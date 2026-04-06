/**
 * Ordenação na janela do editor de escala (sem bundler).
 * Manter alinhado a: gerarEscalasCalculo.ts (indiceFuncaoOrdenacaoEscala) e sortPoliciais.ts (patente/status).
 */
function normalizarRotuloFuncaoEscala(s) {
  if (!s) return '';
  return String(s)
    .toUpperCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function indiceFuncaoOrdenacaoEscala(fn) {
  var f = normalizarRotuloFuncaoEscala(fn);
  if (!f) return 500;
  var compact = f.replace(/\s/g, '').replace(/-/g, '');
  var temOperacoes = f.includes('OPERACOES') || f.includes('OPERACAO');
  if (f.includes('OFICIAL') && temOperacoes && f.includes('AUXILIAR')) return 3;
  if (f.includes('TELEFONISTA') && f.includes('190') && f.includes('AUXILIAR')) return 8;
  var temUpm = f.includes('UPM');
  var ehSubCmtUpm =
    compact.includes('SUBCMTUPM') ||
    compact.includes('SUBTCMTUPM') ||
    (f.includes('SUBCMT') && temUpm) ||
    (f.includes('SUBTCMT') && temUpm) ||
    (f.includes('SUBCOMANDANTE') && temUpm);
  if (ehSubCmtUpm) return 1;
  if (compact.includes('CMTUPM') || /^CMT(\s+|-)?UPM\b/u.test(f)) return 0;
  if (f.includes('OFICIAL') && temOperacoes && !f.includes('AUXILIAR')) return 2;
  if (f.includes('SUPERVISOR') && f.includes('DESPACHO') && f.includes('190')) return 4;
  if (f.includes('SUPERVISOR') && f.includes('ATENDIMENTO') && f.includes('190')) return 5;
  if (f.includes('DESPACHANTE') && f.includes('190')) return 6;
  if (f.includes('TELEFONISTA') && f.includes('190') && !f.includes('AUXILIAR')) return 7;
  if (f.includes('EXPEDIENTE') && f.includes('ADM')) return 9;
  if (f.includes('ANALISTA')) return 10;
  return 500;
}

var STATUS_ORDER_ORD = { ATIVO: 1, DESIGNADO: 2, PTTC: 3, COMISSIONADO: 4, DESATIVADO: 99 };

function getStatusOrderOrd(st) {
  if (st == null || st === '') return 99;
  var n = typeof st === 'string' ? st : st && st.nome ? st.nome : '';
  if (!n) return 99;
  return STATUS_ORDER_ORD[String(n).toUpperCase()] || 99;
}

var PAT_ORD_RULES = [
  [/\bCEL\b/i, 1],
  [/\bTC\b/i, 2],
  [/\bMAJ\b/i, 3],
  [/\bCAP\b/i, 4],
  [/\b2[º°ªo.]?\s*TEN\b/i, 5],
  [/\b1[º°ªo.]?\s*TEN\b/i, 6],
  [/\bASP\b/i, 7],
  [/\bSUB\s*TEN\b/i, 8],
  [/\bSUBTEN\b/i, 8],
  [/\bST\b/i, 8],
  [/\b1[º°ªo.]?\s*SGT\b/i, 9],
  [/\b2[º°ªo.]?\s*SGT\b/i, 10],
  [/\b3[º°ªo.]?\s*SGT\b/i, 11],
  [/\bCB\b/i, 12],
  [/\bSD\b/i, 13],
  [/\bCIVIL\b/i, 14],
];

function getPatenteOrderOrd(nome) {
  var n = String(nome || '').trim();
  for (var i = 0; i < PAT_ORD_RULES.length; i++) {
    if (PAT_ORD_RULES[i][0].test(n)) return PAT_ORD_RULES[i][1];
  }
  return 99;
}

function comparePorPatenteENomeOrd(a, b) {
  var ordA = getPatenteOrderOrd(a.nome);
  var ordB = getPatenteOrderOrd(b.nome);
  if (ordA !== ordB) return ordA - ordB;
  var statusA = getStatusOrderOrd(a.status);
  var statusB = getStatusOrderOrd(b.status);
  if (statusA !== statusB) return statusA - statusB;
  return (a.nome || '').localeCompare(b.nome || '', 'pt-BR', { sensitivity: 'base' });
}

function compareLinhasEscalaOrd(a, b) {
  var fa = indiceFuncaoOrdenacaoEscala(a.funcaoNome);
  var fb = indiceFuncaoOrdenacaoEscala(b.funcaoNome);
  if (fa !== fb) return fa - fb;
  var pa = POL_BY_ID[String(a.policialId)];
  var pb = POL_BY_ID[String(b.policialId)];
  return comparePorPatenteENomeOrd(
    { nome: a.nome, status: pa ? pa.status : null },
    { nome: b.nome, status: pb ? pb.status : null },
  );
}
