import { useMemo, useState } from 'react';
import { Alert, Paper, Stack, Tab, Tabs, Typography } from '@mui/material';
import {
  Bar,
  BarChart,
  CartesianGrid,
  LabelList,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { useChamadasImport } from '../context/ChamadasImportContext';
import { agregarAtendidasPorAtendente } from '../utils/agregarAtendidasPorAtendente';
import { agregarChamadasAtendidasAbandonadasPorHora, type PontoChamadasPorHora } from '../utils/agregarChamadasPorHora';
import { resumoPeriodoDatasChamadas, tituloComPeriodoChamadas } from '../utils/periodoDatasChamadas';
import {
  type PeriodoTurnoChamada,
  fatiarPontosPorTurno,
  filtrarChamadasPorTurno,
} from '../utils/periodoTurnoChamada';
import { extrairLetraEquipe } from '../utils/extrairLetraEquipe';

type LinhaGraficoAtendente = {
  nome: string;
  nomeEixo: string;
  quantidade: number;
  ramal: string;
};

const COR_ATENDIDA = '#2563eb';
const COR_ABANDONADA = '#ea580c';

const tooltipStyle = {
  backgroundColor: '#1e293b',
  border: '1px solid #334155',
  borderRadius: 8,
  color: '#e2e8f0',
};

function DotComValor({
  cx,
  cy,
  payload,
  dataKey,
  fill,
}: {
  cx?: number;
  cy?: number;
  payload?: PontoChamadasPorHora;
  dataKey: 'atendidas' | 'abandonadas';
  fill: string;
}) {
  if (cx == null || cy == null || !payload) return null;
  const v = payload[dataKey];
  const r = v > 99 ? 16 : 14;
  return (
    <g>
      <circle cx={cx} cy={cy} r={r} fill={fill} stroke="rgba(15,23,42,0.25)" strokeWidth={1} />
      <text
        x={cx}
        y={cy}
        textAnchor="middle"
        dominantBaseline="central"
        fill="#ffffff"
        fontSize={11}
        fontWeight={700}
        style={{ pointerEvents: 'none' }}
      >
        {v}
      </text>
    </g>
  );
}

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

  const totaisChamadasGrafico = useMemo(() => {
    let at = 0;
    let ab = 0;
    for (const p of dadosPorHora) {
      at += p.atendidas;
      ab += p.abandonadas;
    }
    return { atendidas: at, abandonadas: ab };
  }, [dadosPorHora]);

  const maxY = useMemo(() => {
    let m = 0;
    for (const p of dadosPorHora) {
      m = Math.max(m, p.atendidas, p.abandonadas);
    }
    return m <= 0 ? 5 : Math.ceil(m * 1.1);
  }, [dadosPorHora]);

  const resumoPeriodoArquivo = useMemo(() => resumoPeriodoDatasChamadas(chamadasRows), [chamadasRows]);

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
          — {chamadasRows.length} registro(s). Intervalo de hora pela <strong>Hora Entrada Fila</strong> (com fallback
          para atendimento/desligamento quando vazia).
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
        <AbasTurnoChamadas value={turno} onChange={setTurno} />
        <Typography variant="h6" component="h2" fontWeight={700} gutterBottom sx={{ mt: 0.25 }}>
          {tituloComPeriodoChamadas('Chamadas por hora do dia', chamadasRows)}
        </Typography>
        <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1 }}>
          Turno pela mesma referência de horário (Hora Entrada Fila, depois atendimento/desligamento):{' '}
          <strong>Diurno</strong> 07:00–18:59 · <strong>Noturno</strong> 19:00–06:59. Nesta aba:{' '}
          {turno === 'diurno' ? (
            <>intervalos 07:00–18:00.</>
          ) : (
            <>19:00–23:00 e depois 00:00–06:00 (ordem do eixo).</>
          )}{' '}
          Apenas status <strong>ATENDIDA</strong> e <strong>ABANDONADA</strong>. Totais no turno:{' '}
          <strong style={{ color: COR_ATENDIDA }}>ATEND. {totaisChamadasGrafico.atendidas}</strong>
          {' · '}
          <strong style={{ color: COR_ABANDONADA }}>ABAND. {totaisChamadasGrafico.abandonadas}</strong>
        </Typography>
        <ResponsiveContainer width="100%" height={400}>
          <LineChart data={dadosPorHora} margin={{ top: 16, right: 12, left: 4, bottom: 36 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#334155" opacity={0.55} />
            <XAxis
              dataKey="horaLabel"
              stroke="#94a3b8"
              fontSize={11}
              interval={0}
              tick={{ fill: '#94a3b8' }}
              tickMargin={14}
              height={52}
            />
            <YAxis
              stroke="#94a3b8"
              fontSize={12}
              allowDecimals={false}
              domain={[0, maxY]}
              padding={{ bottom: 12 }}
              tick={{ fill: '#94a3b8' }}
            />
            <Tooltip
              contentStyle={tooltipStyle}
              formatter={(value: number, name: string) => [value, name === 'atendidas' ? 'ATEND.' : 'ABAND.']}
              labelFormatter={(label) => `Hora ${label}`}
            />
            <Legend
              wrapperStyle={{ fontSize: 12, color: '#94a3b8', paddingTop: 8 }}
              formatter={(value) => (value === 'atendidas' ? 'ATEND.' : 'ABAND.')}
            />
            <Line
              type="monotone"
              dataKey="atendidas"
              name="atendidas"
              stroke={COR_ATENDIDA}
              strokeWidth={2}
              isAnimationActive={false}
              dot={(props) => <DotComValor {...props} dataKey="atendidas" fill={COR_ATENDIDA} />}
              activeDot={{ r: 6, stroke: COR_ATENDIDA, fill: '#fff' }}
            />
            <Line
              type="monotone"
              dataKey="abandonadas"
              name="abandonadas"
              stroke={COR_ABANDONADA}
              strokeWidth={2}
              isAnimationActive={false}
              dot={(props) => <DotComValor {...props} dataKey="abandonadas" fill={COR_ABANDONADA} />}
              activeDot={{ r: 6, stroke: COR_ABANDONADA, fill: '#fff' }}
            />
          </LineChart>
        </ResponsiveContainer>
      </Paper>

      <Paper sx={{ p: 2 }}>
        <AbasTurnoChamadas value={turno} onChange={setTurno} />
        <Typography variant="h6" component="h2" fontWeight={700} gutterBottom sx={{ mt: 0.25 }}>
          {tituloComPeriodoChamadas('Chamadas atendidas por atendente', chamadasRows)}
        </Typography>
        <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1.5 }}>
          Mesmo turno (Diurno / Noturno) do gráfico acima. Cada barra é um nome da coluna <strong>Atendente</strong>; o
          comprimento e o número à direita indicam quantas ligações <strong>ATENDIDA</strong> (mesma regra do gráfico
          por hora) no turno selecionado.
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
                fill={COR_ATENDIDA}
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
