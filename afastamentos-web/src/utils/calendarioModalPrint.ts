import type { Policial } from '../types';
import { formatMatricula } from './dateUtils';

function textoImpressaoMaiusculas(value: string | null | undefined): string {
  return String(value ?? '')
    .trim()
    .toUpperCase();
}

function escHtml(s: string): string {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/**
 * Abre janela com lista formatada para impressão (Calendário das Equipes — modal de efetivo do dia).
 * Chame a partir do clique do usuário para evitar bloqueio de pop-up.
 * @returns false se o navegador bloqueou a nova janela
 */
export function imprimirListaPoliciaisCalendarioModal(titulo: string, policiais: Policial[]): boolean {
  const w = window.open('', '_blank');
  if (!w) {
    return false;
  }

  const rows = policiais
    .map((p, idx) => {
      const nome = escHtml(textoImpressaoMaiusculas(p.nome));
      const mat = escHtml(formatMatricula(p.matricula));
      const funcao = p.funcao?.nome ? escHtml(textoImpressaoMaiusculas(p.funcao.nome)) : '—';
      const st = escHtml(textoImpressaoMaiusculas(p.status ?? '—'));
      return `<tr><td class="num">${idx + 1}</td><td class="nome">${nome}</td><td>${mat}</td><td>${funcao}</td><td>${st}</td></tr>`;
    })
    .join('');

  const gerado = new Date().toLocaleString('pt-BR');
  const tituloSafe = escHtml(textoImpressaoMaiusculas(titulo));

  const html = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1"/>
<title>${tituloSafe}</title>
<style>
  @page { margin: 14mm 12mm; size: A4; }
  * { box-sizing: border-box; }
  body { font-family: 'Segoe UI', system-ui, -apple-system, sans-serif; font-size: 11pt; line-height: 1.35; color: #111; margin: 0; padding: 16px; }
  h1 { font-size: 1.05rem; margin: 0 0 6px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.02em; }
  .meta { font-size: 0.88rem; color: #333; margin: 0 0 14px; line-height: 1.4; }
  table { width: 100%; border-collapse: collapse; margin-top: 4px; }
  th, td { border: 1px solid #222; padding: 6px 8px; text-align: left; vertical-align: top; }
  th { background: #e8e8e8; font-weight: 600; font-size: 0.82rem; }
  td.num { width: 2.2rem; text-align: center; color: #444; }
  td.nome { font-weight: 600; }
  .rodape { margin-top: 18px; padding-top: 10px; border-top: 1px solid #ccc; font-size: 0.78rem; color: #555; }
  @media print {
    body { padding: 0; font-size: 10.5pt; }
    .no-print { display: none !important; }
    th { background: #eaeaea !important; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  }
  .acoes { margin-top: 20px; display: flex; gap: 10px; flex-wrap: wrap; }
  .acoes button { padding: 10px 18px; font-size: 0.95rem; cursor: pointer; border-radius: 4px; border: 1px solid #333; background: #fff; }
  .acoes button.primary { background: #1565c0; color: #fff; border-color: #1565c0; }
</style>
</head>
<body>
  <h1>${tituloSafe}</h1>
  <p class="meta">Efetivo escalado conforme Calendário das Equipes (policiais disponíveis no dia, excluídos afastamentos do período).</p>
  <table>
    <thead>
      <tr><th>Nº</th><th>Nome</th><th>Matrícula</th><th>Função</th><th>Status</th></tr>
    </thead>
    <tbody>${rows}</tbody>
  </table>
  <p class="rodape">Emitido em ${escHtml(gerado)} · Sistema COPOM — Controle de equipes</p>
  <div class="acoes no-print">
    <button type="button" class="primary" onclick="window.print()">Imprimir / salvar como PDF</button>
    <button type="button" onclick="window.close()">Fechar</button>
  </div>
</body>
</html>`;

  w.document.open();
  w.document.write(html);
  w.document.close();
  return true;
}
