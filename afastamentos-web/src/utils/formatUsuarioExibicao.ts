/**
 * Separa posto/graduação embutida no campo `nome` (ex.: "2º SGT MARCELO FARIAS").
 * Mesmas siglas usadas em `sortPoliciais.ts`.
 */
const GRADUACAO_REGEXES: RegExp[] = [
  /\bCEL\b/i,
  /\bTC\b/i,
  /\bMAJ\b/i,
  /\bCAP\b/i,
  /\b2[º°ªo.]?\s*TEN\b/i,
  /\b1[º°ªo.]?\s*TEN\b/i,
  /\bASP\b/i,
  /\bSUB\s*TEN\b/i,
  /\bSUBTEN\b/i,
  /\bST\b/i,
  /\b1[º°ªo.]?\s*SGT\b/i,
  /\b2[º°ªo.]?\s*SGT\b/i,
  /\b3[º°ªo.]?\s*SGT\b/i,
  /\bCB\b/i,
  /\bSD\b/i,
  /\bCIVIL\b/i,
];

export function separarGraduacaoENome(nomeCompleto: string): { graduacao: string; nome: string } {
  const texto = nomeCompleto.trim().replace(/\s+/g, ' ');
  if (!texto) return { graduacao: '', nome: '' };

  for (const re of GRADUACAO_REGEXES) {
    const m = texto.match(new RegExp(`^(${re.source})\\s+(.+)$`, re.flags));
    if (m?.[1] && m[2]) {
      return { graduacao: m[1].trim(), nome: m[2].trim() };
    }
  }

  for (const re of GRADUACAO_REGEXES) {
    const m = texto.match(new RegExp(`^(.+?)\\s+(${re.source})$`, re.flags));
    if (m?.[1] && m[2]) {
      return { graduacao: m[2].trim(), nome: m[1].trim() };
    }
  }

  return { graduacao: '', nome: texto };
}

/** Nome para exibição em saudações e cabeçalho (sempre em maiúsculas). */
export function formatNomeProprioExibicao(nome: string): string {
  return nome.trim().replace(/\s+/g, ' ').toUpperCase();
}

/** Quadro após a graduação no campo nome (ex.: "TC QOPM JOÃO SILVA"). */
const QUADRO_NO_NOME_REGEX = /^(QOPM|QPPMC|QPMCOM)\s+(.+)$/i;

/**
 * Linha sob a assinatura na escala definitiva: "NOME COMPLETO - TC QOPM".
 */
export function formatLinhaAssinaturaCmtUpm(nomeCompleto: string): string {
  const texto = nomeCompleto.trim();
  if (!texto) return '';

  const { graduacao, nome: resto } = separarGraduacaoENome(texto);
  let quadro = '';
  let nomeProprio = resto;
  const qm = resto.match(QUADRO_NO_NOME_REGEX);
  if (qm?.[1] && qm[2]) {
    quadro = qm[1].trim().toUpperCase();
    nomeProprio = qm[2].trim();
  }
  const gradFmt = graduacao.trim().toUpperCase();
  /** Cmt UPM: cadastro costuma vir só "TC NOME…"; na assinatura completa-se com QOPM. */
  if (!quadro && gradFmt) {
    quadro = 'QOPM';
  }

  const nomeFmt = formatNomeProprioExibicao(nomeProprio);
  const postoPartes = [gradFmt, quadro].filter(Boolean);
  if (postoPartes.length === 0) return nomeFmt;
  return `${nomeFmt} - ${postoPartes.join(' ')}`;
}

export function formatUsuarioSaudacaoCompleta(nomeCompleto: string): string {
  const { graduacao, nome } = separarGraduacaoENome(nomeCompleto);
  const nomeFmt = formatNomeProprioExibicao(nome || nomeCompleto);
  const gradFmt = graduacao.trim().toUpperCase();
  return gradFmt ? `${gradFmt} ${nomeFmt}` : nomeFmt;
}

export function primeiroNomeUsuario(nomeCompleto: string): string {
  const { nome } = separarGraduacaoENome(nomeCompleto);
  const base = nome || nomeCompleto;
  const primeiro = base.split(/\s+/).filter(Boolean)[0] ?? base;
  return primeiro.toUpperCase();
}

/** Iniciais do nome próprio (ignora posto/graduação). */
export function iniciaisUsuario(nomeCompleto: string): string {
  const { nome } = separarGraduacaoENome(nomeCompleto);
  const partes = (nome || nomeCompleto).trim().split(/\s+/).filter(Boolean);
  if (partes.length === 0) return '?';
  if (partes.length === 1) return partes[0].charAt(0).toUpperCase();
  return (partes[0].charAt(0) + partes[partes.length - 1].charAt(0)).toUpperCase();
}
