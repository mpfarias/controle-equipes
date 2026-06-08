import { Box, Chip, IconButton, Stack, TextField, Typography } from '@mui/material';
import { Add } from '@mui/icons-material';

type PolicialFormacaoListaCampoProps = {
  label: string;
  items: string[];
  draft: string;
  onDraftChange: (value: string) => void;
  onAdd: () => void;
  onRemove: (index: number) => void;
  formFieldSx?: object;
  minChars?: number;
};

export function PolicialFormacaoListaCampo({
  label,
  items,
  draft,
  onDraftChange,
  onAdd,
  onRemove,
  formFieldSx,
  minChars = 3,
}: PolicialFormacaoListaCampoProps) {
  const podeAdicionar = draft.trim().length >= minChars;

  return (
    <Box>
      <Box sx={{ display: 'flex', gap: 1, alignItems: 'flex-start' }}>
        <TextField
          label={label}
          fullWidth
          size="small"
          value={draft}
          onChange={(e) => onDraftChange(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              if (podeAdicionar) onAdd();
            }
          }}
          sx={formFieldSx}
        />
        {podeAdicionar ? (
          <IconButton
            onClick={onAdd}
            title="Adicionar à lista"
            aria-label={`Adicionar ${label}`}
            sx={{
              mt: 0.25,
              flexShrink: 0,
              width: 40,
              height: 40,
              bgcolor: 'var(--accent-muted, #6B9BC4)',
              color: '#fff',
              borderRadius: 1.5,
              boxShadow: '0 1px 4px rgba(0,0,0,0.35)',
              '&:hover': {
                bgcolor: 'var(--accent-muted, #6B9BC4)',
                opacity: 0.9,
                boxShadow: '0 2px 8px rgba(107, 155, 196, 0.45)',
              },
            }}
          >
            <Add fontSize="small" />
          </IconButton>
        ) : null}
      </Box>
      {items.length > 0 ? (
        <Stack direction="row" flexWrap="wrap" gap={1} sx={{ mt: 1.5 }}>
          {items.map((item, index) => (
            <Chip
              key={`${item}-${index}`}
              label={item}
              onDelete={() => onRemove(index)}
              size="small"
              sx={{ maxWidth: '100%' }}
            />
          ))}
        </Stack>
      ) : (
        <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 1 }}>
          Nenhum item adicionado.
        </Typography>
      )}
    </Box>
  );
}

export function parseFormacaoLista(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value
      .filter((x): x is string => typeof x === 'string')
      .map((s) => s.trim())
      .filter(Boolean);
  }
  if (typeof value === 'string' && value.trim()) {
    return [value.trim()];
  }
  return [];
}
