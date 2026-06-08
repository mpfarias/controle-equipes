import { Box, Typography } from '@mui/material';
import type { ReactNode } from 'react';

type PolicialFormSectionProps = {
  title: string;
  children: ReactNode;
};

/** Bloco visual de seção do cadastro de policial. */
export function PolicialFormSection({ title, children }: PolicialFormSectionProps) {
  return (
    <Box
      sx={{
        border: '1px solid',
        borderColor: 'var(--border-soft, rgba(255,255,255,0.12))',
        borderRadius: 2,
        overflow: 'hidden',
        bgcolor: 'rgba(0,0,0,0.1)',
      }}
    >
      <Box
        sx={{
          px: { xs: 2, sm: 2.5 },
          py: 1.25,
          borderBottom: '1px solid',
          borderColor: 'var(--border-soft, rgba(255,255,255,0.12))',
          bgcolor: 'rgba(107, 155, 196, 0.08)',
        }}
      >
        <Typography
          variant="subtitle1"
          component="h3"
          sx={{ fontWeight: 600, color: 'text.primary', m: 0, letterSpacing: 0.2 }}
        >
          {title}
        </Typography>
      </Box>
      <Box sx={{ p: { xs: 2, sm: 2.5 } }}>{children}</Box>
    </Box>
  );
}
