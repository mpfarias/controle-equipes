import { getExpedienteHorario } from '../constants/svgRegras';
import type { EscalaGeradaDraftPayload, LinhaEscalaGeradaDraft } from './gerarEscalasCalculo';
import { formatarDataBr } from './gerarEscalasCalculo';
import { relogioParaLabel } from './expedienteEscalaRegras';
import { formatarMatriculaExibicao } from './inputUtils';
import {
  ORDEM_BLOCOS_IMPRESSAO,
  tituloBlocoEscalaComLinhas,
  normalizarBlocoEscalaImpressao,
  type BlocoEscalaId,
  type EscalaCabecalhoFormulario,
} from './escalaBlocos';

export const ESCALA_GERADA_SALVAR_MESSAGE = 'escala-gerada-salvar';

function escHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function escHtmlMultiline(s: string): string {
  return escHtml(s).replace(/\n/g, '<br/>');
}

function cel(cab: string | undefined): string {
  return escHtml((cab ?? '').trim() || '—');
}

function parseDataEscalaLocal(dataIso: string): Date | null {
  const [y, m, d] = dataIso.split('-').map(Number);
  if (!y || !m || !d) return null;
  return new Date(y, m - 1, d);
}

/** Coluna HORÁRIO da 1ª linha: só o horário aplicável à data da escala (sem menção a dias da semana). */
function horarioCabecalhoBlocoImpressao(blocoId: BlocoEscalaId, dataIso: string): string {
  const id = normalizarBlocoEscalaImpressao(blocoId);
  const dataRef = parseDataEscalaLocal(dataIso);
  const exp = dataRef ? getExpedienteHorario(dataRef) : null;
  const horarioOrgaoNoDia = exp ? relogioParaLabel(exp.inicio, exp.fim) : '—';

  switch (id) {
    case 'EXP_13_19_SEG_SEX':
      return horarioOrgaoNoDia;
    case 'EXP_DIFERENCIADO':
      return '—';
    case 'EXP_ALT_SEMANAL_07':
      if (!dataRef || !exp) return '—';
      return '07h às 19h';
    case 'EXP_07_13':
      return '07h às 13h';
    case 'EQUIPE_DIURNA_07':
      return '07h às 19h';
    case 'EQUIPE_NOTURNA_19_07':
      return '19h às 07h';
    case 'MOTORISTAS':
      return '07h às 07h';
    case 'SVG_10_18':
      return '10h às 18h';
    case 'SVG_15_23':
      return '15h às 23h';
    case 'SVG_20_04':
      return '20h às 04h';
    case 'AFASTADOS':
      return '—';
    default:
      return horarioOrgaoNoDia;
  }
}

/** Remove prefixo "[Operacional] " etc. do horário combinado na impressão. */
function horarioLinhaExibir(horarioServico: string): string {
  return horarioServico.replace(/^\[[^\]]+\]\s*/u, '').trim();
}

function linhasCorpoPoliciais(rows: LinhaEscalaGeradaDraft[], blocoNorm: BlocoEscalaId): string {
  if (rows.length === 0) {
    return `<tr><td colspan="6" class="muted">(Nenhum policial neste bloco.)</td></tr>`;
  }
  const mostrarHorarioLinha = blocoNorm === 'EXP_DIFERENCIADO';
  return rows
    .map((r) => {
      const horCell = mostrarHorarioLinha ? escHtml(horarioLinhaExibir(r.horarioServico)) : '';
      const afastExtra =
        r.detalheAfastamento && r.lista === 'AFASTADO'
          ? ` <span class="muted">(${escHtml(r.detalheAfastamento)})</span>`
          : '';
      const matEx = formatarMatriculaExibicao(r.matricula) || '—';
      const nomeHtml = `${escHtml(r.nome)}${afastExtra}`;
      if (mostrarHorarioLinha) {
        return `<tr class="linha-policial">
      <td class="cel-matricula">${escHtml(matEx)}</td>
      <td class="cel-policial" colspan="2">${nomeHtml}</td>
      <td class="cel-horario-linha">${horCell}</td>
      <td class="cel-funcao">${escHtml(r.funcaoNome ?? '—')}</td>
      <td></td>
    </tr>`;
      }
      return `<tr class="linha-policial">
      <td class="cel-matricula">${escHtml(matEx)}</td>
      <td class="cel-policial" colspan="3">${nomeHtml}</td>
      <td class="cel-funcao">${escHtml(r.funcaoNome ?? '—')}</td>
      <td></td>
    </tr>`;
    })
    .join('');
}

function cabecalhoBlocoNoDraft(
  draft: EscalaGeradaDraftPayload,
  blocoId: BlocoEscalaId,
): Partial<EscalaCabecalhoFormulario> {
  const por = draft.cabecalhoPorBloco;
  if (por?.[blocoId]) return por[blocoId] as EscalaCabecalhoFormulario;
  if (blocoId === 'EXP_13_19_SEG_SEX' && por?.EXP_13_19_ORG) {
    return por.EXP_13_19_ORG as EscalaCabecalhoFormulario;
  }
  return draft.cabecalhoFormulario ?? {};
}

function montarTabelaBloco(
  draft: EscalaGeradaDraftPayload,
  dataEscalaCab: string,
  blocoId: BlocoEscalaId,
  tituloBloco: string,
  corpoLinhas: string,
): string {
  const cab = cabecalhoBlocoNoDraft(draft, blocoId);
  const horarioCab = horarioCabecalhoBlocoImpressao(blocoId, draft.dataEscala);
  const obs = cab.observacoes ?? '';
  const norm = normalizarBlocoEscalaImpressao(blocoId);
  const subthHtml =
    norm === 'EXP_DIFERENCIADO'
      ? `<tr class="subth">
        <th>MATRÍCULA</th><th colspan="2">POLICIAL</th><th>HORÁRIO</th><th>FUNÇÃO</th><th></th>
      </tr>`
      : `<tr class="subth">
        <th>MATRÍCULA</th><th colspan="3">POLICIAL</th><th>FUNÇÃO</th><th></th>
      </tr>`;

  return `<section class="bloco-escala">
  <h2 class="titulo-bloco">${escHtml(tituloBloco)}</h2>
  <table class="escala-bloco">
    <colgroup>
      <col class="col-upm-mat"/>
      <col class="col-data-nome"/>
      <col class="col-hor"/>
      <col class="col-tipo"/>
      <col class="col-circ-func"/>
      <col class="col-esp"/>
    </colgroup>
    <thead>
      <tr><th>UPM</th><th>DATA</th><th>HORÁRIO</th><th>TIPO</th><th>CIRCUNSTÂNCIA</th><th>ESPECIALIDADE</th></tr>
    </thead>
    <tbody>
      <tr class="cab-valores">
        <td>COPOM</td>
        <td class="cel-data-cab">${escHtml(dataEscalaCab)}</td>
        <td>${escHtml(horarioCab)}</td>
        <td>${cel(cab.tipo)}</td>
        <td>${cel(cab.circunstancia)}</td>
        <td>${cel(cab.especialidade)}</td>
      </tr>
      ${subthHtml}
      ${corpoLinhas}
      <tr class="obs">
        <td colspan="6">
          <strong>OBSERVAÇÕES</strong>
          <div class="obs-conteudo">${obs.trim() ? escHtmlMultiline(obs) : '—'}</div>
        </td>
      </tr>
    </tbody>
  </table>
</section>`;
}

export type BuildEscalaGeradaPrintOptions = {
  assetsBaseUrl?: string;
};

export function buildEscalaGeradaPrintHtml(
  draft: EscalaGeradaDraftPayload,
  opts?: BuildEscalaGeradaPrintOptions,
): string {
  const disp = draft.linhas.filter((l) => l.lista === 'DISPONIVEL');
  const afast = draft.linhas.filter((l) => l.lista === 'AFASTADO');
  const dataEscalaCab = formatarDataBr(draft.dataEscala);

  const porBloco = new Map<BlocoEscalaId, LinhaEscalaGeradaDraft[]>();
  for (const id of ORDEM_BLOCOS_IMPRESSAO) {
    porBloco.set(id, []);
  }
  for (const l of disp) {
    const raw = (l.blocoEscala ?? 'EXP_DIFERENCIADO') as BlocoEscalaId;
    const id = normalizarBlocoEscalaImpressao(raw);
    const arr = porBloco.get(id);
    if (arr) arr.push(l);
    else porBloco.set(id, [l]);
  }

  const secoesBlocos: string[] = [];
  for (const id of ORDEM_BLOCOS_IMPRESSAO) {
    const rows = porBloco.get(id) ?? [];
    if (rows.length === 0) continue;

    const titulo = tituloBlocoEscalaComLinhas(id, rows);
    const blocoNorm = normalizarBlocoEscalaImpressao(id);
    const corpo = linhasCorpoPoliciais(rows, blocoNorm);
    secoesBlocos.push(montarTabelaBloco(draft, dataEscalaCab, id, titulo, corpo));
  }

  const secAfast =
    afast.length > 0
      ? montarTabelaBloco(
          draft,
          dataEscalaCab,
          'AFASTADOS',
          tituloBlocoEscalaComLinhas('AFASTADOS', afast),
          linhasCorpoPoliciais(afast, 'AFASTADOS'),
        )
      : '';

  const base = (opts?.assetsBaseUrl ?? '').replace(/\/$/, '');
  const urlPmdf = base ? `${base}/pmdf.png` : '/pmdf.png';
  const urlGdf = base ? `${base}/gdf.jpeg` : '/gdf.jpeg';

  /** Evita fechar a tag &lt;script&gt; se algum texto contiver "&lt;/script". */
  const payloadLiteral = JSON.stringify(draft).replace(/<\//g, '<\\/');

  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="utf-8"/>
<title>Escala definitiva — ${escHtml(formatarDataBr(draft.dataEscala))}</title>
<style>
  html { height: 100%; }
  body {
    font-family: system-ui, sans-serif;
    margin: 0;
    min-height: 100vh;
    display: flex;
    flex-direction: column;
    color: #111;
    font-size: 0.82rem;
  }
  .escala-doc-shell {
    flex: 1 0 auto;
    display: flex;
    flex-direction: column;
    min-height: 100vh;
    width: calc(100% - 24px);
    max-width: 1400px;
    margin: 0 auto;
    padding: 0 12px;
    box-sizing: border-box;
  }
  .escala-doc-corpo { flex: 1 0 auto; }
  .conteudo-principal { padding: 0; }
  .cabecalho-doc { padding: 10px 0 0; width: 100%; }
  .cabecalho-institucional {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 12px 20px;
    padding-bottom: 8px;
    border-bottom: 1px solid #bbb;
  }
  .cabecalho-brasao-slot {
    flex: 0 0 auto;
    display: flex;
    align-items: center;
    justify-content: center;
  }
  .cabecalho-brasao-slot .brasao-img {
    display: block;
    height: 88px;
    width: auto;
    max-width: 118px;
    object-fit: contain;
  }
  .cabecalho-texto-centro {
    flex: 1 1 auto;
    min-width: 160px;
    text-align: center;
    font-size: 0.82rem;
    line-height: 1.4;
    font-weight: 700;
    letter-spacing: 0.05em;
    text-transform: uppercase;
    white-space: nowrap;
  }
  .cabecalho-texto-centro div { margin: 2px 0; white-space: nowrap; }
  @media (max-width: 640px) {
    .cabecalho-brasao-slot .brasao-img { height: 64px; max-width: 88px; }
  }
  .linha-escala-data-doc {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin: 0 0 12px;
    padding: 8px 0 4px;
    font-size: 1.02rem;
    text-transform: uppercase;
    letter-spacing: 0.02em;
    white-space: nowrap;
  }
  .linha-escala-data-doc .data-doc { text-transform: none; font-weight: 500; }
  .bloco-escala { margin-bottom: 14px; page-break-inside: avoid; width: 100%; }
  .titulo-bloco { font-size: 0.92rem; margin: 0 0 6px 0; border-bottom: 1px solid #333; padding-bottom: 3px; white-space: nowrap; }
  table.escala-bloco {
    width: 100%;
    max-width: 100%;
    border-collapse: collapse;
    table-layout: fixed;
  }
  /* 6 colunas; POLICIAL no corpo usa colspan 3 (ou 2 + HORÁRIO no diferenciado) — larguras somam o espaço do nome. */
  .escala-bloco col.col-upm-mat { width: 10%; }
  .escala-bloco col.col-data-nome { width: 32%; }
  .escala-bloco col.col-hor { width: 10%; }
  .escala-bloco col.col-tipo { width: 10%; }
  .escala-bloco col.col-circ-func { width: 23%; }
  .escala-bloco col.col-esp { width: 15%; }
  .escala-bloco th, .escala-bloco td {
    border: none;
    padding: 4px 5px;
    text-align: left;
    vertical-align: middle;
    box-sizing: border-box;
    overflow: hidden;
  }
  .escala-bloco thead th { background: transparent; font-weight: 600; font-size: 0.72rem; line-height: 1.15; }
  .cab-valores td {
    background: transparent;
    font-size: 0.8rem;
    line-height: 1.2;
    word-wrap: break-word;
    overflow-wrap: break-word;
    word-break: normal;
    hyphens: none;
  }
  .cab-valores td:first-child {
    white-space: nowrap;
  }
  .cab-valores td.cel-data-cab {
    white-space: nowrap;
  }
  .subth th { background: transparent; font-size: 0.72rem; line-height: 1.15; }
  .escala-bloco .linha-policial td {
    font-size: 0.85rem;
    line-height: 1.2;
    word-break: normal;
    hyphens: none;
    overflow: visible;
  }
  .escala-bloco .linha-policial td.cel-matricula,
  .escala-bloco .linha-policial td.cel-horario-linha {
    white-space: nowrap;
  }
  .escala-bloco .linha-policial td.cel-policial {
    white-space: normal;
    overflow: visible;
    word-wrap: break-word;
    overflow-wrap: break-word;
  }
  .escala-bloco .linha-policial td.cel-funcao {
    white-space: normal;
    word-wrap: break-word;
    overflow-wrap: break-word;
  }
  .obs td { background: transparent; min-height: 24px; vertical-align: top; white-space: normal; }
  .obs-conteudo { margin-top: 4px; font-size: 0.85rem; white-space: normal; line-height: 1.25; }
  .muted { color: #666; font-style: italic; }
  .acoes {
    flex-shrink: 0;
    margin-top: auto;
    padding: 28px 0 36px;
    display: flex;
    gap: 12px;
    flex-wrap: wrap;
    justify-content: flex-start;
    border-top: 1px solid #ddd;
    background: #fafafa;
    width: 100%;
    box-sizing: border-box;
  }
  .acoes button { padding: 10px 18px; font-size: 0.95rem; cursor: pointer; border-radius: 6px; border: 1px solid #333; background: #fff; }
  .acoes button.primary { background: #1565c0; color: #fff; border-color: #1565c0; }
  .acoes button.danger { border-color: #b71c1c; color: #b71c1c; background: #fff; }
  @media print {
    @page {
      margin: 6mm 7mm;
      size: A4;
    }
    .acoes { display: none !important; }
    html, body {
      margin: 0;
      min-height: 0 !important;
      height: auto !important;
      display: block;
      font-size: 9pt;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }
    .escala-doc-shell {
      width: 100%;
      max-width: none;
      padding: 0;
      margin: 0;
      min-height: 0 !important;
    }
    .escala-doc-corpo { min-height: 0 !important; }
    .cabecalho-doc { padding: 2mm 0 0; }
    .cabecalho-institucional {
      gap: 5mm 8mm;
      padding-bottom: 3mm;
    }
    .cabecalho-brasao-slot .brasao-img {
      height: 14mm;
      max-width: 20mm;
    }
    .cabecalho-texto-centro {
      font-size: 10pt;
      line-height: 1.35;
      letter-spacing: 0.04em;
    }
    .cabecalho-texto-centro div { margin: 0.6mm 0; }
    .linha-escala-data-doc {
      margin: 0 0 4mm;
      padding: 2mm 0 1mm;
      font-size: 11.5pt;
    }
    .bloco-escala {
      margin-bottom: 5mm;
      page-break-inside: auto;
    }
    .titulo-bloco {
      font-size: 10pt;
      margin: 0 0 2mm;
      padding-bottom: 1mm;
    }
    table.escala-bloco { width: 100%; }
    .escala-bloco col.col-upm-mat { width: 10%; }
    .escala-bloco col.col-data-nome { width: 30%; }
    .escala-bloco col.col-hor { width: 10%; }
    .escala-bloco col.col-tipo { width: 10%; }
    .escala-bloco col.col-circ-func { width: 23%; }
    .escala-bloco col.col-esp { width: 17%; }
    .escala-bloco th, .escala-bloco td {
      padding: 0.8mm 1.2mm;
      font-size: 8.5pt;
    }
    .escala-bloco thead th { font-size: 7.5pt; }
    .cab-valores td { font-size: 8.5pt; line-height: 1.2; }
    .subth th { font-size: 7.5pt; }
    .escala-bloco .linha-policial td { font-size: 8.5pt; line-height: 1.2; }
    .escala-bloco .linha-policial td.cel-policial { font-size: 8.5pt; }
    .obs td { min-height: 0; padding-top: 1mm; padding-bottom: 1mm; }
    .obs-conteudo { font-size: 8.5pt; margin-top: 1mm; }
    /* Mantém linha de tabela inteira; bloco pode dividir entre páginas (menos folhas em branco). */
    .escala-bloco tr { break-inside: avoid; page-break-inside: avoid; }
  }
</style>
</head>
<body>
  <div class="escala-doc-shell">
  <div class="escala-doc-corpo">
  <div class="cabecalho-doc">
    <div class="cabecalho-institucional">
      <div class="cabecalho-brasao-slot">
        <img class="brasao-img" src="${escHtml(urlPmdf)}" alt="Polícia Militar do Distrito Federal"/>
      </div>
      <div class="cabecalho-texto-centro">
        <div>GOVERNO DO DISTRITO FEDERAL</div>
        <div>POLÍCIA MILITAR DO DISTRITO FEDERAL</div>
        <div>DEPARTAMENTO DE OPERAÇÕES</div>
        <div>CENTRO DE OPERAÇÕES DA POLÍCIA MILITAR</div>
      </div>
      <div class="cabecalho-brasao-slot">
        <img class="brasao-img" src="${escHtml(urlGdf)}" alt="Governo do Distrito Federal"/>
      </div>
    </div>
    <div class="linha-escala-data-doc">
      <span class="titulo-doc">Escala de serviço</span>
      <span class="data-doc">${escHtml(dataEscalaCab)}</span>
    </div>
  </div>
  <div class="conteudo-principal">
  ${secoesBlocos.join('\n')}
  ${secAfast}
  </div>
  </div>

  <div class="acoes">
    <button type="button" class="primary" id="btn-salvar">Salvar</button>
    <button type="button" id="btn-imprimir">Imprimir</button>
    <button type="button" class="danger" id="btn-cancelar">Cancelar</button>
  </div>
  </div>

  <script>
    (function() {
      var PAYLOAD = ${payloadLiteral};
      document.getElementById('btn-salvar').onclick = function() {
        if (window.opener) {
          window.opener.postMessage({ type: '${ESCALA_GERADA_SALVAR_MESSAGE}', payload: PAYLOAD }, '*');
        }
      };
      document.getElementById('btn-imprimir').onclick = function() { window.print(); };
      document.getElementById('btn-cancelar').onclick = function() { window.close(); };
    })();
  </script>
</body>
</html>`;
}

/**
 * Abre uma aba/janela vazia — deve ser chamado **no mesmo tick** do clique do usuário (sem await antes),
 * senão o navegador bloqueia como pop-up.
 * Não use `noopener`: o botão Salvar depende de `window.opener.postMessage`.
 */
export function openEscalaGeradaBlankWindow(): Window | null {
  return window.open('about:blank', '_blank');
}

/** Conteúdo temporário enquanto a API carrega os dados da escala. */
export function writeEscalaGeradaLoadingWindow(w: Window): void {
  w.document.open();
  w.document.write(`<!DOCTYPE html>
<html lang="pt-BR">
<head><meta charset="utf-8"/><title>Carregando…</title>
<style>body{font-family:system-ui,sans-serif;margin:40px;color:#444}</style>
</head>
<body><p>Gerando escala, aguarde…</p></body></html>`);
  w.document.close();
}

/** Escreve o layout de impressão na janela já aberta (ex.: retorno de `openEscalaGeradaBlankWindow`). */
export function writeEscalaGeradaPrintWindow(w: Window, draft: EscalaGeradaDraftPayload): void {
  const origin = typeof window !== 'undefined' ? window.location.origin : '';
  const html = buildEscalaGeradaPrintHtml(draft, { assetsBaseUrl: origin });
  w.document.open();
  w.document.write(html);
  w.document.close();
}

/** Abre janela e já escreve o documento — só funciona se chamado de forma síncrona; prefira blank + write após fetch. */
export function openEscalaGeradaPrintWindow(draft: EscalaGeradaDraftPayload): Window | null {
  const w = openEscalaGeradaBlankWindow();
  if (!w) return null;
  writeEscalaGeradaPrintWindow(w, draft);
  return w;
}

/** Remove campos só da impressão antes de enviar à API. */
export function linhasEscalaDraftParaApi(
  linhas: LinhaEscalaGeradaDraft[],
): Array<{
  lista: 'DISPONIVEL' | 'AFASTADO';
  policialId: number;
  nome: string;
  matricula: string;
  equipe: string | null;
  horarioServico: string;
  funcaoNome: string | null;
  detalheAfastamento: string | null;
}> {
  return linhas.map((l) => ({
    lista: l.lista,
    policialId: l.policialId,
    nome: l.nome,
    matricula: l.matricula,
    equipe: l.equipe,
    horarioServico: l.horarioServico,
    funcaoNome: l.funcaoNome,
    detalheAfastamento: l.detalheAfastamento,
  }));
}
