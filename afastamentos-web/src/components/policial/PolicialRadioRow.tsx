import { Box, FormHelperText, Typography } from '@mui/material';
import type { ReactNode } from 'react';

type PolicialRadioRowProps = {
  label: string;
  required?: boolean;
  error?: string | null;
  children: ReactNode;
};

/** Linha com rótulo à esquerda e opções (radio/checkbox) alinhadas na horizontal. */
export function PolicialRadioRow({ label, required, error, children }: PolicialRadioRowProps) {
  return (
    <Box>
      <Box
        sx={{
          display: 'flex',
          flexDirection: { xs: 'column', sm: 'row' },
          alignItems: { xs: 'flex-start', sm: 'center' },
          gap: { xs: 1, sm: 2 },
          px: 2,
          py: 1.25,
          borderRadius: 1.5,
          border: '1px solid',
          borderColor: error ? 'error.main' : 'var(--border-soft, rgba(255,255,255,0.12))',
          bgcolor: 'rgba(0,0,0,0.12)',
          minHeight: 48,
        }}
      >
        <Typography
          variant="body2"
          sx={{
            color: error ? 'error.main' : 'text.secondary',
            fontWeight: 500,
            minWidth: { sm: 148 },
            flexShrink: 0,
          }}
        >
          {label}
          {required ? ' *' : ''}
        </Typography>
        <Box sx={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 0.5 }}>{children}</Box>
      </Box>
      {error ? (
        <FormHelperText error sx={{ mx: 0, mt: 0.5 }}>
          {error}
        </FormHelperText>
      ) : null}
    </Box>
  );
}
