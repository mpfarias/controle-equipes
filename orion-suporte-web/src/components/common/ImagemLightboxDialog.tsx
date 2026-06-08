import { Box, Dialog, IconButton, Typography } from '@mui/material';
import { alpha } from '@mui/material/styles';
import CloseIcon from '@mui/icons-material/Close';

type ImagemLightboxDialogProps = {
  open: boolean;
  src: string;
  alt: string;
  onClose: () => void;
};

/** Exibe a imagem inteira na tela (ajuste proporcional, sem recorte). */
export function ImagemLightboxDialog({ open, src, alt, onClose }: ImagemLightboxDialogProps) {
  return (
    <Dialog
      open={open}
      onClose={onClose}
      fullScreen
      slotProps={{
        backdrop: { sx: { bgcolor: alpha('#000', 0.92) } },
        paper: {
          sx: {
            bgcolor: alpha('#020617', 0.98),
            backgroundImage: 'none',
          },
        },
      }}
    >
      <Box
        sx={{
          display: 'flex',
          flexDirection: 'column',
          width: '100%',
          height: '100%',
          minHeight: '100dvh',
        }}
      >
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 2,
            px: 2,
            py: 1.5,
            flexShrink: 0,
            borderBottom: `1px solid ${alpha('#2dd4bf', 0.2)}`,
          }}
        >
          <Typography
            variant="subtitle2"
            sx={{ color: '#f0fdfa', fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis' }}
            title={alt}
          >
            {alt}
          </Typography>
          <IconButton
            aria-label="Fechar visualização"
            onClick={onClose}
            sx={{
              flexShrink: 0,
              color: '#f0fdfa',
              border: `1px solid ${alpha('#2dd4bf', 0.35)}`,
              bgcolor: alpha('#134e4a', 0.6),
              '&:hover': { bgcolor: alpha('#134e4a', 0.95) },
            }}
          >
            <CloseIcon />
          </IconButton>
        </Box>

        <Box
          sx={{
            flex: 1,
            minHeight: 0,
            width: '100%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            p: { xs: 1.5, sm: 2 },
            boxSizing: 'border-box',
            overflow: 'hidden',
          }}
          onClick={onClose}
        >
          <Box
            component="img"
            src={src}
            alt={alt}
            onClick={(e) => e.stopPropagation()}
            sx={{
              display: 'block',
              maxWidth: '100%',
              maxHeight: '100%',
              width: 'auto',
              height: 'auto',
              objectFit: 'contain',
              borderRadius: 1,
              boxShadow: `0 24px 64px ${alpha('#000', 0.55)}`,
            }}
          />
        </Box>
      </Box>
    </Dialog>
  );
}
