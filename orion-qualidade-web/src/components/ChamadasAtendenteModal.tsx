import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Autocomplete,
  Box,
  Button,
  Checkbox,
  Divider,
  Dialog,
  DialogContent,
  DialogTitle,
  FormControlLabel,
  FormGroup,
  IconButton,
  Link,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TableSortLabel,
  TextField,
  Typography,
} from '@mui/material';
import { Close, FilterList, Search } from '@mui/icons-material';
import type { ChamadaXlsxRow } from '../types/chamadasXlsx';
import { googleMapsUrl } from '../utils/googleMapsLink';
import { parseDataHoraChamada } from '../utils/periodoDatasChamadas';

const cellPad = { py: 1, px: 1.5, fontSize: '0.8125rem' };

type CampoOrdenacaoModal = 'horaEntradaFila' | 'horaAtendimento' | 'horaDesligamento' | 'duracaoSeg';
type DirecaoOrdenacao = 'asc' | 'desc';

const ORDENACAO_PADRAO: { campo: CampoOrdenacaoModal; direcao: DirecaoOrdenacao } = {
  campo: 'horaEntradaFila',
  direcao: 'asc',
};

const tableSortLabelSx = (ativo: boolean) => ({
  cursor: 'pointer',
  userSelect: 'none',
  color: ativo ? 'text.primary' : 'text.secondary',
  fontWeight: 700,
  '& .MuiTableSortLabel-icon': {
    opacity: '1 !important',
    color: ativo ? 'primary.main' : 'text.secondary',
  },
  '&:hover': {
    color: 'text.primary',
  },
  '&:hover .MuiTableSortLabel-icon': {
    color: 'primary.main',
  },
});

type CampoFiltroModal = 'status' | 'quemDesligou' | 'motivoEncerramento';

const CAMPOS_BUSCA: (keyof ChamadaXlsxRow)[] = [
  'chamador',
  'ramal',
  'status',
  'horaEntradaFila',
  'horaAtendimento',
  'horaDesligamento',
  'duracaoSeg',
  'quemDesligou',
  'motivoEncerramento',
  'id',
  'uniqueId',
];

const CAMPOS_SUGESTAO_BUSCA: (keyof ChamadaXlsxRow)[] = [
  'chamador',
  'ramal',
  'status',
  'quemDesligou',
  'motivoEncerramento',
];

type FiltrosModal = Record<CampoFiltroModal, Set<string>>;

function filtrosVazios(): FiltrosModal {
  return {
    status: new Set(),
    quemDesligou: new Set(),
    motivoEncerramento: new Set(),
  };
}

function filtrosAtivos(filtros: FiltrosModal): boolean {
  return filtros.status.size > 0 || filtros.quemDesligou.size > 0 || filtros.motivoEncerramento.size > 0;
}

function passaGrupo(valor: string, selecionados: Set<string>): boolean {
  if (selecionados.size === 0) return true;
  return selecionados.has(valor);
}

function celulaTexto(valor: string): string {
  const t = String(valor ?? '').trim();
  return t.length > 0 ? t : '—';
}

function valorFiltro(row: ChamadaXlsxRow, campo: CampoFiltroModal): string {
  return celulaTexto(row[campo]);
}

function valoresUnicos(registros: ChamadaXlsxRow[], campo: CampoFiltroModal): string[] {
  const set = new Set<string>();
  for (const row of registros) {
    set.add(valorFiltro(row, campo));
  }
  return [...set].sort((a, b) => a.localeCompare(b, 'pt-BR'));
}

function filtrarRegistros(registros: ChamadaXlsxRow[], filtros: FiltrosModal): ChamadaXlsxRow[] {
  if (!filtrosAtivos(filtros)) return registros;
  return registros.filter((row) => {
    if (!passaGrupo(valorFiltro(row, 'status'), filtros.status)) return false;
    if (!passaGrupo(valorFiltro(row, 'quemDesligou'), filtros.quemDesligou)) return false;
    if (!passaGrupo(valorFiltro(row, 'motivoEncerramento'), filtros.motivoEncerramento)) return false;
    return true;
  });
}

function registroPassaBusca(row: ChamadaXlsxRow, termo: string): boolean {
  const busca = termo.trim().toLowerCase();
  if (!busca) return true;
  return CAMPOS_BUSCA.some((campo) => String(row[campo] ?? '').trim().toLowerCase().includes(busca));
}

function sugestoesBusca(registros: ChamadaXlsxRow[]): string[] {
  const valores = new Set<string>();
  for (const row of registros) {
    for (const campo of CAMPOS_SUGESTAO_BUSCA) {
      const texto = String(row[campo] ?? '').trim();
      if (texto) valores.add(texto);
    }
  }
  return [...valores].sort((a, b) => a.localeCompare(b, 'pt-BR'));
}

function valorOrdenacao(row: ChamadaXlsxRow, campo: CampoOrdenacaoModal): number | null {
  if (campo === 'duracaoSeg') {
    const texto = String(row.duracaoSeg ?? '').trim();
    if (!texto) return null;
    const n = Number.parseInt(texto, 10);
    return Number.isFinite(n) ? n : null;
  }
  const instante = parseDataHoraChamada(row[campo]);
  return instante ? instante.getTime() : null;
}

function compararOrdenacao(a: number | null, b: number | null, direcao: DirecaoOrdenacao): number {
  if (a == null && b == null) return 0;
  if (a == null) return 1;
  if (b == null) return -1;
  return direcao === 'asc' ? a - b : b - a;
}

function ordenarRegistros(
  registros: ChamadaXlsxRow[],
  campo: CampoOrdenacaoModal,
  direcao: DirecaoOrdenacao,
): ChamadaXlsxRow[] {
  return [...registros].sort((a, b) => {
    const diff = compararOrdenacao(valorOrdenacao(a, campo), valorOrdenacao(b, campo), direcao);
    if (diff !== 0) return diff;
    return direcao === 'asc' ? a.id.localeCompare(b.id, 'pt-BR') : b.id.localeCompare(a.id, 'pt-BR');
  });
}

function GrupoCheckboxFiltro({
  titulo,
  opcoes,
  selecionados,
  onToggle,
}: {
  titulo: string;
  opcoes: string[];
  selecionados: Set<string>;
  onToggle: (valor: string) => void;
}) {
  return (
    <Box sx={{ minWidth: 0, flex: 1 }}>
      <Typography variant="subtitle2" fontWeight={700} gutterBottom>
        {titulo}
      </Typography>
      <FormGroup sx={{ maxHeight: 160, overflowY: 'auto', pr: 0.5 }}>
        {opcoes.map((opcao) => (
          <FormControlLabel
            key={opcao}
            control={
              <Checkbox
                size="small"
                checked={selecionados.has(opcao)}
                onChange={() => onToggle(opcao)}
              />
            }
            label={
              <Typography variant="body2" sx={{ wordBreak: 'break-word' }}>
                {opcao}
              </Typography>
            }
            sx={{ alignItems: 'flex-start', mx: 0 }}
          />
        ))}
      </FormGroup>
    </Box>
  );
}

type Props = {
  aberto: boolean;
  nomeAtendente: string | null;
  registros: ChamadaXlsxRow[];
  localizacaoCarregamento?: boolean;
  onFechar: () => void;
};

export function ChamadasAtendenteModal({
  aberto,
  nomeAtendente,
  registros,
  localizacaoCarregamento = false,
  onFechar,
}: Props) {
  const opcoesStatus = useMemo(() => valoresUnicos(registros, 'status'), [registros]);
  const opcoesQuemDesligou = useMemo(() => valoresUnicos(registros, 'quemDesligou'), [registros]);
  const opcoesMotivo = useMemo(() => valoresUnicos(registros, 'motivoEncerramento'), [registros]);
  const opcoesBusca = useMemo(() => sugestoesBusca(registros), [registros]);

  const [painelFiltroAberto, setPainelFiltroAberto] = useState(false);
  const [filtros, setFiltros] = useState<FiltrosModal>(() => filtrosVazios());
  const [ordenacao, setOrdenacao] = useState(ORDENACAO_PADRAO);
  const [buscaTexto, setBuscaTexto] = useState('');

  useEffect(() => {
    if (!aberto) return;
    setPainelFiltroAberto(false);
    setFiltros(filtrosVazios());
    setOrdenacao(ORDENACAO_PADRAO);
    setBuscaTexto('');
  }, [aberto, nomeAtendente, registros]);

  const toggleOpcao = useCallback((campo: CampoFiltroModal, valor: string) => {
    setFiltros((prev) => {
      const next = new Set(prev[campo]);
      if (next.has(valor)) next.delete(valor);
      else next.add(valor);
      return { ...prev, [campo]: next };
    });
  }, []);

  const limparFiltros = useCallback(() => {
    setFiltros(filtrosVazios());
    setBuscaTexto('');
  }, []);

  const alternarOrdenacao = useCallback((campo: CampoOrdenacaoModal) => {
    setOrdenacao((prev) =>
      prev.campo === campo
        ? { campo, direcao: prev.direcao === 'asc' ? 'desc' : 'asc' }
        : { campo, direcao: 'asc' },
    );
  }, []);

  const registrosFiltrados = useMemo(() => {
    const porFiltros = filtrarRegistros(registros, filtros);
    const termo = buscaTexto.trim();
    if (!termo) return porFiltros;
    return porFiltros.filter((row) => registroPassaBusca(row, termo));
  }, [registros, filtros, buscaTexto]);
  const registrosExibidos = useMemo(
    () => ordenarRegistros(registrosFiltrados, ordenacao.campo, ordenacao.direcao),
    [registrosFiltrados, ordenacao],
  );

  const temFiltroAplicado = filtrosAtivos(filtros);
  const temBuscaAplicada = buscaTexto.trim().length > 0;
  const temFiltroOuBusca = temFiltroAplicado || temBuscaAplicada;

  return (
    <Dialog open={aberto} onClose={onFechar} maxWidth="xl" fullWidth scroll="paper">
      <DialogTitle sx={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 2, pr: 1 }}>
        <div>
          <Typography variant="overline" color="text.secondary" sx={{ lineHeight: 1.4 }}>
            Registros do atendente
          </Typography>
          <Typography variant="h6" component="div" fontWeight={700}>
            {nomeAtendente ?? '—'}
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
            {temFiltroOuBusca
              ? `${registrosFiltrados.length} de ${registros.length} registro(s) exibido(s)`
              : `${registros.length} registro(s) no período filtrado`}
            {localizacaoCarregamento ? ' · carregando localizações…' : null}
          </Typography>
        </div>
        <IconButton aria-label="Fechar" onClick={onFechar} sx={{ mt: -0.5 }}>
          <Close />
        </IconButton>
      </DialogTitle>
      <DialogContent dividers sx={{ p: 0 }}>
        {registros.length === 0 ? (
          <Typography variant="body2" color="text.secondary" sx={{ p: 3 }}>
            Nenhum registro encontrado para este atendente.
          </Typography>
        ) : (
          <>
            <Box sx={{ px: 2, py: 1.5, borderBottom: 1, borderColor: 'divider' }}>
              <Stack
                direction={{ xs: 'column', md: 'row' }}
                spacing={1}
                alignItems={{ md: 'center' }}
                useFlexGap
              >
                <Button
                  variant={painelFiltroAberto ? 'contained' : 'outlined'}
                  size="small"
                  startIcon={<FilterList />}
                  onClick={() => setPainelFiltroAberto((v) => !v)}
                  sx={{ flexShrink: 0 }}
                >
                  Filtrar
                </Button>
                {temFiltroOuBusca ? (
                  <Button variant="text" size="small" onClick={limparFiltros} sx={{ flexShrink: 0 }}>
                    Limpar
                  </Button>
                ) : null}
                <Autocomplete
                  freeSolo
                  size="small"
                  options={opcoesBusca}
                  value={buscaTexto}
                  inputValue={buscaTexto}
                  onInputChange={(_event, valor) => setBuscaTexto(valor)}
                  onChange={(_event, valor) => setBuscaTexto(typeof valor === 'string' ? valor : valor ?? '')}
                  filterOptions={(options, { inputValue }) => {
                    const termo = inputValue.trim().toLowerCase();
                    if (!termo) return options.slice(0, 40);
                    return options.filter((opcao) => opcao.toLowerCase().includes(termo)).slice(0, 40);
                  }}
                  noOptionsText="Nenhuma sugestão"
                  sx={{ flex: 1, minWidth: { xs: '100%', md: 280 } }}
                  renderInput={(params) => (
                    <TextField
                      {...params}
                      label="Buscar"
                      placeholder="Chamador, ramal, status, motivo…"
                      InputProps={{
                        ...params.InputProps,
                        startAdornment: (
                          <>
                            <Search fontSize="small" color="action" sx={{ ml: 0.5, mr: 0.5 }} />
                            {params.InputProps.startAdornment}
                          </>
                        ),
                      }}
                    />
                  )}
                />
              </Stack>
            </Box>

            {painelFiltroAberto ? (
              <Box sx={{ p: 2, borderBottom: 1, borderColor: 'divider', bgcolor: 'action.hover' }}>
                <Stack
                  direction={{ xs: 'column', md: 'row' }}
                  spacing={2}
                  divider={<Divider flexItem orientation="vertical" sx={{ display: { xs: 'none', md: 'block' } }} />}
                >
                  <GrupoCheckboxFiltro
                    titulo="Status"
                    opcoes={opcoesStatus}
                    selecionados={filtros.status}
                    onToggle={(v) => toggleOpcao('status', v)}
                  />
                  <GrupoCheckboxFiltro
                    titulo="Quem desligou"
                    opcoes={opcoesQuemDesligou}
                    selecionados={filtros.quemDesligou}
                    onToggle={(v) => toggleOpcao('quemDesligou', v)}
                  />
                  <GrupoCheckboxFiltro
                    titulo="Motivo encerramento"
                    opcoes={opcoesMotivo}
                    selecionados={filtros.motivoEncerramento}
                    onToggle={(v) => toggleOpcao('motivoEncerramento', v)}
                  />
                </Stack>
              </Box>
            ) : null}

            {registrosFiltrados.length === 0 ? (
              <Typography variant="body2" color="text.secondary" sx={{ p: 3 }}>
                Nenhum registro corresponde à busca ou aos filtros selecionados.
              </Typography>
            ) : (
              <TableContainer sx={{ maxHeight: 'min(60vh, 640px)' }}>
                <Table size="small" stickyHeader>
                  <TableHead>
                    <TableRow>
                      {['Chamador', 'Ramal', 'Status'].map((col) => (
                        <TableCell key={col} sx={{ ...cellPad, fontWeight: 700, whiteSpace: 'nowrap' }}>
                          {col}
                        </TableCell>
                      ))}
                      {(
                        [
                          ['horaEntradaFila', 'Hora Entrada Fila'],
                          ['horaAtendimento', 'Hora Atendimento'],
                          ['horaDesligamento', 'Hora Desligamento'],
                          ['duracaoSeg', 'Duração (s)'],
                        ] as const
                      ).map(([campo, rotulo]) => (
                        <TableCell
                          key={campo}
                          sortDirection={ordenacao.campo === campo ? ordenacao.direcao : false}
                          sx={{ ...cellPad, fontWeight: 700, whiteSpace: 'nowrap' }}
                        >
                          <TableSortLabel
                            active={ordenacao.campo === campo}
                            direction={ordenacao.campo === campo ? ordenacao.direcao : 'asc'}
                            onClick={() => alternarOrdenacao(campo)}
                            sx={tableSortLabelSx(ordenacao.campo === campo)}
                          >
                            {rotulo}
                          </TableSortLabel>
                        </TableCell>
                      ))}
                      {['Quem Desligou', 'Motivo Encerramento', 'Localização'].map((col) => (
                        <TableCell key={col} sx={{ ...cellPad, fontWeight: 700, whiteSpace: 'nowrap' }}>
                          {col}
                        </TableCell>
                      ))}
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {registrosExibidos.map((row) => {
                      const mapUrl = googleMapsUrl(row.latitude, row.longitude);
                      return (
                        <TableRow key={row.id || row.uniqueId} hover>
                          <TableCell sx={cellPad}>{celulaTexto(row.chamador)}</TableCell>
                          <TableCell sx={cellPad}>{celulaTexto(row.ramal)}</TableCell>
                          <TableCell sx={cellPad}>{celulaTexto(row.status)}</TableCell>
                          <TableCell sx={{ ...cellPad, whiteSpace: 'nowrap' }}>
                            {celulaTexto(row.horaEntradaFila)}
                          </TableCell>
                          <TableCell sx={{ ...cellPad, whiteSpace: 'nowrap' }}>
                            {celulaTexto(row.horaAtendimento)}
                          </TableCell>
                          <TableCell sx={{ ...cellPad, whiteSpace: 'nowrap' }}>
                            {celulaTexto(row.horaDesligamento)}
                          </TableCell>
                          <TableCell sx={cellPad}>{celulaTexto(row.duracaoSeg)}</TableCell>
                          <TableCell sx={cellPad}>{celulaTexto(row.quemDesligou)}</TableCell>
                          <TableCell sx={cellPad}>{celulaTexto(row.motivoEncerramento)}</TableCell>
                          <TableCell sx={cellPad}>
                            {mapUrl ? (
                              <Link href={mapUrl} target="_blank" rel="noopener noreferrer" underline="hover">
                                Ver no mapa
                              </Link>
                            ) : (
                              '—'
                            )}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </TableContainer>
            )}
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
