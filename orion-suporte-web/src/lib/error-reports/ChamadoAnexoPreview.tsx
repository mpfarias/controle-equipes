import { Box, Link, Typography } from '@mui/material';

const IMAGE_MIMES = new Set([
  'image/png',
  'image/jpeg',
  'image/jpg',
  'image/webp',
  'image/gif',
]);

function mimeFromDataUrl(dataUrl: string): string | null {
  const m = /^data:([\w/+.-]+);/i.exec(dataUrl);
  return m ? m[1].toLowerCase().split(';')[0].trim() : null;
}

export interface ChamadoAnexoPreviewProps {
  anexoDataUrl: string;
  anexoNome?: string | null;
  /** Lista compacta: imagem menor; PDF só como link. */
  compact?: boolean;
  /** Quando false, não exibe o rótulo "Anexo" (ex.: formulário já tem título). */
  showTitle?: boolean;
}

export function ChamadoAnexoPreview({
  anexoDataUrl,
  anexoNome,
  compact,
  showTitle = true,
}: ChamadoAnexoPreviewProps) {
  const mime = mimeFromDataUrl(anexoDataUrl);
  const label = anexoNome?.trim() || 'Anexo';
  const isPdf = mime === 'application/pdf';
  const isImg = mime != null && IMAGE_MIMES.has(mime);

  return (
    <Box sx={{ mt: compact ? 1 : 2 }}>
      {showTitle ? (
        <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 1 }}>
          Anexo
        </Typography>
      ) : null}
      {isImg ? (
        <Box
          component="img"
          src={anexoDataUrl}
          alt={label}
          sx={{
            maxWidth: '100%',
            maxHeight: compact ? 180 : 420,
            objectFit: 'contain',
            borderRadius: 1,
            border: '1px solid var(--border-soft)',
            display: 'block',
          }}
        />
      ) : isPdf ? (
        <>
          <Link href={anexoDataUrl} target="_blank" rel="noopener noreferrer" sx={{ wordBreak: 'break-all' }}>
            Abrir PDF ({label})
          </Link>
          {!compact ? (
            <Box
              component="iframe"
              title={label}
              src={anexoDataUrl}
              sx={{
                width: '100%',
                height: 380,
                border: '1px solid var(--border-soft)',
                borderRadius: 1,
                mt: 1,
                display: 'block',
              }}
            />
          ) : null}
        </>
      ) : (
        <Link href={anexoDataUrl} target="_blank" rel="noopener noreferrer" sx={{ wordBreak: 'break-all' }}>
          Abrir anexo ({label})
        </Link>
      )}
    </Box>
  );
}
