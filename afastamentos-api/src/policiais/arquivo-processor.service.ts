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
  private static readonly MAX_TEXTO = 150;

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
      const data = await parser.getText();
      const texto = data.text;
      
      // Extrair dados do PDF (matrícula, nome, função)
      const policiais = this.extrairDadosDoPDF(texto);
      this.validarPoliciaisExtraidos(policiais);
      
      // Mapear e criar funções
      return await this.mapearFuncoes(policiais);
    } catch (error) {
      throw new BadRequestException(`Erro ao processar PDF: ${error instanceof Error ? error.message : 'Erro desconhecido'}`);
    }
  }

  private async processarExcel(buffer: Buffer): Promise<ProcessarArquivoResponseDto> {
    try {
      const workbook = XLSX.read(buffer, { type: 'buffer' });
      const primeiraSheet = workbook.Sheets[workbook.SheetNames[0]];
      const dados = XLSX.utils.sheet_to_json(primeiraSheet, { header: 1, defval: '' }) as string[][];
      
      // Extrair dados do Excel
      const policiais = this.extrairDadosDoExcel(dados);
      this.validarPoliciaisExtraidos(policiais);
      
      // Mapear e criar funções
      return await this.mapearFuncoes(policiais);
    } catch (error) {
      throw new BadRequestException(`Erro ao processar Excel: ${error instanceof Error ? error.message : 'Erro desconhecido'}`);
    }
  }

  private extrairDadosDoPDF(texto: string): Array<{ matricula: string; nome: string; funcaoNome: string }> {
    const policiais: Array<{ matricula: string; nome: string; funcaoNome: string }> = [];
    const matriculaSet = new Set<string>();
    
    // Dividir o texto em linhas
    const linhas = texto.split(/\r?\n/).map(l => l.trim()).filter(l => l.length > 0);
    
    // Procurar pela tabela (procura por "MATRÍCULA" ou "MATRICULA" como cabeçalho)
    let inicioTabela = -1;
    let linhaCabecalho = '';
    for (let i = 0; i < linhas.length; i++) {
      if (linhas[i].toUpperCase().includes('MATRÍCULA') || linhas[i].toUpperCase().includes('MATRICULA')) {
        inicioTabela = i + 1;
        linhaCabecalho = linhas[i];
        break;
      }
    }
    
    if (inicioTabela === -1) {
      throw new BadRequestException('Não foi possível encontrar a tabela de dados no PDF');
    }
    
    // Detectar posições das colunas no cabeçalho
    const cabecalhoUpper = linhaCabecalho.toUpperCase();
    const temCircunstancia = cabecalhoUpper.includes('CIRCUNSTÂNCIA') || cabecalhoUpper.includes('CIRCUNSTANCIA');
    
    // Extrair dados das linhas
    for (let i = inicioTabela; i < linhas.length; i++) {
      const linha = linhas[i];
      
      // Pular linhas vazias ou cabeçalhos
      if (linha.length < 5 || linha.toUpperCase().includes('MATRÍCULA') || linha.toUpperCase().includes('POLICIAL')) {
        continue;
      }
      
      // Se temos a coluna CIRCUNSTÂNCIA, verificar se é "VOLUNTÁRIO"
      if (temCircunstancia) {
        const linhaUpper = linha.toUpperCase();
        // Se contém "VOLUNTÁRIO" ou "VOLUNTARIO", pular esta linha
        if (linhaUpper.includes('VOLUNTÁRIO') || linhaUpper.includes('VOLUNTARIO')) {
          continue;
        }
      }
      
      // Tentar extrair matrícula (geralmente começa com números)
      const matriculaMatch = linha.match(/^(\d{6,9}[X]?)/);
      if (!matriculaMatch) {
        continue;
      }
      
      const matricula = matriculaMatch[1].toUpperCase();
      
      // Remover duplicatas por matrícula (segurança adicional)
      if (matriculaSet.has(matricula)) {
        continue;
      }
      matriculaSet.add(matricula);
      
      // Remover a matrícula e dividir o resto
      const resto = linha.substring(matriculaMatch[0].length).trim();
      
      // Dividir por múltiplos espaços para pegar nome e função
      const partes = resto.split(/\s{2,}/).filter(p => p.trim().length > 0);
      
      if (partes.length < 2) {
        continue;
      }
      
      // O nome geralmente vem antes da função
      // A função geralmente é a última parte ou contém palavras específicas
      const nome = partes[0].trim();
      let funcaoNome = partes.slice(1).join(' ').trim();
      
      // Normalizar função (concatenar "AUXILIAR" se terminar com "-")
      funcaoNome = this.normalizarFuncaoNome(funcaoNome);
      
      if (nome && funcaoNome && matricula) {
        policiais.push({
          matricula: matricula.toUpperCase(),
          nome: nome.toUpperCase(),
          funcaoNome: funcaoNome.toUpperCase(),
        });
      }
    }
    
    return policiais;
  }

  private extrairDadosDoExcel(dados: string[][]): Array<{ matricula: string; nome: string; funcaoNome: string }> {
    const policiais: Array<{ matricula: string; nome: string; funcaoNome: string }> = [];
    const matriculaSet = new Set<string>();
    
    if (dados.length < 2) {
      throw new BadRequestException('Planilha vazia ou sem dados');
    }
    
    // Encontrar linha de cabeçalho
    let linhaCabecalho = -1;
    let colMatricula = -1;
    let colNome = -1;
    let colFuncao = -1;
    let colCircunstancia = -1;
    
    for (let i = 0; i < Math.min(10, dados.length); i++) {
      const linha = dados[i].map(c => String(c || '').toUpperCase());
      
      // Procurar por "MATRÍCULA" ou "MATRICULA"
      const idxMatricula = linha.findIndex(c => c.includes('MATRÍCULA') || c.includes('MATRICULA'));
      const idxNome = linha.findIndex(c => c.includes('POLICIAL') || c.includes('NOME'));
      const idxFuncao = linha.findIndex(c => c.includes('FUNÇÃO') || c.includes('FUNCAO'));
      const idxCircunstancia = linha.findIndex(c => c.includes('CIRCUNSTÂNCIA') || c.includes('CIRCUNSTANCIA'));
      
      if (idxMatricula !== -1) {
        linhaCabecalho = i;
        colMatricula = idxMatricula;
        colNome = idxNome !== -1 ? idxNome : colMatricula + 1;
        colFuncao = idxFuncao !== -1 ? idxFuncao : colMatricula + 2;
        colCircunstancia = idxCircunstancia !== -1 ? idxCircunstancia : -1;
        break;
      }
    }
    
    if (linhaCabecalho === -1 || colMatricula === -1) {
      throw new BadRequestException('Não foi possível encontrar as colunas necessárias (Matrícula, Nome, Função) na planilha');
    }
    
    // Extrair dados
    for (let i = linhaCabecalho + 1; i < dados.length; i++) {
      const linha = dados[i];
      
      // Se temos a coluna CIRCUNSTÂNCIA, verificar se é "VOLUNTÁRIO"
      if (colCircunstancia !== -1) {
        const circunstancia = String(linha[colCircunstancia] || '').trim().toUpperCase();
        if (circunstancia === 'VOLUNTÁRIO' || circunstancia === 'VOLUNTARIO') {
          continue;
        }
      }
      
      const matricula = String(linha[colMatricula] || '').trim().toUpperCase();
      const nome = String(linha[colNome] || '').trim().toUpperCase();
      let funcaoNome = String(linha[colFuncao] || '').trim();
      
      // Normalizar função (concatenar "AUXILIAR" se terminar com "-")
      funcaoNome = this.normalizarFuncaoNome(funcaoNome);
      
      // Converter para uppercase após normalização
      funcaoNome = funcaoNome.toUpperCase();
      
      // Remover duplicatas por matrícula (segurança adicional)
      if (!matricula || matriculaSet.has(matricula)) {
        continue;
      }
      matriculaSet.add(matricula);
      
      if (nome && funcaoNome && matricula) {
        policiais.push({ matricula, nome, funcaoNome });
      }
    }
    
    return policiais;
  }

  private async mapearFuncoes(
    policiais: Array<{ matricula: string; nome: string; funcaoNome: string }>,
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
      });
    }
    
    return {
      policiais: policiaisComFuncaoId,
      funcoesCriadas,
    };
  }
}
