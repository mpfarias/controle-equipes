import { Injectable, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
// eslint-disable-next-line @typescript-eslint/no-require-imports
const pdfParseLib = require('pdf-parse');
import * as XLSX from 'xlsx';
import type { PolicialExtraido, ProcessarArquivoResponseDto } from './dto/processar-arquivo-response.dto';

// Extrair a classe/função correta do pdf-parse
const PDFParseClass = pdfParseLib.PDFParse || pdfParseLib.default || pdfParseLib;

@Injectable()
export class ArquivoProcessorService {
  constructor(private readonly prisma: PrismaService) {}

  private static readonly MAX_POLICIAIS = 2000;
  private static readonly MAX_TEXTO = 250;

  /**
   * Normaliza o nome da função: se terminar com "-", concatena "AUXILIAR"
   */
  private normalizarFuncaoNome(funcaoNome: string): string {
    const trimmed = funcaoNome.trim();
    if (trimmed.endsWith('-')) {
      return `${trimmed} AUXILIAR`;
    }
    return trimmed;
  }

  async processarArquivo(file: Express.Multer.File): Promise<ProcessarArquivoResponseDto> {
    const fileName = file.originalname.toLowerCase();
    
    if (fileName.endsWith('.pdf')) {
      return this.processarPDF(file.buffer);
    } else if (fileName.endsWith('.xlsx') || fileName.endsWith('.xls')) {
      return this.processarExcel(file.buffer);
    } else {
      throw new BadRequestException('Formato de arquivo não suportado. Use PDF ou Excel (.xlsx, .xls)');
    }
  }

  private isMatriculaValida(matricula: string): boolean {
    const cleaned = matricula.trim().toUpperCase();
    if (!cleaned || cleaned.length > 10) {
      return false;
    }
    return /^[0-9X]+$/.test(cleaned);
  }

  private validarPoliciaisExtraidos(
    policiais: Array<{ matricula: string; nome: string; funcaoNome: string }>,
  ): void {
    if (!policiais.length) {
      throw new BadRequestException('Nenhum registro válido encontrado no arquivo.');
    }

    if (policiais.length > ArquivoProcessorService.MAX_POLICIAIS) {
      throw new BadRequestException(
        `Arquivo muito grande. Limite de ${ArquivoProcessorService.MAX_POLICIAIS} registros.`,
      );
    }

    const invalidos = policiais.filter((policial) => {
      if (!this.isMatriculaValida(policial.matricula)) {
        return true;
      }
      if (!policial.nome || policial.nome.length > ArquivoProcessorService.MAX_TEXTO) {
        return true;
      }
      if (!policial.funcaoNome || policial.funcaoNome.length > ArquivoProcessorService.MAX_TEXTO) {
        return true;
      }
      return false;
    });

    if (invalidos.length > 0) {
      throw new BadRequestException(
        `Foram encontrados ${invalidos.length} registros inválidos. Verifique matrícula, nome e função.`,
      );
    }
  }

  private async processarPDF(buffer: Buffer): Promise<ProcessarArquivoResponseDto> {
    try {
      const parser = new PDFParseClass({ data: buffer });
      // Garantir todas as páginas: usar getText() sem limite e, se o resultado tiver .pages, concatenar todas.
      const data = await parser.getText();
      const texto =
        data.pages && Array.isArray(data.pages) && data.pages.length > 0
          ? data.pages.map((p: { num: number; text: string }) => p.text).join('\n')
          : (data.text ?? '');
      if (typeof parser.destroy === 'function') await (parser as { destroy: () => Promise<void> }).destroy();
      
      let policiais = this.extrairDadosDoPDF(texto);
      // Se pelo texto obtivemos poucos registros, tentar getTable() (tabelas detectadas pelo PDF)
      if (policiais.length < 50) {
        try {
          const parser2 = new PDFParseClass({ data: buffer });
          const tableResult = await parser2.getTable();
          if (typeof parser2.destroy === 'function') await (parser2 as { destroy: () => Promise<void> }).destroy();
          const fromTable = this.extrairDadosDeTabelaPDF(tableResult);
          if (fromTable.length > policiais.length) policiais = fromTable;
        } catch {
          // Ignora falha do getTable e mantém o resultado do getText
        }
      }
      this.validarPoliciaisExtraidos(policiais);
      return await this.mapearFuncoes(policiais);
    } catch (error) {
      throw new BadRequestException(`Erro ao processar PDF: ${error instanceof Error ? error.message : 'Erro desconhecido'}`);
    }
  }

  /**
   * Monta array de linhas a partir de todas as células da planilha (ignora !ref que às vezes vem truncado).
   */
  private sheetToArray(sheet: Record<string, unknown>): string[][] {
    const cellRegex = /^[A-Z]+[0-9]+$/;
    const keys = Object.keys(sheet).filter((k) => cellRegex.test(k));
    if (keys.length === 0) return [];
    let maxR = 0;
    let maxC = 0;
    for (const k of keys) {
      const addr = XLSX.utils.decode_cell(k);
      maxR = Math.max(maxR, addr.r);
      maxC = Math.max(maxC, addr.c);
    }
    const dados: string[][] = [];
    for (let r = 0; r <= maxR; r++) {
      const row: string[] = [];
      for (let c = 0; c <= maxC; c++) {
        const key = XLSX.utils.encode_cell({ r, c });
        const val = sheet[key];
        const cell = val && typeof (val as { v?: unknown }).v !== 'undefined' ? (val as { v: unknown }).v : val;
        row.push(cell != null ? String(cell) : '');
      }
      dados.push(row);
    }
    return dados;
  }

  private async processarExcel(buffer: Buffer): Promise<ProcessarArquivoResponseDto> {
    try {
      const workbook = XLSX.read(buffer, { type: 'buffer' });
      const sheetNames = workbook.SheetNames || [];
      if (sheetNames.length === 0) throw new BadRequestException('Nenhuma planilha no arquivo');
      let dados: string[][] = [];
      for (const name of sheetNames) {
        const sheet = workbook.Sheets[name] as Record<string, unknown> | undefined;
        if (!sheet) continue;
        const rows = this.sheetToArray(sheet);
        if (rows.length === 0) continue;
        if (dados.length === 0) {
          dados = rows;
        } else {
          const isHeader = (row: string[]) =>
            row.some((c) => String(c || '').toUpperCase().includes('NOME') || String(c || '').toUpperCase().includes('MAT'));
          for (let i = 0; i < rows.length; i++) {
            if (i === 0 && isHeader(rows[0])) continue;
            dados.push(rows[i]);
          }
        }
      }
      const policiais = this.extrairDadosDoExcel(dados);
      this.validarPoliciaisExtraidos(policiais);
      
      // Mapear e criar funções
      return await this.mapearFuncoes(policiais);
    } catch (error) {
      throw new BadRequestException(`Erro ao processar Excel: ${error instanceof Error ? error.message : 'Erro desconhecido'}`);
    }
  }

  /** Valores da coluna situação/Status no PDF (podem vir como "situação" ou "Status"). ASSESSOR = COMISSIONADO. */
  private static readonly SITUACAO_VALORES = ['ATIVO', 'PTTC', 'ASSESSOR', 'DESIGNADO'] as const;

  /** Ignora linhas de quebra de página (ex.: "-- 1 of 8 --"). */
  private isLinhaQuebraPagina(linha: string): boolean {
    return /--\s*\d+\s+of\s+\d+\s*--/i.test(linha.trim());
  }

  /** Indica se a linha inicia um novo registro (POSTO/GRAD no início). */
  private isInicioRegistro(linha: string): boolean {
    const t = linha.trim();
    if (!t.length) return false;
    return (
      /^(TC|MAJ|CAP|ST|CB|SD|CIVIL)\s/i.test(t) ||
      /^[123]º\s/i.test(t) ||
      /^1\s+TEN\s/i.test(t) ||
      /^2\s+TEN\s/i.test(t)
    );
  }

  private static readonly STATUS_MAP: Record<string, 'ATIVO' | 'COMISSIONADO' | 'PTTC' | 'DESIGNADO'> = {
    ATIVO: 'ATIVO',
    PTTC: 'PTTC',
    ASSESSOR: 'COMISSIONADO',
    DESIGNADO: 'DESIGNADO',
  };

  private extrairDadosDoPDF(
    texto: string,
  ): Array<{ matricula: string; nome: string; funcaoNome: string; status?: 'ATIVO' | 'COMISSIONADO' | 'PTTC' | 'DESIGNADO' }> {
    const policiais: Array<{
      matricula: string;
      nome: string;
      funcaoNome: string;
      status?: 'ATIVO' | 'COMISSIONADO' | 'PTTC' | 'DESIGNADO';
    }> = [];
    const matriculaSet = new Set<string>();
    
    const linhas = texto
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter((l) => l.length > 0 && !this.isLinhaQuebraPagina(l));
    
    // Tabela: "MATRÍCULA"/"MATRICULA" ou colunas NOME + MAT (POSTO/GRAD, NOME, MAT, Mat GDF, situação/Status, etc.)
    let inicioTabela = -1;
    let linhaCabecalho = '';
    let formatoAlternativo = false;
    for (let i = 0; i < linhas.length; i++) {
      const upper = linhas[i].toUpperCase();
      if (upper.includes('MATRÍCULA') || upper.includes('MATRICULA')) {
        inicioTabela = i + 1;
        linhaCabecalho = linhas[i];
        break;
      }
      if (upper.includes('NOME') && (/\bMAT\b/.test(upper) || upper.includes(' MAT '))) {
        inicioTabela = i + 1;
        linhaCabecalho = linhas[i];
        formatoAlternativo = true;
        break;
      }
    }
    
    if (inicioTabela === -1) {
      throw new BadRequestException('Não foi possível encontrar a tabela de dados no PDF');
    }
    
    const cabecalhoUpper = linhaCabecalho.toUpperCase();
    const temCircunstancia = cabecalhoUpper.includes('CIRCUNSTÂNCIA') || cabecalhoUpper.includes('CIRCUNSTANCIA');
    
    // Formato alternativo: cada linha do PDF tem exatamente uma palavra de situação (ATIVO, PTTC, ASSESSOR, DESIGNADO).
    // Dividir o bloco por essas palavras gera um segmento por policial, independente de quebras de linha ou POSTO/GRAD.
    if (formatoAlternativo) {
      const bloco = linhas
        .slice(inicioTabela)
        .filter((l) => !this.isLinhaQuebraPagina(l) && l.length > 0)
        .join(' ');
      const regexSituacao = /\s+(ATIVO|PTTC|ASSESSOR|DESIGNADO)(?=\s|$)/gi;
      const partes: string[] = [];
      let lastIndex = 0;
      let m: RegExpExecArray | null;
      const re = new RegExp(regexSituacao.source, 'gi');
      while ((m = re.exec(bloco)) !== null) {
        partes.push(bloco.slice(lastIndex, m.index).trim());
        partes.push(m[1].toUpperCase());
        lastIndex = re.lastIndex;
      }
      if (lastIndex < bloco.length) partes.push(bloco.slice(lastIndex).trim());
      for (let i = 0; i < partes.length; i += 2) {
        const segmento = partes[i];
        const situacaoRaw = partes[i + 1];
        if (!segmento || segmento.length < 5) continue;
        let limpo = segmento;
        if (i === 0) {
          const primeiroPosto = limpo.match(/\s(TC|MAJ|CAP|ST|CB|SD|CIVIL)\s|[123][ºo°.]?\s*SGT\s|[12]\s+TEN\s/i);
          if (primeiroPosto && primeiroPosto.index != null) limpo = limpo.slice(primeiroPosto.index).trim();
        } else {
          limpo = limpo.replace(/^\s*(\d{1,2}\/\d{1,2}\/\d{2,4})?\s*(\d{10,11})?\s*/, '').trim();
        }
        const tokens = limpo.split(/\s+/).filter((p) => p.length > 0);
        const idxUltimaMat = tokens.map((p, idx) => (/^\d{4,10}[Xx]?$/.test(p) ? idx : -1)).filter((idx) => idx >= 0).pop();
        if (idxUltimaMat == null || idxUltimaMat < 1) continue;
        const matricula = tokens[idxUltimaMat].toUpperCase();
        if (matriculaSet.has(matricula) || !this.isMatriculaValida(matricula)) continue;
        matriculaSet.add(matricula);
        const nome = tokens.slice(0, idxUltimaMat).join(' ').trim();
        if (!nome) continue;
        const status: 'ATIVO' | 'COMISSIONADO' | 'PTTC' | 'DESIGNADO' =
          (situacaoRaw && ArquivoProcessorService.STATUS_MAP[situacaoRaw]) || 'ATIVO';
        policiais.push({
          matricula,
          nome: nome.toUpperCase(),
          funcaoNome: 'NÃO INFORMADO',
          status,
        });
      }
    } else {
      for (let i = inicioTabela; i < linhas.length; i++) {
        const linha = linhas[i];
        if (linha.length < 3) continue;
        if (linha.toUpperCase().includes('MATRÍCULA') || linha.toUpperCase().includes('POLICIAL')) continue;
        if (temCircunstancia && (linha.toUpperCase().includes('VOLUNTÁRIO') || linha.toUpperCase().includes('VOLUNTARIO'))) continue;
        const matriculaMatch = linha.match(/^(\d{6,9}[X]?)/);
        if (!matriculaMatch) continue;
        const matricula = matriculaMatch[1].toUpperCase();
        if (matriculaSet.has(matricula)) continue;
        matriculaSet.add(matricula);
        const resto = linha.substring(matriculaMatch[0].length).trim();
        const partesResto = resto.split(/\s{2,}/).filter((p) => p.trim().length > 0);
        if (partesResto.length < 2) continue;
        const nome = partesResto[0].trim();
        let funcaoNome = partesResto.slice(1).join(' ').trim();
        funcaoNome = this.normalizarFuncaoNome(funcaoNome);
        if (nome && funcaoNome && matricula) {
          policiais.push({
            matricula,
            nome: nome.toUpperCase(),
            funcaoNome: funcaoNome.toUpperCase(),
          });
        }
      }
    }
    return policiais;
  }

  /**
   * Extrai policiais a partir do resultado de getTable() do pdf-parse (formato POSTO/GRAD, NOME, MAT, situação).
   */
  private extrairDadosDeTabelaPDF(
    tableResult: { pages?: Array<{ num: number; tables: Array<Array<Array<string>>> }>; mergedTables?: Array<Array<Array<string>>> },
  ): Array<{ matricula: string; nome: string; funcaoNome: string; status?: 'ATIVO' | 'COMISSIONADO' | 'PTTC' | 'DESIGNADO' }> {
    const policiais: Array<{ matricula: string; nome: string; funcaoNome: string; status?: 'ATIVO' | 'COMISSIONADO' | 'PTTC' | 'DESIGNADO' }> = [];
    const matriculaSet = new Set<string>();
    const allTables: Array<Array<Array<string>>> = [];
    if (tableResult.mergedTables && tableResult.mergedTables.length > 0) {
      allTables.push(...tableResult.mergedTables);
    }
    if (tableResult.pages) {
      for (const page of tableResult.pages) {
        if (page.tables && page.tables.length > 0) allTables.push(...page.tables);
      }
    }
    for (const table of allTables) {
      if (!table || table.length < 2) continue;
      const headerRow = table[0].map((c) => String(c || '').toUpperCase());
      const colNome = headerRow.findIndex((c) => c.includes('NOME'));
      const colMat = headerRow.findIndex((c) => c.includes('MAT'));
      const colSituacao = headerRow.findIndex((c) => c.includes('SITUA') || c.includes('STATUS'));
      const colPosto = headerRow.findIndex((c) => c.includes('POSTO') || c.includes('GRAD'));
      if (colMat === -1 || colNome === -1) continue;
      const idxMat = colMat;
      const idxNome = colNome;
      const idxSituacao = colSituacao >= 0 ? colSituacao : -1;
      for (let r = 1; r < table.length; r++) {
        const row = table[r];
        const matricula = String(row[idxMat] ?? '').trim().replace(/\s/g, '').toUpperCase();
        if (!matricula || !/^\d{4,10}[Xx]?$/.test(matricula) || matriculaSet.has(matricula)) continue;
        matriculaSet.add(matricula);
        const posto = colPosto >= 0 ? String(row[colPosto] ?? '').trim() : '';
        const nome = (posto ? posto + ' ' : '') + String(row[idxNome] ?? '').trim();
        if (!nome) continue;
        let situacaoRaw = idxSituacao >= 0 ? String(row[idxSituacao] ?? '').trim().toUpperCase() : '';
        const status: 'ATIVO' | 'COMISSIONADO' | 'PTTC' | 'DESIGNADO' =
          (situacaoRaw && ArquivoProcessorService.STATUS_MAP[situacaoRaw]) || 'ATIVO';
        policiais.push({
          matricula,
          nome: nome.toUpperCase(),
          funcaoNome: 'NÃO INFORMADO',
          status,
        });
      }
    }
    return policiais;
  }

  private extrairDadosDoExcel(
    dados: string[][],
  ): Array<{ matricula: string; nome: string; funcaoNome: string; status?: 'ATIVO' | 'COMISSIONADO' | 'PTTC' | 'DESIGNADO' }> {
    const policiais: Array<{
      matricula: string;
      nome: string;
      funcaoNome: string;
      status?: 'ATIVO' | 'COMISSIONADO' | 'PTTC' | 'DESIGNADO';
    }> = [];
    const matriculaSet = new Set<string>();

    if (dados.length < 2) {
      throw new BadRequestException('Planilha vazia ou sem dados');
    }

    let linhaCabecalho = -1;
    let colMatricula = -1;
    let colNome = -1;
    let colFuncao = -1;
    let colCircunstancia = -1;
    let colPosto = -1;
    let colSituacao = -1;
    let formatoAlternativo = false;

    for (let i = 0; i < Math.min(10, dados.length); i++) {
      const linha = dados[i].map((c) => String(c || '').toUpperCase());

      const idxMatricula = linha.findIndex((c) => c.includes('MATRÍCULA') || c.includes('MATRICULA'));
      const idxNome = linha.findIndex((c) => c.includes('POLICIAL') || c.includes('NOME'));
      const idxFuncao = linha.findIndex((c) => c.includes('FUNÇÃO') || c.includes('FUNCAO'));
      const idxCircunstancia = linha.findIndex((c) => c.includes('CIRCUNSTÂNCIA') || c.includes('CIRCUNSTANCIA'));
      const idxMat = linha.findIndex((c) => c.trim() === 'MAT' || c.includes('MAT'));
      const idxPosto = linha.findIndex((c) => c.includes('POSTO') || c.includes('GRAD'));
      const idxSituacao = linha.findIndex((c) => c.includes('SITUA') || c.includes('STATUS'));

      if (idxMatricula !== -1) {
        linhaCabecalho = i;
        colMatricula = idxMatricula;
        colNome = idxNome !== -1 ? idxNome : colMatricula + 1;
        colFuncao = idxFuncao !== -1 ? idxFuncao : colMatricula + 2;
        colCircunstancia = idxCircunstancia !== -1 ? idxCircunstancia : -1;
        break;
      }
      if (idxNome !== -1 && (idxMat !== -1 || idxMatricula !== -1)) {
        linhaCabecalho = i;
        formatoAlternativo = true;
        colNome = idxNome;
        colMatricula = idxMat !== -1 ? idxMat : idxMatricula;
        colPosto = idxPosto !== -1 ? idxPosto : -1;
        colSituacao = idxSituacao !== -1 ? idxSituacao : -1;
        colFuncao = -1;
        colCircunstancia = -1;
        break;
      }
    }

    if (linhaCabecalho === -1 || colMatricula === -1 || colNome === -1) {
      throw new BadRequestException(
        'Não foi possível encontrar as colunas necessárias. Use formato com colunas Matrícula/MAT, Nome e (quando não for o formato COPOM) Função, ou formato COPOM: POSTO/GRAD, NOME, MAT, situação/Status.',
      );
    }

    for (let i = linhaCabecalho + 1; i < dados.length; i++) {
      const linha = dados[i];

      if (colCircunstancia !== -1) {
        const circunstancia = String(linha[colCircunstancia] || '').trim().toUpperCase();
        if (circunstancia === 'VOLUNTÁRIO' || circunstancia === 'VOLUNTARIO') continue;
      }

      let matricula = String(linha[colMatricula] ?? '')
        .trim()
        .replace(/\s/g, '')
        .toUpperCase();
      if (!matricula || !/^[0-9X]+$/.test(matricula) || matricula.length > 10) continue;
      if (matriculaSet.has(matricula)) continue;
      matriculaSet.add(matricula);

      if (formatoAlternativo) {
        const posto = colPosto >= 0 ? String(linha[colPosto] ?? '').trim() : '';
        const nome = (posto ? posto + ' ' : '') + String(linha[colNome] ?? '').trim();
        if (!nome) continue;
        const situacaoRaw =
          colSituacao >= 0 ? String(linha[colSituacao] ?? '').trim().toUpperCase() : '';
        const status: 'ATIVO' | 'COMISSIONADO' | 'PTTC' | 'DESIGNADO' =
          (situacaoRaw && ArquivoProcessorService.STATUS_MAP[situacaoRaw]) || 'ATIVO';
        policiais.push({
          matricula,
          nome: nome.toUpperCase(),
          funcaoNome: 'NÃO INFORMADO',
          status,
        });
      } else {
        const nome = String(linha[colNome] || '').trim().toUpperCase();
        let funcaoNome = colFuncao >= 0 ? String(linha[colFuncao] || '').trim() : '';
        funcaoNome = this.normalizarFuncaoNome(funcaoNome).toUpperCase();
        if (nome && funcaoNome) {
          policiais.push({ matricula, nome, funcaoNome });
        }
      }
    }

    return policiais;
  }

  private async mapearFuncoes(
    policiais: Array<{ matricula: string; nome: string; funcaoNome: string; status?: 'ATIVO' | 'COMISSIONADO' | 'PTTC' | 'DESIGNADO' }>,
  ): Promise<ProcessarArquivoResponseDto> {
    const funcoesCriadas: string[] = [];
    const policiaisComFuncaoId: PolicialExtraido[] = [];
    
    // Buscar todas as matrículas já cadastradas no banco
    const policiaisExistentes = await this.prisma.policial.findMany({
      select: { matricula: true },
    });
    const matriculasExistentes = new Set(
      policiaisExistentes.map(p => p.matricula.toUpperCase())
    );
    
    // Filtrar policiais que já existem no banco
    const policiaisNovos = policiais.filter(
      policial => !matriculasExistentes.has(policial.matricula.toUpperCase())
    );
    
    // Buscar todas as funções existentes
    const funcoesExistentes = await this.prisma.funcao.findMany({
      select: { id: true, nome: true },
    });
    
    const mapaFuncoes = new Map<string, number>();
    funcoesExistentes.forEach(f => {
      mapaFuncoes.set(f.nome.toUpperCase(), f.id);
    });
    
    // Processar cada policial
    for (const policial of policiaisNovos) {
      const funcaoNomeUpper = policial.funcaoNome.toUpperCase();
      
      // Tentar encontrar função existente (busca exata)
      let funcaoId = mapaFuncoes.get(funcaoNomeUpper);
      
      // Se não encontrou, criar nova função
      if (!funcaoId) {
        try {
          const novaFuncao = await this.prisma.funcao.create({
            data: {
              nome: policial.funcaoNome,
              descricao: null,
            },
          });
          
          funcaoId = novaFuncao.id;
          mapaFuncoes.set(funcaoNomeUpper, funcaoId);
          
          if (!funcoesCriadas.includes(policial.funcaoNome)) {
            funcoesCriadas.push(policial.funcaoNome);
          }
        } catch (error) {
          // Se der erro (pode ser duplicado por concorrência), tentar buscar novamente
          const funcaoExistente = await this.prisma.funcao.findUnique({
            where: { nome: policial.funcaoNome },
            select: { id: true },
          });
          
          if (funcaoExistente) {
            funcaoId = funcaoExistente.id;
            mapaFuncoes.set(funcaoNomeUpper, funcaoId);
          }
        }
      }
      
      policiaisComFuncaoId.push({
        matricula: policial.matricula,
        nome: policial.nome,
        funcaoNome: policial.funcaoNome,
        funcaoId,
        ...(policial.status != null && { status: policial.status }),
      });
    }
    
    return {
      policiais: policiaisComFuncaoId,
      funcoesCriadas,
    };
  }
}
