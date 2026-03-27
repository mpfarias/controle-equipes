import { useCallback, useEffect, useRef, useState } from 'react';
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
import type { EscalaParsed } from '../../utils/escalaParametros';
import {
  indiceFuncaoOrdenacaoEscala,
  labelTipoServicoUm,
  montarPayloadGerarEscalasCombinado,
  nomeFuncaoIndicaExpedienteAdministrativo,
  type LinhaEscalaGeradaDraft,
  type TipoServicoGerar,
} from '../../utils/gerarEscalasCalculo';
import {
  ESCALA_GERADA_SALVAR_MESSAGE,
  openEscalaGeradaBlankWindow,
  writeEscalaGeradaLoadingWindow,
  writeEscalaGeradaPrintWindow,
} from '../../utils/escalaGeradaPrint';
import type { PermissoesPorTela } from '../../utils/permissions';
import { canEdit } from '../../utils/permissions';

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

function tiposMarcados(op: boolean, exp: boolean, mot: boolean): TipoServicoGerar[] {
  const t: TipoServicoGerar[] = [];
  if (op) t.push('OPERACIONAL');
  if (exp) t.push('EXPEDIENTE');
  if (mot) t.push('MOTORISTAS');
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
  const [operacionalDiurno, setOperacionalDiurno] = useState(false);
  const [operacionalNoturno, setOperacionalNoturno] = useState(false);
  const [dataEscala, setDataEscala] = useState(hojeIsoLocal);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [funcaoMotoristaId, setFuncaoMotoristaId] = useState<number | null>(null);
  const printWinRef = useRef<Window | null>(null);

  const tipos = tiposMarcados(tipoOperacional, tipoExpediente, tipoMotoristas);

  useEffect(() => {
    const carregarFuncoes = async () => {
      try {
        const funcoes = await api.listFuncoes();
        const ativas = funcoes.filter((f) => f.ativo !== false);
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
    setSuccess(null);
    if (!podeEditar) {
      setError('Sem permissão para gravar escalas no sistema.');
      return;
    }
    if (!payload || typeof payload !== 'object') return;
    const p = payload as {
      dataEscala?: string;
      tipoServico?: string;
      resumoEquipes?: string;
      linhas?: unknown[];
    };
    if (!p.dataEscala || !p.tipoServico || !Array.isArray(p.linhas)) {
      setError('Dados inválidos para salvar a escala.');
      return;
    }
    try {
      const created = await api.createEscalaGerada({
        dataEscala: p.dataEscala,
        tipoServico: p.tipoServico,
        resumoEquipes: p.resumoEquipes ?? null,
        linhas: p.linhas as LinhaEscalaGeradaDraft[],
      });
      setSuccess(`Escala salva com sucesso (registro nº ${created.id}).`);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erro ao salvar a escala.');
    }
  }, []);

  useEffect(() => {
    const onMessage = (e: MessageEvent) => {
      if (!printWinRef.current || e.source !== printWinRef.current) return;
      if (e.data?.type !== ESCALA_GERADA_SALVAR_MESSAGE) return;
      void handleSalvarFromPrint(e.data.payload);
    };
    window.addEventListener('message', onMessage);
    return () => window.removeEventListener('message', onMessage);
  }, [handleSalvarFromPrint]);

  const handleGerar = async () => {
    setLoading(true);
    setError(null);
    setSuccess(null);

    if (tipos.length === 0) {
      setError('Marque ao menos um tipo de serviço.');
      setLoading(false);
      return;
    }
    if (tipoOperacional && !operacionalDiurno && !operacionalNoturno) {
      setError('Com Operacional marcado, escolha ao menos um turno: Diurno e/ou Noturno.');
      setLoading(false);
      return;
    }
    if (tipoMotoristas && funcaoMotoristaId == null) {
      setError(
        'Função "Motorista de Dia" não encontrada no cadastro de funções. Cadastre ou ajuste o nome da função.',
      );
      setLoading(false);
      return;
    }

    const win = openEscalaGeradaBlankWindow();
    if (!win) {
      setError(
        'O navegador bloqueou a nova janela. Permita pop-ups para este site (ícone na barra de endereços) e tente de novo.',
      );
      setLoading(false);
      return;
    }
    printWinRef.current = win;
    writeEscalaGeradaLoadingWindow(win);

    try {
      const [funcoes, policiais, afastamentos] = await Promise.all([
        api.listFuncoes(),
        carregarTodosPoliciaisAtivos(),
        api.listAfastamentos({
          dataInicio: dataEscala,
          dataFim: dataEscala,
          status: 'ATIVO',
          includePolicialFuncao: false,
        }),
      ]);

      /** Sempre no momento da geração (evita IDs vazios por corrida com o useEffect ou falha silenciosa no carregamento). */
      const ativasGeracao = funcoes.filter((f) => f.ativo !== false);
      const idsExpGeracao = new Set<number>();
      for (const f of ativasGeracao) {
        if (nomeFuncaoIndicaExpedienteAdministrativo(f.nome)) idsExpGeracao.add(f.id);
        const idx = indiceFuncaoOrdenacaoEscala(f.nome);
        if (idx === 0 || idx === 1 || idx === 9) idsExpGeracao.add(f.id);
      }

      const draft = montarPayloadGerarEscalasCombinado(
        tipos,
        dataEscala,
        policiais,
        afastamentos,
        escalaParsed,
        {
          funcaoMotoristaId,
          funcoesExpedienteIds: [...idsExpGeracao],
          operacionalTurnos:
            tipoOperacional ? { diurno: operacionalDiurno, noturno: operacionalNoturno } : undefined,
        },
      );

      writeEscalaGeradaPrintWindow(win, draft);
    } catch (e) {
      try {
        win.close();
      } catch {
        /* ignore */
      }
      printWinRef.current = null;
      setError(e instanceof Error ? e.message : 'Erro ao gerar a escala.');
    } finally {
      setLoading(false);
    }
  };

  const gerarDesabilitado =
    !podeEditar ||
    loading ||
    !dataEscala ||
    tipos.length === 0 ||
    (tipoOperacional && !operacionalDiurno && !operacionalNoturno);

  const controlesDesabilitados = !podeEditar;

  return (
    <Stack spacing={2.5} sx={{ pt: 0.5 }}>
      {!podeEditar && (
        <Alert severity="info" sx={{ maxWidth: 800 }}>
          Você pode visualizar esta área, mas não tem permissão de <strong>Editar</strong> em &quot;Escalas – Gerar&quot;
          para calcular, imprimir ou gravar escalas.
        </Alert>
      )}
      <Typography variant="body2" color="text.secondary" sx={{ lineHeight: 1.6, maxWidth: 800 }}>
        Marque um ou mais tipos de serviço e a data da escala. A lista única reúne todos os tipos escolhidos (cada
        linha indica o tipo entre colchetes no horário). Policiais afastados na data aparecem uma vez na lista de
        afastados.
      </Typography>

      {error && (
        <Alert severity="error" onClose={() => setError(null)}>
          {error}
        </Alert>
      )}
      {success && (
        <Alert severity="success" onClose={() => setSuccess(null)}>
          {success}
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
              </FormGroup>
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

      {tipoMotoristas && funcaoMotoristaId == null && (
        <Alert severity="warning" sx={{ maxWidth: 800 }}>
          Sem função &quot;Motorista de Dia&quot; no cadastro — a parte Motoristas da escala pode ficar vazia.
        </Alert>
      )}
    </Stack>
  );
}
