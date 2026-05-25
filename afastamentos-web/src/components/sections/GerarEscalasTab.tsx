import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { Policial } from '../../types';
import {
  Alert,
  Box,
  Button,
  Checkbox,
  CircularProgress,
  Divider,
  FormControl,
  FormControlLabel,
  FormGroup,
  FormLabel,
  Grid,
  Paper,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import { api } from '../../api';
import type { FuncaoOption } from '../../types';
import type { EscalaParsed } from '../../utils/escalaParametros';
import {
  indiceFuncaoOrdenacaoEscala,
  labelTipoServicoUm,
  montarPayloadGerarEscalasCombinado,
  nomeFuncaoIndicaExpedienteAdministrativo,
  TIPOS_ESCALA_TOTAL,
  type LinhaEscalaGeradaDraft,
  type SvgEscalaConfig,
  type TipoServicoGerar,
} from '../../utils/gerarEscalasCalculo';
import { SvgEscalaVoluntarioDialog } from '../escalas/SvgEscalaVoluntarioDialog';
import { ESCALA_DEFINITIVA_RENDER_MESSAGE, writeEscalaGeradaEditorWindow } from '../../utils/escalaGeradaEditor';
import {
  ESCALA_GERADA_SALVAR_MESSAGE,
  linhasEscalaDraftParaApi,
  notificarImpressaoEscalaGeradaSalva,
  openEscalaGeradaBlankWindow,
  writeEscalaGeradaLoadingWindow,
  writeEscalaGeradaPrintWindow,
} from '../../utils/escalaGeradaPrint';
import type { EscalaGeradaDraftPayload } from '../../utils/gerarEscalasCalculo';
import type { PermissoesPorTela } from '../../utils/permissions';
import { canEdit } from '../../utils/permissions';
import { ESCALA_MOTORISTA_DIA } from '../../constants/escalaMotoristasDia';

function hojeIsoLocal(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

async function carregarTodosPoliciaisAtivos(): Promise<import('../../types').Policial[]> {
  const pageSize = 400;
  let page = 1;
  const all: import('../../types').Policial[] = [];
  for (;;) {
    const r = await api.listPoliciaisPaginated({
      page,
      pageSize,
      includeAfastamentos: false,
      includeRestricoes: false,
    });
    all.push(...r.Policiales);
    if (page >= r.totalPages) break;
    page += 1;
  }
  return all;
}

function tiposMarcados(op: boolean, exp: boolean, mot: boolean, svg: boolean): TipoServicoGerar[] {
  const t: TipoServicoGerar[] = [];
  if (op) t.push('OPERACIONAL');
  if (exp) t.push('EXPEDIENTE');
  if (mot) t.push('MOTORISTAS');
  if (svg) t.push('SVG');
  return t;
}

interface GerarEscalasTabProps {
  escalaParsed: EscalaParsed;
  permissoes?: PermissoesPorTela | null;
}

const formLabelLegendSx = {
  fontSize: '0.8125rem',
  fontWeight: 600,
  color: 'text.primary',
  mb: 1.25,
  '&.Mui-focused': { color: 'text.primary' },
};

const checkboxRowSx = {
  flexDirection: { xs: 'column', sm: 'row' },
  flexWrap: 'wrap',
  alignItems: { xs: 'flex-start', sm: 'center' },
  gap: { xs: 0, sm: 0.5 },
  columnGap: { sm: 2, md: 3 },
  rowGap: { xs: 0.5, sm: 0 },
  '& .MuiFormControlLabel-root': {
    mr: { xs: 0, sm: 0 },
    ml: { xs: -0.5, sm: 0 },
    alignItems: 'center',
  },
};

export function GerarEscalasTab({ escalaParsed, permissoes }: GerarEscalasTabProps) {
  const podeEditar = canEdit(permissoes, 'escalas-gerar');
  const [tipoOperacional, setTipoOperacional] = useState(false);
  const [tipoExpediente, setTipoExpediente] = useState(false);
  const [tipoMotoristas, setTipoMotoristas] = useState(false);
  const [tipoSvg, setTipoSvg] = useState(false);
  const [operacionalDiurno, setOperacionalDiurno] = useState(false);
  const [operacionalNoturno, setOperacionalNoturno] = useState(false);
  const [dataEscala, setDataEscala] = useState(hojeIsoLocal);
  const [loading, setLoading] = useState(false);
  const [loadingTotal, setLoadingTotal] = useState(false);
  const [semSvgEscalaTotal, setSemSvgEscalaTotal] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [funcaoMotoristaId, setFuncaoMotoristaId] = useState<number | null>(null);
  const [funcoesAtivas, setFuncoesAtivas] = useState<FuncaoOption[]>([]);
  const printWinRef = useRef<Window | null>(null);
  const pendingGeracaoRef = useRef<{
    tipos: TipoServicoGerar[];
    operacionalTurnos?: { diurno: boolean; noturno: boolean };
    loadingFlag: 'gerar' | 'total';
  } | null>(null);

  const [svgModalOpen, setSvgModalOpen] = useState(false);
  const [svgModalLoading, setSvgModalLoading] = useState(false);
  const [policiaisParaSvg, setPoliciaisParaSvg] = useState<Policial[]>([]);

  const tipos = tiposMarcados(tipoOperacional, tipoExpediente, tipoMotoristas, tipoSvg);

  const tiposEscalaTotal = useMemo(
    () => (semSvgEscalaTotal ? TIPOS_ESCALA_TOTAL.filter((t) => t !== 'SVG') : [...TIPOS_ESCALA_TOTAL]),
    [semSvgEscalaTotal],
  );

  const podeGerarMotoristas = useMemo(() => {
    return funcoesAtivas.some(
      (f) => f.escalaMotorista === true || f.nome.toUpperCase().includes('MOTORISTA'),
    );
  }, [funcoesAtivas]);

  useEffect(() => {
    const carregarFuncoes = async () => {
      try {
        const funcoes = await api.listFuncoes();
        const ativas = funcoes.filter((f) => f.ativo !== false);
        setFuncoesAtivas(ativas);
        const mot = ativas.find((f) => f.nome.toUpperCase().includes('MOTORISTA DE DIA'));
        if (mot) setFuncaoMotoristaId(mot.id);
      } catch {
        /* silencioso */
      }
    };
    void carregarFuncoes();
  }, []);

  const handleSalvarFromPrint = useCallback(async (payload: unknown) => {
    setError(null);
    const winImp = printWinRef.current;
    if (!podeEditar) {
      const msg = 'Sem permissão para gravar escalas no sistema.';
      setError(msg);
      notificarImpressaoEscalaGeradaSalva(winImp, { sucesso: false, mensagem: msg });
      return;
    }
    if (!payload || typeof payload !== 'object') {
      const msg = 'Dados inválidos para salvar a escala.';
      setError(msg);
      notificarImpressaoEscalaGeradaSalva(winImp, { sucesso: false, mensagem: msg });
      return;
    }
    const p = payload as {
      dataEscala?: string;
      tipoServico?: string;
      resumoEquipes?: string;
      linhas?: unknown[];
    };
    if (!p.dataEscala || !p.tipoServico || !Array.isArray(p.linhas)) {
      const msg = 'Dados inválidos para salvar a escala.';
      setError(msg);
      notificarImpressaoEscalaGeradaSalva(winImp, { sucesso: false, mensagem: msg });
      return;
    }
    try {
      const impressaoDraft = payload as EscalaGeradaDraftPayload;
      const created = await api.createEscalaGerada({
        dataEscala: p.dataEscala,
        tipoServico: p.tipoServico,
        resumoEquipes: p.resumoEquipes ?? null,
        linhas: linhasEscalaDraftParaApi(p.linhas as LinhaEscalaGeradaDraft[]),
        impressaoDraft: impressaoDraft as unknown as Record<string, unknown>,
      });
      notificarImpressaoEscalaGeradaSalva(winImp, { sucesso: true, registroId: created.id });
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Erro ao salvar a escala.';
      setError(msg);
      notificarImpressaoEscalaGeradaSalva(winImp, { sucesso: false, mensagem: msg });
    }
  }, [podeEditar]);

  useEffect(() => {
    const onMessage = (e: MessageEvent) => {
      const win = printWinRef.current;
      if (!win || e.source !== win) return;
      if (e.data?.type === ESCALA_DEFINITIVA_RENDER_MESSAGE) {
        const draft = e.data.draft as EscalaGeradaDraftPayload;
        writeEscalaGeradaPrintWindow(win, draft);
        return;
      }
      if (e.data?.type === ESCALA_GERADA_SALVAR_MESSAGE) {
        void handleSalvarFromPrint(e.data.payload);
      }
    };
    window.addEventListener('message', onMessage);
    return () => window.removeEventListener('message', onMessage);
  }, [handleSalvarFromPrint]);

  const gerarEscala = async (
    tiposSelecionados: TipoServicoGerar[],
    operacionalTurnos?: { diurno: boolean; noturno: boolean },
    svgVoluntario?: SvgEscalaConfig,
  ) => {
    setError(null);

    const win = openEscalaGeradaBlankWindow();
    if (!win) {
      setError(
        'O navegador bloqueou a nova janela. Permita pop-ups para este site (ícone na barra de endereços) e tente de novo.',
      );
      return;
    }
    printWinRef.current = win;
    writeEscalaGeradaLoadingWindow(win);

    try {
      await api.processarRevertesTrocaServico();
      const [funcoes, policiais, afastamentos, trocasServicoAtivas] = await Promise.all([
        api.listFuncoes(),
        carregarTodosPoliciaisAtivos(),
        api.listAfastamentos({
          dataInicio: dataEscala,
          dataFim: dataEscala,
          status: 'ATIVO',
          includePolicialFuncao: false,
        }),
        api.listTrocasServicoAtivas(),
      ]);

      /** Sempre no momento da geração (evita IDs vazios por corrida com o useEffect ou falha silenciosa no carregamento). */
      const ativasGeracao = funcoes.filter((f) => f.ativo !== false);
      if (tiposSelecionados.includes('MOTORISTAS') && !ativasGeracao.some((f) => f.escalaMotorista || f.nome.toUpperCase().includes('MOTORISTA'))) {
        setError(
          'Nenhuma função está marcada para a escala de motoristas. Em Gestão do sistema → Funções, marque «Escala motoristas» na função correspondente (ou use uma função cujo nome contenha «Motorista»).',
        );
        try {
          win.close();
        } catch {
          /* ignore */
        }
        printWinRef.current = null;
        return;
      }

      const idsExpGeracao = new Set<number>();
      for (const f of ativasGeracao) {
        if (f.escalaExpediente) idsExpGeracao.add(f.id);
        if (nomeFuncaoIndicaExpedienteAdministrativo(f.nome)) idsExpGeracao.add(f.id);
        const idx = indiceFuncaoOrdenacaoEscala(f.nome);
        if (idx === 0 || idx === 1 || idx === 9) idsExpGeracao.add(f.id);
      }

      const draft = montarPayloadGerarEscalasCombinado(
        tiposSelecionados,
        dataEscala,
        policiais,
        afastamentos,
        escalaParsed,
        {
          funcaoMotoristaId,
          funcoesExpedienteIds: [...idsExpGeracao],
          funcoesCatalogo: ativasGeracao,
          operacionalTurnos,
          trocasServicoAtivas,
          dataGeracaoIso: new Date().toISOString(),
          svgVoluntario: tiposSelecionados.includes('SVG') ? svgVoluntario : undefined,
        },
      );

      const funcoesOpts = ativasGeracao.map((f) => ({ id: f.id, nome: f.nome }));
      writeEscalaGeradaEditorWindow(win, draft, policiais, funcoesOpts);
    } catch (e) {
      try {
        win.close();
      } catch {
        /* ignore */
      }
      printWinRef.current = null;
      setError(e instanceof Error ? e.message : 'Erro ao gerar a escala.');
    }
  };

  const abrirModalSvgSeNecessario = async (
    tiposSelecionados: TipoServicoGerar[],
    operacionalTurnos: { diurno: boolean; noturno: boolean } | undefined,
    loadingFlag: 'gerar' | 'total',
  ): Promise<boolean> => {
    if (!tiposSelecionados.includes('SVG')) return false;
    pendingGeracaoRef.current = { tipos: tiposSelecionados, operacionalTurnos, loadingFlag };
    setSvgModalOpen(true);
    setSvgModalLoading(true);
    try {
      const lista = await carregarTodosPoliciaisAtivos();
      setPoliciaisParaSvg(lista.filter((p) => p.status !== 'DESATIVADO'));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erro ao carregar policiais para o SVG.');
      pendingGeracaoRef.current = null;
      setSvgModalOpen(false);
      return true;
    } finally {
      setSvgModalLoading(false);
    }
    return true;
  };

  const handleSvgModalConfirm = async (config: SvgEscalaConfig) => {
    const pending = pendingGeracaoRef.current;
    setSvgModalOpen(false);
    pendingGeracaoRef.current = null;
    if (!pending) return;

    if (pending.loadingFlag === 'total') {
      setLoadingTotal(true);
    } else {
      setLoading(true);
    }
    try {
      await gerarEscala(pending.tipos, pending.operacionalTurnos, config);
    } finally {
      if (pending.loadingFlag === 'total') {
        setLoadingTotal(false);
      } else {
        setLoading(false);
      }
    }
  };

  const handleSvgModalClose = () => {
    setSvgModalOpen(false);
    pendingGeracaoRef.current = null;
    setLoading(false);
    setLoadingTotal(false);
  };

  const handleGerar = async () => {
    setError(null);
    if (tipos.length === 0) {
      setError('Marque ao menos um tipo de serviço.');
      return;
    }
    if (tipoOperacional && !operacionalDiurno && !operacionalNoturno) {
      setError('Com Operacional marcado, escolha ao menos um turno: Diurno e/ou Noturno.');
      return;
    }
    const turnos = tipoOperacional ? { diurno: operacionalDiurno, noturno: operacionalNoturno } : undefined;
    if (await abrirModalSvgSeNecessario(tipos, turnos, 'gerar')) return;
    setLoading(true);
    try {
      await gerarEscala(tipos, turnos);
    } finally {
      setLoading(false);
    }
  };

  const gerarDesabilitado =
    !podeEditar ||
    loading ||
    loadingTotal ||
    !dataEscala ||
    tipos.length === 0 ||
    (tipoOperacional && !operacionalDiurno && !operacionalNoturno) ||
    (tipoMotoristas && !podeGerarMotoristas);

  const controlesDesabilitados = !podeEditar;
  const handleGerarEscalaTotal = async () => {
    if (!podeEditar || !dataEscala) return;
    setError(null);
    if (await abrirModalSvgSeNecessario(tiposEscalaTotal, { diurno: true, noturno: true }, 'total')) {
      return;
    }
    setLoadingTotal(true);
    try {
      await gerarEscala(tiposEscalaTotal, { diurno: true, noturno: true });
    } finally {
      setLoadingTotal(false);
    }
  };

  return (
    <Stack spacing={2.5} sx={{ pt: 0.5 }}>
      {!podeEditar && (
        <Alert severity="info" sx={{ maxWidth: 800 }}>
          Você pode visualizar esta área, mas não tem permissão de <strong>Editar</strong> em &quot;Escalas – Gerar&quot;
          para calcular, imprimir ou gravar escalas.
        </Alert>
      )}
      <Typography variant="body2" color="text.secondary" sx={{ lineHeight: 1.6, maxWidth: 800 }}>
        Marque os tipos de serviço e a data; em seguida abre-se uma <strong>nova aba</strong> para revisar a escala
        (cabeçalho com selects, troca de policial/função). Os horários das linhas são automáticos (regras do sistema).
        Use <strong>Gerar escala definitiva</strong> na aba para obter o documento final (imprimir / salvar).{' '}
        <strong>Cancelar</strong> na aba de edição fecha sem salvar. Quem entra em cada tipo (operacional, expediente,
        motoristas, SVG) é definido por função em <strong>Gestão do sistema → Funções</strong> (participação na escala).
        Com <strong>SVG</strong> marcado (ou em escala total), abre-se antes uma modal para informar policiais e horários
        voluntários (8h, início em hora cheia).
      </Typography>

      {error && (
        <Alert severity="error" onClose={() => setError(null)}>
          {error}
        </Alert>
      )}
      <Paper
        variant="outlined"
        elevation={0}
        sx={{
          p: { xs: 2, sm: 2.5 },
          borderRadius: 2,
          borderColor: 'var(--border-soft, rgba(0,0,0,0.12))',
          bgcolor: 'var(--card-bg, transparent)',
        }}
      >
        <Grid container spacing={3}>
          <Grid size={{ xs: 12, md: 6 }}>
            <FormControl component="fieldset" variant="standard" fullWidth>
              <FormLabel component="legend" sx={formLabelLegendSx}>
                Tipo de serviço
              </FormLabel>
              <FormGroup sx={checkboxRowSx}>
                <FormControlLabel
                  control={
                    <Checkbox
                      checked={tipoOperacional}
                      onChange={(_, v) => {
                        setTipoOperacional(v);
                        if (v) setOperacionalDiurno(true);
                      }}
                      size="small"
                      disabled={controlesDesabilitados}
                    />
                  }
                  label={labelTipoServicoUm('OPERACIONAL')}
                />
                <FormControlLabel
                  control={
                    <Checkbox
                      checked={tipoExpediente}
                      onChange={(_, v) => setTipoExpediente(v)}
                      size="small"
                      disabled={controlesDesabilitados}
                    />
                  }
                  label={labelTipoServicoUm('EXPEDIENTE')}
                />
                <FormControlLabel
                  control={
                    <Checkbox
                      checked={tipoMotoristas}
                      onChange={(_, v) => setTipoMotoristas(v)}
                      size="small"
                      disabled={controlesDesabilitados}
                    />
                  }
                  label={labelTipoServicoUm('MOTORISTAS')}
                />
                <FormControlLabel
                  control={
                    <Checkbox
                      checked={tipoSvg}
                      onChange={(_, v) => setTipoSvg(v)}
                      size="small"
                      disabled={controlesDesabilitados}
                    />
                  }
                  label={labelTipoServicoUm('SVG')}
                />
              </FormGroup>
              <Typography variant="caption" color="text.secondary" sx={{ mt: 1.5, display: 'block', lineHeight: 1.5 }}>
                <strong>Operacional:</strong> escala das equipes <strong>12×24</strong> (turnos dia/noite).{' '}
                <strong>Motoristas:</strong> escala de motorista de dia <strong>{ESCALA_MOTORISTA_DIA}</strong> (rodízio
                próprio, distinto do operacional). <strong>SVG:</strong> turnos 10h–18h, 15h–23h e 20h–04h (regras em
                definição).
              </Typography>
            </FormControl>
          </Grid>

          <Grid size={{ xs: 12, md: 6 }}>
            {tipoOperacional ? (
              <FormControl component="fieldset" variant="standard" fullWidth>
                <FormLabel component="legend" sx={formLabelLegendSx}>
                  Turno (operacional)
                </FormLabel>
                <FormGroup sx={checkboxRowSx}>
                  <FormControlLabel
                    control={
                      <Checkbox
                        checked={operacionalDiurno}
                        onChange={(_, v) => setOperacionalDiurno(v)}
                        size="small"
                        disabled={controlesDesabilitados}
                      />
                    }
                    label="Diurno"
                  />
                  <FormControlLabel
                    control={
                      <Checkbox
                        checked={operacionalNoturno}
                        onChange={(_, v) => setOperacionalNoturno(v)}
                        size="small"
                        disabled={controlesDesabilitados}
                      />
                    }
                    label="Noturno"
                  />
                </FormGroup>
                <Typography variant="caption" color="text.secondary" sx={{ mt: 1.5, display: 'block', lineHeight: 1.5 }}>
                  <strong>Diurno:</strong> 07h–19h do dia da escala. <strong>Noturno:</strong> 19h do dia até 07h do dia
                  seguinte. <strong>Ambos:</strong> 07h do dia da escala às 07h do dia seguinte.
                </Typography>
              </FormControl>
            ) : (
              <Box
                sx={{
                  height: '100%',
                  minHeight: { md: 120 },
                  display: { xs: 'none', md: 'flex' },
                  alignItems: 'center',
                  justifyContent: 'center',
                  borderRadius: 1,
                  border: '1px dashed',
                  borderColor: 'divider',
                  bgcolor: 'action.hover',
                  px: 2,
                }}
              >
                <Typography variant="caption" color="text.secondary" textAlign="center">
                  Marque &quot;Operacional&quot; para escolher turno diurno e/ou noturno.
                </Typography>
              </Box>
            )}
          </Grid>

          <Grid size={{ xs: 12 }}>
            <Divider sx={{ borderColor: 'var(--border-soft, rgba(0,0,0,0.08))' }} />
          </Grid>

          <Grid size={{ xs: 12, sm: 6, md: 4 }}>
            <TextField
              label="Data da escala"
              type="date"
              size="small"
              fullWidth
              value={dataEscala}
              onChange={(e) => setDataEscala(e.target.value)}
              disabled={controlesDesabilitados}
              slotProps={{ inputLabel: { shrink: true } }}
            />
          </Grid>

          <Grid
            size={{ xs: 12, sm: 6, md: 8 }}
            sx={{
              display: 'flex',
              alignItems: { xs: 'stretch', sm: 'flex-end' },
              justifyContent: { xs: 'stretch', sm: 'flex-end' },
            }}
          >
            <Button
              variant="contained"
              size="medium"
              onClick={() => void handleGerar()}
              disabled={gerarDesabilitado}
              sx={{ minWidth: 160, py: 1 }}
            >
              {loading ? <CircularProgress size={22} color="inherit" /> : 'Gerar escala'}
            </Button>
          </Grid>
        </Grid>
      </Paper>

      <Paper
        variant="outlined"
        elevation={0}
        sx={{
          p: { xs: 2, sm: 2.5 },
          borderRadius: 2,
          borderColor: 'var(--border-soft, rgba(0,0,0,0.12))',
          bgcolor: 'var(--card-bg, transparent)',
          maxWidth: 800,
        }}
      >
        <Stack spacing={1.5}>
          <Typography variant="subtitle2">Escala total</Typography>
          <Typography variant="caption" color="text.secondary" display="block">
            Gera operacional (diurno e noturno), expediente, motoristas ({ESCALA_MOTORISTA_DIA})
            {semSvgEscalaTotal ? '' : ' e SVG'} na mesma data.
          </Typography>
          <Box
            sx={{
              display: 'flex',
              flexWrap: 'wrap',
              alignItems: 'center',
              gap: 2,
            }}
          >
            <Button
              variant="contained"
              size="medium"
              onClick={() => void handleGerarEscalaTotal()}
              disabled={controlesDesabilitados || loading || loadingTotal || !dataEscala}
            >
              {loadingTotal ? <CircularProgress size={22} color="inherit" /> : 'Gerar escala total'}
            </Button>
            <Stack
              direction="row"
              alignItems="center"
              spacing={0.5}
              component="label"
              sx={{
                m: 0,
                flexShrink: 0,
                cursor: controlesDesabilitados ? 'default' : 'pointer',
                userSelect: 'none',
              }}
            >
              <Checkbox
                checked={semSvgEscalaTotal}
                onChange={(_, v) => setSemSvgEscalaTotal(v)}
                size="small"
                disabled={controlesDesabilitados}
                sx={{ p: 0.5 }}
              />
              <Typography variant="body2" component="span" sx={{ lineHeight: 1.2 }}>
                Sem SVG
              </Typography>
            </Stack>
          </Box>
        </Stack>
      </Paper>

      {tipoMotoristas && !podeGerarMotoristas && (
        <Alert severity="warning" sx={{ maxWidth: 800 }}>
          Nenhuma função está habilitada para a escala de motoristas. Ajuste em Gestão do sistema → Funções (opção
          «Escala motoristas») ou cadastre uma função cujo nome indique motorista.
        </Alert>
      )}

      <SvgEscalaVoluntarioDialog
        open={svgModalOpen}
        loadingPoliciais={svgModalLoading}
        policiais={policiaisParaSvg}
        onClose={handleSvgModalClose}
        onConfirm={(config) => void handleSvgModalConfirm(config)}
      />
    </Stack>
  );
}
