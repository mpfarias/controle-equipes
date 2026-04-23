import { getExpedienteHorario } from '../constants/svgRegras';
import type { EscalaGeradaDraftPayload, LinhaEscalaGeradaDraft } from './gerarEscalasCalculo';
import { formatarDataBr } from './gerarEscalasCalculo';
import { relogioParaLabel } from './expedienteEscalaRegras';
import { formatarMatriculaExibicao } from './inputUtils';
import {
  ESCALA_CABECALHO_HORARIO_AUTOMATICO,
  ORDEM_BLOCOS_IMPRESSAO,
  rotuloHorarioApartirDeServico,
  tituloBlocoEscalaComLinhas,
  normalizarBlocoEscalaImpressao,
  type BlocoEscalaId,
  type EscalaCabecalhoFormulario,
} from './escalaBlocos';
import { ESCALA_MOTORISTA_DIA } from '../constants/escalaMotoristasDia';

export const ESCALA_GERADA_SALVAR_MESSAGE = 'escala-gerada-salvar';

/** Opener → janela de impressão: gravação concluída (exibir modal de sucesso na própria janela). */
export const ESCALA_GERADA_SALVA_NA_IMPRESSAO_MESSAGE = 'escala-gerada-salva-impressao';

/** Opener → janela de impressão: falha ao salvar (exibir modal de erro na própria janela). */
export const ESCALA_GERADA_ERRO_SALVAR_IMPRESSAO_MESSAGE = 'escala-gerada-erro-salvar-impressao';

export function notificarImpressaoEscalaGeradaSalva(
  janela: Window | null,
  resultado: { sucesso: true; registroId: number } | { sucesso: false; mensagem: string },
): void {
  if (!janela || janela.closed) return;
  try {
    if (resultado.sucesso) {
      janela.postMessage({ type: ESCALA_GERADA_SALVA_NA_IMPRESSAO_MESSAGE, registroId: resultado.registroId }, '*');
    } else {
      janela.postMessage({ type: ESCALA_GERADA_ERRO_SALVAR_IMPRESSAO_MESSAGE, message: resultado.mensagem }, '*');
    }
  } catch {
    /* janela pode estar em estado inválido */
  }
}

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
    case 'ESCALA_EXTRAORDINARIA':
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
      return `${ESCALA_MOTORISTA_DIA} (07h às 07h — motorista de dia)`;
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
  return horarioServico.replace(/^\[[^\]]+\]\s*/u, '').replace(/\s*•\s*TROCA DE SERVIÇO\s*$/iu, '').trim();
}

function linhaEmTrocaServico(horarioServico: string): boolean {
  return /\bTROCA DE SERVIÇO\b/iu.test(horarioServico);
}

function linhasCorpoPoliciais(
  rows: LinhaEscalaGeradaDraft[],
  blocoNorm: BlocoEscalaId,
  opts?: { extraOrdinaria?: boolean },
): string {
  const colspanVazio = opts?.extraOrdinaria ? 4 : 6;
  if (rows.length === 0) {
    return `<tr><td colspan="${colspanVazio}" class="muted">(Nenhum policial neste bloco.)</td></tr>`;
  }
  if (opts?.extraOrdinaria) {
    return rows
      .map((r) => {
        const emTroca = linhaEmTrocaServico(r.horarioServico);
        const badgeTroca = emTroca ? ` <span class="badge-troca-servico">Troca de serviço</span>` : '';
        const afastExtra =
          r.detalheAfastamento && r.lista === 'AFASTADO'
            ? ` <span class="muted">(${escHtml(r.detalheAfastamento)})</span>`
            : '';
        const matEx = formatarMatriculaExibicao(r.matricula) || '—';
        const nomeHtml = `${escHtml(r.nome)}${badgeTroca}${afastExtra}`;
        return `<tr class="linha-policial linha-policial-extraord">
      <td class="cel-matricula">${escHtml(matEx)}</td>
      <td class="cel-policial" colspan="3">${nomeHtml}</td>
    </tr>`;
      })
      .join('');
  }
  const mostrarHorarioLinha = blocoNorm === 'EXP_DIFERENCIADO' || blocoNorm === 'ESCALA_EXTRAORDINARIA';
  return rows
    .map((r) => {
      const emTroca = linhaEmTrocaServico(r.horarioServico);
      const badgeTroca = emTroca ? ` <span class="badge-troca-servico">Troca de serviço</span>` : '';
      const horCell = mostrarHorarioLinha ? escHtml(horarioLinhaExibir(r.horarioServico)) : '';
      const afastExtra =
        r.detalheAfastamento && r.lista === 'AFASTADO'
          ? ` <span class="muted">(${escHtml(r.detalheAfastamento)})</span>`
          : '';
      const matEx = formatarMatriculaExibicao(r.matricula) || '—';
      const nomeHtml = `${escHtml(r.nome)}${badgeTroca}${afastExtra}`;
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
  opts?: { extraOrdinaria?: boolean; horarioApartirLabel?: string },
): string {
  const cab = cabecalhoBlocoNoDraft(draft, blocoId);
  const horarioCab = horarioCabecalhoBlocoImpressao(blocoId, draft.dataEscala);
  const obs = cab.observacoes ?? '';
  const norm = normalizarBlocoEscalaImpressao(blocoId);
  const ex = opts?.extraOrdinaria === true;

  if (ex) {
    const horFallback =
      (opts?.horarioApartirLabel ?? '').trim() || rotuloHorarioApartirDeServico('');
    const horCabEx =
      cab.horario &&
      String(cab.horario).trim() &&
      cab.horario !== ESCALA_CABECALHO_HORARIO_AUTOMATICO
        ? String(cab.horario).trim()
        : horFallback;
    const circCab = 'EXTRAORDINÁRIO';
    return `<section class="bloco-escala bloco-escala-extraordinaria">
  <h2 class="titulo-bloco">${escHtml(tituloBloco)}</h2>
  <table class="escala-bloco escala-bloco-extraordinaria">
    <colgroup>
      <col class="col-ex-mat"/>
      <col class="col-ex-nome"/>
      <col class="col-ex-tipo"/>
      <col class="col-ex-circ"/>
    </colgroup>
    <thead>
      <tr><th>DATA</th><th>HORÁRIO</th><th>TIPO</th><th>CIRCUNSTÂNCIA</th></tr>
    </thead>
    <tbody>
      <tr class="cab-valores">
        <td class="cel-data-cab">${escHtml(dataEscalaCab)}</td>
        <td>${escHtml(horCabEx)}</td>
        <td>${cel(cab.tipo)}</td>
        <td>${escHtml(circCab)}</td>
      </tr>
      <tr class="subth">
        <th>MATRÍCULA</th><th colspan="3">POLICIAL</th>
      </tr>
      ${corpoLinhas}
      <tr class="obs">
        <td colspan="4">
          <strong>OBSERVAÇÕES</strong>
          <div class="obs-conteudo">${obs.trim() ? escHtmlMultiline(obs) : '—'}</div>
        </td>
      </tr>
    </tbody>
  </table>
</section>`;
  }

  const subthHtml =
    norm === 'EXP_DIFERENCIADO' || norm === 'ESCALA_EXTRAORDINARIA'
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

  const isExtra = draft.tipoServico === 'EXTRAORDINARIA';

  const secoesBlocos: string[] = [];
  for (const id of ORDEM_BLOCOS_IMPRESSAO) {
    const rows = porBloco.get(id) ?? [];
    if (rows.length === 0) continue;

    const titulo = tituloBlocoEscalaComLinhas(id, rows);
    const blocoNorm = normalizarBlocoEscalaImpressao(id);
    const corpo = linhasCorpoPoliciais(rows, blocoNorm, { extraOrdinaria: isExtra });
    const horApartir = rotuloHorarioApartirDeServico(rows[0]?.horarioServico ?? '');
    secoesBlocos.push(
      montarTabelaBloco(draft, dataEscalaCab, id, titulo, corpo, {
        extraOrdinaria: isExtra,
        horarioApartirLabel: horApartir,
      }),
    );
  }

  const secAfast =
    afast.length > 0
      ? montarTabelaBloco(
          draft,
          dataEscalaCab,
          'AFASTADOS',
          tituloBlocoEscalaComLinhas('AFASTADOS', afast),
          linhasCorpoPoliciais(afast, 'AFASTADOS', { extraOrdinaria: isExtra }),
          isExtra
            ? {
                extraOrdinaria: true,
                horarioApartirLabel: rotuloHorarioApartirDeServico(afast[0]?.horarioServico ?? ''),
              }
            : undefined,
        )
      : '';

  const base = (opts?.assetsBaseUrl ?? '').replace(/\/$/, '');
  const urlPmdf = base ? `${base}/pmdf.png` : '/pmdf.png';
  const urlGdf = base ? `${base}/gdf.jpeg` : '/gdf.jpeg';

  const resumoExtraHtml =
    draft.tipoServico === 'EXTRAORDINARIA' && (draft.resumoEquipes ?? '').trim()
      ? `<div class="resumo-escala-extra-doc">${escHtml(draft.resumoEquipes.trim())}</div>`
      : '';

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
  .resumo-escala-extra-doc {
    font-size: 0.88rem;
    font-weight: 600;
    text-align: center;
    margin: 0 0 10px;
    line-height: 1.4;
    color: #0d47a1;
  }
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
  .escala-bloco-extraordinaria col.col-ex-mat { width: 14%; }
  .escala-bloco-extraordinaria col.col-ex-nome { width: 42%; }
  .escala-bloco-extraordinaria col.col-ex-tipo { width: 22%; }
  .escala-bloco-extraordinaria col.col-ex-circ { width: 22%; }
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
  .badge-troca-servico {
    display: inline-block;
    margin-left: 6px;
    padding: 1px 7px;
    border-radius: 999px;
    font-size: 0.68rem;
    font-weight: 700;
    letter-spacing: 0.01em;
    text-transform: uppercase;
    color: #0d47a1;
    background: #e3f2fd;
    border: 1px solid #90caf9;
    vertical-align: middle;
    white-space: nowrap;
  }
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
  .modal-salvo-overlay {
    display: none;
    position: fixed;
    inset: 0;
    z-index: 99999;
    background: rgba(0,0,0,0.5);
    align-items: center;
    justify-content: center;
    padding: 16px;
    box-sizing: border-box;
  }
  .modal-salvo-box {
    max-width: 420px;
    width: 100%;
    background: #fff;
    color: #111;
    border-radius: 10px;
    box-shadow: 0 8px 32px rgba(0,0,0,0.25);
    padding: 20px 22px 18px;
    box-sizing: border-box;
  }
  .modal-salvo-titulo { margin: 0 0 12px; font-size: 1.15rem; font-weight: 700; }
  .modal-salvo-corpo { margin: 0; font-size: 0.95rem; line-height: 1.45; }
  .modal-salvo-corpo p { margin: 0 0 8px; }
  .modal-salvo-reg { margin-top: 4px; }
  .modal-salvo-erro { color: #b71c1c; font-weight: 600; }
  .modal-salvo-acoes { margin-top: 18px; display: flex; justify-content: flex-end; }
  .modal-salvo-acoes button { padding: 10px 22px; font-size: 0.95rem; cursor: pointer; border-radius: 6px; border: 1px solid #1565c0; background: #1565c0; color: #fff; }
  @media print {
    @page {
      margin: 6mm 7mm;
      size: A4;
    }
    .acoes { display: none !important; }
    .modal-salvo-overlay { display: none !important; }
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
    .escala-bloco-extraordinaria col.col-ex-mat { width: 14%; }
    .escala-bloco-extraordinaria col.col-ex-nome { width: 42%; }
    .escala-bloco-extraordinaria col.col-ex-tipo { width: 22%; }
    .escala-bloco-extraordinaria col.col-ex-circ { width: 22%; }
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
    ${resumoExtraHtml}
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

  <div id="modal-salvo-overlay" class="modal-salvo-overlay" style="display:none" aria-hidden="true">
    <div class="modal-salvo-box" role="dialog" aria-modal="true" aria-labelledby="modal-salvo-titulo">
      <h2 id="modal-salvo-titulo" class="modal-salvo-titulo">Escala salva</h2>
      <div id="modal-salvo-texto" class="modal-salvo-corpo">
        <p>A escala foi gravada com sucesso no sistema.</p>
        <p class="modal-salvo-reg">Registro nº <strong id="modal-salvo-id">—</strong>.</p>
      </div>
      <div id="modal-salvo-erro" class="modal-salvo-corpo" style="display:none">
        <p class="modal-salvo-erro" id="modal-salvo-erro-msg"></p>
      </div>
      <div class="modal-salvo-acoes">
        <button type="button" id="modal-salvo-ok">OK</button>
      </div>
    </div>
  </div>

  <script>
    (function() {
      var PAYLOAD = ${payloadLiteral};
      var T_SALVA = '${ESCALA_GERADA_SALVA_NA_IMPRESSAO_MESSAGE}';
      var T_ERRO = '${ESCALA_GERADA_ERRO_SALVAR_IMPRESSAO_MESSAGE}';
      var overlay = document.getElementById('modal-salvo-overlay');
      var titulo = document.getElementById('modal-salvo-titulo');
      var blocoOk = document.getElementById('modal-salvo-texto');
      var blocoErro = document.getElementById('modal-salvo-erro');
      var idEl = document.getElementById('modal-salvo-id');
      var errEl = document.getElementById('modal-salvo-erro-msg');
      function abrirModal() {
        overlay.style.display = 'flex';
        overlay.setAttribute('aria-hidden', 'false');
      }
      function fecharModal() {
        overlay.style.display = 'none';
        overlay.setAttribute('aria-hidden', 'true');
      }
      document.getElementById('modal-salvo-ok').onclick = fecharModal;
      overlay.addEventListener('click', function(ev) {
        if (ev.target === overlay) fecharModal();
      });
      window.addEventListener('message', function(ev) {
        var d = ev.data;
        if (!d || typeof d !== 'object') return;
        if (d.type === T_SALVA) {
          titulo.textContent = 'Escala salva';
          idEl.textContent = String(d.registroId != null ? d.registroId : '—');
          blocoOk.style.display = 'block';
          blocoErro.style.display = 'none';
          abrirModal();
        } else if (d.type === T_ERRO) {
          titulo.textContent = 'Não foi possível salvar';
          errEl.textContent = d.message || 'Erro ao salvar a escala.';
          blocoOk.style.display = 'none';
          blocoErro.style.display = 'block';
          abrirModal();
        }
      });
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
