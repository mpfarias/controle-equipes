import { useState } from 'react';
import { Box, Link, Typography } from '@mui/material';
import { alpha } from '@mui/material/styles';
import { ImagemLightboxDialog } from '../../components/common/ImagemLightboxDialog';

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

function isImageAnexo(dataUrl: string): boolean {
  const mime = mimeFromDataUrl(dataUrl);
  if (mime != null && IMAGE_MIMES.has(mime)) return true;
  return /^data:image\//i.test(dataUrl);
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
  const [lightboxAberta, setLightboxAberta] = useState(false);
  const mime = mimeFromDataUrl(anexoDataUrl);
  const label = anexoNome?.trim() || 'Anexo';
  const isPdf = mime === 'application/pdf';
  const isImg = isImageAnexo(anexoDataUrl);

  return (
    <Box sx={{ mt: compact ? 1 : 2 }}>
      {showTitle ? (
        <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 1 }}>
          Anexo
        </Typography>
      ) : null}
      {isImg ? (
        <>
          <Box
            component="button"
            type="button"
            onClick={() => setLightboxAberta(true)}
            aria-label={`Ampliar imagem: ${label}`}
            title="Clique para ver a imagem completa"
            sx={{
              display: 'block',
              p: 0,
              border: '1px solid var(--border-soft)',
              borderRadius: 1,
              bgcolor: 'transparent',
              cursor: 'zoom-in',
              maxWidth: '100%',
              transition: 'box-shadow 0.15s ease, border-color 0.15s ease',
              '&:hover': {
                borderColor: alpha('#2dd4bf', 0.55),
                boxShadow: `0 0 0 1px ${alpha('#2dd4bf', 0.25)}`,
              },
              '&:focus-visible': {
                outline: `2px solid ${alpha('#2dd4bf', 0.85)}`,
                outlineOffset: 2,
              },
            }}
          >
            <Box
              component="img"
              src={anexoDataUrl}
              alt={label}
              draggable={false}
              sx={{
                maxWidth: '100%',
                maxHeight: compact ? 180 : 420,
                objectFit: 'contain',
                borderRadius: 1,
                display: 'block',
                verticalAlign: 'bottom',
              }}
            />
          </Box>
          <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.5 }}>
            Clique na imagem para ampliar
          </Typography>
          <ImagemLightboxDialog
            open={lightboxAberta}
            src={anexoDataUrl}
            alt={label}
            onClose={() => setLightboxAberta(false)}
          />
        </>
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
