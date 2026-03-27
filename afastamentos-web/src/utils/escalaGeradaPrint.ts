import type { EscalaGeradaDraftPayload } from './gerarEscalasCalculo';
import { formatarDataBr, labelTipoServico } from './gerarEscalasCalculo';

export const ESCALA_GERADA_SALVAR_MESSAGE = 'escala-gerada-salvar';

function escHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function montarTabela(rows: EscalaGeradaDraftPayload['linhas'], mostrarColAfastamento: boolean): string {
  if (rows.length === 0) {
    return '<p class="muted">Nenhum registro.</p>';
  }
  const headAfast = mostrarColAfastamento ? '<th>Afastamento</th>' : '';
  const body = rows
    .map((r) => {
      const colAf = mostrarColAfastamento
        ? `<td>${escHtml(r.detalheAfastamento ?? '—')}</td>`
        : '';
      return `<tr><td>${escHtml(r.nome)}</td><td>${escHtml(r.matricula)}</td><td>${escHtml(
        r.equipe ?? '—',
      )}</td><td>${escHtml(r.horarioServico)}</td><td>${escHtml(r.funcaoNome ?? '—')}</td>${colAf}</tr>`;
    })
    .join('');
  return `<table>
<thead><tr><th>Nome</th><th>Matrícula</th><th>Equipe / escala</th><th>Horário do serviço</th><th>Função</th>${headAfast}</tr></thead>
<tbody>${body}</tbody></table>`;
}

/**
 * Abre uma aba/janela vazia — deve ser chamada **no mesmo tick** do clique do usuário (sem await antes),
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
</head><body><p>Gerando escala, aguarde…</p></body></html>`);
  w.document.close();
}

function buildEscalaGeradaPrintHtml(draft: EscalaGeradaDraftPayload): string {
  const rowsDisp = draft.linhas.filter((l) => l.lista === 'DISPONIVEL');
  const rowsAf = draft.linhas.filter((l) => l.lista === 'AFASTADO');

  /** Evita fechar a tag &lt;script&gt; se algum texto contiver "&lt;/script". */
  const payloadLiteral = JSON.stringify(draft).replace(/<\//g, '<\\/');

  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="utf-8"/>
<title>Escala — ${escHtml(formatarDataBr(draft.dataEscala))}</title>
<style>
  body { font-family: system-ui, sans-serif; margin: 24px; color: #111; }
  h1 { font-size: 1.25rem; margin-bottom: 4px; }
  .meta { color: #444; margin-bottom: 20px; font-size: 0.95rem; line-height: 1.5; }
  h2 { font-size: 1.05rem; margin-top: 24px; margin-bottom: 8px; border-bottom: 1px solid #ccc; padding-bottom: 4px; }
  table { width: 100%; border-collapse: collapse; font-size: 0.9rem; }
  th, td { border: 1px solid #ccc; padding: 8px; text-align: left; vertical-align: top; }
  th { background: #f0f0f0; }
  .muted { color: #666; font-size: 0.9rem; }
  .acoes { margin-top: 28px; display: flex; gap: 12px; flex-wrap: wrap; }
  .acoes button { padding: 10px 18px; font-size: 0.95rem; cursor: pointer; border-radius: 6px; border: 1px solid #333; background: #fff; }
  .acoes button.primary { background: #1565c0; color: #fff; border-color: #1565c0; }
  .acoes button.danger { border-color: #b71c1c; color: #b71c1c; background: #fff; }
  @media print {
    .acoes { display: none !important; }
    body { margin: 12px; }
  }
</style>
</head>
<body>
  <h1>Escala gerada</h1>
  <div class="meta">
    <strong>Data da escala:</strong> ${escHtml(formatarDataBr(draft.dataEscala))} &nbsp;|&nbsp;
    <strong>Tipo de serviço:</strong> ${escHtml(labelTipoServico(draft.tipoServico))}<br/>
    ${escHtml(draft.resumoEquipes)}
  </div>

  <h2>Policiais disponíveis para a escala</h2>
  ${montarTabela(rowsDisp, false)}

  <h2>Policiais afastados no dia</h2>
  ${montarTabela(rowsAf, true)}

  <div class="acoes">
    <button type="button" class="primary" id="btn-salvar">Salvar</button>
    <button type="button" id="btn-imprimir">Imprimir</button>
    <button type="button" class="danger" id="btn-cancelar">Cancelar</button>
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

/** Escreve o layout de impressão na janela já aberta (ex.: retorno de `openEscalaGeradaBlankWindow`). */
export function writeEscalaGeradaPrintWindow(w: Window, draft: EscalaGeradaDraftPayload): void {
  const html = buildEscalaGeradaPrintHtml(draft);
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
