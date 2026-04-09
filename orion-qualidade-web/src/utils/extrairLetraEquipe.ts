const LETRAS_EQUIPE = new Set(['A', 'B', 'C', 'D', 'E']);

/**
 * Obtém a letra da equipe (A–E) a partir do texto do cadastro SAD.
 * Aceita valores como "A", "Equipe B", "EQUIPE C", etc.
 */
export function extrairLetraEquipe(equipeRaw: string | null | undefined): string | null {
  const s = (equipeRaw ?? '').trim().toUpperCase().normalize('NFC');
  if (!s) return null;
  if (s.length === 1 && LETRAS_EQUIPE.has(s)) return s;
  const isolada = s.match(/\b([A-E])\b/);
  if (isolada) return isolada[1];
  const aposEquipe = s.match(/(?:EQUIPE|EQ\.?)\s*([A-E])\b/);
  if (aposEquipe) return aposEquipe[1];
  return null;
}
