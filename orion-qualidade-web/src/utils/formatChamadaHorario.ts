/**
 * Extrai e normaliza horário para exibição hh:mm:ss a partir de textos vindos do Excel
 * (só hora, data+hora pt-BR, ISO, etc.).
 */
export function horarioParaHHMMSS(raw: string): string {
  const s = raw.trim();
  if (!s) return '';

  const partesValidas = (h: number, m: number, sec: number): string => {
    const hh = String(Math.min(23, Math.max(0, Math.trunc(h)))).padStart(2, '0');
    const mm = String(Math.min(59, Math.max(0, Math.trunc(m)))).padStart(2, '0');
    const ss = String(Math.min(59, Math.max(0, Math.trunc(sec)))).padStart(2, '0');
    return `${hh}:${mm}:${ss}`;
  };

  const aplicarMatch = (m: RegExpMatchArray): string =>
    partesValidas(
      parseInt(m[1], 10),
      parseInt(m[2], 10),
      m[3] != null ? parseInt(m[3], 10) : 0,
    );

  // Linha só com hora: "14:30" ou "14:30:00"
  let m = s.match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?$/);
  if (m) return aplicarMatch(m);

  // Último trecho hh:mm(:ss) (ex.: "07/04/2026, 14:30:00" ou ISO com hora no fim)
  const trechos = s.match(/\d{1,2}:\d{2}(?::\d{2})?/g);
  if (trechos && trechos.length > 0) {
    const ultimo = trechos[trechos.length - 1];
    m = ultimo.match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?$/);
    if (m) return aplicarMatch(m);
  }

  const d = new Date(s);
  if (!Number.isNaN(d.getTime())) {
    return partesValidas(d.getHours(), d.getMinutes(), d.getSeconds());
  }

  return '';
}
