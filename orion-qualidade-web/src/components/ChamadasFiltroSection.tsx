import { useChamadasImport } from '../context/ChamadasImportContext';
import { ChamadasFiltroBar } from './ChamadasFiltroBar';

export function ChamadasFiltroSection() {
  const { chamadasCarregamento, chamadasErro, coberturaIntegra, buscarChamadas, filtroAtivo } = useChamadasImport();

  return (
    <ChamadasFiltroBar
      carregamento={chamadasCarregamento}
      erro={chamadasErro}
      coberturaIntegra={coberturaIntegra}
      filtroAtivo={filtroAtivo}
      onBuscar={buscarChamadas}
    />
  );
}
