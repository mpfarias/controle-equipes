import { useCallback, useEffect, useState } from 'react';
import { api } from '../../api';
import type { 
  RestricaoAfastamento, 
  TipoRestricaoAfastamento,
  MotivoAfastamentoOption, 
  CreateRestricaoAfastamentoInput 
} from '../../types';
import { formatDate } from '../../utils/dateUtils';
import type { ConfirmConfig } from '../common/ConfirmDialog';
import { 
  Chip, 
  IconButton, 
  FormControlLabel, 
  Checkbox, 
  Box, 
  Typography,
  Paper
} from '@mui/material';
import { Edit, Delete } from '@mui/icons-material';

interface GerarRestricaoAfastamentoSectionProps {
  openConfirm: (config: ConfirmConfig) => void;
}

export function GerarRestricaoAfastamentoSection({
  openConfirm,
}: GerarRestricaoAfastamentoSectionProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [restricoes, setRestricoes] = useState<RestricaoAfastamento[]>([]);
  const [tiposRestricao, setTiposRestricao] = useState<TipoRestricaoAfastamento[]>([]);
  const [motivos, setMotivos] = useState<MotivoAfastamentoOption[]>([]);
  const [editingId, setEditingId] = useState<number | null>(null);
  
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

  // Função auxiliar para buscar o nome do motivo por ID (usada apenas para exibição na tabela)

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    setSuccess(null);

    if (!form.tipoRestricaoId || form.tipoRestricaoId === 0) {
      setError('Selecione o tipo de restrição.');
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

  const handleDelete = (restricao: RestricaoAfastamento) => {
    openConfirm({
      title: 'Excluir restrição',
      message: `Deseja excluir a restrição "${restricao.tipoRestricao.nome} ${restricao.ano}"?`,
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
    } else {
      setForm((prev) => ({ ...prev, dataInicio }));
    }
  };

  // Handler para mudança do tipo de restrição
  const handleTipoRestricaoChange = (tipoRestricaoId: number) => {
    const tipoSelecionado = tiposRestricao.find((t) => t.id === tipoRestricaoId);
    
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
        <div className="form-container">
          <label>
            Tipo de restrição *
            <select
              value={form.tipoRestricaoId || ''}
              onChange={(e) => handleTipoRestricaoChange(Number(e.target.value))}
              required
              disabled={editingId !== null}
            >
              <option value="">Selecione o tipo de restrição</option>
              {tiposRestricao.map((tipo) => (
                <option key={tipo.id} value={tipo.id}>
                  {tipo.nome}
                </option>
              ))}
            </select>
          </label>

          <div className="grid two-columns">
            <label>
              Data de início *
              <input
                type="date"
                value={form.dataInicio}
                onChange={(e) => handleDataInicioChange(e.target.value)}
                required
                disabled={
                  editingId === null &&
                  tiposRestricao.find((t) => t.id === form.tipoRestricaoId)?.nome === 'Mês de Dezembro'
                }
              />
            </label>

            <label>
              Data de término *
              <input
                type="date"
                value={form.dataFim}
                onChange={(e) =>
                  setForm((prev) => ({ ...prev, dataFim: e.target.value }))
                }
                required
                min={form.dataInicio || undefined}
                disabled={
                  editingId === null &&
                  tiposRestricao.find((t) => t.id === form.tipoRestricaoId)?.nome === 'Mês de Dezembro'
                }
              />
            </label>
          </div>

          <div style={{ 
            padding: '12px', 
            backgroundColor: '#f0f9ff', 
            borderRadius: '4px',
            border: '1px solid #bae6fd',
            marginTop: '16px',
            marginBottom: '16px'
          }}>
            <p style={{ margin: 0, fontSize: '0.875rem', color: '#0369a1' }}>
              <strong> Afastamentos restritos:</strong> Férias, Abono e Dispensa recompensa serão bloqueados automaticamente no período selecionado.
            </p>
          </div>

          <Box sx={{ marginTop: '16px', marginBottom: '16px' }}>
            <button
              type="button"
              onClick={toggleMostrarMotivosAdicionais}
              style={{
                background: 'none',
                border: 'none',
                color: '#2563eb',
                cursor: 'pointer',
                textDecoration: 'underline',
                fontSize: '0.875rem',
                padding: 0,
              }}
            >
              {mostrarMotivosAdicionais ? 'Ocultar opções de afastamento' : 'Adicionar mais afastamentos'}
            </button>

            {mostrarMotivosAdicionais && motivosAdicionaisDisponiveis.length > 0 && (
              <Paper
                elevation={0}
                sx={{
                  marginTop: '12px',
                  padding: '16px',
                  backgroundColor: '#f9fafb',
                  border: '1px solid #e5e7eb',
                }}
              >
                <Typography
                  variant="body2"
                  sx={{
                    marginBottom: '16px',
                    fontWeight: 500,
                    color: '#374151',
                  }}
                >
                  Selecione os afastamentos adicionais que também serão bloqueados:
                </Typography>
                <Box
                  sx={{
                    display: 'grid',
                    gridTemplateColumns: {
                      xs: 'repeat(2, 1fr)',
                      sm: 'repeat(3, 1fr)',
                      md: 'repeat(5, 1fr)',
                    },
                    gap: '16px 24px',
                    alignItems: 'start',
                  }}
                >
                  {motivosAdicionaisDisponiveis.map((motivo) => (
                    <FormControlLabel
                      key={motivo.id}
                      control={
                        <Checkbox
                          checked={motivosAdicionaisSelecionados.includes(motivo.id)}
                          onChange={() => handleToggleMotivoAdicional(motivo.id)}
                          size="small"
                        />
                      }
                      label={motivo.nome}
                      sx={{
                        margin: 0,
                        '& .MuiFormControlLabel-label': {
                          fontSize: '0.875rem',
                        },
                      }}
                    />
                  ))}
                </Box>
              </Paper>
            )}
          </Box>

          <div className="form-actions">
            {editingId ? (
              <>
                <button
                  type="button"
                  className="secondary"
                  onClick={handleCancelEdit}
                  disabled={loading}
                >
                  Cancelar
                </button>
                <button type="submit" className="primary" disabled={loading}>
                  {loading ? 'Salvando...' : 'Atualizar restrição'}
                </button>
              </>
            ) : (
              <button type="submit" className="primary" disabled={loading}>
                {loading ? 'Salvando...' : 'Criar restrição'}
              </button>
            )}
          </div>
        </div>
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
                    <strong>{restricao.tipoRestricao.nome}</strong>
                    {restricao.tipoRestricao.descricao && (
                      <div style={{ fontSize: '0.875rem', color: '#64748b', marginTop: '4px' }}>
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
                    <IconButton
                      size="small"
                      onClick={() => handleEdit(restricao)}
                      title="Editar"
                      color="primary"
                    >
                      <Edit />
                    </IconButton>
                    <IconButton
                      size="small"
                      onClick={() => handleDelete(restricao)}
                      title="Excluir"
                      color="error"
                    >
                      <Delete />
                    </IconButton>
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
