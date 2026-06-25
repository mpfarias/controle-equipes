export const DEFAULT_RECORD_FILE_PATH_PREFIX = '/var/spool/asterisk/monitor';

export type RecordFileUrlMode = 'relative' | 'fullpath-query' | 'relative-query';

export type RecordFileConfig = {
  baseUrl: string;
  pathPrefix: string;
  mode: RecordFileUrlMode;
  queryParam: string;
};

function trimSlashes(v: string): string {
  return v.replace(/\/+$/, '');
}

function normalizePathSeparators(v: string): string {
  return v.replace(/\\/g, '/');
}

export function parseRecordFileConfig(env: NodeJS.ProcessEnv): RecordFileConfig | null {
  const baseRaw = env.INTEGRA_SSP_RECORD_FILE_BASE_URL?.trim();
  if (!baseRaw) return null;

  const modeRaw = env.INTEGRA_SSP_RECORD_FILE_URL_MODE?.trim().toLowerCase();
  const mode: RecordFileUrlMode =
    modeRaw === 'relative' || modeRaw === 'relative-query' || modeRaw === 'fullpath-query'
      ? modeRaw
      : 'fullpath-query';

  const pathPrefix =
    env.INTEGRA_SSP_RECORD_FILE_PATH_PREFIX?.trim() || DEFAULT_RECORD_FILE_PATH_PREFIX;

  const queryParam = env.INTEGRA_SSP_RECORD_FILE_QUERY_PARAM?.trim() || 'file';

  return {
    baseUrl: trimSlashes(baseRaw),
    pathPrefix: normalizePathSeparators(pathPrefix).replace(/\/+$/, ''),
    mode,
    queryParam,
  };
}

export function relativeRecordFilePath(recordFile: string, pathPrefix = DEFAULT_RECORD_FILE_PATH_PREFIX): string {
  const normalized = normalizePathSeparators(recordFile.trim());
  const prefix = normalizePathSeparators(pathPrefix).replace(/\/+$/, '');
  if (normalized.toLowerCase().startsWith(`${prefix.toLowerCase()}/`)) {
    return normalized.slice(prefix.length + 1);
  }
  return normalized.replace(/^\/+/, '');
}

export function nomeArquivoGravacao(recordFile: string): string {
  const normalized = normalizePathSeparators(recordFile.trim());
  const parts = normalized.split('/');
  return parts[parts.length - 1] || 'gravacao.wav';
}

/** Converte o valor de `record_file` (URL ou caminho Asterisk) em URL HTTP para download. */
export function resolveRecordFileDownloadUrl(
  recordFile: string | null | undefined,
  config: RecordFileConfig | null,
): string | null {
  const raw = recordFile?.trim();
  if (!raw || !config) return null;
  if (/^https?:\/\//i.test(raw)) return raw;

  const normalized = normalizePathSeparators(raw);
  const relative = relativeRecordFilePath(normalized, config.pathPrefix);

  if (config.mode === 'fullpath-query') {
    const sep = config.baseUrl.includes('?') ? '&' : '?';
    return `${config.baseUrl}${sep}${encodeURIComponent(config.queryParam)}=${encodeURIComponent(normalized)}`;
  }

  if (config.mode === 'relative-query') {
    const sep = config.baseUrl.includes('?') ? '&' : '?';
    return `${config.baseUrl}${sep}${encodeURIComponent(config.queryParam)}=${encodeURIComponent(relative)}`;
  }

  return `${config.baseUrl}/${relative.replace(/^\/+/, '')}`;
}
