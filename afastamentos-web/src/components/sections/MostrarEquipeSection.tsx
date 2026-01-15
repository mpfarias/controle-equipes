import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { api } from '../../api';
import type { Afastamento, Colaborador, Equipe, FuncaoOption, PolicialStatus, Usuario } from '../../types';
import { EQUIPE_FONETICA, EQUIPE_OPTIONS, POLICIAL_STATUS_OPTIONS, STATUS_LABEL } from '../../constants';
import type { ConfirmConfig } from '../common/ConfirmDialog';
import { ImageCropper } from '../common/ImageCropper';
import { Card, CardMedia, CardActions, IconButton, Box, Typography, Paper, Divider, Chip } from '@mui/material';
import { PhotoCamera, Delete, AddPhotoAlternate } from '@mui/icons-material';
import { formatPeriodo } from '../../utils/dateUtils';

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
  const [viewingColaborador, setViewingColaborador] = useState<Colaborador | null>(
    null,
  );
  const [viewingAfastamentos, setViewingAfastamentos] = useState<Afastamento[]>([]);
  const [loadingAfastamentos, setLoadingAfastamentos] = useState(false);
  const [editForm, setEditForm] = useState({
    nome: '',
    matricula: '',
    status: 'ATIVO' as PolicialStatus,
    equipe: 'A' as Equipe,
    funcaoId: undefined as number | undefined,
    fotoUrl: undefined as string | null | undefined,
  });
  const [funcoes, setFuncoes] = useState<FuncaoOption[]>([]);
  const [editSubmitting, setEditSubmitting] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);
  const [showImageCropper, setShowImageCropper] = useState(false);
  const [imageForCrop, setImageForCrop] = useState<string>('');
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [filtrosAberto, setFiltrosAberto] = useState(false);
  const [filtroEquipe, setFiltroEquipe] = useState<Equipe | ''>('');
  const [filtroStatus, setFiltroStatus] = useState<PolicialStatus | ''>('');
  const [filtroFuncao, setFiltroFuncao] = useState<number | ''>('');
  const [ordenacao, setOrdenacao] = useState<{
    campo: 'nome' | 'matricula' | 'equipe';
    direcao: 'asc' | 'desc';
  } | null>(null);
  const [paginaAtual, setPaginaAtual] = useState(1);
  const [itensPorPagina, setItensPorPagina] = useState(20);
 
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
      equipe: colaborador.equipe ?? 'A' as Equipe,
      funcaoId: funcaoId,
      fotoUrl: colaborador.fotoUrl ?? null,
    });
    setEditError(null);
    setShowImageCropper(false);
  };

  const closeEditModal = () => {
    setEditingColaborador(null);
    setEditError(null);
    setShowImageCropper(false);
    setImageForCrop('');
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      // Validar se é uma imagem
      if (!file.type.startsWith('image/')) {
        setEditError('Por favor, selecione uma imagem válida.');
        return;
      }

      // Validar tamanho (máximo 5MB)
      if (file.size > 5 * 1024 * 1024) {
        setEditError('A imagem deve ter no máximo 5MB.');
        return;
      }

      const reader = new FileReader();
      reader.onload = (e) => {
        const imageSrc = e.target?.result as string;
        setImageForCrop(imageSrc);
        setShowImageCropper(true);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleCropComplete = (croppedImageUrl: string) => {
    setEditForm((prev) => ({
      ...prev,
      fotoUrl: croppedImageUrl,
    }));
    setShowImageCropper(false);
    setImageForCrop('');
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
      fotoUrl: editForm.fotoUrl,
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
    let resultado = colaboradoresDaEquipe;

    // Aplicar filtro de busca por nome, matrícula ou função
    if (normalizedSearch) {
      resultado = resultado.filter((colaborador) => {
        // Buscar por nome
        if (colaborador.nome.includes(normalizedSearch)) {
          return true;
        }
        // Buscar por matrícula
        if (colaborador.matricula.toUpperCase().includes(normalizedSearch)) {
          return true;
        }
        // Buscar por função
        if (colaborador.funcao?.nome && colaborador.funcao.nome.toUpperCase().includes(normalizedSearch)) {
          return true;
        }
        return false;
      });
    }

    // Aplicar filtro por equipe
    if (filtroEquipe) {
      resultado = resultado.filter((colaborador) => colaborador.equipe === filtroEquipe);
    }

    // Aplicar filtro por status/condição
    if (filtroStatus) {
      resultado = resultado.filter((colaborador) => colaborador.status === filtroStatus);
    }

    // Aplicar filtro por função
    if (filtroFuncao) {
      resultado = resultado.filter((colaborador) => colaborador.funcaoId === filtroFuncao);
    }

    // Aplicar ordenação
    if (ordenacao) {
      resultado = [...resultado].sort((a, b) => {
        let valorA: string | number;
        let valorB: string | number;

        switch (ordenacao.campo) {
          case 'nome':
            valorA = a.nome.toUpperCase();
            valorB = b.nome.toUpperCase();
            break;
          case 'matricula':
            valorA = a.matricula.toUpperCase();
            valorB = b.matricula.toUpperCase();
            break;
          case 'equipe':
            valorA = a.equipe || '';
            valorB = b.equipe || '';
            break;
          default:
            return 0;
        }

        const comparacao = valorA < valorB ? -1 : valorA > valorB ? 1 : 0;
        return ordenacao.direcao === 'asc' ? comparacao : -comparacao;
      });
    }

    return resultado;
  }, [colaboradoresDaEquipe, normalizedSearch, filtroEquipe, filtroStatus, filtroFuncao, ordenacao]);

  // Calcular itens paginados
  const colaboradoresPaginados = useMemo(() => {
    const inicio = (paginaAtual - 1) * itensPorPagina;
    const fim = inicio + itensPorPagina;
    return filteredColaboradores.slice(inicio, fim);
  }, [filteredColaboradores, paginaAtual, itensPorPagina]);

  // Calcular total de páginas
  const totalPaginas = useMemo(() => {
    return Math.ceil(filteredColaboradores.length / itensPorPagina);
  }, [filteredColaboradores.length, itensPorPagina]);

  // Resetar para página 1 quando filtros ou busca mudarem
  useEffect(() => {
    setPaginaAtual(1);
  }, [normalizedSearch, filtroEquipe, filtroStatus, filtroFuncao]);

  const handleOrdenacao = (campo: 'nome' | 'matricula' | 'equipe') => {
    setOrdenacao((prev) => {
      if (prev?.campo === campo) {
        // Se já está ordenando por esse campo, inverter a direção
        return { campo, direcao: prev.direcao === 'asc' ? 'desc' : 'asc' };
      }
      // Se não, começar ordenando ascendente
      return { campo, direcao: 'asc' };
    });
  };

  return (
    <section>
      <div>
        <h2>
          Mostrar Efetivo do COPOM
        </h2>
        <p>Visualize os policiais cadastrados e execute ações rápidas.</p>
      </div>

      {error && (
        <div className="feedback error">
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
          placeholder="Pesquisar por nome, matrícula ou função"
        />
        <button
          className="ghost"
          type="button"
          onClick={() => setFiltrosAberto(!filtrosAberto)}
        >
          {filtrosAberto ? 'Ocultar filtros' : 'Mostrar filtros'}
        </button>
        <button className="ghost" type="button" onClick={() => void carregarColaboradores()}>
          Atualizar lista
        </button>
        <label style={{ display: 'flex', alignItems: 'center', gap: '8px', marginLeft: 'auto' }}>
          <span style={{ fontSize: '0.9rem', color: '#64748b' }}>Itens por página:</span>
          <select
            value={itensPorPagina}
            onChange={(event) => {
              setItensPorPagina(Number(event.target.value));
              setPaginaAtual(1);
            }}
            style={{ padding: '4px 8px', borderRadius: '4px', border: '1px solid #d1d5db' }}
          >
            <option value={10}>10</option>
            <option value={20}>20</option>
            <option value={30}>30</option>
            <option value={50}>50</option>
            <option value={100}>100</option>
          </select>
        </label>
      </div>

      {filtrosAberto && (
        <div style={{ marginBottom: '16px', padding: '16px', backgroundColor: '#f8f9fa', borderRadius: '8px', border: '1px solid #e9ecef' }}>
          <div className="grid two-columns" style={{ gap: '16px' }}>
            <label>
              Por equipe
              <select
                value={filtroEquipe}
                onChange={(event) => setFiltroEquipe(event.target.value ? (event.target.value as Equipe) : '')}
                style={{ width: '100%', marginTop: '8px' }}
              >
                <option value="">Todas as equipes</option>
                {EQUIPE_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {EQUIPE_FONETICA[option.value]} ({option.value})
                  </option>
                ))}
              </select>
            </label>
            <label>
              Por condição
              <select
                value={filtroStatus}
                onChange={(event) => setFiltroStatus(event.target.value ? (event.target.value as PolicialStatus) : '')}
                style={{ width: '100%', marginTop: '8px' }}
              >
                <option value="">Todas as condições</option>
                {POLICIAL_STATUS_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Por função
              <select
                value={filtroFuncao}
                onChange={(event) => setFiltroFuncao(event.target.value ? Number(event.target.value) : '')}
                style={{ width: '100%', marginTop: '8px' }}
              >
                <option value="">Todas as funções</option>
                {funcoesOrdenadas.map((funcao) => (
                  <option key={funcao.id} value={funcao.id}>
                    {funcao.nome}
                  </option>
                ))}
              </select>
            </label>
          </div>
          {(filtroEquipe || filtroStatus || filtroFuncao) && (
            <button
              type="button"
              className="ghost"
              onClick={() => {
                setFiltroEquipe('');
                setFiltroStatus('');
                setFiltroFuncao('');
              }}
              style={{ marginTop: '12px' }}
            >
              Limpar filtros
            </button>
          )}
        </div>
      )}

      {loading ? (
        <p className="empty-state">Carregando policiais...</p>
      ) : filteredColaboradores.length === 0 ? (
        <p className="empty-state">Nenhum policial cadastrado.</p>
      ) : (
        <>
          <table className="table">
            <thead>
              <tr>
                <th>
                  <button
                    type="button"
                    onClick={() => handleOrdenacao('nome')}
                    style={{
                      background: 'none',
                      border: 'none',
                      padding: 0,
                      font: 'inherit',
                      cursor: 'pointer',
                      textAlign: 'left',
                      width: '100%',
                      fontWeight: ordenacao?.campo === 'nome' ? 'bold' : 'normal',
                    }}
                  >
                    Policial
                    {ordenacao?.campo === 'nome' && (
                      <span style={{ marginLeft: '4px' }}>
                        {ordenacao.direcao === 'asc' ? '↑' : '↓'}
                      </span>
                    )}
                  </button>
                </th>
                <th>
                  <button
                    type="button"
                    onClick={() => handleOrdenacao('matricula')}
                    style={{
                      background: 'none',
                      border: 'none',
                      padding: 0,
                      font: 'inherit',
                      cursor: 'pointer',
                      textAlign: 'left',
                      width: '100%',
                      fontWeight: ordenacao?.campo === 'matricula' ? 'bold' : 'normal',
                    }}
                  >
                    Matrícula
                    {ordenacao?.campo === 'matricula' && (
                      <span style={{ marginLeft: '4px' }}>
                        {ordenacao.direcao === 'asc' ? '↑' : '↓'}
                      </span>
                    )}
                  </button>
                </th>
                <th>Status</th>
                <th>Função</th>
                <th>
                  <button
                    type="button"
                    onClick={() => handleOrdenacao('equipe')}
                    style={{
                      background: 'none',
                      border: 'none',
                      padding: 0,
                      font: 'inherit',
                      cursor: 'pointer',
                      textAlign: 'left',
                      width: '100%',
                      fontWeight: ordenacao?.campo === 'equipe' ? 'bold' : 'normal',
                    }}
                  >
                    Equipe
                    {ordenacao?.campo === 'equipe' && (
                      <span style={{ marginLeft: '4px' }}>
                        {ordenacao.direcao === 'asc' ? '↑' : '↓'}
                      </span>
                    )}
                  </button>
                </th>
                <th>Ações</th>
              </tr>
            </thead>
            <tbody>
              {colaboradoresPaginados.map((colaborador) => (
              <tr key={colaborador.id}>
                <td>
                  <a
                    href="#"
                    onClick={async (e) => {
                      e.preventDefault();
                      setViewingColaborador(colaborador);
                      // Carregar afastamentos do colaborador
                      try {
                        setLoadingAfastamentos(true);
                        const afastamentosData = await api.listAfastamentos(colaborador.id);
                        setViewingAfastamentos(afastamentosData);
                      } catch (err) {
                        console.error('Erro ao carregar afastamentos:', err);
                        setViewingAfastamentos([]);
                      } finally {
                        setLoadingAfastamentos(false);
                      }
                    }}
                    style={{
                      color: '#3b82f6',
                      textDecoration: 'none',
                      cursor: 'pointer',
                      fontWeight: 500,
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.textDecoration = 'underline';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.textDecoration = 'none';
                    }}
                    title="Clique para ver detalhes"
                  >
                    {colaborador.nome}
                  </a>
                </td>
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
                <td>
                  {colaborador.funcao?.nome ? (
                    colaborador.funcao.nome
                  ) : (
                    <span style={{ color: '#64748b', fontStyle: 'italic' }}>-</span>
                  )}
                </td>
                <td>
                  {colaborador.equipe && colaborador.equipe !== 'SEM_EQUIPE' ? (
                    <>
                      {EQUIPE_FONETICA[colaborador.equipe]} ({colaborador.equipe})
                    </>
                  ) : (
                    <span style={{ color: '#64748b', fontStyle: 'italic' }}>-</span>
                  )}
                </td>
                <td className="actions">
                  {usuarioPodeVerTodosEAcoes ? (
                    <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                      <button
                        type="button"
                        onClick={() => openEditModal(colaborador)}
                        title="Editar"
                        style={{
                          background: 'none',
                          border: 'none',
                          cursor: 'pointer',
                          fontSize: '18px',
                          padding: '4px 8px',
                          color: '#3b82f6',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.backgroundColor = '#eff6ff';
                          e.currentTarget.style.borderRadius = '4px';
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.backgroundColor = 'transparent';
                        }}
                      >
                        ✏️
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDelete(colaborador)}
                        title="Desativar"
                        style={{
                          background: 'none',
                          border: 'none',
                          cursor: 'pointer',
                          fontSize: '18px',
                          padding: '4px 8px',
                          color: '#ef4444',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.backgroundColor = '#fef2f2';
                          e.currentTarget.style.borderRadius = '4px';
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.backgroundColor = 'transparent';
                        }}
                      >
                        🗑️
                      </button>
                    </div>
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

        {/* Controles de Paginação */}
        {totalPaginas > 1 && (
          <div style={{ 
            display: 'flex', 
            justifyContent: 'space-between', 
            alignItems: 'center', 
            marginTop: '16px',
            padding: '12px',
            backgroundColor: '#f8f9fa',
            borderRadius: '8px',
            border: '1px solid #e9ecef'
          }}>
            <div style={{ fontSize: '0.9rem', color: '#64748b' }}>
              Mostrando {((paginaAtual - 1) * itensPorPagina) + 1} a {Math.min(paginaAtual * itensPorPagina, filteredColaboradores.length)} de {filteredColaboradores.length} registro(s)
            </div>
            <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
              <button
                type="button"
                className="ghost"
                onClick={() => setPaginaAtual(1)}
                disabled={paginaAtual === 1}
                style={{ padding: '6px 12px' }}
              >
                ««
              </button>
              <button
                type="button"
                className="ghost"
                onClick={() => setPaginaAtual((prev) => Math.max(1, prev - 1))}
                disabled={paginaAtual === 1}
                style={{ padding: '6px 12px' }}
              >
                ‹ Anterior
              </button>
              <span style={{ padding: '0 12px', fontSize: '0.9rem', color: '#374151' }}>
                Página {paginaAtual} de {totalPaginas}
              </span>
              <button
                type="button"
                className="ghost"
                onClick={() => setPaginaAtual((prev) => Math.min(totalPaginas, prev + 1))}
                disabled={paginaAtual === totalPaginas}
                style={{ padding: '6px 12px' }}
              >
                Próxima ›
              </button>
              <button
                type="button"
                className="ghost"
                onClick={() => setPaginaAtual(totalPaginas)}
                disabled={paginaAtual === totalPaginas}
                style={{ padding: '6px 12px' }}
              >
                »»
              </button>
            </div>
          </div>
        )}
        </>
      )}

      {editingColaborador && (
        <div className="modal-backdrop" role="dialog" aria-modal="true">
          <div className="modal" style={{ maxWidth: showImageCropper ? '800px' : '500px' }}>
            <h3>Editar policial</h3>
            {editError && (
              <div className="feedback error">
                {editError}
                <button
                  type="button"
                  className="feedback-close"
                  onClick={() => setEditError(null)}
                  aria-label="Fechar"
                >
                  ×
                </button>
              </div>
            )}
            
            {showImageCropper ? (
              <ImageCropper
                imageSrc={imageForCrop}
                onCropComplete={handleCropComplete}
                onCancel={() => {
                  setShowImageCropper(false);
                  setImageForCrop('');
                  if (fileInputRef.current) {
                    fileInputRef.current.value = '';
                  }
                }}
              />
            ) : (
            <>
              {/* Foto do policial no topo */}
              <Box sx={{ display: 'flex', justifyContent: 'center', marginBottom: '24px' }}>
                <Card 
                  sx={{ 
                    position: 'relative',
                    width: 180,
                    height: 240, // Proporção 3x4 (180/240 = 0.75)
                    borderRadius: 2,
                    boxShadow: 3,
                  }}
                >
                  {editForm.fotoUrl ? (
                    <>
                      <CardMedia
                        component="img"
                        image={editForm.fotoUrl}
                        alt="Foto do policial"
                        sx={{
                          width: '100%',
                          height: '100%',
                          objectFit: 'cover',
                        }}
                      />
                      <CardActions 
                        sx={{ 
                          position: 'absolute',
                          bottom: 0,
                          left: 0,
                          right: 0,
                          background: 'linear-gradient(to top, rgba(0,0,0,0.7) 0%, rgba(0,0,0,0) 100%)',
                          justifyContent: 'center',
                          padding: '8px',
                        }}
                      >
                        <IconButton
                          size="small"
                          onClick={() => fileInputRef.current?.click()}
                          sx={{
                            color: 'white',
                            backgroundColor: 'rgba(255,255,255,0.2)',
                            '&:hover': {
                              backgroundColor: 'rgba(255,255,255,0.3)',
                            },
                            marginRight: 1,
                          }}
                          title="Alterar foto"
                        >
                          <PhotoCamera fontSize="small" />
                        </IconButton>
                        <IconButton
                          size="small"
                          onClick={() => {
                            setEditForm((prev) => ({ ...prev, fotoUrl: null }));
                            if (fileInputRef.current) {
                              fileInputRef.current.value = '';
                            }
                          }}
                          sx={{
                            color: 'white',
                            backgroundColor: 'rgba(255,255,255,0.2)',
                            '&:hover': {
                              backgroundColor: 'rgba(239, 68, 68, 0.8)',
                            },
                          }}
                          title="Remover foto"
                        >
                          <Delete fontSize="small" />
                        </IconButton>
                      </CardActions>
                    </>
                  ) : (
                    <Box
                      sx={{
                        width: '100%',
                        height: '100%',
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        justifyContent: 'center',
                        backgroundColor: '#f5f5f5',
                        cursor: 'pointer',
                        '&:hover': {
                          backgroundColor: '#eeeeee',
                        },
                      }}
                      onClick={() => fileInputRef.current?.click()}
                    >
                      <AddPhotoAlternate sx={{ fontSize: 48, color: '#9e9e9e', marginBottom: 1 }} />
                      <Typography variant="caption" color="text.secondary">
                        Adicionar foto
                      </Typography>
                    </Box>
                  )}
                </Card>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleFileSelect}
                  style={{ display: 'none' }}
                />
              </Box>
              
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
                  // Funções que não devem mostrar equipe: EXPEDIENTE ADM, CMT UPM, SUBCMT UPM, MOTORISTA DE DIA
                  const funcaoNome = editingColaborador.funcao?.nome?.toUpperCase() || '';
                  const naoMostraEquipe = 
                    funcaoNome.includes('EXPEDIENTE') || 
                    funcaoNome.includes('CMT UPM') || 
                    funcaoNome.includes('SUBCMT UPM') ||
                    funcaoNome.includes('MOTORISTA DE DIA');
                  
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
            </>
            )}
          </div>
        </div>
      )}

      {/* Modal de Visualização (Somente Leitura) */}
      {viewingColaborador && (
        <div className="modal-backdrop" role="dialog" aria-modal="true" onClick={() => {
          setViewingColaborador(null);
          setViewingAfastamentos([]);
        }}>
          <Box
            component="div"
            onClick={(e) => e.stopPropagation()}
            sx={{
              position: 'relative',
              width: '90%',
              maxWidth: '1200px',
              maxHeight: '90vh',
              backgroundColor: 'white',
              borderRadius: 2,
              boxShadow: 24,
              display: 'flex',
              flexDirection: 'column',
              overflow: 'hidden',
            }}
          >
            {/* Header */}
            <Box sx={{ p: 3, borderBottom: 1, borderColor: 'divider' }}>
              <Typography variant="h5" component="h2" sx={{ fontWeight: 600, color: 'primary.main' }}>
                Informações do Policial
              </Typography>
            </Box>

            {/* Content - Layout de duas colunas */}
            <Box sx={{ flex: 1, overflow: 'auto', p: 3 }}>
              <Box sx={{ display: 'flex', gap: 3, flexDirection: { xs: 'column', md: 'row' } }}>
                {/* Coluna Esquerda - Dados do Policial */}
                <Box sx={{ flex: { xs: '1 1 100%', md: '0 0 40%' }, minWidth: 0 }}>
                  <Paper elevation={2} sx={{ p: 3, height: '100%' }}>
                    {/* Foto do policial */}
                    {viewingColaborador.fotoUrl && (
                      <Box sx={{ display: 'flex', justifyContent: 'center', marginBottom: 3 }}>
                        <Card 
                          sx={{ 
                            position: 'relative',
                            width: 200,
                            height: 266,
                            borderRadius: 2,
                            boxShadow: 4,
                          }}
                        >
                          <CardMedia
                            component="img"
                            image={viewingColaborador.fotoUrl}
                            alt="Foto do policial"
                            sx={{
                              width: '100%',
                              height: '100%',
                              objectFit: 'cover',
                            }}
                          />
                        </Card>
                      </Box>
                    )}

                    <Divider sx={{ my: 2 }} />

                    {/* Informações do Policial */}
                    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2.5 }}>
                      <Box>
                        <Typography variant="caption" sx={{ color: 'text.secondary', fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.5 }}>
                          Nome
                        </Typography>
                        <Typography variant="body1" sx={{ mt: 0.5, fontWeight: 500 }}>
                          {viewingColaborador.nome}
                        </Typography>
                      </Box>

                      <Divider />

                      <Box>
                        <Typography variant="caption" sx={{ color: 'text.secondary', fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.5 }}>
                          Matrícula
                        </Typography>
                        <Typography variant="body1" sx={{ mt: 0.5 }}>
                          {viewingColaborador.matricula}
                        </Typography>
                      </Box>

                      <Divider />

                      <Box>
                        <Typography variant="caption" sx={{ color: 'text.secondary', fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.5 }}>
                          Status
                        </Typography>
                        <Box sx={{ mt: 0.5 }}>
                          <Chip
                            label={
                              POLICIAL_STATUS_OPTIONS.find(
                                (option) => option.value === viewingColaborador.status,
                              )?.label ?? viewingColaborador.status
                            }
                            size="small"
                            color="default"
                            sx={{ fontWeight: 500 }}
                          />
                        </Box>
                      </Box>

                      {viewingColaborador.funcao && (
                        <>
                          <Divider />
                          <Box>
                            <Typography variant="caption" sx={{ color: 'text.secondary', fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.5 }}>
                              Função
                            </Typography>
                            <Typography variant="body1" sx={{ mt: 0.5 }}>
                              {viewingColaborador.funcao.nome}
                            </Typography>
                          </Box>
                        </>
                      )}

                      {viewingColaborador.equipe && (
                        <>
                          <Divider />
                          <Box>
                            <Typography variant="caption" sx={{ color: 'text.secondary', fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.5 }}>
                              Equipe
                            </Typography>
                            <Typography variant="body1" sx={{ mt: 0.5 }}>
                              {EQUIPE_FONETICA[viewingColaborador.equipe]} ({viewingColaborador.equipe})
                            </Typography>
                          </Box>
                        </>
                      )}
                    </Box>
                  </Paper>
                </Box>

                {/* Coluna Direita - Afastamentos */}
                <Box sx={{ flex: { xs: '1 1 100%', md: '0 0 60%' }, minWidth: 0 }}>
                  <Paper elevation={2} sx={{ p: 3, height: '100%', display: 'flex', flexDirection: 'column' }}>
                    <Typography variant="h6" sx={{ mb: 2, fontWeight: 600, color: 'primary.main' }}>
                      Afastamentos
                    </Typography>

                    <Box sx={{ flex: 1, overflow: 'auto' }}>
                      {loadingAfastamentos ? (
                        <Typography variant="body2" sx={{ color: 'text.secondary', fontStyle: 'italic' }}>
                          Carregando afastamentos...
                        </Typography>
                      ) : viewingAfastamentos.length === 0 ? (
                        <Typography variant="body2" sx={{ color: 'text.secondary', fontStyle: 'italic' }}>
                          Nenhum afastamento registrado para este policial.
                        </Typography>
                      ) : (
                        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                          {viewingAfastamentos.map((afastamento) => (
                            <Card
                              key={afastamento.id}
                              elevation={1}
                              sx={{
                                p: 2,
                                backgroundColor: 'background.paper',
                                border: 1,
                                borderColor: 'divider',
                                '&:hover': {
                                  boxShadow: 3,
                                },
                              }}
                            >
                              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 1 }}>
                                <Box sx={{ flex: 1 }}>
                                  <Typography variant="subtitle1" sx={{ fontWeight: 600, mb: 0.5 }}>
                                    {afastamento.motivo.nome}
                                  </Typography>
                                  {afastamento.descricao && (
                                    <Typography variant="body2" sx={{ color: 'text.secondary', mb: 1 }}>
                                      {afastamento.descricao}
                                    </Typography>
                                  )}
                                </Box>
                                <Chip
                                  label={STATUS_LABEL[afastamento.status]}
                                  size="small"
                                  color={afastamento.status === 'ATIVO' ? 'success' : 'default'}
                                  sx={{ ml: 1 }}
                                />
                              </Box>
                              <Typography variant="body2" sx={{ color: 'text.secondary', fontSize: '0.875rem' }}>
                                {formatPeriodo(afastamento.dataInicio, afastamento.dataFim)}
                              </Typography>
                            </Card>
                          ))}
                        </Box>
                      )}
                    </Box>
                  </Paper>
                </Box>
              </Box>
            </Box>

            {/* Footer - Botões */}
            <Box sx={{ p: 2, borderTop: 1, borderColor: 'divider', display: 'flex', justifyContent: 'flex-end', gap: 2 }}>
              <button
                type="button"
                className="primary"
                onClick={() => {
                  setViewingColaborador(null);
                  setViewingAfastamentos([]);
                }}
              >
                Fechar
              </button>
              {usuarioPodeVerTodosEAcoes && (
                <button
                  type="button"
                  className="secondary"
                  onClick={() => {
                    setViewingColaborador(null);
                    setViewingAfastamentos([]);
                    openEditModal(viewingColaborador);
                  }}
                >
                  Editar
                </button>
              )}
            </Box>
          </Box>
        </div>
      )}
    </section>
  );
}
