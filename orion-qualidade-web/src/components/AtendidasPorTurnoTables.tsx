import { useMemo } from 'react';
import { Alert, Box, Divider, Paper, Stack, Table, TableBody, TableCell, TableContainer, TableFooter, TableHead, TableRow, Typography } from '@mui/material';
import { alpha, useTheme } from '@mui/material/styles';
import type { EquipesSadResolucao } from '../context/ChamadasImportContext';
import { useChamadasImport } from '../context/ChamadasImportContext';
import { agregarAtendidasPorAtendente } from '../utils/agregarAtendidasPorAtendente';
import { resumoPeriodoDatasChamadas, tituloComPeriodoChamadas } from '../utils/periodoDatasChamadas';
import { filtrarChamadasPorTurno } from '../utils/periodoTurnoChamada';

const cellPad = { py: 1.25, px: 2 };

function textoEquipeSad(
  nomeAtendente: string,
  equipePorNome: Record<string, string | null>,
  encontrado: Record<string, boolean>,
  resolucao: EquipesSadResolucao,
): string {
  if (resolucao === 'loading') return '…';
  if (resolucao === 'error' || resolucao === 'skipped') return '—';
  if (!encontrado[nomeAtendente]) return 'Não localizado';
  const eq = equipePorNome[nomeAtendente];
  return eq && eq.trim() ? eq.trim() : '—';
}

function TabelaAtendidasTurno({
  tituloPainel,
  subtitulo,
  linhas,
  accent,
  equipePorNomeAtendente,
  encontradoSadPorNomeAtendente,
  equipesResolucao,
}: {
  tituloPainel: string;
  subtitulo: string;
  linhas: ReturnType<typeof agregarAtendidasPorAtendente>;
  accent: 'diurno' | 'noturno';
  equipePorNomeAtendente: Record<string, string | null>;
  encontradoSadPorNomeAtendente: Record<string, boolean>;
  equipesResolucao: EquipesSadResolucao;
}) {
  const theme = useTheme();
  const accentColor = accent === 'diurno' ? theme.palette.primary.main : theme.palette.secondary.main;
  const total = linhas.reduce((s, r) => s + r.quantidade, 0);

  return (
    <Paper
      elevation={0}
      sx={{
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        borderRadius: 2,
        border: 1,
        borderColor: 'divider',
        overflow: 'hidden',
        bgcolor: alpha(theme.palette.background.paper, 0.65),
        backdropFilter: 'blur(8px)',
      }}
    >
      <Box
        sx={{
          px: 2.5,
          pt: 2,
          pb: 1.5,
          borderLeft: 4,
          borderColor: accentColor,
          bgcolor: alpha(accentColor, 0.06),
        }}
      >
        <Typography variant="overline" sx={{ color: 'text.secondary', letterSpacing: 1.2, lineHeight: 1.6 }}>
          {tituloPainel}
        </Typography>
        <Typography variant="h6" component="h3" fontWeight={700} sx={{ mt: 0.25, letterSpacing: -0.02 }}>
          Ligações atendidas por policial
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mt: 0.75, lineHeight: 1.5 }}>
          {subtitulo}
        </Typography>
      </Box>

      <Divider />

      {linhas.length === 0 ? (
        <Box sx={{ px: 2.5, py: 4, textAlign: 'center' }}>
          <Typography variant="body2" color="text.secondary">
            Nenhuma ligação com status <strong>ATENDIDA</strong> neste turno.
          </Typography>
        </Box>
      ) : (
        <TableContainer sx={{ overflow: 'visible' }}>
          <Table size="medium" sx={{ tableLayout: 'fixed' }}>
            <TableHead>
              <TableRow>
                <TableCell
                  sx={{
                    ...cellPad,
                    fontWeight: 700,
                    fontSize: '0.7rem',
                    textTransform: 'uppercase',
                    letterSpacing: '0.06em',
                    color: 'text.secondary',
                    borderBottom: `2px solid ${alpha(accentColor, 0.35)}`,
                    bgcolor: alpha(theme.palette.common.white, 0.04),
                  }}
                >
                  Policial (atendente)
                </TableCell>
                <TableCell
                  sx={{
                    ...cellPad,
                    width: 120,
                    fontWeight: 700,
                    fontSize: '0.7rem',
                    textTransform: 'uppercase',
                    letterSpacing: '0.06em',
                    color: 'text.secondary',
                    borderBottom: `2px solid ${alpha(accentColor, 0.35)}`,
                    bgcolor: alpha(theme.palette.common.white, 0.04),
                  }}
                >
                  Equipe
                </TableCell>
                <TableCell
                  sx={{
                    ...cellPad,
                    width: 100,
                    fontWeight: 700,
                    fontSize: '0.7rem',
                    textTransform: 'uppercase',
                    letterSpacing: '0.06em',
                    color: 'text.secondary',
                    borderBottom: `2px solid ${alpha(accentColor, 0.35)}`,
                    bgcolor: alpha(theme.palette.common.white, 0.04),
                  }}
                >
                  Ramal
                </TableCell>
                <TableCell
                  align="right"
                  sx={{
                    ...cellPad,
                    width: 112,
                    fontWeight: 700,
                    fontSize: '0.7rem',
                    textTransform: 'uppercase',
                    letterSpacing: '0.06em',
                    color: 'text.secondary',
                    borderBottom: `2px solid ${alpha(accentColor, 0.35)}`,
                    bgcolor: alpha(theme.palette.common.white, 0.04),
                  }}
                >
                  Atendidas
                </TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {linhas.map((r) => (
                <TableRow
                  key={r.nome}
                  hover
                  sx={{
                    '&:nth-of-type(even)': { bgcolor: alpha(theme.palette.common.white, 0.03) },
                    transition: 'background-color 0.15s ease',
                  }}
                >
                  <TableCell
                    sx={{
                      ...cellPad,
                      borderBottom: `1px solid ${alpha(theme.palette.divider, 0.6)}`,
                      fontWeight: 500,
                    }}
                  >
                    {r.nome}
                  </TableCell>
                  <TableCell
                    sx={{
                      ...cellPad,
                      borderBottom: `1px solid ${alpha(theme.palette.divider, 0.6)}`,
                      color: 'text.secondary',
                    }}
                    title={
                      encontradoSadPorNomeAtendente[r.nome]
                        ? (equipePorNomeAtendente[r.nome] ?? 'Sem equipe no cadastro')
                        : undefined
                    }
                  >
                    {textoEquipeSad(r.nome, equipePorNomeAtendente, encontradoSadPorNomeAtendente, equipesResolucao)}
                  </TableCell>
                  <TableCell
                    sx={{
                      ...cellPad,
                      borderBottom: `1px solid ${alpha(theme.palette.divider, 0.6)}`,
                      fontVariantNumeric: 'tabular-nums',
                      color: 'text.secondary',
                    }}
                  >
                    {r.ramal ? r.ramal : '—'}
                  </TableCell>
                  <TableCell
                    align="right"
                    sx={{
                      ...cellPad,
                      borderBottom: `1px solid ${alpha(theme.palette.divider, 0.6)}`,
                      fontVariantNumeric: 'tabular-nums',
                      fontWeight: 600,
                      color: 'primary.light',
                    }}
                  >
                    {r.quantidade}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
            <TableFooter>
              <TableRow
                sx={{
                  '& td': {
                    borderBottom: 'none',
                    borderTop: `2px solid ${alpha(accentColor, 0.45)}`,
                    bgcolor: alpha(accentColor, 0.08),
                  },
                }}
              >
                <TableCell colSpan={3} sx={{ ...cellPad, fontWeight: 700, fontSize: '0.875rem' }}>
                  Total no turno
                </TableCell>
                <TableCell
                  align="right"
                  sx={{
                    ...cellPad,
                    fontWeight: 800,
                    fontSize: '1rem',
                    fontVariantNumeric: 'tabular-nums',
                    color: accentColor,
                  }}
                >
                  {total}
                </TableCell>
              </TableRow>
            </TableFooter>
          </Table>
        </TableContainer>
      )}
    </Paper>
  );
}

export function AtendidasPorTurnoTables() {
  const theme = useTheme();
  const {
    chamadasRows,
    equipePorNomeAtendente,
    encontradoSadPorNomeAtendente,
    equipesResolucao,
    equipesResolucaoErro,
  } = useChamadasImport();

  const resumoPeriodoArquivo = useMemo(() => resumoPeriodoDatasChamadas(chamadasRows), [chamadasRows]);

  const { diurno, noturno } = useMemo(() => {
    const d = filtrarChamadasPorTurno(chamadasRows, 'diurno');
    const n = filtrarChamadasPorTurno(chamadasRows, 'noturno');
    return {
      diurno: agregarAtendidasPorAtendente(d),
      noturno: agregarAtendidasPorAtendente(n),
    };
  }, [chamadasRows]);

  if (chamadasRows.length === 0) {
    return (
      <Paper
        elevation={0}
        sx={{
          p: 3,
          borderRadius: 2,
          border: 1,
          borderColor: 'divider',
          bgcolor: alpha(theme.palette.background.paper, 0.5),
        }}
      >
        <Typography variant="body2" color="text.secondary" sx={{ lineHeight: 1.6 }}>
          Importe um arquivo XLSX na seção acima para montar as tabelas de atendidas por turno.
        </Typography>
      </Paper>
    );
  }

  return (
    <Stack spacing={2.5}>
      <Typography variant="h6" component="h2" fontWeight={700}>
        {tituloComPeriodoChamadas('Atendidas por turno', chamadasRows)}
      </Typography>
      {!resumoPeriodoArquivo.identificado ? (
        <Typography variant="body2" color="text.secondary">
          Período não identificado nos dados — use data e hora nas colunas de horário para exibir as datas
          automaticamente.
        </Typography>
      ) : null}
      <Typography variant="body2" color="text.secondary" sx={{ maxWidth: 720, lineHeight: 1.65 }}>
        Classificação do turno pela mesma referência de horário dos gráficos:{' '}
        <strong>Hora Entrada Fila</strong>, depois atendimento ou desligamento. A coluna <strong>Equipe</strong>{' '}
        consulta policiais <strong>ativos</strong> no cadastro do Órion SAD. Com pelo menos <strong>duas</strong> palavras
        no nome da planilha (ignorando de/da/do…), todas devem aparecer no nome completo do cadastro; nome inteiro
        igual continua válido. Um único termo só casa se o nome completo for idêntico (normalizado).
      </Typography>
      {equipesResolucao === 'error' && equipesResolucaoErro ? (
        <Alert severity="warning" variant="outlined">
          Equipes não carregadas: {equipesResolucaoErro}
        </Alert>
      ) : null}
      <Stack
        direction={{ xs: 'column', md: 'row' }}
        spacing={2.5}
        alignItems="stretch"
        sx={{ '& > *': { flex: 1, minWidth: 0 } }}
      >
        <TabelaAtendidasTurno
          accent="diurno"
          tituloPainel="Turno diurno"
          subtitulo="Período 07:00–18:59 — ligações ATENDIDA por atendente. Ramal: valor da coluna Ramal na primeira linha ATENDIDA de cada nome; demais divergências são ignoradas."
          linhas={diurno}
          equipePorNomeAtendente={equipePorNomeAtendente}
          encontradoSadPorNomeAtendente={encontradoSadPorNomeAtendente}
          equipesResolucao={equipesResolucao}
        />
        <TabelaAtendidasTurno
          accent="noturno"
          tituloPainel="Turno noturno"
          subtitulo="Período 19:00–06:59 (cruza meia-noite) — mesma regra de contagem e de ramal."
          linhas={noturno}
          equipePorNomeAtendente={equipePorNomeAtendente}
          encontradoSadPorNomeAtendente={encontradoSadPorNomeAtendente}
          equipesResolucao={equipesResolucao}
        />
      </Stack>
    </Stack>
  );
}
