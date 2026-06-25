import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
  Box,
  Chip,
  IconButton,
  Link,
  Paper,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Typography,
} from '@mui/material';
import { ChevronLeft, ChevronRight } from '@mui/icons-material';
import { api, getToken } from '../api';
import type { ChamadaXlsxRow } from '../types/chamadasXlsx';
import type { CoberturaIntegraChamadas, NaturezaCatalogoItem, OcorrenciaIntegraItem } from '../types';
import type { ChamadasCarregamento, ChamadasFiltroConsulta } from '../context/ChamadasImportContext';
import { ChamadasFiltroBar } from './ChamadasFiltroBar';
import { filtroPadraoDiaAtualIso } from '../utils/chamadasFiltroBrasilia';
import { googleMapsUrl } from '../utils/googleMapsLink';
import { baixarGravacaoChamada } from '../utils/gravacaoChamada';

function truncar(texto: string, max = 80): string {
  const t = texto.trim();
  if (t.length <= max) return t;
  return `${t.slice(0, max - 1)}…`;
}

function celula(texto: string): string {
  return texto.trim().length > 0 ? texto.trim() : '—';
}

function CelulaRecordFile({ row }: { row: ChamadaXlsxRow }) {
  const caminho = row.recordFile.trim();
  if (!caminho || !row.id.trim()) return <>—</>;

  return (
    <Link
      component="button"
      type="button"
      onClick={() => {
        void baixarGravacaoChamada(row.id).catch((e: unknown) => {
          const msg = e instanceof Error ? e.message : 'Erro ao baixar gravação.';
          window.alert(msg);
        });
      }}
      sx={{ whiteSpace: 'nowrap', cursor: 'pointer' }}
    >
      download da chamada
    </Link>
  );
}

function rotuloConfianca(confianca: NaturezaCatalogoItem['confianca']): string {
  if (confianca === 'alta') return 'Alta';
  if (confianca === 'media') return 'Média';
  return 'Baixa';
}

function corConfianca(confianca: NaturezaCatalogoItem['confianca']): 'success' | 'warning' | 'default' {
  if (confianca === 'alta') return 'success';
  if (confianca === 'media') return 'warning';
  return 'default';
}

function PaginacaoControles({
  page,
  totalPages,
  desabilitado,
  onAnterior,
  onProxima,
}: {
  page: number;
  totalPages: number;
  desabilitado?: boolean;
  onAnterior: () => void;
  onProxima: () => void;
}) {
  return (
    <Stack direction="row" spacing={0.5} alignItems="center">
      <IconButton size="small" onClick={onAnterior} disabled={page <= 1 || desabilitado} aria-label="Página anterior">
        <ChevronLeft />
      </IconButton>
      <Typography variant="body2" sx={{ minWidth: 120, textAlign: 'center' }}>
        Página {page} de {totalPages}
      </Typography>
      <IconButton size="small" onClick={onProxima} disabled={page >= totalPages || desabilitado} aria-label="Próxima página">
        <ChevronRight />
      </IconButton>
    </Stack>
  );
}

export function OcorrenciasIntegraSection() {
  const [items, setItems] = useState<OcorrenciaIntegraItem[]>([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [carregamento, setCarregamento] = useState<ChamadasCarregamento>('idle');
  const [erro, setErro] = useState<string | null>(null);
  const [filtroAtivo, setFiltroAtivo] = useState<ChamadasFiltroConsulta | null>(null);
  const [coberturaIntegra, setCoberturaIntegra] = useState<CoberturaIntegraChamadas | null>(null);

  const [chamadasItems, setChamadasItems] = useState<ChamadaXlsxRow[]>([]);
  const [chamadasPage, setChamadasPage] = useState(1);
  const [chamadasTotalPages, setChamadasTotalPages] = useState(1);
  const [chamadasTotal, setChamadasTotal] = useState(0);
  const [chamadasCarregamento, setChamadasCarregamento] = useState<ChamadasCarregamento>('idle');
  const [chamadasErro, setChamadasErro] = useState<string | null>(null);

  const [naturezas, setNaturezas] = useState<NaturezaCatalogoItem[]>([]);
  const [naturezasCarregamento, setNaturezasCarregamento] = useState<'idle' | 'loading' | 'ok' | 'error'>('idle');
  const [naturezasErro, setNaturezasErro] = useState<string | null>(null);
  const cargaInicialFeita = useRef(false);
  const descricaoPorCodigo = useMemo(() => {
    const map = new Map<string, string>();
    for (const item of naturezas) {
      if (item.descricao) map.set(item.codigo, item.descricao);
    }
    return map;
  }, [naturezas]);

  const carregarOcorrencias = useCallback(async (filtro: ChamadasFiltroConsulta, pagina: number) => {
    const token = getToken();
    if (!token) {
      setItems([]);
      setCarregamento('skipped');
      setErro(null);
      return;
    }

    setCarregamento('loading');
    setErro(null);

    try {
      const data = await api.listarOcorrenciasIntegraSsp({
        page: pagina,
        dataInicio: filtro.dataInicio,
        dataFim: filtro.dataFim,
      });
      setItems(data.items);
      setPage(data.page);
      setTotalPages(data.totalPages);
      setTotal(data.total);
      setCarregamento('ok');
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Erro ao listar ocorrências.');
      setCarregamento('error');
    }
  }, []);

  const carregarChamadas = useCallback(async (filtro: ChamadasFiltroConsulta, pagina: number) => {
    const token = getToken();
    if (!token) {
      setChamadasItems([]);
      setChamadasCarregamento('skipped');
      setChamadasErro(null);
      return;
    }

    setChamadasCarregamento('loading');
    setChamadasErro(null);

    try {
      const data = await api.listarChamadasTabelaIntegraSsp({
        page: pagina,
        dataInicio: filtro.dataInicio,
        dataFim: filtro.dataFim,
      });
      setChamadasItems(data.items);
      setChamadasPage(data.page);
      setChamadasTotalPages(data.totalPages);
      setChamadasTotal(data.total);
      setCoberturaIntegra(data.coberturaIntegra ?? null);
      setChamadasCarregamento('ok');
    } catch (e) {
      setChamadasErro(e instanceof Error ? e.message : 'Erro ao listar chamadas.');
      setChamadasCarregamento('error');
    }
  }, []);

  const carregarTudo = useCallback(
    async (filtro: ChamadasFiltroConsulta, paginaOcorrencias: number, paginaChamadas: number) => {
      setFiltroAtivo(filtro);
      await Promise.all([
        carregarOcorrencias(filtro, paginaOcorrencias),
        carregarChamadas(filtro, paginaChamadas),
      ]);
    },
    [carregarOcorrencias, carregarChamadas],
  );

  const buscar = useCallback(
    (filtro: ChamadasFiltroConsulta) => {
      void carregarTudo(filtro, 1, 1);
    },
    [carregarTudo],
  );

  useEffect(() => {
    if (cargaInicialFeita.current) return;
    cargaInicialFeita.current = true;
    void carregarTudo(filtroPadraoDiaAtualIso(), 1, 1);
  }, [carregarTudo]);

  useEffect(() => {
    const token = getToken();
    if (!token) {
      setNaturezas([]);
      setNaturezasCarregamento('idle');
      return;
    }
    setNaturezasCarregamento('loading');
    setNaturezasErro(null);
    void api
      .catalogoNaturezasIntegraSsp()
      .then((data) => {
        setNaturezas(data.items);
        setNaturezasCarregamento('ok');
      })
      .catch((e) => {
        setNaturezasErro(e instanceof Error ? e.message : 'Erro ao carregar catálogo de naturezas.');
        setNaturezasCarregamento('error');
      });
  }, []);

  const mudarPaginaOcorrencias = (nova: number) => {
    if (!filtroAtivo || nova < 1 || nova > totalPages || nova === page) return;
    void carregarOcorrencias(filtroAtivo, nova);
  };

  const mudarPaginaChamadas = (nova: number) => {
    if (!filtroAtivo || nova < 1 || nova > chamadasTotalPages || nova === chamadasPage) return;
    void carregarChamadas(filtroAtivo, nova);
  };

  const carregamentoFiltro =
    carregamento === 'loading' || chamadasCarregamento === 'loading'
      ? 'loading'
      : carregamento === 'error' || chamadasCarregamento === 'error'
        ? 'error'
        : carregamento;

  const erroFiltro = erro ?? chamadasErro;

  return (
    <Stack spacing={2}>
      <ChamadasFiltroBar
        carregamento={carregamentoFiltro}
        erro={erroFiltro}
        coberturaIntegra={coberturaIntegra}
        filtroAtivo={filtroAtivo}
        onBuscar={buscar}
      />

      <Paper sx={{ p: 2 }}>
        <Stack
          direction={{ xs: 'column', sm: 'row' }}
          spacing={1}
          alignItems={{ sm: 'center' }}
          justifyContent="space-between"
          sx={{ mb: 2 }}
        >
          <Box>
            <Typography variant="h6" component="h2" fontWeight={700}>
              Ocorrências
            </Typography>
            <Typography variant="body2" color="text.secondary">
              {total.toLocaleString('pt-BR')} registro(s) no período
            </Typography>
          </Box>
          <Stack direction="row" spacing={0.5} alignItems="center">
            <PaginacaoControles
              page={page}
              totalPages={totalPages}
              desabilitado={carregamento === 'loading'}
              onAnterior={() => mudarPaginaOcorrencias(page - 1)}
              onProxima={() => mudarPaginaOcorrencias(page + 1)}
            />
          </Stack>
        </Stack>

        {carregamento === 'loading' && items.length === 0 ? (
          <Alert severity="info">Carregando ocorrências…</Alert>
        ) : items.length === 0 ? (
          <Alert severity="warning">Nenhuma ocorrência encontrada no período selecionado.</Alert>
        ) : (
          <TableContainer sx={{ maxHeight: 560, overflow: 'auto' }}>
            <Table size="small" stickyHeader sx={{ minWidth: 2200 }}>
              <TableHead>
                <TableRow>
                  {[
                    'ID',
                    'Chamada',
                    'Protocolo',
                    'Data/hora',
                    'Solicitante',
                    'Natureza',
                    'Ramal',
                    'Atendente',
                    'Município',
                    'Bairro',
                    'Logradouro',
                    'Origem coord.',
                    'Agência',
                    'Telefone',
                    'Lat',
                    'Long',
                    'Mapa',
                    'Narrativa',
                  ].map((col) => (
                    <TableCell key={col} sx={{ fontWeight: 700, whiteSpace: 'nowrap' }}>
                      {col}
                    </TableCell>
                  ))}
                </TableRow>
              </TableHead>
              <TableBody>
                {items.map((row) => {
                  const mapUrl = googleMapsUrl(row.latitude, row.longitude);
                  const descricaoNatureza =
                    /^NAT-\d+$/i.test(row.natureza.trim()) ? descricaoPorCodigo.get(row.natureza.trim()) : null;
                  return (
                    <TableRow key={row.id} hover>
                      <TableCell sx={{ whiteSpace: 'nowrap' }}>{celula(row.id)}</TableCell>
                      <TableCell sx={{ whiteSpace: 'nowrap' }}>{celula(row.chamadaId)}</TableCell>
                      <TableCell sx={{ whiteSpace: 'nowrap' }}>{celula(row.protocolo)}</TableCell>
                      <TableCell sx={{ whiteSpace: 'nowrap' }}>{celula(row.dataHoraRegistro)}</TableCell>
                      <TableCell>{celula(row.nomeSolicitante)}</TableCell>
                      <TableCell sx={{ minWidth: 180, maxWidth: 280 }}>
                        {descricaoNatureza ? (
                          <Stack spacing={0.25}>
                            <Typography variant="body2" fontWeight={600}>
                              {descricaoNatureza}
                            </Typography>
                            <Typography variant="caption" color="text.secondary">
                              {celula(row.natureza)}
                            </Typography>
                          </Stack>
                        ) : (
                          celula(row.natureza)
                        )}
                      </TableCell>
                      <TableCell sx={{ whiteSpace: 'nowrap' }}>{celula(row.ramal)}</TableCell>
                      <TableCell>{celula(row.atendente)}</TableCell>
                      <TableCell>{celula(row.municipio)}</TableCell>
                      <TableCell>{celula(row.bairro)}</TableCell>
                      <TableCell sx={{ minWidth: 160 }}>{celula(row.logradouro)}</TableCell>
                      <TableCell sx={{ whiteSpace: 'nowrap' }}>{celula(row.origemCoordenada)}</TableCell>
                      <TableCell sx={{ whiteSpace: 'nowrap' }}>{celula(row.agencia)}</TableCell>
                      <TableCell sx={{ whiteSpace: 'nowrap' }}>{celula(row.telefoneDigitado)}</TableCell>
                      <TableCell sx={{ whiteSpace: 'nowrap' }}>{celula(row.latitude)}</TableCell>
                      <TableCell sx={{ whiteSpace: 'nowrap' }}>{celula(row.longitude)}</TableCell>
                      <TableCell sx={{ whiteSpace: 'nowrap' }}>
                        {mapUrl ? (
                          <Link href={mapUrl} target="_blank" rel="noopener noreferrer">
                            Ver no mapa
                          </Link>
                        ) : (
                          '—'
                        )}
                      </TableCell>
                      <TableCell
                        sx={{ minWidth: 240, maxWidth: 360, wordBreak: 'break-word' }}
                        title={row.narrativa || undefined}
                      >
                        {row.narrativa ? truncar(row.narrativa, 120) : '—'}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </TableContainer>
        )}
      </Paper>

      <Paper sx={{ p: 2 }}>
        <Stack
          direction={{ xs: 'column', sm: 'row' }}
          spacing={1}
          alignItems={{ sm: 'center' }}
          justifyContent="space-between"
          sx={{ mb: 2 }}
        >
          <Box>
            <Typography variant="h6" component="h2" fontWeight={700}>
              Chamadas
            </Typography>
            <Typography variant="body2" color="text.secondary">
              {chamadasTotal.toLocaleString('pt-BR')} registro(s) no período
            </Typography>
          </Box>
          <PaginacaoControles
            page={chamadasPage}
            totalPages={chamadasTotalPages}
            desabilitado={chamadasCarregamento === 'loading'}
            onAnterior={() => mudarPaginaChamadas(chamadasPage - 1)}
            onProxima={() => mudarPaginaChamadas(chamadasPage + 1)}
          />
        </Stack>

        {chamadasCarregamento === 'loading' && chamadasItems.length === 0 ? (
          <Alert severity="info">Carregando chamadas…</Alert>
        ) : chamadasErro && chamadasItems.length === 0 ? (
          <Alert severity="error">{chamadasErro}</Alert>
        ) : chamadasItems.length === 0 ? (
          <Alert severity="warning">Nenhuma chamada encontrada no período selecionado.</Alert>
        ) : (
          <TableContainer sx={{ maxHeight: 560, overflow: 'auto' }}>
            <Table size="small" stickyHeader sx={{ minWidth: 1600 }}>
              <TableHead>
                <TableRow>
                  {[
                    'ID',
                    'Unique ID',
                    'Chamador',
                    'Fila',
                    'Ramal',
                    'Status',
                    'Entrada fila',
                    'Atendimento',
                    'Desligamento',
                    'Espera (s)',
                    'Duração (s)',
                    'Quem desligou',
                    'Atendente',
                    'Motivo encerramento',
                    'Record file',
                  ].map((col) => (
                    <TableCell key={col} sx={{ fontWeight: 700, whiteSpace: 'nowrap' }}>
                      {col}
                    </TableCell>
                  ))}
                </TableRow>
              </TableHead>
              <TableBody>
                {chamadasItems.map((row) => (
                  <TableRow key={row.id || row.uniqueId} hover>
                    <TableCell sx={{ whiteSpace: 'nowrap' }}>{celula(row.id)}</TableCell>
                    <TableCell sx={{ whiteSpace: 'nowrap' }}>{celula(row.uniqueId)}</TableCell>
                    <TableCell>{celula(row.chamador)}</TableCell>
                    <TableCell sx={{ whiteSpace: 'nowrap' }}>{celula(row.fila)}</TableCell>
                    <TableCell sx={{ whiteSpace: 'nowrap' }}>{celula(row.ramal)}</TableCell>
                    <TableCell sx={{ whiteSpace: 'nowrap' }}>{celula(row.status)}</TableCell>
                    <TableCell sx={{ whiteSpace: 'nowrap' }}>{celula(row.horaEntradaFila)}</TableCell>
                    <TableCell sx={{ whiteSpace: 'nowrap' }}>{celula(row.horaAtendimento)}</TableCell>
                    <TableCell sx={{ whiteSpace: 'nowrap' }}>{celula(row.horaDesligamento)}</TableCell>
                    <TableCell sx={{ whiteSpace: 'nowrap' }}>{celula(row.tempoEsperaSeg)}</TableCell>
                    <TableCell sx={{ whiteSpace: 'nowrap' }}>{celula(row.duracaoSeg)}</TableCell>
                    <TableCell>{celula(row.quemDesligou)}</TableCell>
                    <TableCell>{celula(row.atendente)}</TableCell>
                    <TableCell sx={{ minWidth: 160, wordBreak: 'break-word' }}>{celula(row.motivoEncerramento)}</TableCell>
                    <TableCell sx={{ minWidth: 160, whiteSpace: 'nowrap' }}><CelulaRecordFile row={row} /></TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        )}
      </Paper>

      <Paper sx={{ p: 2 }}>
        <Typography variant="h6" component="h2" fontWeight={700} gutterBottom>
          Naturezas
        </Typography>
        {naturezasCarregamento === 'loading' ? (
          <Alert severity="info">Carregando naturezas…</Alert>
        ) : naturezasErro ? (
          <Alert severity="error">{naturezasErro}</Alert>
        ) : naturezas.length === 0 ? (
          <Alert severity="warning">Nenhuma natureza encontrada.</Alert>
        ) : (
          <TableContainer sx={{ maxHeight: 480, overflow: 'auto' }}>
            <Table size="small" stickyHeader>
              <TableHead>
                <TableRow>
                  <TableCell sx={{ fontWeight: 700 }}>Código</TableCell>
                  <TableCell sx={{ fontWeight: 700 }}>Descrição</TableCell>
                  <TableCell sx={{ fontWeight: 700 }} align="right">
                    Ocorrências
                  </TableCell>
                  <TableCell sx={{ fontWeight: 700 }}>Confiança</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {naturezas.map((row) => (
                  <TableRow key={row.codigo} hover>
                    <TableCell sx={{ whiteSpace: 'nowrap', fontFamily: 'monospace' }}>{row.codigo}</TableCell>
                    <TableCell sx={{ wordBreak: 'break-word' }}>
                      {row.descricao ?? (
                        <Typography component="span" color="text.secondary" fontStyle="italic">
                          Descrição não identificada
                        </Typography>
                      )}
                    </TableCell>
                    <TableCell align="right" sx={{ whiteSpace: 'nowrap' }}>
                      {row.totalOcorrencias.toLocaleString('pt-BR')}
                    </TableCell>
                    <TableCell sx={{ whiteSpace: 'nowrap' }}>
                      <Chip
                        size="small"
                        label={rotuloConfianca(row.confianca)}
                        color={corConfianca(row.confianca)}
                        variant={row.confianca === 'baixa' ? 'outlined' : 'filled'}
                      />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        )}
      </Paper>
    </Stack>
  );
}
