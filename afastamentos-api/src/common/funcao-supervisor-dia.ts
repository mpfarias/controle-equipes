/**
 * Função «Superior de dia» não entra em escala salva nem em Operações (mesma regra do front).
 */
export function funcaoNomeIndicaSuperiorDeDia(nomeFuncao: string | null | undefined): boolean {
  const f = (nomeFuncao ?? '')
    .toUpperCase()
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .replace(/\s+/g, ' ')
    .trim();
  if (!f) return false;
  const compact = f.replace(/\s/g, '');
  return f.includes('SUPERIOR DE DIA') || compact.includes('SUPERIORDEDIA');
}
