/**
 * Formata texto tipo nome próprio: cada palavra com inicial maiúscula e demais minúsculas (pt-BR).
 * Respeita hífens (ex.: "Maria-José" → "Maria-José").
 */
export function formatarNomeTitulo(texto: string): string {
  const t = texto.trim();
  if (!t) return '';

  const palavra = (p: string): string => {
    if (!p) return '';
    const first = p.charAt(0).toLocaleUpperCase('pt-BR');
    const rest = p.slice(1).toLocaleLowerCase('pt-BR');
    return first + rest;
  };

  return t
    .split(/\s+/)
    .map((segmento) =>
      segmento
        .split('-')
        .map((p) => palavra(p))
        .join('-'),
    )
    .filter(Boolean)
    .join(' ');
}
