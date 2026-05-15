import { useMemo, useState } from 'react';
import { Alert, Box, Paper, Stack, Tab, Tabs, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Typography } from '@mui/material';
import {
  Bar,
  BarChart,
  CartesianGrid,
  LabelList,
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
import { resumoPeriodoDatasChamadas, tituloComPeriodoChamadas } from '../utils/periodoDatasChamadas';
import {
  type PeriodoTurnoChamada,
  fatiarPontosPorTurno,
  filtrarChamadasPorTurno,
} from '../utils/periodoTurnoChamada';
import { extrairLetraEquipe } from '../utils/extrairLetraEquipe';
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
    arquivoNome,
    abaNome,
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

  const totaisPrimeiroGrafico = useMemo(() => {
    let at = 0;
    let ab = 0;
    for (const p of pontosPrimeiroGrafico) {
      at += p.atendidas;
      ab += p.abandonadas;
    }
    return { atendidas: at, abandonadas: ab };
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

  const resumoPeriodoArquivo = useMemo(() => resumoPeriodoDatasChamadas(chamadasRows), [chamadasRows]);

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

  return (
    <Stack spacing={2}>
      {chamadasRows.length === 0 ? (
        <Alert severity="info" variant="outlined" sx={{ borderColor: 'divider' }}>
          <strong>Dados de chamadas.</strong> Importe um arquivo XLSX na aba <strong>Registros</strong> para gerar o
          gráfico de ligações (status ATENDIDA e ABANDONADA) por hora do dia.
        </Alert>
      ) : (
        <Alert severity="success" variant="outlined" sx={{ borderColor: 'divider' }}>
          Gráficos de chamadas usam o arquivo <strong>{arquivoNome}</strong>
          {abaNome ? (
            <>
              {' '}
              (aba <strong>{abaNome}</strong>)
            </>
          ) : null}
          — {chamadasRows.length} registro(s). No gráfico com data completa, os pontos são a cada <strong>30 minutos</strong>;
          no modo só turno, por hora. Referência: <strong>Hora Entrada Fila</strong> (com fallback para atendimento/desligamento
          quando vazia).
          {resumoPeriodoArquivo.identificado ? (
            <Typography component="div" variant="body2" sx={{ mt: 1.25 }}>
              <strong>Período dos registros:</strong> {resumoPeriodoArquivo.textoPeriodo}
            </Typography>
          ) : (
            <Typography component="div" variant="body2" color="text.secondary" sx={{ mt: 1.25 }}>
              <strong>Período:</strong> não identificado nos dados — use células com <strong>data e hora</strong> (ex.{' '}
              dd/mm/aaaa hh:mm:ss) nas colunas de horário para exibir o período automaticamente.
            </Typography>
          )}
        </Alert>
      )}

      <Paper sx={{ p: 2, minHeight: 480 }}>
        {linhaTempo ? (
          <>
            <Typography variant="h6" component="h2" fontWeight={700} gutterBottom sx={{ mt: 0.25 }}>
              {tituloComPeriodoChamadas('Atendimentos e abandonos (a cada 30 min)', chamadasRows)}
            </Typography>
            <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1.5 }}>
              Pontos no gráfico a cada <strong>30 minutos</strong> (:00 e :30). Contagem por status <strong>ATENDIDA</strong> e{' '}
              <strong>ABANDONADA</strong> (mesma ordem de campos de horário). Totais no período:{' '}
              <strong style={{ color: COR_ATENDIDAS_AZUL }}>ATEND. {totaisPrimeiroGrafico.atendidas}</strong>
              {' · '}
              <strong style={{ color: COR_ABANDONADAS_LARANJA }}>ABAND. {totaisPrimeiroGrafico.abandonadas}</strong>
            </Typography>
            {linhaTempo.usouFallbackSomenteHora ? (
              <Alert severity="warning" variant="outlined" sx={{ mb: 2, borderColor: 'divider' }}>
                Parte das linhas tinha <strong>só horário</strong> (sem data): esses registros foram posicionados no dia
                do primeiro carimbo com data, para manter o gráfico contínuo.
              </Alert>
            ) : null}
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
                <Typography variant="caption" color="text.secondary" fontWeight={600}>
                  Faixas do dia (referência visual — madrugada / diurno / noturno)
                </Typography>
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
              {tituloComPeriodoChamadas('Chamadas por hora do dia', chamadasRows)}
            </Typography>
            <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1 }}>
              Sem <strong>data e hora completas</strong> no arquivo, usamos o modo por <strong>turno</strong> (24 h). Com
              data nas colunas de horário, o gráfico passa a mostrar o <strong>intervalo total</strong>, cartões de % e
              faixas coloridas. Referência: Hora Entrada Fila → atendimento → desligamento.{' '}
              <strong>Diurno</strong> 07:00–18:59 · <strong>Noturno</strong> 19:00–06:59. Nesta aba:{' '}
              {turno === 'diurno' ? (
                <>intervalos 07:00–18:00.</>
              ) : (
                <>19:00–23:00 e depois 00:00–06:00 (ordem do eixo).</>
              )}{' '}
              Apenas status <strong>ATENDIDA</strong> e <strong>ABANDONADA</strong>. Totais no turno:{' '}
              <strong style={{ color: COR_ATENDIDAS_AZUL }}>ATEND. {totaisPrimeiroGrafico.atendidas}</strong>
              {' · '}
              <strong style={{ color: COR_ABANDONADAS_LARANJA }}>ABAND. {totaisPrimeiroGrafico.abandonadas}</strong>
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
        {chamadasRows.length > 0 && resumoMotivosEncerramento.length > 0 ? (
          <Box sx={{ mt: 3 }}>
            <Typography variant="subtitle1" component="h3" fontWeight={700} gutterBottom>
              Motivo encerramento
            </Typography>
            <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1.25 }}>
              Formato: <strong>motivo: total</strong> e, entre parênteses, o ramal e o atendente mais frequentes naquele
              motivo, cada um com a <strong>quantidade de registros</strong> em que aparecem (entre as linhas com esse
              motivo). Empates: desempate alfabético.
            </Typography>
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
                    <TableCell sx={{ fontWeight: 700 }}>Motivo: total (ramal e atendente moda · subcontagens)</TableCell>
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
        ) : null}
      </Paper>

      <Paper sx={{ p: 2 }}>
        <AbasTurnoChamadas value={turno} onChange={setTurno} />
        <Typography variant="h6" component="h2" fontWeight={700} gutterBottom sx={{ mt: 0.25 }}>
          {tituloComPeriodoChamadas('Chamadas atendidas por atendente', chamadasRows)}
        </Typography>
        <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1.5 }}>
          O gráfico <strong>acima</strong> usa o intervalo completo do arquivo quando há data nas colunas (pontos
          a cada <strong>30 minutos</strong>); caso contrário, o modo por turno (Diurno / Noturno), por hora. Aqui cada
          barra é um nome da coluna <strong>Atendente</strong>; o comprimento e o número à direita indicam quantas
          ligações <strong>ATENDIDA</strong> (mesma regra do gráfico por hora) no turno selecionado.
        </Typography>
        {chamadasRows.length === 0 ? (
          <Typography variant="body2" color="text.secondary" sx={{ py: 3 }}>
            Importe um XLSX na aba Registros para montar este gráfico.
          </Typography>
        ) : dadosPorAtendente.length === 0 ? (
          <Typography variant="body2" color="text.secondary" sx={{ py: 3 }}>
            Não há registros classificados como <strong>ATENDIDA</strong> para agrupar por atendente.
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
