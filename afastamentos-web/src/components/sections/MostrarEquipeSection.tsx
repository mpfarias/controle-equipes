import { useCallback, useEffect, useMemo, useState } from 'react';
import { api } from '../../api';
import type { Colaborador, Equipe, FuncaoOption, PolicialStatus, Usuario } from '../../types';
import { EQUIPE_FONETICA, EQUIPE_OPTIONS, POLICIAL_STATUS_OPTIONS } from '../../constants';
import { formatDate } from '../../utils/dateUtils';
import type { ConfirmConfig } from '../common/ConfirmDialog';

interface MostrarEquipeSectionProps {
  currentUser: Usuario;
  openConfirm: (config: ConfirmConfig) => void;
  onChanged?: () => void;
  refreshKey?: number;
}

export function MostrarEquipeSection({
  currentUser,
  openConfirm,
  onChanged,
  refreshKey,
}: MostrarEquipeSectionProps) {
  const [colaboradores, setColaboradores] = useState<Colaborador[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [editingColaborador, setEditingColaborador] = useState<Colaborador | null>(
    null,
  );
  const [editForm, setEditForm] = useState({
    nome: '',
    matricula: '',
    status: 'ATIVO' as PolicialStatus,
    equipe: 'A' as Equipe,
    funcaoId: undefined as number | undefined,
  });
  const [funcoes, setFuncoes] = useState<FuncaoOption[]>([]);
  const [editSubmitting, setEditSubmitting] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);
 
  const carregarColaboradores = useCallback(async () => {
    try {
      setLoading(true);
      const data = await api.listColaboradores();
      setColaboradores(data);
      setError(null);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Não foi possível carregar os policiais.',
      );
    } finally {
      setLoading(false);
    }
  }, []);

  const carregarFuncoes = useCallback(async () => {
    try {
      const data = await api.listFuncoes();
      setFuncoes(data);
    } catch (err) {
      console.error('Erro ao carregar funções:', err);
    }
  }, []);

  // Ordenar funções alfabeticamente
  const funcoesOrdenadas = useMemo(() => {
    return [...funcoes].sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR', { sensitivity: 'base' }));
  }, [funcoes]);
 
  useEffect(() => {
    void carregarColaboradores();
    void carregarFuncoes();
  }, [carregarColaboradores, carregarFuncoes, refreshKey]);

  const openEditModal = (colaborador: Colaborador) => {
    setEditingColaborador(colaborador);
    // O Prisma retorna funcaoId diretamente quando usa include
    // Precisamos tratar null explicitamente, pois null ?? undefined retorna undefined
    const funcaoId = colaborador.funcaoId !== null && colaborador.funcaoId !== undefined
      ? colaborador.funcaoId
      : colaborador.funcao?.id ?? undefined;
    setEditForm({
      nome: colaborador.nome,
      matricula: colaborador.matricula,
      status: colaborador.status,
      equipe: colaborador.equipe,
      funcaoId: funcaoId,
    });
    setEditError(null);
  };

  const closeEditModal = () => {
    setEditingColaborador(null);
    setEditError(null);
  };

  const handleEditSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!editingColaborador || editSubmitting) {
      return;
    }

    const nome = editForm.nome.trim();
    const matricula = editForm.matricula.trim();

    if (!nome || !matricula) {
      setEditError('Informe nome e matrícula.');
      return;
    }

    const payload = {
      nome,
      matricula,
      status: editForm.status,
      equipe: editForm.equipe,
      funcaoId: editForm.funcaoId,
    };

    openConfirm({
      title: 'Confirmar edição',
      message: `Deseja salvar as alterações para ${editingColaborador.nome}?`,
      confirmLabel: 'Salvar',
      onConfirm: async () => {
        try {
          setEditSubmitting(true);
          setEditError(null);
          await api.updateColaborador(editingColaborador.id, payload);
          setSuccess('Policial atualizado com sucesso.');
          closeEditModal();
          await carregarColaboradores();
          onChanged?.();
        } catch (err) {
          setEditError(
            err instanceof Error
              ? err.message
              : 'Não foi possível atualizar o policial.',
          );
        } finally {
          setEditSubmitting(false);
        }
      },
    });
  };

  const handleLink = (colaborador: Colaborador) => {
    openConfirm({
      title: 'Vincular policial',
      message: `Deseja vincular ${colaborador.nome} (matrícula ${colaborador.matricula})?`,
      confirmLabel: 'Vincular',
      onConfirm: async () => {
        setSuccess('Policial vinculado.');
      },
    });
  };

  const handleDelete = (colaborador: Colaborador) => {
    openConfirm({
      title: 'Desativar policial',
      message: `Deseja desativar ${colaborador.nome} (matrícula ${colaborador.matricula})?`,
      confirmLabel: 'Desativar',
      onConfirm: async () => {
        try {
          await api.removeColaborador(colaborador.id);
          setSuccess('Policial desativado.');
          await carregarColaboradores();
          onChanged?.();
        } catch (err) {
          setError(
            err instanceof Error
              ? err.message
              : 'Não foi possível desativar o policial.',
          );
        }
      },
    });
  };

  const normalizedSearch = searchTerm.trim().toUpperCase();
  const equipeAtual = currentUser.equipe;

  // Verificar se o usuário é ADMINISTRADOR ou SAD (podem ver todos e fazer ações)
  const usuarioPodeVerTodosEAcoes = useMemo(() => {
    const nivelNome = currentUser.nivel?.nome;
    return nivelNome === 'ADMINISTRADOR' || nivelNome === 'SAD' || currentUser.isAdmin === true;
  }, [currentUser]);

  // Verificar se o usuário é COMANDO (pode ver todos, mas apenas visualizar)
  const usuarioPodeVerTodosSomenteLeitura = useMemo(() => {
    const nivelNome = currentUser.nivel?.nome;
    return nivelNome === 'COMANDO';
  }, [currentUser]);

  // Verificar se o usuário pode ver todos (ADMINISTRADOR, SAD ou COMANDO)
  const usuarioPodeVerTodos = useMemo(() => {
    return usuarioPodeVerTodosEAcoes || usuarioPodeVerTodosSomenteLeitura;
  }, [usuarioPodeVerTodosEAcoes, usuarioPodeVerTodosSomenteLeitura]);

  const colaboradoresDaEquipe = useMemo(
    () => {
      // Se for ADMINISTRADOR, SAD ou COMANDO, retornar todos os colaboradores
      if (usuarioPodeVerTodos) {
        return colaboradores.filter(
          (colaborador) => colaborador.status !== 'DESATIVADO',
        );
      }
      // Caso contrário (OPERAÇÕES), filtrar apenas pela equipe do usuário
      return colaboradores.filter(
        (colaborador) =>
          colaborador.equipe === equipeAtual &&
          colaborador.status !== 'DESATIVADO',
      );
    },
    [colaboradores, equipeAtual, usuarioPodeVerTodos],
  );

  const filteredColaboradores = useMemo(() => {
    if (!normalizedSearch) {
      return colaboradoresDaEquipe;
    }
    return colaboradoresDaEquipe.filter((colaborador) =>
      colaborador.nome.includes(normalizedSearch),
    );
  }, [colaboradoresDaEquipe, normalizedSearch]);

  return (
    <section>
      <div>
        <h2>
          Mostrar Equipe
        </h2>
        <p>Visualize os policiais cadastrados e execute ações rápidas.</p>
      </div>

      {error && <div className="feedback error">{error}</div>}
      {success && (
        <div className="feedback success">
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

      <div className="list-controls">
        <input
          className="search-input"
          value={searchTerm}
          onChange={(event) => setSearchTerm(event.target.value.toUpperCase())}
          placeholder="Pesquisar por nome"
        />
        <button className="ghost" type="button" onClick={() => void carregarColaboradores()}>
          Atualizar lista
        </button>
      </div>

      {loading ? (
        <p className="empty-state">Carregando policiais...</p>
      ) : filteredColaboradores.length === 0 ? (
        <p className="empty-state">Nenhum policial cadastrado.</p>
      ) : (
        <table className="table">
          <thead>
            <tr>
              <th>Policial</th>
              <th>Matrícula</th>
              <th>Status</th>
              <th>Cadastro</th>
              <th>Ações</th>
            </tr>
          </thead>
          <tbody>
            {filteredColaboradores.map((colaborador) => (
              <tr key={colaborador.id}>
                <td>{colaborador.nome}</td>
                <td>{colaborador.matricula}</td>
                <td>
                  <span className="badge badge-muted">
                    {
                      POLICIAL_STATUS_OPTIONS.find(
                        (option) => option.value === colaborador.status,
                      )?.label ?? colaborador.status
                    }
                  </span>
                </td>
                <td>{formatDate(colaborador.createdAt)}</td>
                <td className="actions">
                  {usuarioPodeVerTodosEAcoes ? (
                    <>
                      <button
                        className="action-button"
                        type="button"
                        onClick={() => handleLink(colaborador)}
                      >
                        Vincular
                      </button>
                      <button
                        className="secondary"
                        type="button"
                        onClick={() => openEditModal(colaborador)}
                      >
                        Editar
                      </button>
                      <button
                        className="danger"
                        type="button"
                        onClick={() => handleDelete(colaborador)}
                      >
                        Desativar
                      </button>
                    </>
                  ) : (
                    <span style={{ color: '#64748b', fontStyle: 'italic' }}>
                      Somente visualização
                    </span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {editingColaborador && (
        <div className="modal-backdrop" role="dialog" aria-modal="true">
          <div className="modal">
            <h3>Editar policial</h3>
            {editError && <div className="feedback error">{editError}</div>}
            <form onSubmit={handleEditSubmit}>
              <label>
                Nome
                <input
                  value={editForm.nome}
                  onChange={(event) =>
                    setEditForm((prev) => ({
                      ...prev,
                      nome: event.target.value.toUpperCase(),
                    }))
                  }
                  required
                />
              </label>
              <label>
                Matrícula
                <input
                  value={editForm.matricula}
                  onChange={(event) =>
                  setEditForm((prev) => ({
                    ...prev,
                    matricula: event.target.value
                      .replace(/[^0-9xX]/g, '')
                      .toUpperCase(),
                  }))
                  }
                  required
                />
              </label>
              <div className="grid two-columns">
                <label>
                  Status
                  <select
                    value={editForm.status}
                    onChange={(event) =>
                      setEditForm((prev) => ({
                        ...prev,
                        status: event.target.value as PolicialStatus,
                      }))
                    }
                    required
                  >
                    {POLICIAL_STATUS_OPTIONS.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </label>
                {(() => {
                  // Funções que não devem mostrar equipe: EXPEDIENTE ADM, CMT UPM, SUBCMT UPM
                  const funcaoNome = editingColaborador.funcao?.nome?.toUpperCase() || '';
                  const naoMostraEquipe = 
                    funcaoNome.includes('EXPEDIENTE') || 
                    funcaoNome.includes('CMT UPM') || 
                    funcaoNome.includes('SUBCMT UPM');
                  
                  if (naoMostraEquipe) {
                    return null;
                  }
                  
                  return (
                    <label>
                      Equipe
                      <select
                        value={editForm.equipe}
                        onChange={(event) =>
                          setEditForm((prev) => ({
                            ...prev,
                            equipe: event.target.value as Equipe,
                          }))
                        }
                        required
                      >
                        {EQUIPE_OPTIONS.map((option) => (
                          <option key={option.value} value={option.value}>
                            {EQUIPE_FONETICA[option.value]} ({option.value})
                          </option>
                        ))}
                      </select>
                    </label>
                  );
                })()}
              </div>
              <label>
                Função
                <select
                  value={editForm.funcaoId ? String(editForm.funcaoId) : ''}
                  onChange={(event) =>
                    setEditForm((prev) => ({
                      ...prev,
                      funcaoId: event.target.value ? Number(event.target.value) : undefined,
                    }))
                  }
                >
                  <option value="">Selecione uma função</option>
                  {funcoesOrdenadas.map((funcao) => (
                    <option key={funcao.id} value={funcao.id}>
                      {funcao.nome}
                    </option>
                  ))}
                </select>
              </label>
              <div className="modal-actions">
                <button
                  type="button"
                  className="secondary"
                  onClick={closeEditModal}
                  disabled={editSubmitting}
                >
                  Cancelar
                </button>
                <button className="primary" type="submit" disabled={editSubmitting}>
                  {editSubmitting ? 'Salvando...' : 'Salvar alterações'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </section>
  );
}
