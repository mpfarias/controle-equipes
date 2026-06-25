/** URL do Google Maps para coordenadas válidas; null se lat/long ausentes ou inválidas. */
export function googleMapsUrl(latitude: string, longitude: string): string | null {
  const latRaw = String(latitude ?? '').trim().replace(',', '.');
  const lngRaw = String(longitude ?? '').trim().replace(',', '.');
  if (!latRaw || !lngRaw) return null;
  const lat = Number.parseFloat(latRaw);
  const lng = Number.parseFloat(lngRaw);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${lat},${lng}`)}`;
}

export function temCoordenadasValidas(latitude: string, longitude: string): boolean {
  return googleMapsUrl(latitude, longitude) != null;
}
