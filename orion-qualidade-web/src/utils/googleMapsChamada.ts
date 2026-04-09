import type { ChamadaXlsxRow } from '../types/chamadasXlsx';

/** Interpreta número da planilha (vírgula ou ponto decimal, espaços). */
export function parseCoordenadaGeografica(raw: string): number | null {
  const s = raw.trim().replace(/\s/g, '').replace(',', '.');
  if (!s) return null;
  const n = Number.parseFloat(s);
  return Number.isFinite(n) ? n : null;
}

export function coordenadasGeograficasValidas(lat: number, lng: number): boolean {
  return lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180;
}

/**
 * URL do Google Maps no ponto (abre em nova aba; não exige chave de API).
 * Ordem: latitude, longitude.
 */
export function urlGoogleMapsLatLng(lat: number, lng: number): string {
  const query = `${lat},${lng}`;
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`;
}

/**
 * Monta latitude/longitude reais para o mapa.
 * Na planilha exportada, os valores nas colunas nomeadas "Latitude" e "Longitude" vêm trocados
 * em relação ao padrão do Google Maps (lat, lng); aqui invertemos só na hora de abrir o mapa.
 */
export function coordenadasDaChamada(row: ChamadaXlsxRow): { lat: number; lng: number } | null {
  const valorColunaLatitude = parseCoordenadaGeografica(row.latitude);
  const valorColunaLongitude = parseCoordenadaGeografica(row.longitude);
  if (valorColunaLatitude == null || valorColunaLongitude == null) return null;

  const lat = valorColunaLongitude;
  const lng = valorColunaLatitude;

  if (!coordenadasGeograficasValidas(lat, lng)) return null;
  return { lat, lng };
}

export function abrirLocalChamadaNoGoogleMaps(row: ChamadaXlsxRow): void {
  const c = coordenadasDaChamada(row);
  if (!c) return;
  const url = urlGoogleMapsLatLng(c.lat, c.lng);
  window.open(url, '_blank', 'noopener,noreferrer');
}
