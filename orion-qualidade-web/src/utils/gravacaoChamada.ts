import { getToken } from '../api';

const envApiUrl = import.meta.env.VITE_API_URL;
const fallbackApiUrl = `${window.location.protocol}//${window.location.hostname}:3002`;
const apiUrlFromEnv = envApiUrl?.trim();
const isEnvLocalhost =
  apiUrlFromEnv?.includes('localhost') || apiUrlFromEnv?.includes('127.0.0.1');
const isBrowserRemoteHost =
  window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1';
const API_URL =
  isBrowserRemoteHost && isEnvLocalhost ? fallbackApiUrl : apiUrlFromEnv ?? fallbackApiUrl;

export function nomeArquivoGravacao(recordFile: string): string {
  const normalized = recordFile.trim().replace(/\\/g, '/');
  const parts = normalized.split('/');
  return parts[parts.length - 1] || 'gravacao.wav';
}

function extrairNomeDownload(contentDisposition: string | null, fallback: string): string {
  if (!contentDisposition) return fallback;
  const match = /filename\*?=(?:UTF-8''|")?([^";]+)/i.exec(contentDisposition);
  if (!match?.[1]) return fallback;
  try {
    return decodeURIComponent(match[1].replace(/"/g, '').trim());
  } catch {
    return match[1].replace(/"/g, '').trim() || fallback;
  }
}

/** Baixa a gravação via API (JWT) — caminho Asterisk vira arquivo WAV no disco. */
export async function baixarGravacaoChamada(id: string): Promise<void> {
  const chamadaId = id.trim();
  if (!chamadaId) {
    throw new Error('Identificador da chamada inválido.');
  }

  const token = getToken();
  const response = await fetch(
    `${API_URL}/orion-qualidade/v1/chamadas/${encodeURIComponent(chamadaId)}/gravacao`,
    {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    },
  );

  if (!response.ok) {
    let detail = '';
    try {
      const contentType = response.headers.get('content-type');
      if (contentType?.includes('application/json')) {
        const text = await response.text();
        if (text.trim()) {
          const errorData = JSON.parse(text) as { message?: string | string[]; error?: string };
          const msg = errorData.message;
          detail = Array.isArray(msg) ? msg.join(' ') : msg ?? errorData.error ?? text;
        }
      } else {
        detail = (await response.text()).trim();
      }
    } catch {
      detail = response.statusText;
    }
    throw new Error(detail || `Erro ${response.status} ao baixar gravação.`);
  }

  const blob = await response.blob();
  const filename = extrairNomeDownload(
    response.headers.get('Content-Disposition'),
    `gravacao-${chamadaId}.wav`,
  );
  const objectUrl = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = objectUrl;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(objectUrl);
}
