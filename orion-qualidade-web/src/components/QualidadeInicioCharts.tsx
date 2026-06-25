import { useMemo, useState } from 'react';
import { Box, Paper, Stack, Tab, Tabs, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Typography } from '@mui/material';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  LabelList,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { useChamadasImport } from '../context/ChamadasImportContext';
import { agregarAtendidasPorAtendente } from '../utils/agregarAtendidasPorAtendente';
import {
  agregarChamadasAtendidasAbandonadasPorHora,
  normalizarRamalChamada,
} from '../utils/agregarChamadasPorHora';
import {
  agregarChamadasLinhaTempo,
  CORES_FAIXA_BARRA,
  PROPORCAO_FAIXA_24H,
} from '../utils/agregarChamadasLinhaTempo';
import {
  type PeriodoTurnoChamada,
  fatiarPontosPorTurno,
  filtrarChamadasPorTurno,
} from '../utils/periodoTurnoChamada';
import { extrairLetraEquipe } from '../utils/extrairLetraEquipe';
import { ChamadasFiltroSection } from './ChamadasFiltroSection';
import { ChamadasVolumeLinhasSvg } from './ChamadasVolumeLinhasSvg';

function rotuloAtendenteMotivoAgregacao(raw: string): string {
  const t = String(raw ?? '').trim();
  return t.length > 0 ? t : '(Sem atendente)';
}

/** Par chave/contagem com maior contagem; em empate, desempate alfabético pt-BR na chave. */
function modaComContagem(contagens: Map<string, number>): { k: string; q: number } {
  let melhor: { k: string; q: number } | null = null;
  for (const [k, q] of contagens) {
    if (q <= 0) continue;
    if (!melhor || q > melhor.q || (q === melhor.q && k.localeCompare(melhor.k, 'pt-BR') < 0)) {
      melhor = { k, q };
    }
  }
  return melhor ?? { k: '—', q: 0 };
}

type LinhaGraficoAtendente = {
  nome: string;
  nomeEixo: string;
  quantidade: number;
  ramal: string;
};

/** Chamadas ATENDIDA — azul */
const COR_ATENDIDAS_AZUL = '#2563eb';
/** Chamadas ABANDONADA — laranja */
const COR_ABANDONADAS_LARANJA = '#ea580c';

const tooltipStyle = {
  backgroundColor: '#1e293b',
  border: '1px solid #334155',
  borderRadius: 8,
  color: '#e2e8f0',
};

const CORES_PIZZA_MOTIVO = [
  '#2563eb',
  '#ea580c',
  '#16a34a',
  '#9333ea',
  '#0891b2',
  '#ca8a04',
  '#dc2626',
  '#64748b',
  '#db2777',
  '#0d9488',
  '#7c3aed',
  '#059669',
] as const;

type FatiaMotivoPizza = {
  texto: string;
  qtd: number;
};

type PayloadContagensHora = {
  atendidas?: number;
  abandonadas?: number;
  horaLabel?: string;
  bucketMs?: number;
  horaIndex?: number;
};

type PontoGraficoComIndice = PayloadContagensHora & {
  eixoIdx: number;
  atendidas: number;
  abandonadas: number;
};

function AbasTurnoChamadas({
  value,
  onChange,
}: {
  value: PeriodoTurnoChamada;
  onChange: (v: PeriodoTurnoChamada) => void;
}) {
  return (
    <Tabs
      value={value}
      onChange={(_, v) => onChange(v as PeriodoTurnoChamada)}
      sx={{ minHeight: 40, mb: 1, borderBottom: 1, borderColor: 'divider' }}
    >
      <Tab label="Diurno" value="diurno" sx={{ minHeight: 40, textTransform: 'none' }} />
      <Tab label="Noturno" value="noturno" sx={{ minHeight: 40, textTransform: 'none' }} />
    </Tabs>
  );
}

export function QualidadeInicioCharts() {
  const {
    chamadasRows,
    equipePorNomeAtendente,
    encontradoSadPorNomeAtendente,
    equipesResolucao,
  } = useChamadasImport();
  const [turno, setTurno] = useState<PeriodoTurnoChamada>('diurno');

  const linhasPorTurno = useMemo(
    () => filtrarChamadasPorTurno(chamadasRows, turno),
    [chamadasRows, turno],
  );

  const buckets24PorTurno = useMemo(
    () => agregarChamadasAtendidasAbandonadasPorHora(linhasPorTurno),
    [linhasPorTurno],
  );

  const dadosPorHora = useMemo(
    () => fatiarPontosPorTurno(buckets24PorTurno, turno),
    [buckets24PorTurno, turno],
  );

  const linhaTempo = useMemo(() => agregarChamadasLinhaTempo(chamadasRows), [chamadasRows]);

  const pontosPrimeiroGrafico = useMemo(
    () => linhaTempo?.pontos ?? dadosPorHora,
    [linhaTempo, dadosPorHora],
  );

  /** Pontos do primeiro gráfico com índice e contagens numéricas (usado pelo gráfico SVG). */
  const dadosComIndiceGrafico = useMemo((): PontoGraficoComIndice[] => {
    return pontosPrimeiroGrafico.map((p, i) => ({
      ...p,
      eixoIdx: i,
      atendidas: Number(p.atendidas) || 0,
      abandonadas: Number(p.abandonadas) || 0,
    }));
  }, [pontosPrimeiroGrafico]);

  const maxYPrimeiroGrafico = useMemo(() => {
    let m = 0;
    for (const p of pontosPrimeiroGrafico) {
      m = Math.max(m, p.atendidas, p.abandonadas);
    }
    if (m <= 0) return 50;
    return Math.max(50, Math.ceil(m / 50) * 50);
  }, [pontosPrimeiroGrafico]);

  const diasBarraFaixa = useMemo(() => {
    if (!linhaTempo) return [];
    const seen = new Set<number>();
    const out: Date[] = [];
    for (const met of linhaTempo.metricasFaixas) {
      if (seen.has(met.dataRefMs)) continue;
      seen.add(met.dataRefMs);
      out.push(new Date(met.dataRefMs));
    }
    return out;
  }, [linhaTempo]);

  const dadosPorAtendente = useMemo(
    () => agregarAtendidasPorAtendente(linhasPorTurno),
    [linhasPorTurno],
  );

  const dadosGraficoAtendentes = useMemo((): LinhaGraficoAtendente[] => {
    return dadosPorAtendente.map((row) => {
      const eqRaw =
        equipesResolucao === 'ok' && encontradoSadPorNomeAtendente[row.nome]
          ? equipePorNomeAtendente[row.nome]
          : null;
      const letra = extrairLetraEquipe(eqRaw);
      const nomeEixo = letra ? `(${letra}) ${row.nome}` : row.nome;
      return { nome: row.nome, nomeEixo, quantidade: row.quantidade, ramal: row.ramal };
    });
  }, [
    dadosPorAtendente,
    equipePorNomeAtendente,
    encontradoSadPorNomeAtendente,
    equipesResolucao,
  ]);

  const alturaGraficoAtendentes = useMemo(() => {
    const n = dadosPorAtendente.length;
    if (n === 0) return 220;
    return Math.min(900, Math.max(260, n * 44 + 96));
  }, [dadosPorAtendente.length]);

  /** Por motivo (não vazio): quantidade total, ramal mais frequente e atendente mais frequente entre essas linhas. */
  const resumoMotivosEncerramento = useMemo(() => {
    if (chamadasRows.length === 0) return [];
    type Ac = { qtd: number; ramais: Map<string, number>; atendentes: Map<string, number> };
    const porMotivo = new Map<string, Ac>();
    for (const row of chamadasRows) {
      const motivo = String(row.motivoEncerramento ?? '').trim();
      if (motivo.length === 0) continue;
      let g = porMotivo.get(motivo);
      if (!g) {
        g = { qtd: 0, ramais: new Map(), atendentes: new Map() };
        porMotivo.set(motivo, g);
      }
      g.qtd += 1;
      const ram = normalizarRamalChamada(row.ramal);
      g.ramais.set(ram, (g.ramais.get(ram) ?? 0) + 1);
      const at = rotuloAtendenteMotivoAgregacao(row.atendente);
      g.atendentes.set(at, (g.atendentes.get(at) ?? 0) + 1);
    }
    return Array.from(porMotivo.entries())
      .map(([texto, g]) => {
        const ram = modaComContagem(g.ramais);
        const at = modaComContagem(g.atendentes);
        return {
          texto,
          qtd: g.qtd,
          ramalModa: ram.k,
          ramalModaQtd: ram.q,
          atendenteModa: at.k,
          atendenteModaQtd: at.q,
        };
      })
      .sort((a, b) => b.qtd - a.qtd || a.texto.localeCompare(b.texto, 'pt-BR'));
  }, [chamadasRows]);

  const dadosMotivosPizza = useMemo(
    (): FatiaMotivoPizza[] => resumoMotivosEncerramento.map((row) => ({ texto: row.texto, qtd: row.qtd })),
    [resumoMotivosEncerramento],
  );

  const totalMotivosPizza = useMemo(
    () => dadosMotivosPizza.reduce((s, d) => s + d.qtd, 0),
    [dadosMotivosPizza],
  );

  const alturaPizzaMotivos = 320;

  return (
    <Stack spacing={2}>
      <ChamadasFiltroSection />

      <Paper sx={{ p: 2, minHeight: 480 }}>
        {linhaTempo ? (
          <>
            <Typography variant="h6" component="h2" fontWeight={700} gutterBottom sx={{ mt: 0.25 }}>
              Atendimentos e abandonos
            </Typography>
            <Stack direction="row" flexWrap="wrap" gap={1.5} justifyContent="center" sx={{ mb: 2 }}>
              {linhaTempo.metricasFaixas.map((met) => (
                <Paper
                  key={met.id}
                  variant="outlined"
                  sx={{
                    minWidth: 128,
                    flex: '1 1 128px',
                    maxWidth: 168,
                    p: 1.25,
                    textAlign: 'center',
                    borderColor: 'divider',
                    background: (theme) =>
                      theme.palette.mode === 'dark' ? 'rgba(15, 23, 42, 0.55)' : 'rgba(248, 250, 252, 0.9)',
                  }}
                >
                  <Typography variant="overline" color="text.secondary" sx={{ lineHeight: 1.2, fontWeight: 600 }}>
                    {met.dataLabelCurta}
                  </Typography>
                  <Typography
                    variant="h5"
                    component="div"
                    fontWeight={800}
                    sx={{
                      my: 0.5,
                      color: met.pctAtendidas != null ? COR_ATENDIDAS_AZUL : 'text.disabled',
                      lineHeight: 1.2,
                    }}
                  >
                    {met.pctAtendidas != null ? `${met.pctAtendidas}%` : '—'}
                  </Typography>
                  <Typography
                    variant="caption"
                    color="text.secondary"
                    display="block"
                    sx={{ mb: 0.75, lineHeight: 1.2 }}
                  >
                    de chamadas atendidas
                  </Typography>
                  <Typography variant="caption" fontWeight={700} display="block">
                    {met.faixaTitulo}
                  </Typography>
                  <Typography variant="caption" color="text.secondary" display="block" sx={{ mb: 0.75 }}>
                    {met.faixaSub}
                  </Typography>
                  <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.65rem' }}>
                    ATEND. {met.atendidas} · ABAND. {met.abandonadas}
                  </Typography>
                </Paper>
              ))}
            </Stack>
            <ChamadasVolumeLinhasSvg
              pontos={dadosComIndiceGrafico}
              maxY={maxYPrimeiroGrafico}
              corAtendidas={COR_ATENDIDAS_AZUL}
              corAbandonadas={COR_ABANDONADAS_LARANJA}
              height={pontosPrimeiroGrafico.length > 72 ? 460 : 420}
            />
            {diasBarraFaixa.length > 0 ? (
              <Stack spacing={0.75} sx={{ mt: 2 }}>
                <Stack direction="row" spacing={1} alignItems="stretch">
                  {diasBarraFaixa.map((dia) => {
                    const rotulo =
                      linhaTempo.metricasFaixas.find((m) => m.dataRefMs === dia.getTime())?.dataLabelCurta ??
                      dia.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
                    return (
                      <Stack key={dia.getTime()} flex={1} spacing={0.5} alignItems="center" sx={{ minWidth: 0 }}>
                        <Stack
                          direction="row"
                          width="100%"
                          sx={{
                            height: 14,
                            borderRadius: 1,
                            overflow: 'hidden',
                            border: '1px solid',
                            borderColor: 'divider',
                          }}
                        >
                          <Box
                            title="Madrugada · 00h às 06:59min"
                            sx={{ flex: PROPORCAO_FAIXA_24H.madrugada, bgcolor: CORES_FAIXA_BARRA.madrugada }}
                          />
                          <Box
                            title="Diurno · 07h às 18:59min"
                            sx={{ flex: PROPORCAO_FAIXA_24H.diurno, bgcolor: CORES_FAIXA_BARRA.diurno }}
                          />
                          <Box
                            title="Noturno · 19h às 23:59min"
                            sx={{ flex: PROPORCAO_FAIXA_24H.noturno, bgcolor: CORES_FAIXA_BARRA.noturno }}
                          />
                        </Stack>
                        <Typography variant="caption" color="text.secondary" noWrap>
                          {rotulo}
                        </Typography>
                      </Stack>
                    );
                  })}
                </Stack>
              </Stack>
            ) : null}
          </>
        ) : (
          <>
            <AbasTurnoChamadas value={turno} onChange={setTurno} />
            <Typography variant="h6" component="h2" fontWeight={700} gutterBottom sx={{ mt: 0.25 }}>
              Chamadas por hora
            </Typography>
            <ChamadasVolumeLinhasSvg
              pontos={dadosComIndiceGrafico}
              maxY={maxYPrimeiroGrafico}
              corAtendidas={COR_ATENDIDAS_AZUL}
              corAbandonadas={COR_ABANDONADAS_LARANJA}
              height={400}
            />
          </>
        )}
      </Paper>

      {chamadasRows.length > 0 && dadosMotivosPizza.length > 0 ? (
        <Paper sx={{ p: 2 }}>
          <Typography variant="h6" component="h2" fontWeight={700} gutterBottom sx={{ mt: 0.25 }}>
            Motivos de encerramento
          </Typography>
          <ResponsiveContainer width="100%" height={alturaPizzaMotivos}>
            <PieChart margin={{ top: 8, right: 8, bottom: 8, left: 8 }}>
              <Pie
                data={dadosMotivosPizza}
                dataKey="qtd"
                nameKey="texto"
                cx="50%"
                cy="50%"
                outerRadius={128}
                innerRadius={0}
                paddingAngle={1}
              >
                {dadosMotivosPizza.map((row, i) => (
                  <Cell key={row.texto} fill={CORES_PIZZA_MOTIVO[i % CORES_PIZZA_MOTIVO.length]} stroke="#0f172a" />
                ))}
              </Pie>
              <Tooltip
                content={({ active, payload }) => {
                  if (!active || !payload?.length) return null;
                  const row = payload[0]?.payload as FatiaMotivoPizza | undefined;
                  if (!row) return null;
                  const pct = totalMotivosPizza > 0 ? ((row.qtd / totalMotivosPizza) * 100).toFixed(1) : '0';
                  return (
                    <div style={{ ...tooltipStyle, padding: '10px 12px' }}>
                      <div style={{ fontWeight: 700, marginBottom: 6 }}>{row.texto}</div>
                      <div style={{ color: '#94a3b8', fontSize: 12 }}>Quantidade</div>
                      <div style={{ fontWeight: 600 }}>{row.qtd}</div>
                      <div style={{ color: '#94a3b8', fontSize: 12, marginTop: 6 }}>Participação</div>
                      <div>{pct}%</div>
                    </div>
                  );
                }}
              />
            </PieChart>
          </ResponsiveContainer>

          <Box
            sx={{
              mt: 2,
              display: 'grid',
              gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' },
              gap: 1,
              maxHeight: 320,
              overflowY: 'auto',
              pr: 0.5,
            }}
          >
            {dadosMotivosPizza.map((row, i) => {
              const pct = totalMotivosPizza > 0 ? ((row.qtd / totalMotivosPizza) * 100).toFixed(1) : '0';
              const cor = CORES_PIZZA_MOTIVO[i % CORES_PIZZA_MOTIVO.length];
              return (
                <Stack
                  key={row.texto}
                  direction="row"
                  spacing={1}
                  alignItems="flex-start"
                  sx={{ minWidth: 0 }}
                >
                  <Box
                    sx={{
                      width: 12,
                      height: 12,
                      borderRadius: '50%',
                      bgcolor: cor,
                      border: '1px solid',
                      borderColor: 'divider',
                      flexShrink: 0,
                      mt: 0.45,
                    }}
                  />
                  <Typography variant="body2" sx={{ minWidth: 0, wordBreak: 'break-word' }}>
                    {row.texto}{' '}
                    <Box component="span" sx={{ fontWeight: 700, whiteSpace: 'nowrap' }}>
                      {row.qtd} ({pct}%)
                    </Box>
                  </Typography>
                </Stack>
              );
            })}
          </Box>

          <Box sx={{ mt: 2 }}>
            <TableContainer
              component={Paper}
              variant="outlined"
              sx={{
                maxHeight: 440,
                borderColor: 'divider',
                background: (theme) =>
                  theme.palette.mode === 'dark' ? 'rgba(15, 23, 42, 0.35)' : 'rgba(248, 250, 252, 0.85)',
              }}
            >
              <Table size="small" stickyHeader>
                <TableHead>
                  <TableRow>
                    <TableCell sx={{ fontWeight: 700 }}>Motivo</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {resumoMotivosEncerramento.map((row) => (
                    <TableRow key={row.texto} hover>
                      <TableCell
                        sx={{
                          wordBreak: 'break-word',
                          maxWidth: { xs: '100%', sm: 720 },
                          verticalAlign: 'top',
                        }}
                      >
                        <Typography component="span" fontWeight={600}>
                          {row.texto}
                        </Typography>
                        <Typography component="span" color="text.secondary">
                          :{' '}
                        </Typography>
                        <Typography component="span" fontWeight={700}>
                          {row.qtd}
                        </Typography>
                        <Typography component="span" color="text.secondary">
                          {' '}
                          (Ramal:{' '}
                        </Typography>
                        <Typography component="span" fontWeight={500}>
                          {row.ramalModa}
                        </Typography>
                        <Typography component="span" color="text.secondary">
                          {' '}
                          - ({row.ramalModaQtd}{' '}
                          {row.ramalModaQtd === 1 ? 'registro' : 'registros'}) -{' '}
                        </Typography>
                        <Typography component="span" fontWeight={500}>
                          {row.atendenteModa}
                        </Typography>
                        <Typography component="span" color="text.secondary">
                          {' '}
                          ({row.atendenteModaQtd}{' '}
                          {row.atendenteModaQtd === 1 ? 'registro' : 'registros'})
                        </Typography>
                        <Typography component="span" color="text.secondary">
                          )
                        </Typography>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          </Box>
        </Paper>
      ) : null}

      <Paper sx={{ p: 2 }}>
        <AbasTurnoChamadas value={turno} onChange={setTurno} />
        <Typography variant="h6" component="h2" fontWeight={700} gutterBottom sx={{ mt: 0.25 }}>
          Chamadas atendidas por atendente
        </Typography>
        {chamadasRows.length === 0 ? (
          <Typography variant="body2" color="text.secondary" sx={{ py: 3 }}>
            Nenhum registro no período.
          </Typography>
        ) : dadosPorAtendente.length === 0 ? (
          <Typography variant="body2" color="text.secondary" sx={{ py: 3 }}>
            Sem atendidas no turno.
          </Typography>
        ) : (
          <ResponsiveContainer width="100%" height={alturaGraficoAtendentes}>
            <BarChart
              layout="vertical"
              data={dadosGraficoAtendentes}
              margin={{ top: 8, right: 56, left: 8, bottom: 8 }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="#33bb55" opacity={0.45} horizontal={false} />
              <XAxis
                type="number"
                stroke="#94a3b8"
                fontSize={12}
                allowDecimals={false}
                tick={{ fill: '#94a3b8' }}
              />
              <YAxis
                type="category"
                dataKey="nomeEixo"
                stroke="#94a3b8"
                width={268}
                interval={0}
                tick={{ fill: '#e2e8f0', fontSize: 12 }}
                tickMargin={8}
              />
              <Tooltip
                content={({ active, payload }) => {
                  if (!active || !payload?.length) return null;
                  const row = payload[0]?.payload as LinhaGraficoAtendente;
                  const nome = row?.nome ?? '';
                  const valor = payload[0]?.value;
                  let equipeTxt: string;
                  if (equipesResolucao === 'loading') equipeTxt = 'Carregando…';
                  else if (equipesResolucao === 'error' || equipesResolucao === 'skipped') equipeTxt = '—';
                  else if (!encontradoSadPorNomeAtendente[nome]) equipeTxt = 'Não localizado no SAD';
                  else equipeTxt = (equipePorNomeAtendente[nome] ?? '').trim() || '—';
                  return (
                    <div style={{ ...tooltipStyle, padding: '10px 12px' }}>
                      <div style={{ color: '#94a3b8', fontSize: 11, marginBottom: 2 }}>Atendente</div>
                      <div style={{ fontWeight: 600, marginBottom: 8 }}>{nome}</div>
                      <div style={{ color: '#94a3b8', fontSize: 11, marginBottom: 2 }}>Equipe</div>
                      <div style={{ marginBottom: 8 }}>{equipeTxt}</div>
                      <div style={{ color: '#94a3b8', fontSize: 11 }}>Chamadas atendidas</div>
                      <div style={{ fontWeight: 700 }}>{String(valor)}</div>
                    </div>
                  );
                }}
              />
              <Bar
                dataKey="quantidade"
                fill={COR_ATENDIDAS_AZUL}
                name="Atendidas"
                radius={[0, 6, 6, 0]}
                maxBarSize={32}
              >
                <LabelList
                  dataKey="quantidade"
                  position="right"
                  fill="#cbd5e1"
                  fontSize={12}
                  fontWeight={700}
                  offset={10}
                />
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        )}
      </Paper>
    </Stack>
  );
}
