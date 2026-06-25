import { Stack } from '@mui/material';
import { AtendidasPorTurnoTables } from './AtendidasPorTurnoTables';
import { ChamadasFiltroSection } from './ChamadasFiltroSection';

export function RegistrosQualidadeSection() {
  return (
    <Stack spacing={2} sx={{ mt: 1 }}>
      <ChamadasFiltroSection />
      <AtendidasPorTurnoTables />
    </Stack>
  );
}
