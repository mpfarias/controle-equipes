import { Stack } from '@mui/material';
import { AtendidasPorTurnoTables } from './AtendidasPorTurnoTables';
import { ChamadasXlsxLeitorSection } from './ChamadasXlsxLeitorSection';

export function RegistrosQualidadeSection() {
  return (
    <Stack spacing={2} sx={{ mt: 1 }}>
      <ChamadasXlsxLeitorSection />
      <AtendidasPorTurnoTables />
    </Stack>
  );
}
