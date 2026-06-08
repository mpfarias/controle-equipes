import {
  Alert,
  Box,
  Button,
  Checkbox,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControl,
  FormControlLabel,
  Grid,
  IconButton,
  InputLabel,
  MenuItem,
  Select,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import { Close as CloseIcon } from '@mui/icons-material';
import type {
  Equipe,
  EquipeOption,
  FuncaoOption,
  Policial,
  PolicialStatus,
  PostoGraduacaoOption,
  QuadroOption,
} from '../../types';
import {
  POLICIAL_STATUS_OPTIONS_FORM,
  formatEquipeLabel,
  funcaoEquipeObrigatoriaNoFormulario,
  funcaoOcultaCampoEquipe,
  funcaoRequerFase12x36Expediente,
  labelFase12x36Policial,
} from '../../constants';
import { formatMatricula, formatNome } from '../../utils/dateUtils';
import {
  blurValidacaoCpfTelefone,
  PolicialCamposComplementares,
} from './PolicialCamposComplementares';
import { PolicialFormSection } from './PolicialFormSection';
import { PolicialFotoUpload } from './PolicialFotoUpload';
import type {
  PolicialCamposComplementaresErrors,
  PolicialCamposComplementaresForm,
} from '../../utils/policialCamposComplementaresForm';

export type PolicialEditFormState = {
  postoGraduacaoId: number | undefined;
  quadroId: number | undefined;
  nome: string;
  matricula: string;
  cpf: string;
  telefone: string;
  dataNascimento: string;
  status: PolicialStatus;
  matriculaComissionadoGdf: string;
  dataPosse: string;
  equipe: Equipe | undefined;
  funcaoId: number | undefined;
  fotoUrl: string | null | undefined;
  expediente12x36Fase: 'PAR' | 'IMPAR' | undefined;
};

type PolicialEditModalProps = {
  open: boolean;
  policial: Policial | null;
  editForm: PolicialEditFormState;
  setEditForm: React.Dispatch<React.SetStateAction<PolicialEditFormState>>;
  camposComplementares: PolicialCamposComplementaresForm;
  patchCamposComplementares: (patch: Partial<PolicialCamposComplementaresForm>) => void;
  camposComplementaresErrors: PolicialCamposComplementaresErrors;
  setCamposComplementaresErrors: React.Dispatch<
    React.SetStateAction<PolicialCamposComplementaresErrors>
  >;
  cpfError: string | null;
  setCpfError: React.Dispatch<React.SetStateAction<string | null>>;
  telefoneError: string | null;
  setTelefoneError: React.Dispatch<React.SetStateAction<string | null>>;
  error: string | null;
  setError: React.Dispatch<React.SetStateAction<string | null>>;
  submitting: boolean;
  onClose: () => void;
  onSubmit: (event: React.FormEvent<HTMLFormElement>) => void;
  postosGraduacao: PostoGraduacaoOption[];
  quadrosDisponiveis: QuadroOption[];
  funcoes: FuncaoOption[];
  funcoesOrdenadas: FuncaoOption[];
  equipesDisponiveis: EquipeOption[];
  formFieldSx: object;
  selectMenuProps: object;
};

function rotuloSelectVazio(texto: string) {
  return (
    <Typography component="span" variant="body2" sx={{ color: 'text.secondary' }}>
      {texto}
    </Typography>
  );
}

export function PolicialEditModal({
  open,
  policial,
  editForm,
  setEditForm,
  camposComplementares,
  patchCamposComplementares,
  camposComplementaresErrors,
  setCamposComplementaresErrors,
  cpfError,
  setCpfError,
  telefoneError,
  setTelefoneError,
  error,
  setError,
  submitting,
  onClose,
  onSubmit,
  postosGraduacao,
  quadrosDisponiveis,
  funcoes,
  funcoesOrdenadas,
  equipesDisponiveis,
  formFieldSx,
  selectMenuProps,
}: PolicialEditModalProps) {
  const funcaoSelecionada = editForm.funcaoId
    ? funcoes.find((f) => f.id === editForm.funcaoId)
    : null;
  const mostrarEquipe = funcaoSelecionada ? !funcaoOcultaCampoEquipe(funcaoSelecionada) : false;
  const equipeObrigatoria = funcaoSelecionada
    ? funcaoEquipeObrigatoriaNoFormulario(funcaoSelecionada)
    : false;
  const mostrarFase12x36 = funcaoRequerFase12x36Expediente(funcaoSelecionada ?? undefined);
  const guardaCopom = funcaoSelecionada?.expedienteHorarioPreset === 'GUARDA_COPOM_12X36';
  const faseLabel = guardaCopom ? 'Fase Guarda COPOM (12×36)' : 'Fase 12×36';

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="md"
      fullWidth
      scroll="paper"
      slotProps={{
        paper: {
          sx: {
            maxHeight: '92vh',
            bgcolor: 'var(--card-bg, background.paper)',
          },
        },
      }}
    >
      <DialogTitle
        sx={{
          display: 'flex',
          alignItems: 'flex-start',
          justifyContent: 'space-between',
          gap: 2,
          py: 2,
          px: { xs: 2, sm: 3 },
          borderBottom: '1px solid',
          borderColor: 'divider',
        }}
      >
        <Box>
          <Typography variant="h6" component="span" sx={{ fontWeight: 600 }}>
            Editar policial
          </Typography>
          {policial ? (
            <Typography variant="body2" color="text.secondary" sx={{ mt: 0.25 }}>
              {formatNome(policial.nome)} · {formatMatricula(policial.matricula)}
            </Typography>
          ) : null}
        </Box>
        <IconButton onClick={onClose} aria-label="Fechar" size="small" sx={{ mt: -0.5 }}>
          <CloseIcon />
        </IconButton>
      </DialogTitle>

      <DialogContent dividers sx={{ px: { xs: 2, sm: 3 }, py: 2 }}>
        {error ? (
          <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>
            {error}
          </Alert>
        ) : null}

        <Box component="form" id="edit-policial-form" onSubmit={onSubmit} noValidate>
          <Stack spacing={3}>
            <PolicialFormSection title="Foto">
              <PolicialFotoUpload
                fotoUrl={editForm.fotoUrl}
                onChange={(url) => setEditForm((prev) => ({ ...prev, fotoUrl: url }))}
                onError={setError}
              />
            </PolicialFormSection>

            <PolicialFormSection title="Dados funcionais">
              <Grid container spacing={2}>
                <Grid size={{ xs: 12, sm: 6, md: 3 }}>
                  <FormControl fullWidth size="small" required sx={formFieldSx}>
                    <InputLabel id="edit-posto-graduacao-label" shrink>
                      Posto/Graduação
                    </InputLabel>
                    <Select
                      labelId="edit-posto-graduacao-label"
                      label="Posto/Graduação"
                      MenuProps={selectMenuProps}
                      value={editForm.postoGraduacaoId != null ? String(editForm.postoGraduacaoId) : ''}
                      displayEmpty
                      renderValue={(v) => {
                        if (!v) return rotuloSelectVazio('Selecione');
                        const p = postosGraduacao.find((x) => x.id === Number(v));
                        return p ? p.sigla : rotuloSelectVazio('Selecione');
                      }}
                      onChange={(e) => {
                        const val = String(e.target.value);
                        setEditForm((prev) => ({
                          ...prev,
                          postoGraduacaoId: val === '' ? undefined : Number(val),
                          quadroId: undefined,
                        }));
                      }}
                    >
                      <MenuItem value="">
                        <em>Selecione</em>
                      </MenuItem>
                      {postosGraduacao.map((p) => (
                        <MenuItem key={p.id} value={String(p.id)}>
                          {p.sigla}
                        </MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                </Grid>
                <Grid size={{ xs: 12, sm: 6, md: 3 }}>
                  <FormControl
                    fullWidth
                    size="small"
                    required
                    disabled={!editForm.postoGraduacaoId}
                    sx={formFieldSx}
                  >
                    <InputLabel id="edit-quadro-label" shrink>
                      Quadro
                    </InputLabel>
                    <Select
                      labelId="edit-quadro-label"
                      label="Quadro"
                      MenuProps={selectMenuProps}
                      value={editForm.quadroId != null ? String(editForm.quadroId) : ''}
                      displayEmpty
                      renderValue={(v) => {
                        if (!v) {
                          return rotuloSelectVazio(
                            editForm.postoGraduacaoId ? 'Selecione o quadro' : 'Selecione o posto antes',
                          );
                        }
                        const q = quadrosDisponiveis.find((x) => x.id === Number(v));
                        return q ? q.sigla : rotuloSelectVazio('Selecione o quadro');
                      }}
                      onChange={(e) => {
                        const val = String(e.target.value);
                        setEditForm((prev) => ({
                          ...prev,
                          quadroId: val === '' ? undefined : Number(val),
                        }));
                      }}
                    >
                      <MenuItem value="">
                        <em>Selecione</em>
                      </MenuItem>
                      {quadrosDisponiveis.map((q) => (
                        <MenuItem key={q.id} value={String(q.id)}>
                          {q.sigla}
                        </MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                </Grid>
                <Grid size={{ xs: 12, sm: 6, md: 3 }}>
                  <TextField
                    label="Matrícula"
                    value={editForm.matricula}
                    onChange={(event) =>
                      setEditForm((prev) => ({
                        ...prev,
                        matricula: event.target.value.replace(/[^0-9xX]/g, '').toUpperCase(),
                      }))
                    }
                    required
                    fullWidth
                    size="small"
                    sx={formFieldSx}
                  />
                </Grid>
                <Grid size={{ xs: 12, sm: 6, md: 3 }}>
                  <FormControl fullWidth required size="small" sx={formFieldSx}>
                    <InputLabel id="edit-status-label" shrink>
                      Status
                    </InputLabel>
                    <Select
                      labelId="edit-status-label"
                      label="Status"
                      MenuProps={selectMenuProps}
                      value={editForm.status}
                      renderValue={(v) =>
                        POLICIAL_STATUS_OPTIONS_FORM.find((o) => o.value === v)?.label ?? v
                      }
                      onChange={(event) => {
                        const novoStatus = event.target.value as PolicialStatus;
                        setEditForm((prev) => ({
                          ...prev,
                          status: novoStatus,
                          ...(novoStatus !== 'COMISSIONADO'
                            ? { matriculaComissionadoGdf: '', dataPosse: '' }
                            : {}),
                        }));
                        if (novoStatus === 'COMISSIONADO') {
                          patchCamposComplementares({ dataAdmissao: '' });
                        }
                      }}
                    >
                      {POLICIAL_STATUS_OPTIONS_FORM.map((option) => (
                        <MenuItem key={option.value} value={option.value}>
                          {option.label}
                        </MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                </Grid>
                <Grid size={{ xs: 12 }}>
                  <TextField
                    label="Nome completo"
                    value={editForm.nome}
                    onChange={(event) =>
                      setEditForm((prev) => ({ ...prev, nome: event.target.value.toUpperCase() }))
                    }
                    required
                    fullWidth
                    size="small"
                    placeholder="JOÃO PEREIRA DA SILVA"
                    sx={formFieldSx}
                  />
                </Grid>
                <Grid size={{ xs: 12 }}>
                  <FormControlLabel
                    control={
                      <Checkbox
                        checked={editForm.status === 'COMISSIONADO'}
                        onChange={(e) =>
                          setEditForm((prev) => ({
                            ...prev,
                            status: e.target.checked ? 'COMISSIONADO' : 'ATIVO',
                            ...(e.target.checked ? {} : { matriculaComissionadoGdf: '', dataPosse: '' }),
                          }))
                        }
                        size="small"
                      />
                    }
                    label="Comissionado (GDF)"
                    sx={{ m: 0, alignItems: 'center' }}
                  />
                </Grid>
                {editForm.status === 'COMISSIONADO' && (
                  <Grid size={{ xs: 12 }}>
                    <Box
                      sx={{
                        p: 2,
                        borderRadius: 1.5,
                        border: '1px dashed',
                        borderColor: 'var(--border-soft, divider)',
                        bgcolor: 'rgba(0,0,0,0.12)',
                      }}
                    >
                      <Grid container spacing={2}>
                        <Grid size={{ xs: 12, sm: 6 }}>
                          <TextField
                            fullWidth
                            size="small"
                            label="Matrícula comissionado (GDF)"
                            value={editForm.matriculaComissionadoGdf}
                            onChange={(event) =>
                              setEditForm((prev) => ({
                                ...prev,
                                matriculaComissionadoGdf: event.target.value
                                  .replace(/[^0-9xX]/g, '')
                                  .toUpperCase(),
                              }))
                            }
                            sx={formFieldSx}
                          />
                        </Grid>
                        <Grid size={{ xs: 12, sm: 6 }}>
                          <TextField
                            fullWidth
                            size="small"
                            label="Data de posse"
                            type="date"
                            value={editForm.dataPosse}
                            onChange={(event) =>
                              setEditForm((prev) => ({ ...prev, dataPosse: event.target.value }))
                            }
                            slotProps={{ inputLabel: { shrink: true } }}
                            sx={formFieldSx}
                          />
                        </Grid>
                      </Grid>
                    </Box>
                  </Grid>
                )}
                <Grid size={{ xs: 12, md: 6 }}>
                  <FormControl fullWidth size="small" required sx={formFieldSx}>
                    <InputLabel id="edit-funcao-label" shrink>
                      Função
                    </InputLabel>
                    <Select
                      labelId="edit-funcao-label"
                      label="Função"
                      MenuProps={selectMenuProps}
                      value={editForm.funcaoId ?? ''}
                      displayEmpty
                      renderValue={(v) => {
                        if (!v) return rotuloSelectVazio('Selecione uma função');
                        const f = funcoesOrdenadas.find((x) => x.id === v);
                        return f ? formatNome(f.nome) : rotuloSelectVazio('Selecione uma função');
                      }}
                      onChange={(event) => {
                        const novoFuncaoId = event.target.value ? Number(event.target.value) : undefined;
                        const funcaoSel = novoFuncaoId
                          ? funcoes.find((f) => f.id === novoFuncaoId)
                          : null;
                        if (funcaoSel) {
                          const isMot = funcaoSel.nome.toUpperCase().includes('MOTORISTA DE DIA');
                          const oculta = funcaoOcultaCampoEquipe(funcaoSel);
                          const manterFase = funcaoRequerFase12x36Expediente(funcaoSel);
                          setEditForm((prev) => ({
                            ...prev,
                            funcaoId: novoFuncaoId,
                            equipe: oculta
                              ? undefined
                              : isMot && prev.equipe === 'E'
                                ? undefined
                                : prev.equipe,
                            expediente12x36Fase: manterFase ? prev.expediente12x36Fase : undefined,
                          }));
                        } else {
                          setEditForm((prev) => ({
                            ...prev,
                            funcaoId: novoFuncaoId,
                            expediente12x36Fase: undefined,
                          }));
                        }
                      }}
                    >
                      <MenuItem value="">
                        <em>Selecione uma função</em>
                      </MenuItem>
                      {funcoesOrdenadas.map((funcao) => (
                        <MenuItem key={funcao.id} value={funcao.id}>
                          {formatNome(funcao.nome)}
                        </MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                </Grid>
                {mostrarEquipe ? (
                  <Grid size={{ xs: 12, sm: 6, md: 3 }}>
                    <FormControl
                      fullWidth
                      required={equipeObrigatoria}
                      size="small"
                      sx={formFieldSx}
                    >
                      <InputLabel id="edit-equipe-label" shrink>
                        Equipe
                      </InputLabel>
                      <Select
                        labelId="edit-equipe-label"
                        label="Equipe"
                        MenuProps={selectMenuProps}
                        value={editForm.equipe ?? ''}
                        displayEmpty
                        renderValue={(v) => {
                          if (!v) {
                            return rotuloSelectVazio(
                              equipeObrigatoria ? 'Selecione a equipe' : 'Sem equipe',
                            );
                          }
                          return formatNome(v);
                        }}
                        onChange={(event) =>
                          setEditForm((prev) => ({
                            ...prev,
                            equipe: event.target.value ? (event.target.value as Equipe) : undefined,
                          }))
                        }
                      >
                        <MenuItem value="">
                          <em>Selecione</em>
                        </MenuItem>
                        {equipesDisponiveis.map((option) => (
                          <MenuItem key={option.id} value={option.nome}>
                            {formatEquipeLabel(option.nome)}
                          </MenuItem>
                        ))}
                      </Select>
                    </FormControl>
                  </Grid>
                ) : null}
                {mostrarFase12x36 ? (
                  <Grid size={{ xs: 12, sm: 6, md: 3 }}>
                    <FormControl fullWidth required size="small" sx={formFieldSx}>
                      <InputLabel id="edit-fase-12x36-label" shrink>
                        {faseLabel}
                      </InputLabel>
                      <Select
                        labelId="edit-fase-12x36-label"
                        label={faseLabel}
                        value={editForm.expediente12x36Fase ?? ''}
                        displayEmpty
                        renderValue={(v) => {
                          if (!v) return rotuloSelectVazio('Par ou ímpar');
                          return labelFase12x36Policial(
                            v as 'PAR' | 'IMPAR',
                            funcaoSelecionada?.expedienteHorarioPreset,
                          );
                        }}
                        onChange={(e) => {
                          const v = e.target.value;
                          setEditForm((prev) => ({
                            ...prev,
                            expediente12x36Fase: v === 'PAR' || v === 'IMPAR' ? v : undefined,
                          }));
                        }}
                        MenuProps={selectMenuProps}
                      >
                        <MenuItem value="">
                          <em>Selecione</em>
                        </MenuItem>
                        <MenuItem value="PAR">
                          {labelFase12x36Policial('PAR', funcaoSelecionada?.expedienteHorarioPreset)}
                        </MenuItem>
                        <MenuItem value="IMPAR">
                          {labelFase12x36Policial('IMPAR', funcaoSelecionada?.expedienteHorarioPreset)}
                        </MenuItem>
                      </Select>
                    </FormControl>
                  </Grid>
                ) : null}
                {editForm.status !== 'COMISSIONADO' ? (
                  <Grid size={{ xs: 12, sm: 6, md: 3 }}>
                    <TextField
                      label="Data de admissão"
                      fullWidth
                      size="small"
                      type="date"
                      required
                      value={camposComplementares.dataAdmissao}
                      onChange={(e) => {
                        patchCamposComplementares({ dataAdmissao: e.target.value });
                        setCamposComplementaresErrors((prev) => ({ ...prev, dataAdmissao: null }));
                      }}
                      slotProps={{ inputLabel: { shrink: true } }}
                      error={!!camposComplementaresErrors.dataAdmissao}
                      helperText={camposComplementaresErrors.dataAdmissao}
                      sx={formFieldSx}
                    />
                  </Grid>
                ) : null}
              </Grid>
            </PolicialFormSection>

            <PolicialCamposComplementares
              values={camposComplementares}
              onChange={patchCamposComplementares}
              errors={camposComplementaresErrors}
              onClearError={(field) =>
                setCamposComplementaresErrors((prev) => ({ ...prev, [field]: null }))
              }
              status={editForm.status}
              formFieldSx={formFieldSx}
              hideDataAdmissao
              contactFields={{
                cpf: editForm.cpf,
                telefone: editForm.telefone,
                dataNascimento: editForm.dataNascimento,
                cpfError,
                telefoneError,
                onCpfChange: (value) => {
                  setEditForm((prev) => ({ ...prev, cpf: value }));
                  if (cpfError) setCpfError(null);
                },
                onTelefoneChange: (value) => {
                  setEditForm((prev) => ({ ...prev, telefone: value }));
                  if (telefoneError) setTelefoneError(null);
                },
                onDataNascimentoChange: (value) =>
                  setEditForm((prev) => ({ ...prev, dataNascimento: value })),
                onCpfBlur: () =>
                  blurValidacaoCpfTelefone(
                    editForm.cpf,
                    editForm.telefone,
                    setCpfError,
                    setTelefoneError,
                  ),
                onTelefoneBlur: () =>
                  blurValidacaoCpfTelefone(
                    editForm.cpf,
                    editForm.telefone,
                    setCpfError,
                    setTelefoneError,
                  ),
              }}
            />
          </Stack>
        </Box>
      </DialogContent>

      <DialogActions
        sx={{
          px: { xs: 2, sm: 3 },
          py: 2,
          gap: 1,
          borderTop: '1px solid',
          borderColor: 'divider',
        }}
      >
        <Button variant="outlined" onClick={onClose} disabled={submitting} sx={{ textTransform: 'none' }}>
          Cancelar
        </Button>
        <Button
          type="submit"
          form="edit-policial-form"
          variant="contained"
          disabled={submitting}
          sx={{
            minWidth: 160,
            textTransform: 'none',
            fontWeight: 600,
            bgcolor: 'var(--sentinela-blue)',
            '&:hover': { bgcolor: 'var(--sentinela-blue)', opacity: 0.9 },
          }}
        >
          {submitting ? 'Salvando...' : 'Salvar alterações'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
