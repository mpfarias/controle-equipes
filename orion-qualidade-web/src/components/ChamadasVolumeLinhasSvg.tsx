import { useCallback, useEffect, useId, useRef, useState } from 'react';
import PanToolOutlined from '@mui/icons-material/PanToolOutlined';
import { Box, Button, Paper, Stack, ToggleButton, Tooltip, Typography } from '@mui/material';

export type PontoChamadasVolumeLinhas = {
  horaLabel?: string;
  /** Início do bucket (ms); presente no modo linha do tempo — usado para marcas de hora cheia no eixo X. */
  bucketMs?: number;
  atendidas: number;
  abandonadas: number;
};

const VB_W = 1000;
const VB_H = 420;

type ViewRect = { vx: number; vy: number; vw: number; vh: number };

const FULL_VIEW: ViewRect = { vx: 0, vy: 0, vw: VB_W, vh: VB_H };

const ZOOM_FACTOR = 1.12;
const MIN_VW = VB_W / 14;
const MIN_VH = VB_H / 14;

function horaLinhaCurta(horaLabel: string | undefined): string {
  const s = horaLabel != null ? String(horaLabel) : '';
  return s.includes('\n') ? s.split('\n').pop()!.trim() : s.trim();
}

/** Bucket alinhado ao início da hora local (:00). */
function isInicioHoraCheiaLocal(ms: number): boolean {
  const d = new Date(ms);
  return d.getMinutes() === 0 && d.getSeconds() === 0 && d.getMilliseconds() === 0;
}

/**
 * Marcas do eixo X em **hora cheia** (:00). Usa `bucketMs` quando existir; senão, `horaLabel` terminando em `:00`.
 * Se houver demais horas, reduz mantendo alinhamento a horas cheias.
 */
function indicesTicksEixoHorario(n: number, pontos: PontoChamadasVolumeLinhas[]): number[] {
  if (n <= 0) return [];
  if (n === 1) return [0];

  const hourly: number[] = [];
  let algumBucketMs = false;
  for (let i = 0; i < n; i++) {
    const ms = pontos[i]?.bucketMs;
    if (ms != null && Number.isFinite(ms)) {
      algumBucketMs = true;
      if (isInicioHoraCheiaLocal(ms)) hourly.push(i);
    }
  }
  if (!algumBucketMs) {
    for (let i = 0; i < n; i++) {
      const h = horaLinhaCurta(pontos[i]?.horaLabel);
      if (h.endsWith(':00')) hourly.push(i);
    }
  }

  if (hourly.length === 0) {
    const want = Math.min(14, n);
    const step = Math.max(1, Math.ceil((n - 1) / Math.max(1, want - 1)));
    const out: number[] = [];
    for (let i = 0; i < n; i += step) out.push(i);
    if (out[out.length - 1] !== n - 1) out.push(n - 1);
    return out;
  }

  const sorted = [...new Set(hourly)].sort((a, b) => a - b);
  const maxTicks = 22;
  if (sorted.length <= maxTicks) return sorted;

  const step = Math.ceil(sorted.length / maxTicks);
  const thinned: number[] = [];
  for (let j = 0; j < sorted.length; j += step) thinned.push(sorted[j]);
  if (thinned[thinned.length - 1] !== sorted[sorted.length - 1]) thinned.push(sorted[sorted.length - 1]);
  return thinned;
}

function isZoomed(v: ViewRect): boolean {
  return v.vw < VB_W - 0.5 || v.vh < VB_H - 0.5 || v.vx > 0.5 || v.vy > 0.5;
}

type Props = {
  pontos: PontoChamadasVolumeLinhas[];
  maxY: number;
  corAtendidas: string;
  corAbandonadas: string;
  height: number;
};

/**
 * Gráfico de duas séries em SVG. **Zoom** com a roda; **mover** com botão do meio, Shift+esquerdo ou modo
 * «Arrastar» (esquerdo). Duplo clique ou «Redefinir zoom».
 */
export function ChamadasVolumeLinhasSvg({
  pontos,
  maxY,
  corAtendidas,
  corAbandonadas,
  height,
}: Props) {
  const patternUid = useId().replace(/:/g, '');
  const wrapRef = useRef<HTMLDivElement>(null);
  const panDrag = useRef<null | { sx: number; sy: number; vx: number; vy: number; vw: number; vh: number }>(null);
  const modoArrastarRef = useRef(false);

  const [hoverI, setHoverI] = useState<number | null>(null);
  const [view, setView] = useState<ViewRect>(FULL_VIEW);
  const [modoArrastar, setModoArrastar] = useState(false);
  const [arrastando, setArrastando] = useState(false);
  const viewRef = useRef(view);
  viewRef.current = view;
  modoArrastarRef.current = modoArrastar;

  const n = pontos.length;
  const maxYSafe = Math.max(1, maxY);

  useEffect(() => {
    setView(FULL_VIEW);
    setModoArrastar(false);
  }, [n, maxY]);

  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const rect = el.getBoundingClientRect();
      if (rect.width <= 0 || rect.height <= 0) return;
      const relX = (e.clientX - rect.left) / rect.width;
      const relY = (e.clientY - rect.top) / rect.height;
      const zoomIn = e.deltaY < 0;
      const f = zoomIn ? 1 / ZOOM_FACTOR : ZOOM_FACTOR;
      setView((prev) => {
        const { vx, vy, vw, vh } = prev;
        const dataX = vx + relX * vw;
        const dataY = vy + relY * vh;
        let newVw = vw * f;
        let newVh = vh * f;
        newVw = Math.min(VB_W, Math.max(MIN_VW, newVw));
        newVh = Math.min(VB_H, Math.max(MIN_VH, newVh));
        let newVx = dataX - relX * newVw;
        let newVy = dataY - relY * newVh;
        newVx = Math.max(0, Math.min(VB_W - newVw, newVx));
        newVy = Math.max(0, Math.min(VB_H - newVh, newVy));
        return { vx: newVx, vy: newVy, vw: newVw, vh: newVh };
      });
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, []);

  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      const d = panDrag.current;
      const el = wrapRef.current;
      if (!d || !el) return;
      const rect = el.getBoundingClientRect();
      if (rect.width <= 0 || rect.height <= 0) return;
      const dx = e.clientX - d.sx;
      const dy = e.clientY - d.sy;
      const dvx = -(dx / rect.width) * d.vw;
      const dvy = -(dy / rect.height) * d.vh;
      const newVx = Math.max(0, Math.min(VB_W - d.vw, d.vx + dvx));
      const newVy = Math.max(0, Math.min(VB_H - d.vh, d.vy + dvy));
      setView({ vx: newVx, vy: newVy, vw: d.vw, vh: d.vh });
    };
    const onUp = () => {
      panDrag.current = null;
      setArrastando(false);
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    return () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
  }, []);

  const onMouseDownSvg = useCallback((e: React.MouseEvent<SVGSVGElement>) => {
    const v = viewRef.current;
    const modo = modoArrastarRef.current;
    const panComEsquerdo = modo && e.button === 0 && !e.shiftKey;
    const panOk = e.button === 1 || (e.button === 0 && e.shiftKey) || panComEsquerdo;
    if (!panOk) return;
    e.preventDefault();
    if (!isZoomed(v)) return;
    panDrag.current = { sx: e.clientX, sy: e.clientY, vx: v.vx, vy: v.vy, vw: v.vw, vh: v.vh };
    setArrastando(true);
  }, []);

  const resetZoom = useCallback(() => {
    setView(FULL_VIEW);
  }, []);

  const padL = 58;
  const padR = 20;
  const padT = 32;
  const padB = n > 24 ? 102 : 78;
  const innerW = VB_W - padL - padR;
  const innerH = VB_H - padT - padB;

  const tickIndices = indicesTicksEixoHorario(n, pontos);

  const x = (i: number) => {
    if (n <= 1) return padL + innerW / 2;
    return padL + (i / (n - 1)) * innerW;
  };
  const y = (v: number) => padT + innerH - (Math.min(Math.max(0, v), maxYSafe) / maxYSafe) * innerH;

  const ySteps = 5;
  const yTicks = Array.from({ length: ySteps + 1 }, (_, k) => Math.round((maxYSafe * k) / ySteps));

  const polyAt =
    n > 0 ? pontos.map((p, i) => `${x(i)},${y(p.atendidas)}`).join(' ') : '';
  const polyAb =
    n > 0 ? pontos.map((p, i) => `${x(i)},${y(p.abandonadas)}`).join(' ') : '';

  const band = n <= 1 ? innerW : innerW / Math.max(n - 1, 1);
  const labelEvery = Math.max(1, Math.ceil(n / 36));
  const mostrarRotuloNoIndice = (i: number) => i % labelEvery === 0 || i === n - 1;

  const hover = hoverI != null && hoverI >= 0 && hoverI < n ? pontos[hoverI] : null;
  const zoomed = isZoomed(view);

  return (
    <Box sx={{ position: 'relative', width: '100%' }}>
      <Stack direction="row" spacing={2} sx={{ mb: 1, flexWrap: 'wrap', alignItems: 'center' }}>
        <Stack direction="row" spacing={0.75} alignItems="center">
          <Box sx={{ width: 14, height: 3, bgcolor: corAtendidas, borderRadius: 0.5 }} />
          <Typography variant="caption" sx={{ color: '#94a3b8', fontWeight: 600 }}>
            ATENDIMENTOS
          </Typography>
        </Stack>
        <Stack direction="row" spacing={0.75} alignItems="center">
          <Box sx={{ width: 14, height: 3, bgcolor: corAbandonadas, borderRadius: 0.5 }} />
          <Typography variant="caption" sx={{ color: '#94a3b8', fontWeight: 600 }}>
            ABANDONO
          </Typography>
        </Stack>
        <Tooltip
          title={
            zoomed
              ? 'Ative e arraste com o botão esquerdo. Desative para ver o resumo ao passar o mouse.'
              : 'Dê zoom na área do gráfico; depois use este modo para arrastar com o botão esquerdo.'
          }
        >
          <ToggleButton
            value="arrastar"
            size="small"
            color="primary"
            selected={modoArrastar}
            onClick={() => setModoArrastar((x) => !x)}
            aria-label="Modo arrastar o gráfico"
            sx={{ px: 1, py: 0.5, textTransform: 'none' }}
          >
            <PanToolOutlined sx={{ fontSize: 18, mr: 0.5 }} />
            <Typography component="span" variant="caption" fontWeight={600}>
              Arrastar
            </Typography>
          </ToggleButton>
        </Tooltip>
        {zoomed ? (
          <Button size="small" variant="outlined" color="inherit" onClick={resetZoom} sx={{ ml: { xs: 0, sm: 1 } }}>
            Redefinir zoom
          </Button>
        ) : null}
        <Typography
          variant="caption"
          sx={{ color: 'text.secondary', maxWidth: 480, lineHeight: 1.35 }}
          component="span"
        >
          Roda do mouse: zoom. Mover: botão «Arrastar» + esquerdo, botão do meio, ou Shift + esquerdo (com zoom).
          Duplo clique ou «Redefinir zoom».
        </Typography>
      </Stack>

      {hover ? (
        <Paper
          elevation={4}
          sx={{
            position: 'absolute',
            right: 12,
            top: 4,
            zIndex: 2,
            p: 1.25,
            minWidth: 160,
            bgcolor: '#1e293b',
            border: '1px solid #334155',
            borderRadius: 1,
            color: '#e2e8f0',
          }}
        >
          <Typography variant="caption" sx={{ color: '#94a3b8', display: 'block', mb: 0.75 }}>
            {String(hover.horaLabel ?? '—').replace(/\n/g, ' · ')}
          </Typography>
          <Typography variant="caption" sx={{ fontWeight: 700, color: corAtendidas, display: 'block' }}>
            ATENDIMENTOS: {hover.atendidas}
          </Typography>
          <Typography variant="caption" sx={{ fontWeight: 700, color: corAbandonadas, display: 'block', mt: 0.5 }}>
            ABANDONO: {hover.abandonadas}
          </Typography>
        </Paper>
      ) : null}

      <Box
        ref={wrapRef}
        onContextMenu={(e) => e.preventDefault()}
        sx={{
          touchAction: 'none',
          cursor: arrastando ? 'grabbing' : modoArrastar && zoomed ? 'grab' : 'default',
          borderRadius: 1,
          outline: '1px solid',
          outlineColor: 'divider',
          userSelect: modoArrastar && zoomed ? 'none' : 'auto',
        }}
      >
        <svg
          viewBox={`${view.vx} ${view.vy} ${view.vw} ${view.vh}`}
          width="100%"
          height={height}
          preserveAspectRatio="xMidYMid meet"
          role="img"
          aria-label="Gráfico de atendimentos e abandonos ao longo do tempo"
          onMouseDown={onMouseDownSvg}
          onDoubleClick={(e) => {
            e.preventDefault();
            resetZoom();
          }}
        >
          <defs>
            <pattern
              id={`gridChamadas${patternUid}`}
              width="40"
              height="40"
              patternUnits="userSpaceOnUse"
            >
              <path d="M 40 0 L 0 0 0 40" fill="none" stroke="#334155" strokeWidth="0.6" opacity={0.45} />
            </pattern>
          </defs>
          <rect x={padL} y={padT} width={innerW} height={innerH} fill={`url(#gridChamadas${patternUid})`} opacity={0.35} />

          {yTicks.map((yt) => {
            const yy = y(yt);
            return (
              <g key={`gy-${yt}`}>
                <line
                  x1={padL}
                  x2={padL + innerW}
                  y1={yy}
                  y2={yy}
                  stroke="#334155"
                  strokeWidth="0.8"
                  strokeDasharray="4 4"
                  opacity={0.55}
                />
                <text x={padL - 8} y={yy + 4} textAnchor="end" fill="#94a3b8" fontSize={11}>
                  {yt}
                </text>
              </g>
            );
          })}

          <text
            x={18}
            y={padT + innerH / 2}
            textAnchor="middle"
            fill="#94a3b8"
            fontSize={12}
            transform={`rotate(-90, 18, ${padT + innerH / 2})`}
          >
            Quantidade
          </text>

          {tickIndices.map((i) => {
            const lab = String(pontos[i]?.horaLabel ?? '').replace(/\n/g, ' · ');
            const xi = x(i);
            const rot = n > 24 ? -42 : 0;
            const anchor = n > 24 ? 'end' : 'middle';
            const ty = padT + innerH + (n > 24 ? 36 : 22);
            return (
              <text
                key={`tx-${i}`}
                x={xi}
                y={ty}
                textAnchor={anchor}
                fill="#94a3b8"
                fontSize={10}
                transform={rot ? `rotate(${rot}, ${xi}, ${ty})` : undefined}
              >
                {lab}
              </text>
            );
          })}

          {n > 0 ? (
            <>
              <polyline
                fill="none"
                stroke={corAtendidas}
                strokeWidth={2.5}
                strokeLinejoin="round"
                strokeLinecap="round"
                points={polyAt}
              />
              <polyline
                fill="none"
                stroke={corAbandonadas}
                strokeWidth={2.5}
                strokeLinejoin="round"
                strokeLinecap="round"
                points={polyAb}
              />
            </>
          ) : null}

          {pontos.map((p, i) => {
            if (!mostrarRotuloNoIndice(i)) return null;
            const xa = x(i);
            const fs = n > 96 ? 8 : n > 56 ? 9 : 10;
            const dy = 11;
            let yAt = p.atendidas > 0 ? y(p.atendidas) - dy : null;
            let yAb = p.abandonadas > 0 ? y(p.abandonadas) - dy : null;
            if (yAt != null && yAb != null && Math.abs(yAt - yAb) < 13) {
              if (yAt <= yAb) {
                yAt -= 6;
                yAb += 6;
              } else {
                yAb -= 6;
                yAt += 6;
              }
            }
            return (
              <g key={`lbl-${i}`} style={{ pointerEvents: 'none' }}>
                {yAt != null ? (
                  <text
                    x={xa}
                    y={yAt}
                    textAnchor="middle"
                    fill={corAtendidas}
                    fontSize={fs}
                    fontWeight={700}
                    stroke="rgba(15,23,42,0.55)"
                    strokeWidth={0.35}
                    paintOrder="stroke fill"
                  >
                    {p.atendidas}
                  </text>
                ) : null}
                {yAb != null ? (
                  <text
                    x={xa}
                    y={yAb}
                    textAnchor="middle"
                    fill={corAbandonadas}
                    fontSize={fs}
                    fontWeight={700}
                    stroke="rgba(15,23,42,0.55)"
                    strokeWidth={0.35}
                    paintOrder="stroke fill"
                  >
                    {p.abandonadas}
                  </text>
                ) : null}
              </g>
            );
          })}

          {pontos.map((p, i) => (
            <g key={`hit-${i}`}>
              <circle cx={x(i)} cy={y(p.atendidas)} r={4} fill={corAtendidas} stroke="#0f172a55" strokeWidth={1} />
              <circle cx={x(i)} cy={y(p.abandonadas)} r={4} fill={corAbandonadas} stroke="#0f172a55" strokeWidth={1} />
              <rect
                x={n <= 1 ? padL : x(i) - band / 2}
                y={padT}
                width={Math.max(band, 6)}
                height={innerH}
                fill="transparent"
                style={{
                  cursor: modoArrastar && zoomed ? 'grab' : 'crosshair',
                }}
                onMouseEnter={() => {
                  if (panDrag.current || modoArrastar) return;
                  setHoverI(i);
                }}
                onMouseLeave={() => setHoverI(null)}
              >
                <title>
                  {String(p.horaLabel ?? '—').replace(/\n/g, ' · ')} — ATEND. {p.atendidas} · ABAND. {p.abandonadas}
                </title>
              </rect>
            </g>
          ))}
        </svg>
      </Box>
    </Box>
  );
}
