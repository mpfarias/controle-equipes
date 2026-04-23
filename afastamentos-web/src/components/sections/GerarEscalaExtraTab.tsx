import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
  Autocomplete,
  Box,
  Button,
  CircularProgress,
  FormControl,
  InputLabel,
  Link,
  List,
  ListItem,
  ListItemText,
  MenuItem,
  Paper,
  Select,
  Stack,
  TextField,
  Typography,
  type SelectChangeEvent,
} from '@mui/material';
import { api } from '../../api';
import { formatEquipeLabel } from '../../constants';
import { theme as orionTheme } from '../../constants/theme';
import type { Afastamento, EscalaExtraordinariaTipoServico, Policial } from '../../types';
import { formatMatricula } from '../../utils/dateUtils';
import type { PermissoesPorTela } from '../../utils/permissions';
import { canEdit } from '../../utils/permissions';
import {
  ESCALA_DEFINITIVA_RENDER_MESSAGE,
  writeEscalaGeradaEditorWindow,
} from '../../utils/escalaGeradaEditor';
import {
  ESCALA_GERADA_SALVAR_MESSAGE,
  linhasEscalaDraftParaApi,
  notificarImpressaoEscalaGeradaSalva,
  openEscalaGeradaBlankWindow,
  writeEscalaGeradaLoadingWindow,
  writeEscalaGeradaPrintWindow,
} from '../../utils/escalaGeradaPrint';
import type { EscalaGeradaDraftPayload, LinhaEscalaGeradaDraft } from '../../utils/gerarEscalasCalculo';
import { afastamentoAtivoNaData, montarPayloadEscalaExtraordinaria } from '../../utils/gerarEscalasCalculo';
import { sortPorPatenteENome } from '../../utils/sortPoliciais';

/** Links no tema escuro: `primary` do MUI é azul muito escuro (#0F2A44) e some no fundo. */
const sxLinkHorarioExtra = {
  cursor: 'pointer',
  color: orionTheme.accentMuted,
  fontWeight: 600,
  textDecoration: 'underline',
  textUnderlineOffset: 4,
  '&:hover': { color: orionTheme.info },
} as const;

const TIPO_OPCOES: { value: EscalaExtraordinariaTipoServico; label: string }[] = [
  { value: 'CARNAVAL', label: 'Carnaval' },
  { value: 'SETE_DE_SETEMBRO', label: '7 de setembro' },
  { value: 'EVENTO', label: 'Evento' },
  { value: 'OUTRO', label: 'Outro' },
];

const HORAS_DIA = Array.from({ length: 24 }, (_, i) => String(i).padStart(2, '0'));
const MINUTOS_MEIA_HORA = ['00', '30'] as const;

/** Extrai hora e minutos (sempre 00 ou 30) de "HH:mm" ou vazio. */
function partesHorario(hhmm: string): { h: string; m: string } {
  const m = /^(\d{1,2}):(\d{2})$/.exec(hhmm.trim());
  if (!m) return { h: '', m: '' };
  const h = String(Math.min(23, Math.max(0, parseInt(m[1], 10)))).padStart(2, '0');
  const mm = m[2] === '30' ? '30' : '00';
  return { h, m: mm };
}

function hojeIsoLocal(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function normalizarBusca(s: string): string {
  return s
    .trim()
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase();
}

function matriculaParaBusca(p: Policial): string {
  const raw =
    p.status === 'COMISSIONADO' && (p.matriculaComissionadoGdf ?? '').trim()
      ? (p.matriculaComissionadoGdf ?? '').trim()
      : p.matricula;
  return `${raw} ${formatMatricula(raw)}`;
}

function labelPolicialOpcao(p: Policial): string {
  const mat =
    p.status === 'COMISSIONADO' && (p.matriculaComissionadoGdf ?? '').trim()
      ? p.matriculaComissionadoGdf!.trim()
      : p.matricula;
  const st = p.status === 'DESIGNADO' ? 'Designado' : p.status === 'ATIVO' ? 'Ativo' : p.status;
  return `${p.nome} — ${formatEquipeLabel(p.equipe)} · ${formatMatricula(mat)} · ${st}`;
}

function policialElegivelEscalaExtra(p: Policial): boolean {
  return p.status === 'ATIVO' || p.status === 'DESIGNADO';
}

/** Data local (meio-dia) a partir de YYYY-MM-DD — alinhado ao cálculo de afastamentos na escala. */
function parseDataEscalaLocal(dataIso: string): Date {
  const [y, m, d] = dataIso.trim().split('-').map(Number);
  return new Date(y, m - 1, d, 12, 0, 0, 0);
}

function policialSemRestricaoMedica(p: Policial): boolean {
  return p.restricaoMedicaId == null;
}

function policialSemAfastamentoNaData(p: Policial, dataRef: Date, afastamentos: Afastamento[]): boolean {
  return !afastamentos.some((af) => af.policialId === p.id && afastamentoAtivoNaData(af, dataRef));
}

function policialApareceNaListaEscalaExtra(
  p: Policial,
  dataRef: Date,
  afastamentos: Afastamento[],
): boolean {
  return (
    policialElegivelEscalaExtra(p) &&
    policialSemRestricaoMedica(p) &&
    policialSemAfastamentoNaData(p, dataRef, afastamentos)
  );
}

async function carregarPoliciaisAtivoOuDesignado(): Promise<Policial[]> {
  const pageSize = 400;
  let page = 1;
  const all: Policial[] = [];
  for (;;) {
    const r = await api.listPoliciaisPaginated({
      page,
      pageSize,
      statuses: ['ATIVO', 'DESIGNADO'],
      orderBy: 'nome',
      orderDir: 'asc',
      includeAfastamentos: false,
      includeRestricoes: false,
    });
    for (const p of r.Policiales) {
      if (policialElegivelEscalaExtra(p)) all.push(p);
    }
    if (page >= r.totalPages) break;
    page += 1;
  }
  return all;
}

/** Todos os policiais (para combos na janela de edição), mesmo padrão da aba «Gerar Escalas». */
async function carregarTodosPoliciaisParaEditor(): Promise<Policial[]> {
  const pageSize = 400;
  let page = 1;
  const all: Policial[] = [];
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

export interface GerarEscalaExtraTabProps {
  permissoes?: PermissoesPorTela | null;
}

export function GerarEscalaExtraTab({ permissoes }: GerarEscalaExtraTabProps) {
  const podeEditar = canEdit(permissoes, 'escalas-gerar');
  const controlesDesabilitados = !podeEditar;

  const [dataEscala, setDataEscala] = useState(hojeIsoLocal);
  const [horaInicio, setHoraInicio] = useState('');
  const [horaFim, setHoraFim] = useState('');
  /** Só após clicar em «Horário fim?»; se false, a escala usa apenas o horário de início. */
  const [mostrarHorarioFim, setMostrarHorarioFim] = useState(false);
  const [tipoServico, setTipoServico] = useState<EscalaExtraordinariaTipoServico | ''>('');
  /** Texto do evento quando o tipo é «Evento». */
  const [tipoEventoEventoDescricao, setTipoEventoEventoDescricao] = useState('');
  /** Texto do evento quando o tipo é «Outro». */
  const [tipoEventoOutroDescricao, setTipoEventoOutroDescricao] = useState('');
  const [policiaisOpcoes, setPoliciaisOpcoes] = useState<Policial[]>([]);
  /** Policial escolhido no campo de busca (antes de clicar em Adicionar). */
  const [policialNoCampo, setPolicialNoCampo] = useState<Policial | null>(null);
  /** Ordem em que foram adicionados à escala extraordinária. */
  const [policiaisNaEscala, setPoliciaisNaEscala] = useState<Policial[]>([]);
  const [carregandoLista, setCarregandoLista] = useState(true);
  const [gerandoEscala, setGerandoEscala] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const printWinRef = useRef<Window | null>(null);
  /** Cache do efetivo Ativo/Designado (não depende da data). */
  const policiaisBaseRef = useRef<Policial[] | null>(null);

  const idsNaEscala = useMemo(() => new Set(policiaisNaEscala.map((p) => p.id)), [policiaisNaEscala]);

  const opcoesSemJaAdicionados = useMemo(
    () => policiaisOpcoes.filter((p) => !idsNaEscala.has(p.id)),
    [policiaisOpcoes, idsNaEscala],
  );

  useEffect(() => {
    const dataIso = dataEscala?.trim();
    if (!dataIso) {
      setPoliciaisOpcoes([]);
      setCarregandoLista(false);
      return;
    }

    let cancelado = false;
    (async () => {
      setCarregandoLista(true);
      setError(null);
      if (!cancelado) setPoliciaisOpcoes([]);
      try {
        if (!policiaisBaseRef.current) {
          policiaisBaseRef.current = await carregarPoliciaisAtivoOuDesignado();
        }
        const base = policiaisBaseRef.current;
        const afastamentos = await api.listAfastamentos({
          dataInicio: dataIso,
          dataFim: dataIso,
          status: 'ATIVO',
          includePolicialFuncao: false,
        });
        const dataRef = parseDataEscalaLocal(dataIso);
        const filtrados = base.filter((p) => policialApareceNaListaEscalaExtra(p, dataRef, afastamentos));
        if (!cancelado) setPoliciaisOpcoes(filtrados);
      } catch (e) {
        if (!cancelado) {
          setError(
            e instanceof Error ? e.message : 'Não foi possível carregar a lista para a data da escala.',
          );
          setPoliciaisOpcoes([]);
        }
      } finally {
        if (!cancelado) setCarregandoLista(false);
      }
    })();
    return () => {
      cancelado = true;
    };
  }, [dataEscala]);

  useEffect(() => {
    setPolicialNoCampo((cur) => {
      if (!cur) return cur;
      return policiaisOpcoes.some((o) => o.id === cur.id) ? cur : null;
    });
  }, [policiaisOpcoes]);

  useEffect(() => {
    setPoliciaisNaEscala((prev) => prev.filter((p) => policiaisOpcoes.some((o) => o.id === p.id)));
  }, [policiaisOpcoes]);

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

  const limparFormulario = useCallback(() => {
    setDataEscala(hojeIsoLocal());
    setHoraInicio('');
    setHoraFim('');
    setMostrarHorarioFim(false);
    setTipoServico('');
    setTipoEventoEventoDescricao('');
    setTipoEventoOutroDescricao('');
    setPolicialNoCampo(null);
    setPoliciaisNaEscala([]);
    setError(null);
  }, []);

  const handleTipoChange = (e: SelectChangeEvent<EscalaExtraordinariaTipoServico | ''>) => {
    const v = e.target.value as EscalaExtraordinariaTipoServico | '';
    setTipoServico(v);
    if (v !== 'OUTRO') setTipoEventoOutroDescricao('');
    if (v !== 'EVENTO') setTipoEventoEventoDescricao('');
  };

  const adicionarPolicialNaLista = () => {
    setError(null);
    if (!policialNoCampo) {
      setError('Selecione um policial no campo ao lado antes de adicionar.');
      return;
    }
    if (idsNaEscala.has(policialNoCampo.id)) {
      setError('Este policial já está na lista abaixo.');
      return;
    }
    setPoliciaisNaEscala((prev) => sortPorPatenteENome([...prev, policialNoCampo]));
    setPolicialNoCampo(null);
  };

  const removerPolicialDaEscala = useCallback((index: number) => {
    setPoliciaisNaEscala((prev) => prev.filter((_, j) => j !== index));
    setError(null);
  }, []);

  const handleGerarEscala = async () => {
    setError(null);
    if (!dataEscala?.trim()) {
      setError('Informe a data da escala.');
      return;
    }
    if (!horaInicio?.trim()) {
      setError('Informe o horário de início da escala.');
      return;
    }
    if (!partesHorario(horaInicio).h) {
      setError('Selecione hora e minutos (00 ou 30) para o início.');
      return;
    }
    if (mostrarHorarioFim) {
      if (!horaFim?.trim() || !partesHorario(horaFim).h) {
        setError('Selecione o horário de fim ou use «Ocultar» para gerar só com o horário de início.');
        return;
      }
    }
    if (!tipoServico) {
      setError('Selecione o tipo de serviço.');
      return;
    }
    if (tipoServico === 'EVENTO' && !tipoEventoEventoDescricao.trim()) {
      setError('Informe a descrição do evento no campo abaixo (tipo «Evento»).');
      return;
    }
    if (tipoServico === 'OUTRO' && !tipoEventoOutroDescricao.trim()) {
      setError('Informe a descrição do evento no campo abaixo (tipo «Outro»).');
      return;
    }
    if (policiaisNaEscala.length === 0) {
      setError('Adicione pelo menos um policial com status Ativo ou Designado à lista abaixo.');
      return;
    }

    const win = openEscalaGeradaBlankWindow();
    if (!win) {
      setError(
        'O navegador bloqueou a nova janela. Permita pop-ups para este site (ícone na barra de endereços) e tente de novo.',
      );
      return;
    }
    printWinRef.current = win;
    writeEscalaGeradaLoadingWindow(win);
    setGerandoEscala(true);

    try {
      await api.processarRevertesTrocaServico();
      const [funcoes, policiaisEditor, afastamentos] = await Promise.all([
        api.listFuncoes(),
        carregarTodosPoliciaisParaEditor(),
        api.listAfastamentos({
          dataInicio: dataEscala,
          dataFim: dataEscala,
          status: 'ATIVO',
          includePolicialFuncao: false,
        }),
      ]);

      const draft = montarPayloadEscalaExtraordinaria({
        dataIso: dataEscala.trim(),
        horaInicio: horaInicio.trim(),
        horaFim:
          mostrarHorarioFim && partesHorario(horaFim).h ? horaFim.trim() : '',
        tipoEvento: tipoServico,
        tipoEventoEventoTexto: tipoServico === 'EVENTO' ? tipoEventoEventoDescricao.trim() : undefined,
        tipoEventoOutroTexto: tipoServico === 'OUTRO' ? tipoEventoOutroDescricao.trim() : undefined,
        policiais: policiaisNaEscala,
        afastamentos,
        dataGeracaoIso: new Date().toISOString(),
      });

      const ativas = funcoes.filter((f) => f.ativo !== false);
      const funcoesOpts = ativas.map((f) => ({ id: f.id, nome: f.nome }));
      writeEscalaGeradaEditorWindow(win, draft, policiaisEditor, funcoesOpts);
    } catch (e) {
      try {
        win.close();
      } catch {
        /* ignore */
      }
      printWinRef.current = null;
      setError(e instanceof Error ? e.message : 'Erro ao gerar a escala.');
    } finally {
      setGerandoEscala(false);
    }
  };

  return (
    <Stack spacing={2.5} sx={{ pt: 0.5 }}>
      {!podeEditar && (
        <Alert severity="info" sx={{ maxWidth: 800 }}>
          Você pode visualizar esta área, mas não tem permissão de <strong>Editar</strong> em &quot;Escalas – Gerar&quot;
          para preencher ou alterar os dados desta escala extraordinária.
        </Alert>
      )}

      <Typography variant="body2" color="text.secondary" sx={{ lineHeight: 1.6, maxWidth: 900 }}>
        Escala extraordinária: informe a <strong>data da escala</strong> (a lista de policiais é recalculada para esse dia),
        horário de início (opcionalmente o fim, pelo link <strong>Horário fim?</strong>) e tipo de serviço (em <strong>Evento</strong> e <strong>Outro</strong> descreva o evento; ele entra no resumo da escala gerada). No campo de busca entram apenas quem está <strong>Ativo</strong> ou{' '}
        <strong>Designado</strong>, <strong>sem restrição médica</strong> e <strong>sem afastamento ativo</strong> na data
        informada. Use <strong>Adicionar</strong> para montar a lista (ordem por patente). Em seguida use{' '}
        <strong>Gerar Escala</strong> para abrir a mesma janela de revisão/impressão da aba «Gerar Escalas».
      </Typography>

      {error && (
        <Alert severity="error" onClose={() => setError(null)}>
          {error}
        </Alert>
      )}
      <Stack
        spacing={2.5}
        component="fieldset"
        disabled={controlesDesabilitados}
        sx={{ border: 'none', p: 0, m: 0, minWidth: 0 }}
      >
        <TextField
          label="Data da escala"
          type="date"
          value={dataEscala}
          onChange={(e) => setDataEscala(e.target.value)}
          InputLabelProps={{ shrink: true }}
          size="small"
          sx={{ maxWidth: 280 }}
        />

        <Stack direction={{ xs: 'column', md: 'row' }} spacing={3} useFlexGap flexWrap="wrap" alignItems="flex-start">
          <Box>
            <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 1 }}>
              Horário início
            </Typography>
            <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap" useFlexGap>
              <FormControl size="small" sx={{ minWidth: 112 }}>
                <InputLabel id="escala-extra-hi-h">Hora</InputLabel>
                <Select
                  labelId="escala-extra-hi-h"
                  label="Hora"
                  value={partesHorario(horaInicio).h}
                  displayEmpty
                  onChange={(e) => {
                    const h = String(e.target.value ?? '');
                    const m = partesHorario(horaInicio).m || '00';
                    setHoraInicio(h ? `${h}:${m}` : '');
                  }}
                >
                  <MenuItem value="">
                    <em>—</em>
                  </MenuItem>
                  {HORAS_DIA.map((h) => (
                    <MenuItem key={h} value={h}>
                      {h}h
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
              <FormControl size="small" sx={{ minWidth: 100 }}>
                <InputLabel id="escala-extra-hi-m">Min</InputLabel>
                <Select
                  labelId="escala-extra-hi-m"
                  label="Min"
                  value={partesHorario(horaInicio).h ? partesHorario(horaInicio).m : '00'}
                  disabled={!partesHorario(horaInicio).h}
                  onChange={(e) => {
                    const m = String(e.target.value);
                    const h = partesHorario(horaInicio).h;
                    if (!h) return;
                    setHoraInicio(`${h}:${m}`);
                  }}
                >
                  {MINUTOS_MEIA_HORA.map((m) => (
                    <MenuItem key={m} value={m}>
                      :{m}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Stack>
          </Box>
          <Box>
            {!mostrarHorarioFim ? (
              <>
                <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 1, visibility: 'hidden' }} aria-hidden>
                  {'\u00a0'}
                </Typography>
                <Link
                  component="button"
                  type="button"
                  variant="body2"
                  onClick={() => {
                    setMostrarHorarioFim(true);
                    setError(null);
                  }}
                  sx={sxLinkHorarioExtra}
                >
                  Horário fim?
                </Link>
              </>
            ) : (
              <>
                <Stack direction="row" alignItems="center" justifyContent="space-between" spacing={1} sx={{ mb: 1 }}>
                  <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>
                    Horário fim
                  </Typography>
                  <Link
                    component="button"
                    type="button"
                    variant="caption"
                    onClick={() => {
                      setMostrarHorarioFim(false);
                      setHoraFim('');
                      setError(null);
                    }}
                    sx={{ ...sxLinkHorarioExtra, fontWeight: 500, flexShrink: 0 }}
                  >
                    Ocultar
                  </Link>
                </Stack>
                <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap" useFlexGap>
                  <FormControl size="small" sx={{ minWidth: 112 }}>
                    <InputLabel id="escala-extra-hf-h">Hora</InputLabel>
                    <Select
                      labelId="escala-extra-hf-h"
                      label="Hora"
                      value={partesHorario(horaFim).h}
                      displayEmpty
                      onChange={(e) => {
                        const h = String(e.target.value ?? '');
                        const m = partesHorario(horaFim).m || '00';
                        setHoraFim(h ? `${h}:${m}` : '');
                      }}
                    >
                      <MenuItem value="">
                        <em>—</em>
                      </MenuItem>
                      {HORAS_DIA.map((h) => (
                        <MenuItem key={`f-${h}`} value={h}>
                          {h}h
                        </MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                  <FormControl size="small" sx={{ minWidth: 100 }}>
                    <InputLabel id="escala-extra-hf-m">Min</InputLabel>
                    <Select
                      labelId="escala-extra-hf-m"
                      label="Min"
                      value={partesHorario(horaFim).h ? partesHorario(horaFim).m : '00'}
                      disabled={!partesHorario(horaFim).h}
                      onChange={(e) => {
                        const m = String(e.target.value);
                        const h = partesHorario(horaFim).h;
                        if (!h) return;
                        setHoraFim(`${h}:${m}`);
                      }}
                    >
                      {MINUTOS_MEIA_HORA.map((m) => (
                        <MenuItem key={`fm-${m}`} value={m}>
                          :{m}
                        </MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                </Stack>
              </>
            )}
          </Box>
        </Stack>

        <Stack spacing={1.5} sx={{ maxWidth: 520 }}>
          <FormControl size="small" sx={{ maxWidth: 400 }}>
            <InputLabel id="escala-extra-tipo">Tipo de serviço</InputLabel>
            <Select
              labelId="escala-extra-tipo"
              label="Tipo de serviço"
              value={tipoServico}
              onChange={handleTipoChange}
            >
              <MenuItem value="">
                <em>Selecione…</em>
              </MenuItem>
              {TIPO_OPCOES.map((o) => (
                <MenuItem key={o.value} value={o.value}>
                  {o.label}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
          {tipoServico === 'EVENTO' && (
            <TextField
              label="Nome ou natureza do evento"
              value={tipoEventoEventoDescricao}
              onChange={(e) => setTipoEventoEventoDescricao(e.target.value)}
              size="small"
              required
              fullWidth
              placeholder="Ex.: Show na arena, desfile escolar, maratona no Eixo, feira no Taguaparque…"
              inputProps={{ maxLength: 200 }}
              helperText="Algo que identifique o que acontece no dia — substitui «Evento» no resumo (máx. 200 caracteres)."
              disabled={controlesDesabilitados}
            />
          )}
          {tipoServico === 'OUTRO' && (
            <TextField
              label="Motivo da escala (outro)"
              value={tipoEventoOutroDescricao}
              onChange={(e) => setTipoEventoOutroDescricao(e.target.value)}
              size="small"
              required
              fullWidth
              placeholder="Ex.: Plantão de contingência, interface com outro órgão, cobertura de gabinete, treinamento interno…"
              inputProps={{ maxLength: 200 }}
              disabled={controlesDesabilitados}
            />
          )}
        </Stack>

        <Box>
          {carregandoLista ? (
            <Stack direction="row" alignItems="center" spacing={1} sx={{ py: 1 }}>
              <CircularProgress size={22} />
              <Typography variant="body2" color="text.secondary">
                Carregando policiais (Ativo e Designado)…
              </Typography>
            </Stack>
          ) : (
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5} alignItems={{ sm: 'flex-start' }}>
              <Autocomplete
                sx={{ flex: 1, minWidth: 0 }}
                options={opcoesSemJaAdicionados}
                value={policialNoCampo}
                onChange={(_, v) => setPolicialNoCampo(v)}
                getOptionLabel={labelPolicialOpcao}
                isOptionEqualToValue={(a, b) => a.id === b.id}
                filterOptions={(options, { inputValue }) => {
                  const t = normalizarBusca(inputValue);
                  if (!t) return options;
                  return options.filter((p) => {
                    const hay = normalizarBusca(
                      `${p.nome} ${matriculaParaBusca(p)} ${formatEquipeLabel(p.equipe)} ${p.status} designado ativo`,
                    );
                    return hay.includes(t);
                  });
                }}
                renderInput={(params) => (
                  <TextField
                    {...params}
                    label="Policial"
                    placeholder="Busque por nome, matrícula, equipe ou status…"
                  />
                )}
                disabled={controlesDesabilitados || opcoesSemJaAdicionados.length === 0}
                noOptionsText={
                  policiaisOpcoes.length === 0
                    ? 'Nenhum policial Ativo ou Designado encontrado.'
                    : idsNaEscala.size >= policiaisOpcoes.length
                      ? 'Todos os policiais elegíveis já foram adicionados.'
                      : 'Nenhum resultado'
                }
              />
              <Button
                variant="outlined"
                onClick={adicionarPolicialNaLista}
                disabled={controlesDesabilitados || carregandoLista || opcoesSemJaAdicionados.length === 0}
                sx={{ flexShrink: 0, alignSelf: { xs: 'stretch', sm: 'center' }, minWidth: 120 }}
              >
                Adicionar
              </Button>
            </Stack>
          )}
        </Box>

        <Stack direction="row" spacing={1.5} flexWrap="wrap" useFlexGap>
          <Button variant="outlined" onClick={limparFormulario} disabled={controlesDesabilitados}>
            Limpar
          </Button>
          <Button
            variant="contained"
            onClick={() => void handleGerarEscala()}
            disabled={controlesDesabilitados || carregandoLista || gerandoEscala}
          >
            {gerandoEscala ? 'Gerando…' : 'Gerar Escala'}
          </Button>
        </Stack>
      </Stack>

      <Box>
        <Typography variant="subtitle2" sx={{ mb: 1, fontWeight: 600 }}>
          Policiais escalados ({policiaisNaEscala.length})
        </Typography>
        <Paper
          variant="outlined"
          sx={{
            borderRadius: 1,
            borderColor: 'var(--border-soft, rgba(0,0,0,0.12))',
            maxHeight: 320,
            overflow: 'auto',
          }}
        >
          {policiaisNaEscala.length === 0 ? (
            <Box sx={{ px: 2, py: 2.5 }}>
              <Typography variant="body2" color="text.secondary">
                Nenhum policial adicionado. Use o campo acima e o botão &quot;Adicionar&quot;.
              </Typography>
            </Box>
          ) : (
            <List dense disablePadding>
              {policiaisNaEscala.map((p, i) => (
                <ListItem
                  key={`${p.id}-${i}`}
                  divider={i < policiaisNaEscala.length - 1}
                  secondaryAction={
                    <Button
                      size="small"
                      color="error"
                      variant="text"
                      onClick={() => removerPolicialDaEscala(i)}
                      disabled={controlesDesabilitados}
                      sx={{ textTransform: 'none', fontWeight: 600 }}
                    >
                      Excluir
                    </Button>
                  }
                >
                  <ListItemText
                    primary={`${i + 1}. ${p.nome}`}
                    secondary={`${formatMatricula(p.matricula)} · ${formatEquipeLabel(p.equipe)} · ${
                      p.status === 'DESIGNADO' ? 'Designado' : p.status === 'ATIVO' ? 'Ativo' : p.status
                    }${p.funcao?.nome ? ` · ${p.funcao.nome}` : ''}`}
                    primaryTypographyProps={{ variant: 'body2', fontWeight: 600 }}
                    secondaryTypographyProps={{ variant: 'caption' }}
                  />
                </ListItem>
              ))}
            </List>
          )}
        </Paper>
      </Box>

    </Stack>
  );
}
