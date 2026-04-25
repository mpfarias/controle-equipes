export function formatMatricula(value: string | null | undefined): string {
  if (!value) return '';
  const str = String(value).trim();
  if (str.length <= 1) return str;
  const last = str.slice(-1);
  const rest = str.slice(0, -1);
  if (!/^\d+$/.test(rest)) return str;
  const lastDisplay = last.toUpperCase() === 'X' ? 'X' : last;
  const formatted = rest.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  return formatted + '/' + lastDisplay;
}
