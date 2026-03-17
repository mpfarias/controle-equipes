import { useCallback, useEffect, useState } from 'react';
import { api } from '../../api';
import type { 
  RestricaoAfastamento, 
  TipoRestricaoAfastamento,
  MotivoAfastamentoOption, 
  CreateRestricaoAfastamentoInput 
} from '../../types';
import { formatDate, formatNome } from '../../utils/dateUtils';
import type { PermissoesPorTela } from '../../utils/permissions';
import { canEdit, canExcluir, canDesativar } from '../../utils/permissions';
import type { ConfirmConfig } from '../common/ConfirmDialog';
import { 
  Chip, 
  IconButton, 
  Checkbox, 
  Box, 
  Typography,
  Paper,
  Grid,
  Collapse,
  Button,
  TextField,
  FormControl,
  Select,
  MenuItem,
} from '@mui/material';
import { Edit, Delete, Block } from '@mui/icons-material';

const formFieldSx = {
  '& .MuiOutlinedInput-root': {
    borderRadius: '8px',
    fontSize: '0.95rem',
    '& fieldset': { borderColor: 'var(--border-soft)' },
    '&:hover fieldset': { borderColor: 'var(--border-soft)' },
    '&.Mui-focused fieldset': {
      borderColor: 'var(--accent-muted)',
      boxShadow: '0 0 0 3px rgba(107, 155, 196, 0.2)',
    },
    '& input, & textarea': { padding: '10px 12px' },
  },
};

interface GerarRestricaoAfastamentoSectionProps {
  openConfirm: (config: ConfirmConfig) => void;
  permissoes?: PermissoesPorTela | null;
}

export function GerarRestricaoAfastamentoSection({
  openConfirm,
  permissoes,
}: GerarRestricaoAfastamentoSectionProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [restricoes, setRestricoes] = useState<RestricaoAfastamento[]>([]);
  const [tiposRestricao, setTiposRestricao] = useState<TipoRestricaoAfastamento[]>([]);
  const [motivos, setMotivos] = useState<MotivoAfastamentoOption[]>([]);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [mostrarCampoOutro, setMostrarCampoOutro] = useState(false);
  const [customTipoNome, setCustomTipoNome] = useState('');
  const [dataFimFocada, setDataFimFocada] = useState(false);
  
  const initialForm: CreateRestricaoAfastamentoInput = {
    tipoRestricaoId: 0,
    ano: new Date().getFullYear(), // Será calculado automaticamente a partir da dataInicio
    dataInicio: '',
    dataFim: '',
    motivosAdicionais: [],
  };
  
  const [form, setForm] = useState<CreateRestricaoAfastamentoInput>(initialForm);
  const [mostrarMotivosAdicionais, setMostrarMotivosAdicionais] = useState(false);
  const [motivosAdicionaisSelecionados, setMotivosAdicionaisSelecionados] = useState<number[]>([]);

  const carregarDados = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const [restricoesData, tiposData, motivosData] = await Promise.all([
        api.listRestricoesAfastamento(),
        api.listTiposRestricaoAfastamento(),
        api.listMotivos(),
      ]);
      setRestricoes(restricoesData);
      setTiposRestricao(tiposData);
      setMotivos(motivosData);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Não foi possível carregar os dados.',
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void carregarDados();
  }, [carregarDados]);

  // Ordenar tipos de restrição: "Outro" sempre por último
  const tiposRestricaoOrdenados = [...tiposRestricao].sort((a, b) => {
    if (a.nome === 'Outro') return 1;
    if (b.nome === 'Outro') return -1;
    return 0;
  });

  // Função auxiliar para buscar o nome do motivo por ID (usada apenas para exibição na tabela)

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    setSuccess(null);

    const tipoSelecionado = tiposRestricao.find(
      (t) => t.id === form.tipoRestricaoId,
    );

    if (!form.tipoRestricaoId || form.tipoRestricaoId === 0) {
      setError('Selecione o tipo de restrição.');
      return;
    }

    if (tipoSelecionado?.nome === 'Outro' && !customTipoNome.trim()) {
      setError('Informe o tipo de restrição quando selecionar "Outro".');
      return;
    }

    if (!form.dataInicio) {
      setError('Informe a data de início.');
      return;
    }

    if (!form.dataFim) {
      setError('Informe a data de término.');
      return;
    }

    if (new Date(form.dataInicio) > new Date(form.dataFim)) {
      setError('A data de início deve ser anterior ou igual à data de término.');
      return;
    }

    // Calcular ano automaticamente a partir da data de início
    const anoCalculado = new Date(form.dataInicio).getFullYear();
    const anoFim = new Date(form.dataFim).getFullYear();
    
    // Validar que ambas as datas são do mesmo ano
    if (anoCalculado !== anoFim) {
      setError('As datas de início e término devem ser do mesmo ano.');
      return;
    }

    try {
      setLoading(true);
      // Construir payload com motivos adicionais se houver
      const payload: CreateRestricaoAfastamentoInput = {
        tipoRestricaoId: form.tipoRestricaoId,
        ano: anoCalculado,
        dataInicio: form.dataInicio,
        dataFim: form.dataFim,
      };
      
      // Adicionar motivos adicionais se houver selecionados
      if (motivosAdicionaisSelecionados.length > 0) {
        payload.motivosAdicionais = motivosAdicionaisSelecionados;
      }
      
      if (editingId) {
        await api.updateRestricaoAfastamento(editingId, payload);
        setSuccess('Restrição atualizada com sucesso.');
      } else {
        await api.createRestricaoAfastamento(payload);
        setSuccess('Restrição criada com sucesso.');
      }
      setForm(initialForm);
      setEditingId(null);
      setMotivosAdicionaisSelecionados([]);
      setMostrarMotivosAdicionais(false);
      await carregarDados();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Não foi possível salvar a restrição.',
      );
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = (restricao: RestricaoAfastamento) => {
    setForm({
      tipoRestricaoId: restricao.tipoRestricaoId,
      ano: restricao.ano,
      dataInicio: restricao.dataInicio.split('T')[0],
      dataFim: restricao.dataFim.split('T')[0],
    });
    setEditingId(restricao.id);
    setError(null);
    setSuccess(null);
    // Scroll para o formulário
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleDisable = (restricao: RestricaoAfastamento) => {
    openConfirm({
      title: 'Desativar restrição',
      message: `Deseja desativar a restrição "${formatNome(restricao.tipoRestricao.nome)} ${restricao.ano}"?`,
      confirmLabel: 'Desativar',
      onConfirm: async () => {
        try {
          setLoading(true);
          await api.disableRestricaoAfastamento(restricao.id);
          setSuccess('Restrição desativada com sucesso.');
          await carregarDados();
        } catch (err) {
          setError(
            err instanceof Error ? err.message : 'Não foi possível desativar a restrição.',
          );
        } finally {
          setLoading(false);
        }
      },
    });
  };

  const handleDelete = (restricao: RestricaoAfastamento) => {
    openConfirm({
      title: 'Excluir restrição',
      message: `Deseja excluir a restrição "${formatNome(restricao.tipoRestricao.nome)} ${restricao.ano}"?`,
      confirmLabel: 'Excluir',
      onConfirm: async () => {
        try {
          setLoading(true);
          await api.deleteRestricaoAfastamento(restricao.id);
          setSuccess('Restrição excluída com sucesso.');
          await carregarDados();
        } catch (err) {
          setError(
            err instanceof Error ? err.message : 'Não foi possível excluir a restrição.',
          );
        } finally {
          setLoading(false);
        }
      },
    });
  };

  const handleCancelEdit = () => {
    setForm(initialForm);
    setEditingId(null);
    setMotivosAdicionaisSelecionados([]);
    setMostrarMotivosAdicionais(false);
    setError(null);
    setSuccess(null);
  };

  // Filtrar motivos: excluir os 3 padrões (Férias, Abono, Dispensa recompensa)
  const motivosAdicionaisDisponiveis = motivos.filter(
    (motivo) => !['Férias', 'Abono', 'Dispensa recompensa'].includes(motivo.nome)
  );

  const toggleMostrarMotivosAdicionais = () => {
    if (mostrarMotivosAdicionais) {
      // Ao ocultar, limpar seleções
      setMotivosAdicionaisSelecionados([]);
    }
    setMostrarMotivosAdicionais(!mostrarMotivosAdicionais);
  };

  const handleToggleMotivoAdicional = (motivoId: number) => {
    setMotivosAdicionaisSelecionados((prev) => {
      if (prev.includes(motivoId)) {
        return prev.filter((id) => id !== motivoId);
      } else {
        return [...prev, motivoId];
      }
    });
  };

  const getMotivoNome = (motivoId: number) => {
    return motivos.find((m) => m.id === motivoId)?.nome || `ID ${motivoId}`;
  };

  // Calcular ano automaticamente quando a data de início muda
  const handleDataInicioChange = (dataInicio: string) => {
    if (dataInicio) {
      const ano = new Date(dataInicio).getFullYear();
      setForm((prev) => ({ ...prev, dataInicio, ano }));
      // Resetar o estado de foco quando a data de início mudar para permitir pré-seleção novamente
      if (!form.dataFim) {
        setDataFimFocada(false);
      }
    } else {
      setForm((prev) => ({ ...prev, dataInicio }));
      setDataFimFocada(false);
    }
  };

  // Handler para mudança do tipo de restrição
  const handleTipoRestricaoChange = (tipoRestricaoId: number) => {
    const tipoSelecionado = tiposRestricao.find((t) => t.id === tipoRestricaoId);
    const isOutro = tipoSelecionado?.nome === 'Outro';
    setMostrarCampoOutro(!!isOutro);
    if (!isOutro) {
      setCustomTipoNome('');
    }
    
    // Se for "Mês de Dezembro", definir automaticamente as datas
    if (tipoSelecionado?.nome === 'Mês de Dezembro') {
      // Usar o ano do formulário ou o ano atual
      const anoAtual = form.ano || new Date().getFullYear();
      // Garantir formato YYYY-MM-DD com zero à esquerda
      const dataInicio = `${anoAtual}-12-01`;
      const dataFim = `${anoAtual}-12-31`;
      
      setForm({
        tipoRestricaoId,
        ano: anoAtual,
        dataInicio,
        dataFim,
      });
    } else {
      // Para outros tipos, apenas atualizar o tipoRestricaoId
      setForm((prev) => ({
        ...prev,
        tipoRestricaoId,
      }));
    }
  };

  const handleCustomTipoNomeChange = (value: string) => {
    // Normalizar texto: primeira letra maiúscula, restante minúscula
    let normalized = value.toLowerCase();
    if (normalized.length > 0) {
      normalized = normalized[0].toUpperCase() + normalized.slice(1);
    }
    setCustomTipoNome(normalized);
  };

  if (loading && restricoes.length === 0 && tiposRestricao.length === 0) {
    return (
      <section>
        <p className="empty-state">Carregando...</p>
      </section>
    );
  }

  return (
    <section>
      <div className="section-header">
        <h2>Gerar restrição de afastamento</h2>
        <p>
          Crie restrições para impedir o cadastro de Férias, Abono ou Dispensa recompensa em períodos específicos.
        </p>
      </div>

      {error && (
        <div className="feedback error" role="alert">
          {error}
          <button
            type="button"
            className="feedback-close"
            onClick={() => setError(null)}
            aria-label="Fechar"
          >
            ×
          </button>
        </div>
      )}

      {success && (
        <div className="feedback success" role="alert">
          {success}
          <button
            type="button"
            className="feedback-close"
            onClick={() => setSuccess(null)}
            aria-label="Fechar"
          >
            ×
          </button>
        </div>
      )}

      <form onSubmit={handleSubmit}>
        <Box sx={{ display: 'grid', gap: 2 }}>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.75 }}>
            <Typography component="label" htmlFor="tipo-restricao-select" sx={{ fontSize: '0.9rem', color: 'text.secondary' }}>
              Tipo de restrição *
            </Typography>
            <FormControl fullWidth required size="small" variant="outlined" disabled={editingId !== null} sx={formFieldSx}>
              <Select
                id="tipo-restricao-select"
                value={!form.tipoRestricaoId ? '' : form.tipoRestricaoId}
                displayEmpty
                renderValue={(v) => {
                  if (!v) return 'Selecione o tipo de restrição';
                  const t = tiposRestricaoOrdenados.find((tipo) => tipo.id === v);
                  return t ? formatNome(t.nome) : 'Selecione o tipo de restrição';
                }}
                onChange={(e) => {
                  const val = e.target.value;
                  handleTipoRestricaoChange(typeof val === 'string' && val === '' ? 0 : Number(val));
                }}
                MenuProps={{ sx: { zIndex: 1500 } }}
              >
                <MenuItem value="">
                  <em>Selecione o tipo de restrição</em>
                </MenuItem>
                {tiposRestricaoOrdenados.map((tipo) => (
                  <MenuItem key={tipo.id} value={tipo.id}>
                    {formatNome(tipo.nome)}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </Box>

          {mostrarCampoOutro && (
            <TextField
              label="Especifique o tipo de restrição"
              value={customTipoNome}
              onChange={(e) => handleCustomTipoNomeChange(e.target.value)}
              required
              fullWidth
              size="small"
              variant="outlined"
              placeholder="Digite o nome do tipo de restrição"
              helperText="Informe o tipo de restrição personalizado"
              sx={formFieldSx}
            />
          )}

          <Box sx={{ display: 'grid', gap: 2, gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' } }}>
            <TextField
              label="Data de início *"
              type="date"
              value={form.dataInicio}
              onChange={(e) => handleDataInicioChange(e.target.value)}
              required
              fullWidth
              size="small"
              variant="outlined"
              InputLabelProps={{ shrink: true }}
              disabled={
                editingId === null &&
                tiposRestricao.find((t) => t.id === form.tipoRestricaoId)?.nome === 'Mês de Dezembro'
              }
              sx={formFieldSx}
            />
            <TextField
              label="Data de término *"
              type="date"
              value={form.dataFim}
              onChange={(e) => {
                setForm((prev) => ({ ...prev, dataFim: e.target.value }));
                setDataFimFocada(true);
              }}
              required
              fullWidth
              size="small"
              variant="outlined"
              InputLabelProps={{ shrink: true }}
              inputProps={{ min: form.dataInicio || undefined }}
              disabled={
                editingId === null &&
                tiposRestricao.find((t) => t.id === form.tipoRestricaoId)?.nome === 'Mês de Dezembro'
              }
              onFocus={(e) => {
                if (!form.dataFim && form.dataInicio && !dataFimFocada) {
                  (e.target as HTMLInputElement).value = form.dataInicio;
                  setForm((prev) => ({ ...prev, dataFim: prev.dataInicio }));
                  setDataFimFocada(true);
                }
              }}
              sx={formFieldSx}
            />
          </Box>

          <Box sx={{
            p: 1.5,
            backgroundColor: 'var(--alert-info-bg)',
            borderRadius: '4px',
            border: '1px solid var(--border-soft)',
          }}>
            <Typography sx={{ margin: 0, fontSize: '0.875rem', color: 'var(--alert-info-text)' }}>
              <strong>Afastamentos restritos:</strong> Férias, Abono e Dispensa recompensa serão bloqueados automaticamente no período selecionado.
            </Typography>
          </Box>

          <Box sx={{ mt: 2, mb: 2 }}>
            <Button
              variant="outlined"
              size="small"
              onClick={toggleMostrarMotivosAdicionais}
              sx={{
                whiteSpace: 'nowrap',
                textTransform: 'none',
                minWidth: 'auto',
              }}
            >
              {mostrarMotivosAdicionais ? 'Ocultar opções de afastamento' : 'Adicionar mais afastamentos'}
            </Button>

            <Collapse in={mostrarMotivosAdicionais && motivosAdicionaisDisponiveis.length > 0}>
              <Paper
                elevation={2}
                sx={{
                  p: 3,
                  mb: 2,
                  mt: 2,
                  backgroundColor: 'var(--card-bg)',
                }}
              >
                <Grid container spacing={3} direction="column">
                  <Grid size={{ xs: 12, sm: 12, md: 12, lg: 12 }}>
                    <Typography variant="h6" sx={{ mb: 2, fontWeight: 600, color: 'text.primary' }}>
                      Selecione os afastamentos adicionais que também serão bloqueados
                    </Typography>
                    <Box
                      sx={{
                        display: 'grid',
                        gridTemplateColumns: `repeat(${Math.ceil(motivosAdicionaisDisponiveis.length / 2)}, 1fr)`,
                        gap: '8px 16px',
                        mb: 2,
                      }}
                    >
                      {motivosAdicionaisDisponiveis.map((motivo) => (
                        <Box key={motivo.id} sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                          <Checkbox
                            checked={motivosAdicionaisSelecionados.includes(motivo.id)}
                            onChange={() => handleToggleMotivoAdicional(motivo.id)}
                            size="small"
                            sx={{
                              '& .MuiSvgIcon-root': {
                                fontSize: '1.25rem',
                              },
                            }}
                          />
                          <Typography variant="body2" sx={{ fontSize: '0.875rem' }}>
                            {formatNome(motivo.nome)}
                          </Typography>
                        </Box>
                      ))}
                    </Box>
                    <Box sx={{ display: 'flex', gap: 1, mt: 1 }}>
                      <Button
                        variant="outlined"
                        size="small"
                        onClick={() => setMotivosAdicionaisSelecionados(motivosAdicionaisDisponiveis.map((m) => m.id))}
                        sx={{
                          textTransform: 'none',
                          fontSize: '0.75rem',
                        }}
                      >
                        Selecionar Todos
                      </Button>
                      <Button
                        variant="outlined"
                        size="small"
                        onClick={() => setMotivosAdicionaisSelecionados([])}
                        sx={{
                          textTransform: 'none',
                          fontSize: '0.75rem',
                        }}
                      >
                        Limpar
                      </Button>
                      {motivosAdicionaisSelecionados.length > 0 && (
                        <Typography
                          variant="caption"
                          sx={{
                            ml: 'auto',
                            alignSelf: 'center',
                            color: 'text.secondary',
                            fontWeight: 500,
                          }}
                        >
                          {motivosAdicionaisSelecionados.length} selecionado(s)
                        </Typography>
                      )}
                    </Box>
                  </Grid>
                </Grid>
              </Paper>
            </Collapse>
          </Box>

          <Box sx={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 1.5 }}>
            {editingId ? (
              <>
                <Button
                  type="button"
                  variant="outlined"
                  onClick={handleCancelEdit}
                  disabled={loading}
                  sx={{ textTransform: 'none' }}
                >
                  Cancelar
                </Button>
                <Button
                  type="submit"
                  variant="contained"
                  disabled={loading}
                  sx={{
                    textTransform: 'none',
                    bgcolor: 'var(--sentinela-blue)',
                    '&:hover': { bgcolor: 'var(--sentinela-blue)', opacity: 0.9 },
                  }}
                >
                  {loading ? 'Salvando...' : 'Atualizar restrição'}
                </Button>
              </>
            ) : (
              <Button
                type="submit"
                variant="contained"
                disabled={loading}
                sx={{
                  textTransform: 'none',
                  bgcolor: 'var(--sentinela-blue)',
                  '&:hover': { bgcolor: 'var(--sentinela-blue)', opacity: 0.9 },
                }}
              >
                {loading ? 'Salvando...' : 'Criar restrição'}
              </Button>
            )}
          </Box>
        </Box>
      </form>

      <div style={{ marginTop: '2rem' }}>
        <div className="section-header">
          <h3>Restrições cadastradas</h3>
        </div>

        {restricoes.length === 0 ? (
          <p className="empty-state">Nenhuma restrição cadastrada.</p>
        ) : (
          <table className="table">
            <thead>
              <tr>
                <th>Tipo</th>
                <th>Ano</th>
                <th>Período</th>
                <th>Motivos restritos</th>
                <th>Ações</th>
              </tr>
            </thead>
            <tbody>
              {restricoes.map((restricao) => (
                <tr key={restricao.id}>
                  <td>
                    <strong>{formatNome(restricao.tipoRestricao.nome)}</strong>
                    {restricao.tipoRestricao.descricao && (
                      <div style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', marginTop: '4px' }}>
                        {restricao.tipoRestricao.descricao}
                      </div>
                    )}
                  </td>
                  <td>{restricao.ano}</td>
                  <td>
                    {formatDate(restricao.dataInicio)} a {formatDate(restricao.dataFim)}
                  </td>
                  <td>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
                      {restricao.motivosRestritos.map((motivoId) => (
                        <Chip
                          key={motivoId}
                          label={getMotivoNome(motivoId)}
                          size="small"
                          color="primary"
                          variant="outlined"
                        />
                      ))}
                    </div>
                  </td>
                  <td className="actions">
                    {canEdit(permissoes, 'restricao-afastamento') && (
                      <IconButton
                        size="small"
                        onClick={() => handleEdit(restricao)}
                        title="Editar"
                        color="primary"
                      >
                        <Edit />
                      </IconButton>
                    )}
                    {canDesativar(permissoes, 'restricao-afastamento') && (
                      <IconButton
                        size="small"
                        onClick={() => handleDisable(restricao)}
                        title="Desativar"
                        color="warning"
                        disabled={restricao.ativo === false}
                      >
                        <Block />
                      </IconButton>
                    )}
                    {canExcluir(permissoes, 'restricao-afastamento') && (
                      <IconButton
                        size="small"
                        onClick={() => handleDelete(restricao)}
                        title="Excluir"
                        color="error"
                      >
                        <Delete />
                      </IconButton>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </section>
  );
}
