import MapIcon from '@mui/icons-material/Map';
import SearchIcon from '@mui/icons-material/Search';
import UploadFileIcon from '@mui/icons-material/UploadFile';
import {
  Alert,
  Button,
  IconButton,
  InputAdornment,
  LinearProgress,
  Paper,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TablePagination,
  TableRow,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material';
import { Fragment, useCallback, useMemo, useRef, useState } from 'react';
import type { EquipesSadResolucao } from '../context/ChamadasImportContext';
import { useChamadasImport } from '../context/ChamadasImportContext';
import type { ChamadaXlsxColunaCampo, ChamadaXlsxRow } from '../types/chamadasXlsx';
import { horarioParaHHMMSS } from '../utils/formatChamadaHorario';
import { formatarNomeTitulo } from '../utils/formatNomeTitulo';
import { abrirLocalChamadaNoGoogleMaps, coordenadasDaChamada } from '../utils/googleMapsChamada';
import { parseChamadasXlsxBuffer } from '../utils/parseChamadasXlsx';
import { resumoPeriodoDatasChamadas } from '../utils/periodoDatasChamadas';

const ROWS_PER_PAGE = 10;

const CAMPOS_SO_HORA = new Set<ChamadaXlsxColunaCampo>([
  'horaEntradaFila',
  'horaAtendimento',
  'horaDesligamento',
]);

/** Nomes próprios: primeira letra maiúscula por palavra (e por parte após hífen). */
const CAMPOS_NOME_TITULO = new Set<ChamadaXlsxColunaCampo>(['atendente', 'chamador', 'quemDesligou']);

function textoCelulaExibicao(row: ChamadaXlsxRow, campo: ChamadaXlsxColunaCampo): string {
  const v = row[campo]?.trim() ?? '';
  if (!v) return '—';
  if (CAMPOS_SO_HORA.has(campo)) {
    const h = horarioParaHHMMSS(v);
    return h || v;
  }
  if (CAMPOS_NOME_TITULO.has(campo)) {
    return formatarNomeTitulo(v);
  }
  return v;
}

const COLUNAS_TABELA: { campo: ChamadaXlsxColunaCampo; tituloCurto: string }[] = [
  { campo: 'id', tituloCurto: 'ID' },
  { campo: 'uniqueId', tituloCurto: 'Unique ID' },
  { campo: 'chamador', tituloCurto: 'Chamador' },
  { campo: 'fila', tituloCurto: 'Fila' },
  { campo: 'ramal', tituloCurto: 'Ramal' },
  { campo: 'status', tituloCurto: 'Status' },
  { campo: 'horaEntradaFila', tituloCurto: 'Entrada fila' },
  { campo: 'horaAtendimento', tituloCurto: 'Atendimento' },
  { campo: 'horaDesligamento', tituloCurto: 'Desligamento' },
  { campo: 'tempoEsperaSeg', tituloCurto: 'Espera (s)' },
  { campo: 'duracaoSeg', tituloCurto: 'Duração (s)' },
  { campo: 'quemDesligou', tituloCurto: 'Quem desligou' },
  { campo: 'atendente', tituloCurto: 'Atendente' },
  { campo: 'motivoEncerramento', tituloCurto: 'Motivo enc.' },
  { campo: 'longitude', tituloCurto: 'Long.' },
  { campo: 'latitude', tituloCurto: 'Lat.' },
];

function textoEquipeLinhaPlanilha(
  row: ChamadaXlsxRow,
  equipePorNome: Record<string, string | null>,
  encontrado: Record<string, boolean>,
  resolucao: EquipesSadResolucao,
): string {
  const nomeFmt = formatarNomeTitulo(row.atendente?.trim() ?? '');
  if (nomeFmt === '(Não informado)') return '';
  if (resolucao === 'loading') return 'Carregando equipe…';
  if (resolucao === 'error' || resolucao === 'skipped') return '';
  if (!encontrado[nomeFmt]) return 'Não localizado';
  return (equipePorNome[nomeFmt] ?? '').trim();
}

function linhaCorrespondeBusca(
  row: ChamadaXlsxRow,
  query: string,
  ctx?: {
    equipePorNome: Record<string, string | null>;
    encontrado: Record<string, boolean>;
    resolucao: EquipesSadResolucao;
  },
): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  for (const key of Object.keys(row) as (keyof ChamadaXlsxRow)[]) {
    if (String(row[key] ?? '').toLowerCase().includes(q)) return true;
  }
  for (const { campo } of COLUNAS_TABELA) {
    const t = textoCelulaExibicao(row, campo);
    if (t.toLowerCase().includes(q)) return true;
  }
  if (ctx) {
    const eq = textoEquipeLinhaPlanilha(row, ctx.equipePorNome, ctx.encontrado, ctx.resolucao);
    if (eq.toLowerCase().includes(q)) return true;
  }
  return false;
}

export function ChamadasXlsxLeitorSection() {
  const {
    chamadasRows,
    arquivoNome,
    abaNome,
    importarChamadas,
    limparChamadasImportadas,
    equipePorNomeAtendente,
    encontradoSadPorNomeAtendente,
    equipesResolucao,
    equipesResolucaoErro,
  } = useChamadasImport();
  const inputRef = useRef<HTMLInputElement>(null);
  const [lendo, setLendo] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [page, setPage] = useState(0);
  const [textoBusca, setTextoBusca] = useState('');

  const linhasFiltradas = useMemo(
    () => (textoBusca.trim() ? chamadasRows.filter((r) => linhaCorrespondeBusca(r, textoBusca)) : chamadasRows),
    [chamadasRows, textoBusca],
  );

  const resumoPeriodoArquivo = useMemo(() => resumoPeriodoDatasChamadas(chamadasRows), [chamadasRows]);

  const limpar = useCallback(() => {
    setErro(null);
    limparChamadasImportadas();
    setPage(0);
    setTextoBusca('');
    if (inputRef.current) inputRef.current.value = '';
  }, [limparChamadasImportadas]);

  const onFile = useCallback(
    (file: File | null) => {
      if (!file) return;
      setErro(null);
      setLendo(true);
      setPage(0);
      setTextoBusca('');

      const reader = new FileReader();
      reader.onload = () => {
        try {
          const buf = reader.result;
          if (!(buf instanceof ArrayBuffer)) {
            setErro('Falha ao ler o arquivo na memória.');
            return;
          }
          const resultado = parseChamadasXlsxBuffer(buf);
          if (!resultado.ok) {
            setErro(resultado.error);
            return;
          }
          importarChamadas({
            rows: resultado.rows,
            arquivoNome: file.name,
            abaNome: resultado.nomePrimeiraAba,
          });
        } catch {
          setErro('Erro inesperado ao processar o arquivo.');
        } finally {
          setLendo(false);
        }
      };
      reader.onerror = () => {
        setLendo(false);
        setErro('Não foi possível ler o arquivo.');
      };
      reader.readAsArrayBuffer(file);
    },
    [importarChamadas],
  );

  const slice = linhasFiltradas.slice(page * ROWS_PER_PAGE, page * ROWS_PER_PAGE + ROWS_PER_PAGE);

  return (
    <Paper variant="outlined" sx={{ p: 2 }}>
      <Stack spacing={2}>
        <Stack direction="row" alignItems="center" justifyContent="space-between" flexWrap="wrap" gap={1}>
          <Typography variant="subtitle1" fontWeight={700}>
            Leitura de planilha (XLSX)
          </Typography>
          <Stack direction="row" spacing={1} flexWrap="wrap">
            <input
              ref={inputRef}
              type="file"
              accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
              hidden
              onChange={(e) => {
                const f = e.target.files?.[0] ?? null;
                void onFile(f);
              }}
            />
            <Button
              variant="outlined"
              size="small"
              startIcon={<UploadFileIcon />}
              disabled={lendo}
              onClick={() => inputRef.current?.click()}
            >
              Selecionar XLSX
            </Button>
            {(arquivoNome || chamadasRows.length > 0) && (
              <Button variant="text" size="small" color="inherit" onClick={limpar} disabled={lendo}>
                Limpar
              </Button>
            )}
          </Stack>
        </Stack>

        <Typography variant="body2" color="text.secondary">
          Selecione o arquivo XLSX gerado no HEFESTO, utilizando o botão a lado.
        </Typography>

        {lendo && <LinearProgress />}

        {erro && (
          <Alert severity="error" onClose={() => setErro(null)}>
            {erro}
          </Alert>
        )}

        {!lendo && chamadasRows.length > 0 && (
          <>
            <Alert severity="success" variant="outlined">
              Arquivo &quot;{arquivoNome}&quot; — aba &quot;{abaNome}&quot;: {chamadasRows.length} linha(s) de dados
              lidas (linhas em branco ignoradas). A coluna <strong>Equipe</strong> é preenchida com o cadastro de
              policiais ativos no Órion SAD: com <strong>duas ou mais</strong> palavras no atendente, todas devem
              constar no nome do cadastro; nome completo igual também identifica.
              {resumoPeriodoArquivo.identificado ? (
                <Typography component="div" variant="body2" sx={{ mt: 1.25 }}>
                  <strong>Período dos registros:</strong> {resumoPeriodoArquivo.textoPeriodo}
                </Typography>
              ) : (
                <Typography component="div" variant="body2" color="text.secondary" sx={{ mt: 1.25 }}>
                  <strong>Período:</strong> não identificado — inclua <strong>data e hora</strong> nas colunas de horário
                  para exibir o período aqui e nos gráficos.
                </Typography>
              )}
            </Alert>

            {equipesResolucao === 'error' && equipesResolucaoErro ? (
              <Alert severity="warning" variant="outlined">
                Equipes (SAD): {equipesResolucaoErro}
              </Alert>
            ) : null}

            <Stack spacing={1}>
              <TextField
                size="small"
                fullWidth
                placeholder="Buscar em qualquer informação da tabela…"
                value={textoBusca}
                onChange={(e) => {
                  setTextoBusca(e.target.value);
                  setPage(0);
                }}
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">
                      <SearchIcon fontSize="small" color="action" />
                    </InputAdornment>
                  ),
                }}
                aria-label="Filtrar registros da planilha"
              />
              <Typography variant="body2" color="text.secondary">
                {textoBusca.trim() ? (
                  <>
                    <strong>{linhasFiltradas.length}</strong>{' '}
                    {linhasFiltradas.length === 1 ? 'registro encontrado' : 'registros encontrados'} nesta busca
                    {linhasFiltradas.length !== chamadasRows.length ? (
                      <> (de {chamadasRows.length} no arquivo)</>
                    ) : null}
                    .
                  </>
                ) : (
                  <>
                    Exibindo todos os <strong>{chamadasRows.length}</strong>{' '}
                    {chamadasRows.length === 1 ? 'registro' : 'registros'}. Digite acima para filtrar.
                  </>
                )}
              </Typography>
            </Stack>

            <TableContainer sx={{ maxHeight: 480, overflow: 'auto' }}>
              <Table size="small" stickyHeader>
                <TableHead>
                  <TableRow>
                    {COLUNAS_TABELA.map(({ campo, tituloCurto }) => (
                      <Fragment key={campo}>
                        <TableCell sx={{ fontWeight: 700, whiteSpace: 'nowrap' }}>{tituloCurto}</TableCell>
                        {campo === 'atendente' ? (
                          <TableCell sx={{ fontWeight: 700, whiteSpace: 'nowrap' }}>Equipe SAD)</TableCell>
                        ) : null}
                      </Fragment>
                    ))}
                    <TableCell align="center" sx={{ fontWeight: 700, whiteSpace: 'nowrap' }}>
                      Mapa
                    </TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {linhasFiltradas.length === 0 && textoBusca.trim() ? (
                    <TableRow>
                      <TableCell colSpan={COLUNAS_TABELA.length + 2} align="center" sx={{ py: 4 }}>
                        <Typography variant="body2" color="text.secondary">
                          Nenhum registro corresponde à busca.
                        </Typography>
                      </TableCell>
                    </TableRow>
                  ) : null}
                  {slice.map((row, i) => {
                    const coords = coordenadasDaChamada(row);
                    return (
                      <TableRow key={`${page}-${i}-${row.id}-${row.uniqueId}-${row.chamador}`}>
                        {COLUNAS_TABELA.map(({ campo }) => (
                          <Fragment key={campo}>
                            <TableCell
                              sx={{
                                maxWidth: 160,
                                whiteSpace: 'nowrap',
                                overflow: 'hidden',
                                textOverflow: 'ellipsis',
                              }}
                              title={textoCelulaExibicao(row, campo)}
                            >
                              {textoCelulaExibicao(row, campo)}
                            </TableCell>
                            {campo === 'atendente' ? (
                              <TableCell
                                sx={{
                                  maxWidth: 140,
                                  whiteSpace: 'nowrap',
                                  overflow: 'hidden',
                                  textOverflow: 'ellipsis',
                                }}
                                title={textoEquipeLinhaPlanilha(
                                  row,
                                  equipePorNomeAtendente,
                                  encontradoSadPorNomeAtendente,
                                  equipesResolucao,
                                )}
                              >
                                {(() => {
                                  const t = textoEquipeLinhaPlanilha(
                                    row,
                                    equipePorNomeAtendente,
                                    encontradoSadPorNomeAtendente,
                                    equipesResolucao,
                                  );
                                  return t || '—';
                                })()}
                              </TableCell>
                            ) : null}
                          </Fragment>
                        ))}
                        <TableCell align="center" padding="checkbox">
                          <Tooltip
                            title={
                              coords
                                ? 'Abrir localização no Google Maps'
                                : 'Latitude e longitude ausentes ou inválidas para o mapa'
                            }
                          >
                            <span>
                              <IconButton
                                size="small"
                                color="primary"
                                aria-label="Abrir no Google Maps"
                                disabled={!coords}
                                onClick={() => abrirLocalChamadaNoGoogleMaps(row)}
                              >
                                <MapIcon fontSize="small" />
                              </IconButton>
                            </span>
                          </Tooltip>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </TableContainer>

            <TablePagination
              component="div"
              count={linhasFiltradas.length}
              page={page}
              onPageChange={(_, p) => setPage(p)}
              rowsPerPage={ROWS_PER_PAGE}
              onRowsPerPageChange={() => {}}
              rowsPerPageOptions={[ROWS_PER_PAGE]}
              labelRowsPerPage="Linhas por página"
              labelDisplayedRows={({ from, to, count }) => `${from}–${to} de ${count}`}
            />
          </>
        )}

        {!lendo && !erro && chamadasRows.length === 0 && arquivoNome && (
          <Alert severity="info" variant="outlined">
            O arquivo foi lido, mas não há linhas de dados após o cabeçalho (ou todas estão em branco).
          </Alert>
        )}
      </Stack>
    </Paper>
  );
}
