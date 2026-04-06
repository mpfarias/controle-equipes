import type { Policial, PolicialStatus } from '../types';
import escalaEditorOrderingInline from './escalaGeradaEditor-ordering-inline.js?raw';
import { sortPorPatenteENome } from './sortPoliciais';
import type { EscalaGeradaDraftPayload, LinhaEscalaGeradaDraft } from './gerarEscalasCalculo';
import {
  ESCALA_CABECALHO_HORARIO_AUTOMATICO,
  ESCALA_CAB_OPCOES_CIRCUNSTANCIA,
  ESCALA_CAB_OPCOES_ESPECIALIDADE,
  ESCALA_CAB_OPCOES_TIPO,
  ORDEM_BLOCOS_IMPRESSAO,
  ehBlocoSvgPlaceholder,
  normalizarBlocoEscalaImpressao,
  tituloBlocoEscalaComLinhas,
  type BlocoEscalaId,
} from './escalaBlocos';
import { formatarMatriculaExibicao } from './inputUtils';

/** Opener trata este tipo e chama `buildEscalaGeradaPrintHtml` na mesma aba. */
export const ESCALA_DEFINITIVA_RENDER_MESSAGE = 'escala-definitiva-render';

type FuncaoOpt = { id: number; nome: string };

type PolicialSlim = {
  id: number;
  nome: string;
  matricula: string;
  funcaoId: number | null;
  funcaoNome: string | null;
  status: PolicialStatus;
};

function escHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function safeJsonForScript(o: unknown): string {
  return JSON.stringify(o).replace(/</g, '\\u003c');
}

function optionsFromConst<T extends readonly string[]>(
  values: T,
  selected: string,
): string {
  return values
    .map((v) => `<option value="${escHtml(v)}"${v === selected ? ' selected' : ''}>${escHtml(v)}</option>`)
    .join('');
}

/** Rótulo de horário sugerido para linhas novas quando o bloco ainda não tinha policiais. */
function horarioPadraoNovoNoBloco(blocoId: BlocoEscalaId | 'AFASTADOS'): string {
  if (blocoId === 'SVG_10_18') return '[SVG] 10h às 18h';
  if (blocoId === 'SVG_15_23') return '[SVG] 15h às 23h';
  if (blocoId === 'SVG_20_04') return '[SVG] 20h às 04h';
  if (blocoId === 'MOTORISTAS') return '[Motoristas] Conforme escala 24×72';
  if (blocoId === 'EQUIPE_DIURNA_07' || blocoId === 'EQUIPE_NOTURNA_19_07') {
    return '[Operacional] Conforme escala 24×72';
  }
  if (blocoId === 'AFASTADOS') return '[Expediente] Afastamento';
  return '[Expediente] Conforme regras UPM';
}

function tipoServicoLinhaPorBloco(blocoId: BlocoEscalaId | 'AFASTADOS'): 'OPERACIONAL' | 'EXPEDIENTE' | 'MOTORISTAS' {
  if (blocoId === 'MOTORISTAS') return 'MOTORISTAS';
  if (blocoId === 'EQUIPE_DIURNA_07' || blocoId === 'EQUIPE_NOTURNA_19_07') return 'OPERACIONAL';
  if (blocoId === 'SVG_10_18' || blocoId === 'SVG_15_23' || blocoId === 'SVG_20_04') return 'EXPEDIENTE';
  return 'EXPEDIENTE';
}

function agruparDisponiveisPorBloco(
  linhas: LinhaEscalaGeradaDraft[],
): Map<BlocoEscalaId, LinhaEscalaGeradaDraft[]> {
  const m = new Map<BlocoEscalaId, LinhaEscalaGeradaDraft[]>();
  for (const id of ORDEM_BLOCOS_IMPRESSAO) {
    m.set(id, []);
  }
  for (const l of linhas) {
    if (l.lista !== 'DISPONIVEL') continue;
    const id = normalizarBlocoEscalaImpressao((l.blocoEscala ?? 'EXP_DIFERENCIADO') as BlocoEscalaId);
    const arr = m.get(id);
    if (arr) arr.push(l);
    else m.set(id, [l]);
  }
  return m;
}

function montarSelectPoliciais(
  policiais: PolicialSlim[],
  selectedId: number,
  lineKey: string,
): string {
  const sel = policiais.find((p) => p.id === selectedId);
  const btnLabel = sel ? sel.nome : '— Selecione —';
  const val = sel ? String(sel.id) : '';
  return `<div class="policial-combo" data-line-key="${escHtml(lineKey)}">
  <input type="hidden" name="policial-${escHtml(lineKey)}" value="${escHtml(val)}"/>
  <button type="button" class="pol-combo-btn" data-line-key="${escHtml(lineKey)}" aria-haspopup="listbox" aria-expanded="false">${escHtml(btnLabel)}</button>
</div>`;
}

function montarSelectFuncoes(
  funcoes: FuncaoOpt[],
  selectedId: number | null,
  lineKey: string,
  fallbackNomeFuncao: string | null,
): string {
  let sel = selectedId;
  if (sel == null && fallbackNomeFuncao) {
    const fn = funcoes.find(
      (f) => f.nome.trim().toLowerCase() === fallbackNomeFuncao.trim().toLowerCase(),
    );
    if (fn) sel = fn.id;
  }
  const opts = funcoes
    .slice()
    .sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'))
    .map(
      (f) =>
        `<option value="${f.id}"${f.id === sel ? ' selected' : ''}>${escHtml(f.nome)}</option>`,
    )
    .join('');
  return `<select class="sel-funcao" data-line-key="${escHtml(lineKey)}" name="funcao-${escHtml(lineKey)}" style="max-width:100%;font-size:0.85rem"><option value="">—</option>${opts}</select>`;
}

function linhaEditorHtml(
  line: LinhaEscalaGeradaDraft,
  lineKey: string,
  policiais: PolicialSlim[],
  funcoes: FuncaoOpt[],
): string {
  const pol = policiais.find((p) => p.id === line.policialId);
  const fid = pol?.funcaoId ?? null;
  const fnFallback = line.funcaoNome ?? pol?.funcaoNome ?? null;
  const af =
    line.detalheAfastamento && line.lista === 'AFASTADO'
      ? `<br/><span class="muted">${escHtml(line.detalheAfastamento)}</span>`
      : '';
  const matEx = formatarMatriculaExibicao(line.matricula) || '—';
  return `<tr data-line-key="${escHtml(lineKey)}">
    <td class="cel-matricula" data-line-key="${escHtml(lineKey)}">${escHtml(matEx)}</td>
    <td>${montarSelectPoliciais(policiais, line.policialId, lineKey)}${af}</td>
    <td></td><td></td>
    <td>${montarSelectFuncoes(funcoes, fid, lineKey, fnFallback)}</td>
    <td class="cel-acoes"><button type="button" class="btn-excluir-linha" data-line-key="${escHtml(lineKey)}">Excluir</button></td>
  </tr>`;
}

function circunstanciaPadraoPorBloco(blocoId: string): string {
  return ehBlocoSvgPlaceholder(blocoId as BlocoEscalaId)
    ? ESCALA_CAB_OPCOES_CIRCUNSTANCIA[1]
    : ESCALA_CAB_OPCOES_CIRCUNSTANCIA[0];
}

function cabecalhoBlocoEditorHtml(blocoId: string): string {
  const defTipo = ESCALA_CAB_OPCOES_TIPO[0];
  const defCirc = circunstanciaPadraoPorBloco(blocoId);
  const defEsp = ESCALA_CAB_OPCOES_ESPECIALIDADE[0];
  return `<tr class="cab-valores">
    <td>COPOM</td>
    <td class="cel-data-geracao"></td>
    <td>${escHtml(ESCALA_CABECALHO_HORARIO_AUTOMATICO)}</td>
    <td><select name="tipo-${escHtml(blocoId)}" class="cab-sel">${optionsFromConst(ESCALA_CAB_OPCOES_TIPO, defTipo)}</select></td>
    <td><select name="circ-${escHtml(blocoId)}" class="cab-sel">${optionsFromConst(ESCALA_CAB_OPCOES_CIRCUNSTANCIA, defCirc)}</select></td>
    <td><select name="esp-${escHtml(blocoId)}" class="cab-sel">${optionsFromConst(ESCALA_CAB_OPCOES_ESPECIALIDADE, defEsp)}</select></td>
  </tr>`;
}

export function buildEscalaGeradaEditorHtml(
  draft: EscalaGeradaDraftPayload,
  policiais: Policial[],
  funcoes: FuncaoOpt[],
): string {
  const polSlim: PolicialSlim[] = policiais.map((p) => ({
    id: p.id,
    nome: p.nome,
    matricula: p.matricula,
    funcaoId: p.funcaoId ?? null,
    funcaoNome: p.funcao?.nome ?? null,
    status: p.status,
  }));

  const afast = draft.linhas.filter((l) => l.lista === 'AFASTADO');
  const porBloco = agruparDisponiveisPorBloco(draft.linhas);

  type Meta = { key: string; snapshot: LinhaEscalaGeradaDraft };
  const metaLinhas: Meta[] = [];
  for (const blocoId of ORDEM_BLOCOS_IMPRESSAO) {
    const rows = porBloco.get(blocoId) ?? [];
    rows.forEach((line, i) => {
      metaLinhas.push({
        key: `${blocoId}-d-${i}-${line.policialId}`,
        snapshot: line,
      });
    });
  }
  afast.forEach((line, i) => {
    metaLinhas.push({
      key: `AFASTADOS-${i}-${line.policialId}`,
      snapshot: line,
    });
  });

  const polListSorted = sortPorPatenteENome(polSlim).map((p) => ({
    id: p.id,
    label: p.nome,
    matricula: p.matricula,
  }));
  const optsFuncaoInner = funcoes
    .slice()
    .sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'))
    .map((f) => `<option value="${f.id}">${escHtml(f.nome)}</option>`)
    .join('');

  const secoes: string[] = [];
  for (const blocoId of ORDEM_BLOCOS_IMPRESSAO) {
    const rows = porBloco.get(blocoId) ?? [];
    if (rows.length === 0) continue;

    const titulo = tituloBlocoEscalaComLinhas(blocoId, rows);
    const defaultHorario = rows[0]?.horarioServico ?? horarioPadraoNovoNoBloco(blocoId);
    const tipoLinha = tipoServicoLinhaPorBloco(blocoId);
    const corpo = rows
      .map((line, i) => linhaEditorHtml(line, `${blocoId}-d-${i}-${line.policialId}`, polSlim, funcoes))
      .join('');
    const btnAdicionar = `<tr class="row-add-policial"><td colspan="6" style="padding:10px 8px">
  <button type="button" class="btn-add-policial" data-bloco-id="${escHtml(blocoId)}">+ Adicionar policial</button>
</td></tr>`;

    secoes.push(`<section class="bloco-escala" data-bloco-id="${escHtml(blocoId)}" data-default-horario="${escHtml(defaultHorario)}" data-lista="DISPONIVEL" data-tipo-linha="${escHtml(tipoLinha)}">
  <h2 class="titulo-bloco">${escHtml(titulo)}</h2>
  <table class="escala-bloco editor-table">
    <thead>
      <tr><th>UPM</th><th>DATA</th><th>HORÁRIO</th><th>TIPO</th><th>CIRCUNSTÂNCIA</th><th>ESPECIALIDADE</th></tr>
    </thead>
    <tbody>
      ${cabecalhoBlocoEditorHtml(blocoId)}
      <tr class="subth">
        <th>MATRÍCULA</th><th>POLICIAL</th><th></th><th></th><th>FUNÇÃO</th><th class="subth-acoes">Ações</th>
      </tr>
      ${corpo}
      ${btnAdicionar}
      <tr class="obs">
        <td colspan="6">
          <strong>OBSERVAÇÕES</strong>
          <textarea name="obs-${escHtml(blocoId)}" class="obs-field" rows="2" style="width:100%;margin-top:6px;box-sizing:border-box"></textarea>
        </td>
      </tr>
    </tbody>
  </table>
</section>`);
  }

  if (afast.length > 0) {
    const defaultHorarioAfast = afast[0]?.horarioServico ?? horarioPadraoNovoNoBloco('AFASTADOS');
    const corpoAfast = afast
      .map((line, i) => linhaEditorHtml(line, `AFASTADOS-${i}-${line.policialId}`, polSlim, funcoes))
      .join('');

    secoes.push(`<section class="bloco-escala" data-bloco-id="AFASTADOS" data-default-horario="${escHtml(defaultHorarioAfast)}" data-lista="AFASTADO" data-tipo-linha="EXPEDIENTE">
  <h2 class="titulo-bloco">${escHtml(tituloBlocoEscalaComLinhas('AFASTADOS', afast))}</h2>
  <table class="escala-bloco editor-table">
    <thead>
      <tr><th>UPM</th><th>DATA</th><th>HORÁRIO</th><th>TIPO</th><th>CIRCUNSTÂNCIA</th><th>ESPECIALIDADE</th></tr>
    </thead>
    <tbody>
      ${cabecalhoBlocoEditorHtml('AFASTADOS')}
      <tr class="subth">
        <th>MATRÍCULA</th><th>POLICIAL</th><th></th><th></th><th>FUNÇÃO</th><th class="subth-acoes">Ações</th>
      </tr>
      ${corpoAfast}
      <tr class="row-add-policial"><td colspan="6" style="padding:10px 8px">
  <button type="button" class="btn-add-policial" data-bloco-id="AFASTADOS">+ Adicionar policial</button>
</td></tr>
      <tr class="obs">
        <td colspan="6">
          <strong>OBSERVAÇÕES</strong>
          <textarea name="obs-AFASTADOS" class="obs-field" rows="2" style="width:100%;margin-top:6px;box-sizing:border-box"></textarea>
        </td>
      </tr>
    </tbody>
  </table>
</section>`);
  }

  const BLOCO_IDS = [...ORDEM_BLOCOS_IMPRESSAO, 'AFASTADOS'] as string[];
  const polById = Object.fromEntries(polSlim.map((p) => [String(p.id), p]));
  const funById = Object.fromEntries(funcoes.map((f) => [String(f.id), f]));

  const initialDraft = { ...draft, cabecalhoPorBloco: undefined, cabecalhoFormulario: undefined };

  const script = `
<script>
(function() {
  var MSG = ${safeJsonForScript(ESCALA_DEFINITIVA_RENDER_MESSAGE)};
  var BLOCO_IDS = ${safeJsonForScript(BLOCO_IDS)};
  var LINE_META = ${safeJsonForScript(metaLinhas)};
  var POL_BY_ID = ${safeJsonForScript(polById)};
  var POL_LIST = ${safeJsonForScript(polListSorted)};
  var FUN_BY_ID = ${safeJsonForScript(funById)};
  ${escalaEditorOrderingInline.trim()}
  var INITIAL_DRAFT = ${safeJsonForScript(initialDraft)};
  var HORARIO_AUTO = ${safeJsonForScript(ESCALA_CABECALHO_HORARIO_AUTOMATICO)};
  var ORDEM_BLOCOS = ${safeJsonForScript([...ORDEM_BLOCOS_IMPRESSAO])};
  var addSeq = 0;
  var activePolComboKey = null;
  var activePolComboBtn = null;

  function normalizarBlocoEscalaDraft(bid) {
    if (bid === 'EXP_13_19_ORG') return 'EXP_13_19_SEG_SEX';
    return bid;
  }

  function dataGeracaoFmt() {
    var iso = INITIAL_DRAFT.dataGeracaoIso;
    var d = iso ? new Date(iso) : new Date();
    return d.toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' });
  }

  document.querySelectorAll('.cel-data-geracao').forEach(function(el) {
    el.textContent = dataGeracaoFmt();
  });

  function equipeLabel(p) {
    if (!p || !p.equipe || p.equipe === 'SEM_EQUIPE') return null;
    return 'Equipe ' + p.equipe;
  }

  function normBusca(s) {
    if (!s) return '';
    return String(s)
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '');
  }

  function formatMatriculaExibicao(s) {
    if (s == null) return '';
    var t = String(s).trim();
    if (!t) return '';
    if (
      /^\\d{1}\\.\\d{3}\\/\\d$/.test(t) ||
      /^\\d{2}\\.\\d{3}\\/\\d$/.test(t) ||
      /^\\d{3}\\.\\d{3}\\/\\d$/.test(t)
    ) {
      return t;
    }
    var d = t.replace(/\\D/g, '');
    if (d.length === 5) return d.slice(0, 1) + '.' + d.slice(1, 4) + '/' + d.slice(4);
    if (d.length === 6) return d.slice(0, 2) + '.' + d.slice(2, 5) + '/' + d.slice(5);
    if (d.length === 7) return d.slice(0, 3) + '.' + d.slice(3, 6) + '/' + d.slice(6);
    return t;
  }

  function closePolCombo() {
    var pop = document.getElementById('pol-combo-popover');
    if (pop) pop.style.display = 'none';
    if (activePolComboBtn) activePolComboBtn.setAttribute('aria-expanded', 'false');
    activePolComboKey = null;
    activePolComboBtn = null;
  }

  function renderPolComboList(query, selectedIdStr) {
    var qn = normBusca(query);
    var ul = document.querySelector('#pol-combo-popover .pol-combo-list');
    if (!ul) return;
    ul.innerHTML = '';
    var cur = selectedIdStr == null ? '' : String(selectedIdStr);
    function appendLi(id, text) {
      var li = document.createElement('li');
      li.className = 'pol-combo-li';
      li.setAttribute('data-id', id);
      li.setAttribute('role', 'option');
      li.textContent = text;
      if (String(id) === cur) li.classList.add('is-current');
      ul.appendChild(li);
    }
    if (!qn) appendLi('', '— Selecione —');
    for (var i = 0; i < POL_LIST.length; i++) {
      var it = POL_LIST[i];
      var hay = normBusca(it.label + ' ' + (it.matricula || ''));
      if (qn && hay.indexOf(qn) === -1) continue;
      appendLi(String(it.id), it.label);
    }
    if (ul.children.length === 0) {
      var empty = document.createElement('li');
      empty.className = 'pol-combo-li';
      empty.style.cursor = 'default';
      empty.style.color = '#666';
      empty.textContent = 'Nenhum policial encontrado.';
      ul.appendChild(empty);
    }
  }

  function positionPolComboPopover(anchorBtn) {
    var pop = document.getElementById('pol-combo-popover');
    if (!pop || !anchorBtn) return;
    var r = anchorBtn.getBoundingClientRect();
    var w = Math.max(r.width, 260);
    pop.style.left = Math.min(r.left, window.innerWidth - w - 8) + 'px';
    pop.style.top = (r.bottom + 2) + 'px';
    pop.style.width = w + 'px';
  }

  function openPolCombo(btn) {
    var key = btn.getAttribute('data-line-key');
    if (!key) return;
    activePolComboKey = key;
    activePolComboBtn = btn;
    var hidden = document.querySelector('[name="policial-' + key + '"]');
    var selVal = hidden ? hidden.value : '';
    var q = document.querySelector('#pol-combo-popover .pol-combo-q');
    if (q) q.value = '';
    renderPolComboList('', selVal);
    var pop = document.getElementById('pol-combo-popover');
    if (!pop) return;
    positionPolComboPopover(btn);
    pop.style.display = 'block';
    btn.setAttribute('aria-expanded', 'true');
    setTimeout(function() { if (q) q.focus(); }, 0);
  }

  function syncMatriculaAndFuncaoFromPolicial(lineKey) {
    var ps = document.querySelector('[name="policial-' + lineKey + '"]');
    var fs = document.querySelector('[name="funcao-' + lineKey + '"]');
    var mat = document.querySelector('.cel-matricula[data-line-key="' + lineKey + '"]');
    if (!ps || !fs || !mat) return;
    if (!ps.value) {
      mat.textContent = '—';
      return;
    }
    var pid = parseInt(ps.value, 10);
    var p = POL_BY_ID[String(pid)];
    if (!p) {
      mat.textContent = '—';
      return;
    }
    mat.textContent = formatMatriculaExibicao(p.matricula) || '—';
    if (p.funcaoId != null) fs.value = String(p.funcaoId);
  }

  document.getElementById('pol-combo-popover').addEventListener('click', function(e) {
    var li = e.target.closest && e.target.closest('.pol-combo-li');
    if (!li || !activePolComboKey || !li.hasAttribute('data-id')) return;
    e.stopPropagation();
    var id = li.getAttribute('data-id');
    if (id === null) id = '';
    var hidden = document.querySelector('[name="policial-' + activePolComboKey + '"]');
    var btn = document.querySelector('.pol-combo-btn[data-line-key="' + activePolComboKey + '"]');
    if (!hidden || !btn) return;
    hidden.value = id;
    if (!id) {
      btn.textContent = '— Selecione —';
    } else {
      var p = POL_BY_ID[id];
      btn.textContent = p ? p.nome : '—';
    }
    var k = activePolComboKey;
    closePolCombo();
    syncMatriculaAndFuncaoFromPolicial(k);
  });

  document.querySelector('#pol-combo-popover .pol-combo-q').addEventListener('input', function() {
    if (!activePolComboKey) return;
    var hidden = document.querySelector('[name="policial-' + activePolComboKey + '"]');
    renderPolComboList(this.value, hidden ? hidden.value : '');
    if (activePolComboBtn) positionPolComboPopover(activePolComboBtn);
  });

  document.addEventListener('keydown', function(e) {
    if (e.key === 'Escape') closePolCombo();
  });

  window.addEventListener('scroll', function() { closePolCombo(); }, true);
  window.addEventListener('resize', function() { closePolCombo(); });

  function addPolicialRow(blocoId) {
    var section = document.querySelector('.bloco-escala[data-bloco-id="' + blocoId + '"]');
    if (!section) return;
    var tbody = section.querySelector('table.editor-table tbody');
    var obsRow = tbody.querySelector('tr.obs');
    if (!obsRow) return;
    var msg = tbody.querySelector('tr.no-rows-msg');
    if (msg) msg.remove();
    var horario = section.getAttribute('data-default-horario') || '';
    var lista = section.getAttribute('data-lista') || 'DISPONIVEL';
    var tipoLinha = section.getAttribute('data-tipo-linha') || 'EXPEDIENTE';
    var key = blocoId + '-add-' + (++addSeq) + '-' + Date.now();
    LINE_META.push({
      key: key,
      snapshot: {
        lista: lista,
        policialId: 0,
        nome: '',
        matricula: '',
        equipe: null,
        horarioServico: horario,
        funcaoNome: null,
        detalheAfastamento: null,
        blocoEscala: blocoId,
        tipoServicoLinha: tipoLinha
      }
    });
    var tr = document.createElement('tr');
    tr.setAttribute('data-line-key', key);
    var tdMat = document.createElement('td');
    tdMat.className = 'cel-matricula';
    tdMat.setAttribute('data-line-key', key);
    tdMat.textContent = '—';
    var tdPol = document.createElement('td');
    var wrapP = document.createElement('div');
    wrapP.className = 'policial-combo';
    wrapP.setAttribute('data-line-key', key);
    var hidP = document.createElement('input');
    hidP.type = 'hidden';
    hidP.name = 'policial-' + key;
    hidP.value = '';
    var btnP = document.createElement('button');
    btnP.type = 'button';
    btnP.className = 'pol-combo-btn';
    btnP.setAttribute('data-line-key', key);
    btnP.setAttribute('aria-haspopup', 'listbox');
    btnP.setAttribute('aria-expanded', 'false');
    btnP.textContent = '— Selecione —';
    wrapP.appendChild(hidP);
    wrapP.appendChild(btnP);
    tdPol.appendChild(wrapP);
    var tdF = document.createElement('td');
    var tdE = document.createElement('td');
    var tdFn = document.createElement('td');
    var selF = document.createElement('select');
    selF.className = 'sel-funcao';
    selF.setAttribute('data-line-key', key);
    selF.name = 'funcao-' + key;
    selF.style.cssText = 'max-width:100%;font-size:0.85rem';
    var tplF = document.getElementById('tpl-funcao-opts');
    if (tplF) {
      for (var j = 0; j < tplF.options.length; j++) {
        selF.appendChild(tplF.options[j].cloneNode(true));
      }
    }
    tdFn.appendChild(selF);
    var tdAc = document.createElement('td');
    tdAc.className = 'cel-acoes';
    var btnEx = document.createElement('button');
    btnEx.type = 'button';
    btnEx.className = 'btn-excluir-linha';
    btnEx.setAttribute('data-line-key', key);
    btnEx.textContent = 'Excluir';
    tdAc.appendChild(btnEx);
    tr.appendChild(tdMat);
    tr.appendChild(tdPol);
    tr.appendChild(tdF);
    tr.appendChild(tdE);
    tr.appendChild(tdFn);
    tr.appendChild(tdAc);
    var addBar = tbody.querySelector('tr.row-add-policial');
    if (addBar) tbody.insertBefore(tr, addBar);
    else tbody.insertBefore(tr, obsRow);
  }

  function ocultarBlocoSeSemPoliciais(section) {
    var tbody = section.querySelector('table.editor-table tbody');
    if (!tbody || tbody.querySelectorAll('tr[data-line-key]').length > 0) return;
    section.style.display = 'none';
  }

  function excluirLinhaPolicialDaEscala(lineKey) {
    if (!confirm('Remover este policial deste bloco da escala?')) return;
    if (activePolComboKey === lineKey) closePolCombo();
    for (var i = LINE_META.length - 1; i >= 0; i--) {
      if (LINE_META[i].key === lineKey) {
        LINE_META.splice(i, 1);
        break;
      }
    }
    var tr = null;
    var rows = document.querySelectorAll('tr[data-line-key]');
    for (var ri = 0; ri < rows.length; ri++) {
      if (rows[ri].getAttribute('data-line-key') === lineKey) {
        tr = rows[ri];
        break;
      }
    }
    if (!tr) return;
    var section = tr.closest && tr.closest('.bloco-escala');
    tr.remove();
    if (section) ocultarBlocoSeSemPoliciais(section);
  }

  document.body.addEventListener('click', function(e) {
    var t = e.target;
    if (t && t.closest && t.closest('#pol-combo-popover')) return;
    var exBtn = t && t.closest && t.closest('.btn-excluir-linha');
    if (exBtn) {
      var lk = exBtn.getAttribute('data-line-key');
      if (lk) excluirLinhaPolicialDaEscala(lk);
      return;
    }
    if (t && t.classList && t.classList.contains('pol-combo-btn')) {
      var pop = document.getElementById('pol-combo-popover');
      var k = t.getAttribute('data-line-key');
      if (activePolComboKey === k && pop && pop.style.display === 'block') closePolCombo();
      else {
        closePolCombo();
        openPolCombo(t);
      }
      return;
    }
    if (t && t.classList && t.classList.contains('btn-add-policial')) {
      var bid = t.getAttribute('data-bloco-id');
      if (bid) addPolicialRow(bid);
      return;
    }
    closePolCombo();
  });

  function collectDraft() {
    var cabecalhoPorBloco = {};
    BLOCO_IDS.forEach(function(bid) {
      var tipo = document.querySelector('[name="tipo-' + bid + '"]');
      var circ = document.querySelector('[name="circ-' + bid + '"]');
      var esp = document.querySelector('[name="esp-' + bid + '"]');
      var obs = document.querySelector('[name="obs-' + bid + '"]');
      cabecalhoPorBloco[bid] = {
        horario: HORARIO_AUTO,
        tipo: tipo ? tipo.value : '',
        circunstancia: circ ? circ.value : '',
        especialidade: esp ? esp.value : '',
        observacoes: obs ? obs.value : ''
      };
    });

    var linhas = [];
    for (var i = 0; i < LINE_META.length; i++) {
      var m = LINE_META[i];
      var k = m.key;
      var snap = m.snapshot;
      var polEl = document.querySelector('[name="policial-' + k + '"]');
      var funEl = document.querySelector('[name="funcao-' + k + '"]');
      if (!polEl) continue;
      if (!polEl.value) {
        alert('Selecione o policial em todas as linhas (incluindo as adicionadas) antes de gerar a escala definitiva.');
        return null;
      }
      var pid = parseInt(polEl.value, 10);
      var p = POL_BY_ID[String(pid)];
      if (!p) {
        alert('Policial inválido em uma das linhas.');
        return null;
      }
      var fid = funEl && funEl.value ? parseInt(funEl.value, 10) : null;
      var fn = (fid != null && FUN_BY_ID[String(fid)]) ? FUN_BY_ID[String(fid)].nome : (p.funcaoNome || null);
      var eq = snap.equipe != null && snap.equipe !== '' ? snap.equipe : equipeLabel(p);
      linhas.push({
        lista: snap.lista,
        policialId: pid,
        nome: p.nome,
        matricula: p.matricula,
        equipe: eq,
        horarioServico: snap.horarioServico,
        funcaoNome: fn,
        detalheAfastamento: snap.detalheAfastamento,
        blocoEscala: normalizarBlocoEscalaDraft(snap.blocoEscala),
        tipoServicoLinha: snap.tipoServicoLinha
      });
    }

    var disp = linhas.filter(function(l) { return l.lista === 'DISPONIVEL'; });
    var af = linhas.filter(function(l) { return l.lista === 'AFASTADO'; });
    function indiceBloco(b) {
      var ix = ORDEM_BLOCOS.indexOf(normalizarBlocoEscalaDraft(b));
      return ix === -1 ? 998 : ix;
    }
    function cmpDisp(a, b) {
      var oa = indiceBloco(a.blocoEscala);
      var ob = indiceBloco(b.blocoEscala);
      if (oa !== ob) return oa - ob;
      return compareLinhasEscalaOrd(a, b);
    }
    disp.sort(cmpDisp);
    af.sort(compareLinhasEscalaOrd);

    return {
      dataEscala: INITIAL_DRAFT.dataEscala,
      tipoServico: INITIAL_DRAFT.tipoServico,
      resumoEquipes: INITIAL_DRAFT.resumoEquipes,
      linhas: disp.concat(af),
      dataGeracaoIso: INITIAL_DRAFT.dataGeracaoIso,
      cabecalhoPorBloco: cabecalhoPorBloco
    };
  }

  function fecharEditor() {
    window.close();
  }
  function gerarEscalaDefinitiva() {
    var draft = collectDraft();
    if (!draft) return;
    if (window.opener) {
      window.opener.postMessage({ type: MSG, draft: draft }, '*');
    }
  }
  document.getElementById('btn-cancelar').onclick = fecharEditor;
  document.getElementById('btn-cancelar-rodape').onclick = fecharEditor;
  document.getElementById('btn-definitiva').onclick = gerarEscalaDefinitiva;
  document.getElementById('btn-definitiva-rodape').onclick = gerarEscalaDefinitiva;
})();
</script>`;

  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="utf-8"/>
<title>Editar escala — ${escHtml(draft.dataEscala)}</title>
<style>
  body { font-family: system-ui, sans-serif; margin: 20px; color: #111; font-size: 0.9rem; }
  h1 { font-size: 1.35rem; margin-bottom: 8px; }
  .subtitulo { color: #555; margin-bottom: 20px; line-height: 1.5; }
  .bloco-escala { margin-bottom: 28px; }
  .titulo-bloco { font-size: 1.02rem; margin: 0 0 8px 0; border-bottom: 1px solid #333; padding-bottom: 4px; }
  table.editor-table { width: 100%; border-collapse: collapse; table-layout: fixed; border: none; }
  .editor-table th, .editor-table td { border: none; padding: 6px 8px; text-align: left; vertical-align: middle; }
  .editor-table thead th { background: transparent; font-size: 0.78rem; }
  .cab-valores td { background: transparent; font-size: 0.85rem; }
  .cab-sel { width: 100%; max-width: 100%; font-size: 0.82rem; }
  .subth th { background: transparent; font-size: 0.78rem; }
  .subth th.subth-acoes { white-space: nowrap; width: 4.5rem; }
  .cel-acoes { white-space: nowrap; vertical-align: middle; }
  .btn-excluir-linha {
    font-size: 0.78rem;
    padding: 4px 8px;
    cursor: pointer;
    border-radius: 4px;
    border: 1px solid #b71c1c;
    color: #b71c1c;
    background: #fff;
  }
  .btn-excluir-linha:hover { background: #ffebee; }
  .obs td { background: transparent; vertical-align: top; }
  .muted { color: #666; font-style: italic; font-size: 0.88rem; }
  .acoes-top, .acoes-rodape {
    display: flex;
    gap: 12px;
    flex-wrap: wrap;
    align-items: center;
  }
  .acoes-top { margin-bottom: 24px; }
  .acoes-rodape { margin-top: 32px; margin-bottom: 20px; }
  .acoes-top button, .acoes-rodape button {
    padding: 10px 18px;
    font-size: 0.95rem;
    cursor: pointer;
    border-radius: 6px;
    border: 1px solid #333;
    background: #fff;
  }
  .acoes-top .primary, .acoes-rodape .primary { background: #1565c0; color: #fff; border-color: #1565c0; }
  .acoes-top .danger, .acoes-rodape .danger { border-color: #b71c1c; color: #b71c1c; }
  .policial-combo { position: relative; min-width: 0; }
  .pol-combo-btn {
    width: 100%;
    box-sizing: border-box;
    display: block;
    text-align: left;
    font-size: 0.85rem;
    padding: 5px 1.75rem 5px 8px;
    border: 1px solid #555;
    border-radius: 3px;
    background-color: #fff;
    background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='8' viewBox='0 0 12 8'%3E%3Cpath fill='%23333' d='M6 8L0 0h12z'/%3E%3C/svg%3E");
    background-repeat: no-repeat;
    background-position: right 0.5rem center;
    background-size: 10px 6px;
    cursor: pointer;
    color: inherit;
  }
  .pol-combo-popover {
    position: fixed;
    z-index: 10000;
    box-sizing: border-box;
    background: #fff;
    border: 1px solid #333;
    border-radius: 4px;
    box-shadow: 0 6px 20px rgba(0,0,0,0.18);
    max-height: min(340px, 72vh);
    display: flex;
    flex-direction: column;
    overflow: hidden;
  }
  .pol-combo-popover .pol-combo-q {
    flex: 0 0 auto;
    width: 100%;
    box-sizing: border-box;
    border: 0;
    border-bottom: 1px solid #ccc;
    padding: 8px 10px;
    font-size: 0.85rem;
    outline: none;
  }
  .pol-combo-list {
    list-style: none;
    margin: 0;
    padding: 4px 0;
    overflow-y: auto;
    flex: 1 1 auto;
    min-height: 0;
  }
  .pol-combo-li {
    padding: 6px 10px;
    font-size: 0.85rem;
    cursor: pointer;
  }
  .pol-combo-li:hover { background: #e3f2fd; }
  .pol-combo-li.is-current { font-weight: 600; background: #f0f0f0; }
</style>
</head>
<body>
  <h1>Editar escala</h1>
  <p class="subtitulo">Só aparecem os blocos que já têm pelo menos um policial. Use <strong>Adicionar policial</strong> e <strong>Excluir</strong> dentro de cada bloco visível. Se remover todos de um bloco, ele some da tela. Matrícula preenchida ao escolher o nome. Depois: <strong>Gerar escala definitiva</strong>.</p>
  <div class="acoes-top">
    <button type="button" class="danger" id="btn-cancelar">Cancelar</button>
    <button type="button" class="primary" id="btn-definitiva">Gerar escala definitiva</button>
  </div>
  <div id="escala-editor-templates" style="display:none" aria-hidden="true">
    <select id="tpl-funcao-opts"><option value="">—</option>${optsFuncaoInner}</select>
  </div>
  <div id="pol-combo-popover" class="pol-combo-popover" style="display:none" role="dialog" aria-label="Escolher policial">
    <input type="search" class="pol-combo-q" placeholder="Buscar nome ou matrícula…" autocomplete="off" />
    <ul class="pol-combo-list" role="listbox"></ul>
  </div>
  ${secoes.join('\n')}
  <div class="acoes-rodape">
    <button type="button" class="danger" id="btn-cancelar-rodape">Cancelar</button>
    <button type="button" class="primary" id="btn-definitiva-rodape">Gerar escala definitiva</button>
  </div>
  ${script}
</body>
</html>`;
}

export function writeEscalaGeradaEditorWindow(
  w: Window,
  draft: EscalaGeradaDraftPayload,
  policiais: Policial[],
  funcoes: FuncaoOpt[],
): void {
  const html = buildEscalaGeradaEditorHtml(draft, policiais, funcoes);
  w.document.open();
  w.document.write(html);
  w.document.close();
}
