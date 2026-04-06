import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControl,
  InputLabel,
  MenuItem,
  Paper,
  Select,
  Stack,
  Tab,
  Tabs,
  TextField,
  Typography,
} from '@mui/material';
import { api } from '../api';
import type { ErrorReport, ErrorReportCategoria, ErrorReportStatus, Usuario } from '../types';
import { AbrirChamadoLink } from '../components/common/AbrirChamadoLink';
import { ChamadoAnexoPreview } from './ChamadoAnexoPreview';
import { ERROR_REPORT_CATEGORIA_LABEL, ERROR_REPORT_STATUS_LABEL } from './labels';

const CATEGORIAS: ErrorReportCategoria[] = ['ERRO_SISTEMA', 'DUVIDA', 'MELHORIA', 'OUTRO'];

const ANEXO_MAX_BYTES = 8 * 1024 * 1024;
const ANEXO_ACCEPT = 'image/png,image/jpeg,image/jpg,image/webp,image/gif,application/pdf';
const ANEXO_TIPOS_PERMITIDOS = new Set([
  'image/png',
  'image/jpeg',
  'image/jpg',
  'image/webp',
  'image/gif',
  'application/pdf',
]);

function formatarDataHora(iso: string): string {
  try {
    return new Date(iso).toLocaleString('pt-BR', {
      dateStyle: 'short',
      timeStyle: 'short',
    });
  } catch {
    return iso;
  }
}

function chipStatusSx(status: ErrorReportStatus): object {
  switch (status) {
    case 'ABERTO':
      return { bgcolor: 'rgba(211, 47, 47, 0.18)', color: '#b71c1c', fontWeight: 600 };
    case 'EM_ANALISE':
      return { bgcolor: 'rgba(255, 154, 60, 0.2)', color: 'var(--sentinela-orange-glow)' };
    case 'RESOLVIDO':
      return { bgcolor: 'rgba(34, 197, 94, 0.2)', color: '#166534' };
    case 'CANCELADO':
      return { bgcolor: 'rgba(180, 180, 180, 0.35)', color: 'var(--text-secondary)' };
    case 'FECHADO':
    default:
      return { bgcolor: 'rgba(0,0,0,0.12)', color: 'var(--text-secondary)' };
  }
}

function usuarioPodeCancelarChamado(status: ErrorReportStatus): boolean {
  return status === 'ABERTO' || status === 'EM_ANALISE';
}

type AbaMeusChamados = 'ativos' | 'fechados';

interface ReportarErroViewProps {
  currentUser: Usuario;
  focusChamadoFormSeq?: number;
}

export function ReportarErroView({ currentUser: _currentUser, focusChamadoFormSeq = 0 }: ReportarErroViewProps) {
  void _currentUser;
  const formSectionRef = useRef<HTMLDivElement | null>(null);
  const descricaoInputRef = useRef<HTMLTextAreaElement | null>(null);

  const [lista, setLista] = useState<ErrorReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [descricao, setDescricao] = useState('');
  const [categoria, setCategoria] = useState<ErrorReportCategoria>('ERRO_SISTEMA');
  const [submitting, setSubmitting] = useState(false);
  const [formMsg, setFormMsg] = useState<{ type: 'err'; text: string } | null>(null);
  const [confirmarAberturaOpen, setConfirmarAberturaOpen] = useState(false);
  const [sucessoProtocolo, setSucessoProtocolo] = useState<string | null>(null);

  const [anexoDataUrl, setAnexoDataUrl] = useState<string | null>(null);
  const [anexoNome, setAnexoNome] = useState<string | null>(null);
  const [anexoErro, setAnexoErro] = useState<string | null>(null);

  const [cancelChamadoId, setCancelChamadoId] = useState<number | null>(null);
  const [cancelMotivo, setCancelMotivo] = useState('');
  const [cancelSubmitting, setCancelSubmitting] = useState(false);
  const [cancelError, setCancelError] = useState<string | null>(null);
  const [sucessoCancelamentoProtocolo, setSucessoCancelamentoProtocolo] = useState<string | null>(null);

  const [formularioAberto, setFormularioAberto] = useState(false);
  const [abaMeusChamados, setAbaMeusChamados] = useState<AbaMeusChamados>('ativos');

  const listaChamadosAtivos = useMemo(
    () => lista.filter((r) => r.status !== 'FECHADO'),
    [lista],
  );
  const listaChamadosFechados = useMemo(() => lista.filter((r) => r.status === 'FECHADO'), [lista]);
  const listaChamadosExibida = abaMeusChamados === 'ativos' ? listaChamadosAtivos : listaChamadosFechados;

  const carregar = useCallback(async () => {
    setLoadError(null);
    setLoading(true);
    try {
      const data = await api.listErrorReports();
      setLista(data);
    } catch (e) {
      setLoadError(e instanceof Error ? e.message : 'Não foi possível carregar os chamados.');
    } finally {
      setLoading(false);
    }
  }, []);

  /** Atualiza a lista sem spinner (acompanhamento do status alterado pela gestão). */
  const refetchListaSilencioso = useCallback(async () => {
    try {
      const data = await api.listErrorReports();
      setLista(data);
    } catch {
      /* ignora falha em poll */
    }
  }, []);

  useEffect(() => {
    void carregar();
  }, [carregar]);

  useEffect(() => {
    const onVis = () => {
      if (document.visibilityState === 'visible') void refetchListaSilencioso();
    };
    document.addEventListener('visibilitychange', onVis);
    const t = window.setInterval(() => {
      if (document.visibilityState === 'visible') void refetchListaSilencioso();
    }, 45_000);
    return () => {
      document.removeEventListener('visibilitychange', onVis);
      window.clearInterval(t);
    };
  }, [refetchListaSilencioso]);

  useEffect(() => {
    if (focusChamadoFormSeq <= 0) return;
    setFormularioAberto(true);
  }, [focusChamadoFormSeq]);

  useEffect(() => {
    if (focusChamadoFormSeq <= 0 || !formularioAberto) return;
    const t = window.setTimeout(() => {
      formSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      descricaoInputRef.current?.focus();
    }, 120);
    return () => window.clearTimeout(t);
  }, [formularioAberto, focusChamadoFormSeq]);

  function abrirCancelarChamado(id: number) {
    setCancelChamadoId(id);
    setCancelMotivo('');
    setCancelError(null);
  }

  function fecharModalCancelar() {
    if (cancelSubmitting) return;
    setCancelChamadoId(null);
    setCancelMotivo('');
    setCancelError(null);
  }

  async function confirmarCancelarChamado() {
    if (cancelChamadoId == null) return;
    const motivo = cancelMotivo.trim();
    if (motivo.length < 3) {
      setCancelError('Descreva o motivo com pelo menos 3 caracteres.');
      return;
    }
    setCancelSubmitting(true);
    setCancelError(null);
    try {
      const atualizado = await api.cancelErrorReport(cancelChamadoId, { motivo });
      fecharModalCancelar();
      setSucessoCancelamentoProtocolo(atualizado.protocolo);
      await carregar();
    } catch (err) {
      setCancelError(err instanceof Error ? err.message : 'Não foi possível cancelar o chamado.');
    } finally {
      setCancelSubmitting(false);
    }
  }

  function handleSubmitFormulario(e: React.FormEvent) {
    e.preventDefault();
    setFormMsg(null);
    const d = descricao.trim();
    if (!d) {
      setFormMsg({ type: 'err', text: 'Preencha a descrição.' });
      return;
    }
    setConfirmarAberturaOpen(true);
  }

  function handleAnexoChange(e: React.ChangeEvent<HTMLInputElement>) {
    setAnexoErro(null);
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    if (file.size > ANEXO_MAX_BYTES) {
      setAnexoErro('Arquivo muito grande. Máximo 8 MB.');
      return;
    }
    if (file.type && !ANEXO_TIPOS_PERMITIDOS.has(file.type)) {
      setAnexoErro('Tipo não permitido. Use imagem (PNG, JPEG, WebP, GIF) ou PDF.');
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result;
      if (typeof result !== 'string') {
        setAnexoErro('Não foi possível ler o arquivo.');
        return;
      }
      setAnexoDataUrl(result);
      setAnexoNome(file.name || 'anexo');
    };
    reader.onerror = () => setAnexoErro('Não foi possível ler o arquivo.');
    reader.readAsDataURL(file);
  }

  function limparAnexo() {
    setAnexoDataUrl(null);
    setAnexoNome(null);
    setAnexoErro(null);
  }

  async function confirmarEEnviarChamado() {
    const d = descricao.trim();
    if (!d) return;
    setConfirmarAberturaOpen(false);
    setSubmitting(true);
    setFormMsg(null);
    try {
      const payload = {
        descricao: d,
        categoria,
        ...(anexoDataUrl ? { anexoDataUrl, anexoNome: anexoNome ?? 'anexo' } : {}),
      };
      const criado = await api.createErrorReport(payload);
      setDescricao('');
      setCategoria('ERRO_SISTEMA');
      limparAnexo();
      setSucessoProtocolo(criado.protocolo);
      await carregar();
    } catch (err) {
      setFormMsg({
        type: 'err',
        text: err instanceof Error ? err.message : 'Falha ao registrar o chamado.',
      });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Stack spacing={3} sx={{ mt: 1 }}>
      <div className="management-grid">
        <div className="management-item">
          <AbrirChamadoLink onAbrirChamado={() => setFormularioAberto(true)} />
        </div>
      </div>

      {formularioAberto ? (
        <Paper
          ref={formSectionRef}
          id="formulario-chamado-orion"
          elevation={2}
          sx={{
            p: 3,
            backgroundColor: 'var(--card-bg)',
            border: '1px solid var(--border-soft)',
            borderRadius: 2,
            scrollMarginTop: '24px',
          }}
        >
          <Stack direction="row" alignItems="center" justifyContent="space-between" flexWrap="wrap" gap={1} sx={{ mb: 2 }}>
            <Typography variant="h6" sx={{ fontWeight: 600 }}>
              Novo chamado
            </Typography>
            <Button
              type="button"
              size="small"
              variant="text"
              onClick={() => setFormularioAberto(false)}
              sx={{ textTransform: 'none', color: 'text.secondary' }}
            >
              Ocultar formulário
            </Button>
          </Stack>
          {formMsg && (
            <Alert severity="error" sx={{ mb: 2 }} onClose={() => setFormMsg(null)}>
              {formMsg.text}
            </Alert>
          )}
          <Box component="form" onSubmit={handleSubmitFormulario}>
            <Stack spacing={2}>
              <FormControl fullWidth size="small">
                <InputLabel id="categoria-label">Categoria</InputLabel>
                <Select
                  labelId="categoria-label"
                  label="Categoria"
                  value={categoria}
                  onChange={(e) => setCategoria(e.target.value as ErrorReportCategoria)}
                >
                  {CATEGORIAS.map((c) => (
                    <MenuItem key={c} value={c}>
                      {ERROR_REPORT_CATEGORIA_LABEL[c]}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
              <TextField
                label="Descrição"
                value={descricao}
                onChange={(e) => setDescricao(e.target.value)}
                fullWidth
                required
                multiline
                minRows={4}
                inputRef={descricaoInputRef}
                inputProps={{ maxLength: 8000 }}
                helperText="Descreva o erro, a tela envolvida e o que tentou fazer."
              />
              <Stack spacing={1}>
                <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>
                  Anexo (opcional)
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  Imagem (PNG, JPEG, WebP, GIF) ou PDF, até 8 MB.
                </Typography>
                {anexoErro ? (
                  <Alert severity="error" onClose={() => setAnexoErro(null)}>
                    {anexoErro}
                  </Alert>
                ) : null}
                <Stack direction="row" alignItems="center" spacing={1} flexWrap="wrap" sx={{ gap: 1 }}>
                  <Button component="label" variant="outlined" disabled={submitting} sx={{ textTransform: 'none' }}>
                    Escolher arquivo
                    <input type="file" hidden accept={ANEXO_ACCEPT} onChange={handleAnexoChange} />
                  </Button>
                  {anexoDataUrl ? (
                    <Button type="button" variant="text" color="inherit" onClick={limparAnexo} sx={{ textTransform: 'none' }}>
                      Remover anexo
                    </Button>
                  ) : null}
                </Stack>
                {anexoDataUrl && anexoNome ? (
                  <Typography variant="body2" color="text.secondary">
                    Arquivo selecionado: {anexoNome}
                  </Typography>
                ) : null}
                {anexoDataUrl ? (
                  <ChamadoAnexoPreview anexoDataUrl={anexoDataUrl} anexoNome={anexoNome} compact showTitle={false} />
                ) : null}
              </Stack>
              <Box>
                <Button type="submit" variant="contained" disabled={submitting} sx={{ textTransform: 'none' }}>
                  Registrar chamado
                </Button>
              </Box>
            </Stack>
          </Box>

          <Dialog
            open={confirmarAberturaOpen}
            onClose={() => !submitting && setConfirmarAberturaOpen(false)}
            maxWidth="sm"
            fullWidth
            slotProps={{
              paper: { sx: { backgroundColor: 'var(--card-bg)', border: '1px solid var(--border-soft)' } },
            }}
          >
            <DialogTitle sx={{ fontWeight: 700 }}>Confirmar abertura do chamado</DialogTitle>
            <DialogContent>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                Confira os dados abaixo. Após confirmar, o chamado será registrado e receberá um número de protocolo.
              </Typography>
              <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 0.5 }}>
                Categoria
              </Typography>
              <Typography variant="body2" sx={{ mb: 2 }}>
                {ERROR_REPORT_CATEGORIA_LABEL[categoria]}
              </Typography>
              <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 0.5 }}>
                Descrição
              </Typography>
              <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap', maxHeight: 200, overflow: 'auto' }}>
                {descricao.trim() || '—'}
              </Typography>
              {anexoNome ? (
                <>
                  <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 0.5, mt: 2 }}>
                    Anexo
                  </Typography>
                  <Typography variant="body2">{anexoNome}</Typography>
                </>
              ) : null}
            </DialogContent>
            <DialogActions sx={{ px: 3, pb: 2 }}>
              <Button onClick={() => setConfirmarAberturaOpen(false)} disabled={submitting} sx={{ textTransform: 'none' }}>
                Cancelar
              </Button>
              <Button variant="contained" onClick={() => void confirmarEEnviarChamado()} disabled={submitting} sx={{ textTransform: 'none' }}>
                {submitting ? 'Registrando…' : 'Confirmar e registrar'}
              </Button>
            </DialogActions>
          </Dialog>

          <Dialog
            open={Boolean(sucessoProtocolo)}
            onClose={() => setSucessoProtocolo(null)}
            maxWidth="sm"
            fullWidth
            slotProps={{
              paper: { sx: { backgroundColor: 'var(--card-bg)', border: '1px solid var(--border-soft)' } },
            }}
          >
            <DialogTitle sx={{ fontWeight: 700 }}>Chamado registrado</DialogTitle>
            <DialogContent>
              <Typography variant="body2" sx={{ mb: 2 }}>
                Guarde o número de protocolo abaixo para acompanhamento e referência junto ao suporte.
              </Typography>
              <Paper
                elevation={0}
                sx={{
                  p: 2,
                  bgcolor: 'rgba(107, 155, 196, 0.12)',
                  border: '1px solid var(--border-soft)',
                }}
              >
                <Typography variant="caption" color="text.secondary" display="block">
                  Protocolo (15 dígitos — os 5 finais seguem a ordem no ano e reiniciam em 1º de janeiro)
                </Typography>
                <Typography
                  variant="h6"
                  sx={{
                    fontFamily: 'ui-monospace, "Cascadia Code", monospace',
                    fontWeight: 700,
                    letterSpacing: '0.04em',
                    wordBreak: 'break-all',
                  }}
                >
                  {sucessoProtocolo}
                </Typography>
              </Paper>
            </DialogContent>
            <DialogActions sx={{ px: 3, pb: 2 }}>
              <Button variant="contained" onClick={() => setSucessoProtocolo(null)} sx={{ textTransform: 'none' }}>
                Fechar
              </Button>
            </DialogActions>
          </Dialog>
        </Paper>
      ) : null}

      <Typography variant="h6" sx={{ fontWeight: 600 }}>
        Meus chamados
      </Typography>

      {!loadError && !loading ? (
        <Tabs
          value={abaMeusChamados}
          onChange={(_, v) => setAbaMeusChamados(v as AbaMeusChamados)}
          sx={{ borderBottom: 1, borderColor: 'divider', mb: 2 }}
        >
          <Tab
            label={`Chamados${listaChamadosAtivos.length ? ` (${listaChamadosAtivos.length})` : ''}`}
            value="ativos"
            sx={{ textTransform: 'none' }}
          />
          <Tab
            label={`Chamados Fechados${listaChamadosFechados.length ? ` (${listaChamadosFechados.length})` : ''}`}
            value="fechados"
            sx={{ textTransform: 'none' }}
          />
        </Tabs>
      ) : null}

      {loadError && (
        <Alert
          severity="error"
          action={
            <Button color="inherit" size="small" onClick={() => void carregar()}>
              Tentar novamente
            </Button>
          }
        >
          {loadError}
        </Alert>
      )}

      {loading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
          <CircularProgress size={36} />
        </Box>
      ) : listaChamadosExibida.length === 0 ? (
        <Typography color="text.secondary">
          {abaMeusChamados === 'fechados'
            ? 'Nenhum chamado fechado ainda.'
            : 'Nenhum chamado em acompanhamento. Abra um novo chamado acima quando precisar.'}
        </Typography>
      ) : (
        <Stack spacing={2}>
          {listaChamadosExibida.map((r) => (
            <Paper
              key={r.id}
              elevation={1}
              sx={{
                p: 2,
                backgroundColor: 'var(--card-bg)',
                border: '1px solid var(--border-soft)',
              }}
            >
              <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} alignItems={{ sm: 'center' }} flexWrap="wrap">
                <Chip
                  size="small"
                  label={r.protocolo}
                  variant="outlined"
                  sx={{ fontFamily: 'ui-monospace, monospace', fontWeight: 600 }}
                />
                <Chip size="small" label={ERROR_REPORT_CATEGORIA_LABEL[r.categoria]} />
                <Chip size="small" label={ERROR_REPORT_STATUS_LABEL[r.status]} sx={chipStatusSx(r.status)} />
                <Typography variant="caption" color="text.secondary" sx={{ ml: { sm: 'auto' } }}>
                  Aberto em {formatarDataHora(r.createdAt)}
                </Typography>
              </Stack>

              <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap', mt: 1 }}>
                {r.descricao}
              </Typography>

              {r.anexoDataUrl ? (
                <ChamadoAnexoPreview anexoDataUrl={r.anexoDataUrl} anexoNome={r.anexoNome} compact />
              ) : null}

              {usuarioPodeCancelarChamado(r.status) && (
                <Box sx={{ mt: 2 }}>
                  <Button
                    type="button"
                    variant="outlined"
                    color="inherit"
                    onClick={() => abrirCancelarChamado(r.id)}
                    sx={{ textTransform: 'none' }}
                  >
                    Cancelar chamado
                  </Button>
                </Box>
              )}
            </Paper>
          ))}
        </Stack>
      )}

      <Dialog
        open={cancelChamadoId != null}
        onClose={() => fecharModalCancelar()}
        maxWidth="sm"
        fullWidth
        slotProps={{
          paper: { sx: { backgroundColor: 'var(--card-bg)', border: '1px solid var(--border-soft)' } },
        }}
      >
        <DialogTitle sx={{ fontWeight: 700 }}>Cancelar chamado</DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            Informe o motivo do cancelamento. Esta ação não pode ser desfeita pelo solicitante.
          </Typography>
          {cancelError && (
            <Alert severity="error" sx={{ mb: 2 }} onClose={() => setCancelError(null)}>
              {cancelError}
            </Alert>
          )}
          <TextField
            label="Motivo do cancelamento"
            value={cancelMotivo}
            onChange={(e) => setCancelMotivo(e.target.value)}
            fullWidth
            required
            multiline
            minRows={4}
            inputProps={{ maxLength: 4000 }}
            autoFocus
            disabled={cancelSubmitting}
            helperText="Mínimo de 3 caracteres."
          />
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={fecharModalCancelar} disabled={cancelSubmitting} sx={{ textTransform: 'none' }}>
            Voltar
          </Button>
          <Button
            variant="contained"
            color="error"
            onClick={() => void confirmarCancelarChamado()}
            disabled={cancelSubmitting}
            sx={{ textTransform: 'none' }}
          >
            {cancelSubmitting ? 'Cancelando…' : 'Confirmar cancelamento'}
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog
        open={Boolean(sucessoCancelamentoProtocolo)}
        onClose={() => setSucessoCancelamentoProtocolo(null)}
        maxWidth="sm"
        fullWidth
        slotProps={{
          paper: { sx: { backgroundColor: 'var(--card-bg)', border: '1px solid var(--border-soft)' } },
        }}
      >
        <DialogTitle sx={{ fontWeight: 700 }}>Chamado cancelado</DialogTitle>
        <DialogContent>
          <Typography variant="body2" sx={{ mb: 2 }}>
            O chamado foi cancelado com sucesso e não seguirá em análise pelo suporte.
          </Typography>
          <Paper
            elevation={0}
            sx={{
              p: 2,
              bgcolor: 'rgba(34, 197, 94, 0.12)',
              border: '1px solid var(--border-soft)',
            }}
          >
            <Typography variant="caption" color="text.secondary" display="block">
              Protocolo
            </Typography>
            <Typography
              variant="h6"
              sx={{
                fontFamily: 'ui-monospace, "Cascadia Code", monospace',
                fontWeight: 700,
                letterSpacing: '0.04em',
                wordBreak: 'break-all',
              }}
            >
              {sucessoCancelamentoProtocolo}
            </Typography>
          </Paper>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button variant="contained" onClick={() => setSucessoCancelamentoProtocolo(null)} sx={{ textTransform: 'none' }}>
            Fechar
          </Button>
        </DialogActions>
      </Dialog>
    </Stack>
  );
}
