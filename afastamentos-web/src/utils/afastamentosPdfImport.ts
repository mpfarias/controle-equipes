import * as pdfjsLib from 'pdfjs-dist';

/** Worker do pdf.js (Vite + ESM). */
if (typeof window !== 'undefined') {
  pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
    'pdfjs-dist/build/pdf.worker.min.mjs',
    import.meta.url,
  ).href;
}

export type PdfLinhaBruta = {
  linhaTexto: number;
  /** Texto antes do nome completo (POSTO/GRAD); vazio quando veio do parser de 11 colunas. */
  postoGrad: string;
  /** Nome ou bloco POSTO/GRAD + NOME conforme o parser. */
  nome: string;
  inicioBr: string;
  terminoBr: string;
  docSei: string;
  obs: string;
  /** Coluna MAT do PDF (quando o layout de 11 colunas for reconhecido). */
  matriculaPdf?: string;
  quadro?: string;
  equipe?: string;
};

export type PdfPreviewLinha = {
  linhaTexto: number;
  matriculaPdf?: string;
  dataInicioIso: string;
  dataFimIso: string | null;
  seiNumero: string;
  obsOriginal: string;
  motivoMapeadoNome: string;
  /** Somente linhas com OBS contendo "Atestado" (case-insensitive) entram na pré-visualização deste passo. */
  filtroAtestado: boolean;
  status: 'ok' | 'aviso' | 'erro';
  mensagem?: string;
  policialId?: number;
  policialNome?: string;
};

const RE_DATA_BR = /\b(\d{2})\/(\d{2})\/(\d{4})\b/g;

export function dataBrParaIso(dataBr: string): string | null {
  const m = String(dataBr).trim().match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (!m) return null;
  const [, dd, mm, yyyy] = m;
  return `${yyyy}-${mm}-${dd}`;
}

export function normalizarTextoComparacao(s: string): string {
  return String(s)
    .toUpperCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Apenas dígitos, para cruzar MAT do PDF com matrícula do sistema. */
export function normalizarMatriculaDigitos(s: string): string {
  return String(s).replace(/\D/g, '');
}

/**
 * Separa POSTO/GRAD e NOME a partir do bloco único lido do PDF (lista COPOM: patente termina em QPPMC).
 */
export function dividirPostoGradENomeDoBloco(bloco: string): { postoGrad: string; nome: string } {
  const s = bloco.trim();
  if (!s) return { postoGrad: '', nome: '' };
  const m = s.match(/^(.+?\bQPPMC)\s+(.+)$/i);
  if (m) {
    return { postoGrad: m[1]!.trim(), nome: m[2]!.trim() };
  }
  return { postoGrad: '', nome: s };
}

function aplicarSeparacaoPostoGradNomeLinhaBruta(l: PdfLinhaBruta): PdfLinhaBruta {
  const full = [l.postoGrad, l.nome].filter(Boolean).join(' ').trim();
  const { postoGrad, nome } = dividirPostoGradENomeDoBloco(full);
  if (postoGrad) {
    return { ...l, postoGrad, nome };
  }
  return l;
}

/**
 * Só igualdade exata dos dígitos (sem sufixo/prefixo): combinar por "final" gerava
 * correspondência errada (ex.: 732540 em matrícula longa de outro policial).
 */
function encontrarPolicialPorMatriculaPdf(
  policiais: { id: number; nome: string; matricula: string }[],
  matPdfRaw: string | undefined,
): { id: number; nome: string } | null {
  if (!matPdfRaw) return null;
  const digitsPdf = normalizarMatriculaDigitos(matPdfRaw);
  if (!digitsPdf || digitsPdf.length < 4) return null;

  for (const p of policiais) {
    const d = normalizarMatriculaDigitos(p.matricula);
    if (d === digitsPdf) return { id: p.id, nome: p.nome };
  }
  return null;
}

/**
 * Quando o leitor PDF junta MAT + QUADRO (+ ANO + DIAS) na mesma linha do nome.
 */
function sanearLinhaBrutaColagem(l: PdfLinhaBruta): PdfLinhaBruta {
  let nome = l.nome.trim();
  let matriculaPdf = l.matriculaPdf;

  const coladoFull = nome.match(
    /^(.+?)\s+(\d{5,9}|\d{4,9}[Xx])\s+(ATIVO|ASSESSOR|DSA|PTTC)\s+(\d{4})\s+(\d{1,3})\s*$/i,
  );
  if (coladoFull) {
    return {
      ...l,
      nome: coladoFull[1]!.trim(),
      matriculaPdf: matriculaPdf ?? coladoFull[2],
      quadro: l.quadro ?? coladoFull[3],
    };
  }

  const coladoMatQuadro = nome.match(
    /^(.+?)\s+(\d{5,9}|\d{4,9}[Xx])\s+(ATIVO|ASSESSOR|DSA|PTTC)\s*$/i,
  );
  if (coladoMatQuadro && !matriculaPdf) {
    return {
      ...l,
      nome: coladoMatQuadro[1]!.trim(),
      matriculaPdf: coladoMatQuadro[2],
      quadro: l.quadro ?? coladoMatQuadro[3],
    };
  }

  return { ...l, nome, matriculaPdf };
}

/**
 * Layout típico (lista CGP / tabela 11 colunas):
 * POSTO/GRAD + NOME | MAT | QUADRO | ANO | DIAS | INÍCIO | TÉRMINO | DOC. SEI | OBS | EQUIPE
 */
function parsearLinhaTabelaOnzeColunas(linha: string): Omit<PdfLinhaBruta, 'linhaTexto'> | null {
  const datas = [...linha.matchAll(RE_DATA_BR)].map((m) => m[0]);
  if (datas.length < 2) return null;

  const inicioBr = datas[0]!;
  const terminoBr = datas[1]!;
  const idxIni = linha.indexOf(inicioBr);
  const idxTerm = linha.indexOf(terminoBr);
  if (idxIni < 0 || idxTerm < 0) return null;

  const prefix = linha.slice(0, idxIni).trim();
  const suffix = linha.slice(idxTerm + terminoBr.length).trim();

  /** DOC. SEI (só dígitos), OBS (pode ter várias palavras), EQUIPE (último token). */
  const mSuf = suffix.match(/^(\d+)\s+(.+)\s+(\S+)\s*$/);
  if (!mSuf) return null;

  const docSei = mSuf[1] ?? '';
  const obs = (mSuf[2] ?? '').trim();
  const equipe = mSuf[3] ?? '';

  const mPre = prefix.match(
    /^(.+)\s+(\d{5,9}|\d{4,9}[Xx])\s+(\S+)\s+(\d{4})\s+(\d{1,3})\s*$/u,
  );
  if (!mPre) return null;

  const postoENome = (mPre[1] ?? '').trim();
  const { postoGrad, nome } = dividirPostoGradENomeDoBloco(postoENome);
  const matriculaPdf = mPre[2] ?? '';
  const quadro = mPre[3] ?? '';

  return {
    postoGrad,
    nome,
    inicioBr,
    terminoBr,
    docSei,
    obs,
    matriculaPdf,
    quadro,
    equipe,
  };
}

/** Mesma linha da tabela (várias linhas de texto na célula NOME + outras colunas). ~30 pt cobre 3 linhas de nome. */
const PDF_CLUSTER_Y_SPREAD = 30;
/** |Δx| ≤ isso: mesma “faixa” de coluna — ordena top→baixo antes de esquerda→direita. */
const PDF_MESMA_COLUNA_DX = 18;

export async function extrairTextoPdf(buffer: ArrayBuffer): Promise<string> {
  const task = pdfjsLib.getDocument({ data: buffer }).promise;
  const pdf = await task;
  const partes: string[] = [];
  for (let p = 1; p <= pdf.numPages; p++) {
    const page = await pdf.getPage(p);
    const content = await page.getTextContent();
    type Item = { str: string; x: number; y: number };
    const items: Item[] = [];
    for (const raw of content.items) {
      if (!('str' in raw) || !raw.str?.trim()) continue;
      const tr = (raw as { str: string; transform: number[] }).transform;
      if (!tr || tr.length < 6) continue;
      items.push({ str: raw.str.trim(), x: tr[4]!, y: tr[5]! });
    }

    const dedupeGlobal = (arr: Item[]): Item[] => {
      const out: Item[] = [];
      for (const it of arr) {
        const dup = out.some(
          (o) =>
            o.str === it.str && Math.abs(o.x - it.x) < 2.5 && Math.abs(o.y - it.y) < 2.5,
        );
        if (!dup) out.push(it);
      }
      return out;
    };

    const fundirTokensRepetidos = (s: string): string => {
      const parts = s.split(/\s+/).filter(Boolean);
      const out: string[] = [];
      for (const q of parts) {
        if (out.length > 0 && out[out.length - 1] === q) continue;
        out.push(q);
      }
      return out.join(' ').trim();
    };

    /** Dentro do cluster da linha da tabela: colunas por X; na mesma coluna, Y decrescente (topo primeiro). */
    const ordenarItensParaLeituraTabela = (grupo: Item[]): Item[] => {
      return [...grupo].sort((a, b) => {
        if (Math.abs(a.x - b.x) > PDF_MESMA_COLUNA_DX) return a.x - b.x;
        return b.y - a.y;
      });
    };

    const limpos = dedupeGlobal(items);
    limpos.sort((a, b) => b.y - a.y || a.x - b.x);

    const grupos: Item[][] = [];
    for (const it of limpos) {
      if (!grupos.length) {
        grupos.push([it]);
        continue;
      }
      const g = grupos[grupos.length - 1]!;
      const topY = Math.max(...g.map((i) => i.y));
      if (topY - it.y <= PDF_CLUSTER_Y_SPREAD) g.push(it);
      else grupos.push([it]);
    }

    const linhas: string[] = [];
    for (const g of grupos) {
      const ord = ordenarItensParaLeituraTabela(g);
      const texto = fundirTokensRepetidos(
        ord
          .map((i) => i.str)
          .join(' ')
          .replace(/\s+/g, ' ')
          .trim(),
      );
      if (texto) linhas.push(texto);
    }

    if (linhas.length) partes.push(linhas.join('\n'));
  }
  return partes.join('\n\n');
}

const QUADROS_COPOM = new Set(
  ['ATIVO', 'ASSESSOR', 'DSA', 'PTTC', 'COMISSIONADO', 'DESIGNADO', 'COMISIONADO'].map((s) =>
    s.toUpperCase(),
  ),
);

function isFooterLinhaCopom(l: string): boolean {
  if (/^Relação\s+/i.test(l)) return true;
  if (/\bpg\.\s*\d+/i.test(l) && /SEI/i.test(l)) return true;
  return false;
}

function isDataBrLinha(s: string): boolean {
  return /^\d{2}\/\d{2}\/\d{4}$/.test(s.trim());
}

/** Linha de MAT quando a próxima linha é o QUADRO (PDF COPOM em colunas verticais). */
function isMatLinhaCopom(linha: string, proxima: string | undefined): boolean {
  const mat = linha.trim();
  const q = (proxima ?? '').trim().toUpperCase();
  if (!QUADROS_COPOM.has(q)) return false;
  if (/^\d{5,8}$/.test(mat)) return true;
  if (/^\d{4,8}[Xx]$/.test(mat)) return true;
  return false;
}

function isEquipeLinhaCopom(l: string): boolean {
  const t = l.trim().toUpperCase();
  if (!t) return false;
  if (/^[A-E]$/.test(t)) return true;
  if (t === 'EXPEDIENTE' || t === 'MOTORISTA') return true;
  return false;
}

/** Linhas só com dígitos/MAT-X no meio do nome: envia para o fim (antes da MAT+QUADRO). */
function reordenarNomeEMatOrfaos(block: string[]): string[] {
  const orphan: string[] = [];
  const text: string[] = [];
  for (const raw of block) {
    const t = raw.trim();
    if (/^\d{5,8}$/.test(t) || /^\d{4,8}[Xx]$/.test(t)) orphan.push(raw);
    else text.push(raw);
  }
  return [...text, ...orphan];
}

type ParMatQuadroFlex = { matJ: number; nomeEntreMatEQuadro: string[] };

/**
 * MAT e QUADRO nem sempre são linhas consecutivas: pode haver trechos do nome entre elas.
 */
function encontrarParMatQuadroFlexivel(linhas: string[], start: number): ParMatQuadroFlex | null {
  for (let j = start; j < linhas.length; j++) {
    const L = linhas[j]!.trim();
    /** MAT COPOM: 5–8 dígitos ou dígitos+X; 9+ costuma ser SEI / outro nº. */
    if (!(/^\d{5,8}$/.test(L) || /^\d{4,8}[Xx]$/.test(L))) continue;

    const nomeEntre: string[] = [];
    let scan = j + 1;
    while (scan < linhas.length) {
      const raw = linhas[scan]!;
      const u = raw.trim().toUpperCase();
      if (QUADROS_COPOM.has(u)) {
        return { matJ: j, nomeEntreMatEQuadro: nomeEntre };
      }
      if (isDataBrLinha(raw)) break;
      if (/^20\d{2}$/.test(raw.trim())) break;
      if (/^\d+$/.test(raw.trim())) break;
      nomeEntre.push(raw);
      scan++;
    }
  }
  return null;
}

/**
 * Recupera ordem quando o extrator intercala MAT com linhas do nome (celula multilinha).
 * Produz uma linha única "posto + nome" antes de MAT, QUADRO, …, OBS.
 */
function colapsarNomesRegistrosCopom(linhas: string[]): string[] {
  const equipeIdx = linhas.findIndex((l) => /^EQUIPE$/i.test(l.trim()));
  const dataStart = equipeIdx >= 0 ? equipeIdx + 1 : 0;
  const out: string[] = linhas.slice(0, dataStart);
  let i = dataStart;

  while (i < linhas.length) {
    const linha = linhas[i]!;
    if (isFooterLinhaCopom(linha)) {
      out.push(linha);
      i++;
      continue;
    }

    const parFlex = encontrarParMatQuadroFlexivel(linhas, i);
    if (!parFlex) {
      out.push(...linhas.slice(i));
      break;
    }
    const { matJ, nomeEntreMatEQuadro } = parFlex;

    const block = linhas.slice(i, matJ);
    const blockExt = [...block, ...nomeEntreMatEQuadro];
    if (blockExt.length) {
      out.push(reordenarNomeEMatOrfaos(blockExt).join(' '));
    }

    out.push(linhas[matJ]!);
    let k = matJ + 1 + nomeEntreMatEQuadro.length;
    for (let c = 0; c < 7 && k < linhas.length; c++) {
      out.push(linhas[k]!);
      k++;
    }
    while (k < linhas.length && linhas[k]!.trim() === '') {
      out.push(linhas[k]!);
      k++;
    }
    if (k < linhas.length && isEquipeLinhaCopom(linhas[k]!)) {
      out.push(linhas[k]!);
      k++;
    }
    i = k;
  }

  return out;
}

/** Une datas partidas em duas linhas (ex.: "04/" + "02/2026") e normaliza blocos de nome/MAT. */
export function preprocessarLinhasCopomPdf(texto: string): string[] {
  const raw = texto
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0);

  const merged: string[] = [];
  for (let i = 0; i < raw.length; i++) {
    const cur = raw[i]!;
    if (/^\d{2}\/$/.test(cur) && i + 1 < raw.length) {
      const next = raw[i + 1]!;
      if (/^\d{2}\/\d{4}$/.test(next)) {
        merged.push(cur + next);
        i++;
        continue;
      }
    }
    merged.push(cur);
  }

  const mergedColapsado = colapsarNomesRegistrosCopom(merged);

  const splitMatQuadro: string[] = [];
  for (const line of mergedColapsado) {
    const m5 = line.match(
      /^(.+?)\s+(\d{5,9}|\d{4,9}[Xx])\s+(ATIVO|ASSESSOR|DSA|PTTC)\s+(\d{4})\s+(\d{1,3})\s*$/i,
    );
    if (m5) {
      splitMatQuadro.push(
        m5[1]!.trim(),
        m5[2]!,
        m5[3]!,
        m5[4]!,
        m5[5]!,
      );
      continue;
    }
    const m3 = line.match(
      /^(.+?)\s+(\d{5,9}|\d{4,9}[Xx])\s+(ATIVO|ASSESSOR|DSA|PTTC)\s*$/i,
    );
    if (m3) {
      splitMatQuadro.push(m3[1]!.trim(), m3[2]!, m3[3]!);
      continue;
    }
    splitMatQuadro.push(line);
  }

  return splitMatQuadro.filter((l) => !isFooterLinhaCopom(l));
}

/**
 * Parser para PDFs em que cada coluna vira uma linha (extração PyPDF / alguns leitores).
 * Sequência: POSTO+NOME… | MAT | QUADRO | ANO | DIAS | INÍCIO | TÉRMINO | SEI | OBS | [EQUIPE]
 */
function parsearRegistrosCopomPdfMultiLinha(linhas: string[]): PdfLinhaBruta[] {
  const equipeIdx = linhas.findIndex((l) => /^EQUIPE$/i.test(l.trim()));
  let dataStart = 0;
  if (equipeIdx >= 0) dataStart = equipeIdx + 1;
  else {
    const h = linhas.findIndex((l) => /POSTO/i.test(l) && /GRAD/i.test(l) && /NOME/i.test(l));
    dataStart = h >= 0 ? h + 12 : 0;
  }

  const out: PdfLinhaBruta[] = [];
  let lastEnd = dataStart - 1;
  let i = dataStart;

  while (i < linhas.length) {
    if (isFooterLinhaCopom(linhas[i]!)) {
      i++;
      continue;
    }
    if (i < linhas.length - 1 && isMatLinhaCopom(linhas[i]!, linhas[i + 1])) {
      const matIdx = i;
      const mat = linhas[matIdx]!.trim();
      const postoNome = linhas.slice(lastEnd + 1, matIdx).join(' ').trim();
      if (matIdx + 5 >= linhas.length) break;
      const d1 = linhas[matIdx + 4]!.trim();
      const d2 = linhas[matIdx + 5]!.trim();
      if (!isDataBrLinha(d1) || !isDataBrLinha(d2)) {
        i++;
        continue;
      }
      let j = matIdx + 6;
      const sei = linhas[j];
      if (sei === undefined || !/^\d+$/.test(sei.trim())) {
        i++;
        continue;
      }
      j++;
      const obsLinha = linhas[j];
      if (obsLinha === undefined) break;
      const obs = obsLinha.trim();
      j++;
      while (j < linhas.length && linhas[j]!.trim() === '') j++;
      let equipe = '';
      if (j < linhas.length && isEquipeLinhaCopom(linhas[j]!)) {
        equipe = linhas[j]!.trim();
        j++;
      }
      const quadro = linhas[matIdx + 1]!.trim();
      const linhaRef = lastEnd + 2;
      const pgNome = dividirPostoGradENomeDoBloco(postoNome);
      out.push({
        linhaTexto: linhaRef,
        postoGrad: pgNome.postoGrad,
        nome: pgNome.nome,
        inicioBr: d1,
        terminoBr: d2,
        docSei: sei.trim(),
        obs,
        matriculaPdf: mat,
        quadro,
        equipe,
      });
      lastEnd = j - 1;
      i = j;
      continue;
    }
    i++;
  }

  return out;
}

/**
 * Tenta extrair linhas de tabela a partir do texto do PDF.
 * Heurística: após linha de cabeçalho com POSTO/GRAD e NOME, lê linhas com pelo menos duas datas BR.
 */
export function parsearLinhasTabelaAfastamentosPdf(texto: string): PdfLinhaBruta[] {
  const linhasPre = preprocessarLinhasCopomPdf(texto);
  const multi = parsearRegistrosCopomPdfMultiLinha(linhasPre).map(sanearLinhaBrutaColagem);
  if (multi.length > 0) return multi;

  const linhas = texto
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);

  const idxHeader = linhas.findIndex(
    (l) => /POSTO/i.test(l) && /GRAD/i.test(l) && /NOME/i.test(l),
  );
  const inicio = idxHeader >= 0 ? idxHeader + 1 : 0;

  const resultado: PdfLinhaBruta[] = [];

  for (let i = inicio; i < linhas.length; i++) {
    const linha = linhas[i]!;
    if (/^p[aá]gina\s*\d/i.test(linha)) continue;
    if (/^total|^observa/i.test(linha)) break;

    const datas = [...linha.matchAll(RE_DATA_BR)].map((m) => m[0]);
    if (datas.length < 2) continue;

    const parsed11 = parsearLinhaTabelaOnzeColunas(linha);
    if (parsed11) {
      resultado.push({ linhaTexto: i + 1, ...parsed11 });
      continue;
    }

    const primeiroIdx = linha.indexOf(datas[0]!);
    const antes = linha.slice(0, primeiroIdx).trim();
    const colunasAntes = antes.split(/\s{2,}/).map((c) => c.trim()).filter(Boolean);

    let postoGrad = '';
    let nome = '';
    if (colunasAntes.length >= 2) {
      postoGrad = colunasAntes[0] ?? '';
      nome = colunasAntes.slice(1).join(' ');
    } else {
      const tokens = antes.split(/\s+/).filter(Boolean);
      if (tokens.length >= 2) {
        postoGrad = tokens[0] ?? '';
        nome = tokens.slice(1).join(' ');
      } else {
        nome = antes;
      }
    }

    const inicioBr = datas[0]!;
    const terminoBr = datas[1]!;

    let docSei = '';
    let obs = '';

    // Tentar extrair DOC. SEI e OBS com base nas duas datas:
    // ... INÍCIO ... TÉRMINO <SEI> <OBS>
    const trechoDatasEDepois = linha.slice(linha.indexOf(inicioBr));
    const mTail = trechoDatasEDepois.match(
      /(\d{2}\/\d{2}\/\d{4}).*?(\d{2}\/\d{2}\/\d{4})\s+(\S+)\s+(.+)$/,
    );
    if (mTail) {
      docSei = mTail[3] ?? '';
      obs = mTail[4] ?? '';
    } else {
      // Fallback para o caso da regex não bater – mantém heurística anterior baseada em espaçamento.
      const depoisSegundaData = linha.slice(linha.indexOf(terminoBr) + terminoBr.length).trim();
      const partesDepois = depoisSegundaData.split(/\s{2,}/).map((c) => c.trim()).filter(Boolean);

      if (partesDepois.length >= 2) {
        docSei = partesDepois[0] ?? '';
        obs = partesDepois.slice(1).join(' ');
      } else if (partesDepois.length === 1) {
        const unico = partesDepois[0] ?? '';
        if (/^\d/.test(unico) || /\//.test(unico)) {
          docSei = unico;
          obs = '';
        } else {
          obs = unico;
        }
      }
    }

    resultado.push(
      aplicarSeparacaoPostoGradNomeLinhaBruta(
        sanearLinhaBrutaColagem({
          linhaTexto: i + 1,
          postoGrad,
          nome,
          inicioBr,
          terminoBr,
          docSei,
          obs,
        }),
      ),
    );
  }

  return resultado;
}

export function montarPreviewImportacaoPdf(
  linhas: PdfLinhaBruta[],
  policiais: { id: number; nome: string; matricula: string }[],
  motivoDispensaMedicaNome: string | null,
): PdfPreviewLinha[] {
  const motivoNome = motivoDispensaMedicaNome ?? 'Dispensa médica';

  return linhas.map((l) => {
    const di = dataBrParaIso(l.inicioBr);
    const df = dataBrParaIso(l.terminoBr);
    const filtroAtestado = /atestado/i.test(l.obs);

    let status: PdfPreviewLinha['status'] = 'ok';
    let mensagem: string | undefined;

    if (!di) {
      status = 'erro';
      mensagem = 'Data de início inválida ou não reconhecida.';
    } else if (l.inicioBr && l.terminoBr && di && df && df < di) {
      status = 'erro';
      mensagem = 'Data de término anterior à data de início.';
    } else if (!motivoDispensaMedicaNome) {
      status = 'erro';
      mensagem = 'Motivo "Dispensa médica" não encontrado no cadastro de motivos.';
    }

    let policialId: number | undefined;
    let policialNome: string | undefined;

    if (status !== 'erro') {
      const matPdf = l.matriculaPdf?.trim();
      const porMat = encontrarPolicialPorMatriculaPdf(policiais, matPdf);

      if (porMat) {
        policialId = porMat.id;
        policialNome = porMat.nome;
      } else if (matPdf) {
        status = 'aviso';
        mensagem = 'Matrícula do PDF não bate com nenhum cadastro (busca exata por dígitos).';
      } else {
        status = 'aviso';
        mensagem =
          'Sem matrícula reconhecida no PDF. A correspondência com o cadastro é feita somente pela coluna MAT.';
      }
    }

    return {
      linhaTexto: l.linhaTexto,
      matriculaPdf: l.matriculaPdf,
      dataInicioIso: di ?? '',
      dataFimIso: df,
      seiNumero: l.docSei.trim(),
      obsOriginal: l.obs,
      motivoMapeadoNome: motivoNome,
      filtroAtestado,
      status,
      mensagem,
      policialId,
      policialNome,
    };
  });
}
