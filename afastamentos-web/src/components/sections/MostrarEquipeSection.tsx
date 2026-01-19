import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { api } from '../../api';
import type { Afastamento, Policial, Equipe, FuncaoOption, PolicialStatus, Usuario } from '../../types';
import { EQUIPE_FONETICA, EQUIPE_OPTIONS, POLICIAL_STATUS_OPTIONS, STATUS_LABEL } from '../../constants';
import type { ConfirmConfig } from '../common/ConfirmDialog';
import { ImageCropper } from '../common/ImageCropper';
import { Card, CardMedia, CardActions, IconButton, Box, Typography, Paper, Divider, Chip } from '@mui/material';
import { PhotoCamera, Delete, AddPhotoAlternate, Edit, CheckCircle, Block } from '@mui/icons-material';
import { formatPeriodo, calcularDiasEntreDatas } from '../../utils/dateUtils';

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
  const [policiais, setPoliciais] = useState<Policial[]>([]);
  const [totalPoliciaisGeral, setTotalPoliciaisGeral] = useState<number>(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [editingPolicial, setEditingPolicial] = useState<Policial | null>(
    null,
  );
  const [viewingPolicial, setViewingPolicial] = useState<Policial | null>(
    null,
  );
  const [viewingAfastamentos, setViewingAfastamentos] = useState<Afastamento[]>([]);
  const [loadingAfastamentos, setLoadingAfastamentos] = useState(false);
  const [restricaoModal, setRestricaoModal] = useState<{
    open: boolean;
    policial: Policial | null;
    restricaoMedicaId: number | null;
    loading: boolean;
    error: string | null;
  }>({
    open: false,
    policial: null,
    restricaoMedicaId: null,
    loading: false,
    error: null,
  });
  const [restricoesMedicas, setRestricoesMedicas] = useState<Array<{ id: number; nome: string }>>([]);
  const [loadingRestricoes, setLoadingRestricoes] = useState(false);
  const [deleteModal, setDeleteModal] = useState<{
    open: boolean;
    policial: Policial | null;
    senha: string;
    error: string | null;
    loading: boolean;
  }>({
    open: false,
    policial: null,
    senha: '',
    error: null,
    loading: false,
  });
  const [removeRestricaoModal, setRemoveRestricaoModal] = useState<{
    open: boolean;
    policial: Policial | null;
    senha: string;
    error: string | null;
    loading: boolean;
  }>({
    open: false,
    policial: null,
    senha: '',
    error: null,
    loading: false,
  });
  const [editForm, setEditForm] = useState({
    nome: '',
    matricula: '',
    status: 'ATIVO' as PolicialStatus,
    equipe: undefined as Equipe | undefined,
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

  // Aplicar filtros do Dashboard quando o componente montar
  useEffect(() => {
    const dashboardFilters = sessionStorage.getItem('dashboard-filters');
    if (dashboardFilters) {
      try {
        const filters = JSON.parse(dashboardFilters);
        if (filters.equipe) {
          setFiltroEquipe(filters.equipe as Equipe);
          setFiltrosAberto(true);
        }
        if (filters.funcaoId) {
          setFiltroFuncao(filters.funcaoId);
          setFiltrosAberto(true);
        }
        // Limpar filtros após aplicá-los
        sessionStorage.removeItem('dashboard-filters');
      } catch (error) {
        console.error('Erro ao aplicar filtros do Dashboard:', error);
      }
    }
  }, []);
  const [ordenacao, setOrdenacao] = useState<{
    campo: 'nome' | 'matricula' | 'equipe';
    direcao: 'asc' | 'desc';
  } | null>(null);
  const [paginaAtual, setPaginaAtual] = useState(1);
  const [itensPorPagina, setItensPorPagina] = useState(20);
  const [totalPoliciais, setTotalPoliciais] = useState(0);
  const [totalPaginas, setTotalPaginas] = useState(1);
 
  const getPolicialStatusClass = (status: PolicialStatus) => {
    switch (status) {
      case 'ATIVO':
        return 'badge policial-status-ativo';
      case 'COMISSIONADO':
        return 'badge policial-status-comissionado';
      case 'DESIGNADO':
        return 'badge policial-status-designado';
      case 'PTTC':
        return 'badge policial-status-pttc';
      case 'DESATIVADO':
        return 'badge policial-status-desativado';
      default:
        return 'badge badge-muted';
    }
  };

  const getPolicialStatusChipSx = (status: PolicialStatus) => {
    switch (status) {
      case 'ATIVO':
        return { backgroundColor: '#dcfce7', color: '#166534' };
      case 'COMISSIONADO':
        return { backgroundColor: '#fee2e2', color: '#991b1b' };
      case 'DESIGNADO':
        return { backgroundColor: '#fef9c3', color: '#92400e' };
      case 'PTTC':
        return { backgroundColor: '#dbeafe', color: '#1d4ed8' };
      case 'DESATIVADO':
        return { backgroundColor: '#fee2e2', color: '#991b1b' };
      default:
        return { backgroundColor: '#e2e8f0', color: '#1e293b' };
    }
  };

  // Carregar total geral de policiais (sem filtros)
  const carregarTotalGeral = useCallback(async () => {
    try {
      const nivelNome = currentUser.nivel?.nome;
      const usuarioPodeVerTodos =
        nivelNome === 'ADMINISTRADOR' ||
        nivelNome === 'SAD' ||
        nivelNome === 'COMANDO' ||
        currentUser.isAdmin === true;
      const params: Parameters<typeof api.listPoliciaisPaginated>[0] = {
        page: 1,
        pageSize: 1, // Apenas precisamos do total
        includeAfastamentos: false,
        includeRestricoes: false,
        // Não passar nenhum filtro para pegar o total geral
      };
      if (!usuarioPodeVerTodos && currentUser.equipe) {
        params.equipe = currentUser.equipe; // Usuário só pode ver sua equipe
      }
      const data = await api.listPoliciaisPaginated(params);
      setTotalPoliciaisGeral(data.total);
    } catch (err) {
      console.error('Erro ao carregar total geral de policiais:', err);
      setTotalPoliciaisGeral(0);
    }
  }, [currentUser]);

  const carregarPoliciais = useCallback(async (page: number, pageSize: number) => {
    try {
      setLoading(true);
      const nivelNome = currentUser.nivel?.nome;
      const usuarioPodeVerTodos =
        nivelNome === 'ADMINISTRADOR' ||
        nivelNome === 'SAD' ||
        nivelNome === 'COMANDO' ||
        currentUser.isAdmin === true;
      const params: Parameters<typeof api.listPoliciaisPaginated>[0] = {
        page,
        pageSize,
        includeAfastamentos: false,
        includeRestricoes: true,
      };
      const busca = searchTerm.trim();
      if (busca) {
        params.search = busca;
      }
      if (!usuarioPodeVerTodos && currentUser.equipe) {
        params.equipe = currentUser.equipe;
      } else if (filtroEquipe) {
        params.equipe = filtroEquipe;
      }
      if (filtroStatus) {
        params.status = filtroStatus;
      }
      if (filtroFuncao) {
        params.funcaoId = filtroFuncao;
      }
      if (ordenacao) {
        params.orderBy = ordenacao.campo;
        params.orderDir = ordenacao.direcao;
      }
      const data = await api.listPoliciaisPaginated(params);
      setPoliciais(data.Policiales);
      const totalPages = Math.max(1, data.totalPages);
      setTotalPoliciais(data.total);
      setTotalPaginas(totalPages);
      if (page > totalPages) {
        setPaginaAtual(totalPages);
      }
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
  }, [currentUser, filtroEquipe, filtroFuncao, filtroStatus, ordenacao, searchTerm]);

  const carregarFuncoes = useCallback(async () => {
    try {
      const data = await api.listFuncoes();
      setFuncoes(data);
    } catch (err) {
      console.error('Erro ao carregar funções:', err);
    }
  }, []);

  const carregarRestricoesMedicas = useCallback(async () => {
    try {
      setLoadingRestricoes(true);
      const restricoes = await api.listRestricoesMedicas();
      setRestricoesMedicas(restricoes);
    } catch (err) {
      console.error('Erro ao carregar restrições médicas:', err);
    } finally {
      setLoadingRestricoes(false);
    }
  }, []);

  // Ordenar funções alfabeticamente
  const funcoesOrdenadas = useMemo(() => {
    return [...funcoes].sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR', { sensitivity: 'base' }));
  }, [funcoes]);
 
  useEffect(() => {
    void carregarTotalGeral();
  }, [carregarTotalGeral, refreshKey]);

  useEffect(() => {
    void carregarPoliciais(paginaAtual, itensPorPagina);
  }, [carregarPoliciais, paginaAtual, itensPorPagina, refreshKey]);

  useEffect(() => {
    void carregarFuncoes();
    void carregarRestricoesMedicas();
  }, [carregarFuncoes, carregarRestricoesMedicas]);

  const openEditModal = (policial: Policial) => {
    setEditingPolicial(policial);
    // O Prisma retorna funcaoId diretamente quando usa include
    // Precisamos tratar null explicitamente, pois null ?? undefined retorna undefined
    const funcaoId = policial.funcaoId !== null && policial.funcaoId !== undefined
      ? policial.funcaoId
      : policial.funcao?.id ?? undefined;
    setEditForm({
      nome: policial.nome,
      matricula: policial.matricula,
      status: policial.status,
      equipe: policial.equipe ?? undefined,
      funcaoId: funcaoId,
      fotoUrl: policial.fotoUrl ?? null,
    });
    setEditError(null);
    setShowImageCropper(false);
  };

  const closeEditModal = () => {
    setEditingPolicial(null);
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
    if (!editingPolicial || editSubmitting) {
      return;
    }

    const nome = editForm.nome.trim();
    const matricula = editForm.matricula.trim();

    if (!nome || !matricula) {
      setEditError('Informe nome e matrícula.');
      return;
    }

    // Validar se MOTORISTA DE DIA não tem equipe E
    let equipeFinal = editForm.equipe;
    if (editForm.funcaoId) {
      const funcaoSelecionada = funcoes.find(f => f.id === editForm.funcaoId);
      if (funcaoSelecionada?.nome.toUpperCase().includes('MOTORISTA DE DIA')) {
        if (equipeFinal === 'E') {
          setEditError('A função MOTORISTA DE DIA não pode ter equipe E (Echo). Selecione uma equipe de A até D.');
          return;
        }
      }
    }

    const payload = {
      nome,
      matricula,
      status: editForm.status,
      equipe: equipeFinal,
      funcaoId: editForm.funcaoId,
      fotoUrl: editForm.fotoUrl,
    };

    openConfirm({
      title: 'Confirmar edição',
      message: `Deseja salvar as alterações para ${editingPolicial.nome}?`,
      confirmLabel: 'Salvar',
      onConfirm: async () => {
        try {
          setEditSubmitting(true);
          setEditError(null);
          await api.updatePolicial(editingPolicial.id, payload);
          setSuccess('Policial atualizado com sucesso.');
          closeEditModal();
          await carregarPoliciais(paginaAtual, itensPorPagina);
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

  const handleDelete = (policial: Policial) => {
    openConfirm({
      title: 'Desativar policial',
      message: `Deseja desativar ${policial.nome} (matrícula ${policial.matricula})?`,
      confirmLabel: 'Desativar',
      onConfirm: async () => {
        try {
          await api.removePolicial(policial.id);
          setSuccess('Policial desativado.');
          await carregarPoliciais(paginaAtual, itensPorPagina);
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

  const handleActivate = (policial: Policial) => {
    openConfirm({
      title: 'Reativar policial',
      message: `Deseja reativar ${policial.nome} (matrícula ${policial.matricula})?`,
      confirmLabel: 'Reativar',
      onConfirm: async () => {
        try {
          await api.activatePolicial(policial.id);
          setSuccess('Policial reativado com sucesso.');
          await carregarPoliciais(paginaAtual, itensPorPagina);
          onChanged?.();
        } catch (err) {
          setError(
            err instanceof Error
              ? err.message
              : 'Não foi possível reativar o policial.',
          );
        }
      },
    });
  };

  const handleOpenDeleteModal = (policial: Policial) => {
    setDeleteModal({
      open: true,
      policial,
      senha: '',
      error: null,
      loading: false,
    });
  };

  const handleCloseDeleteModal = () => {
    setDeleteModal({
      open: false,
      policial: null,
      senha: '',
      error: null,
      loading: false,
    });
  };

  const handleConfirmDelete = async () => {
    if (!deleteModal.policial) {
      return;
    }

    if (!deleteModal.senha.trim()) {
      setDeleteModal((prev) => ({
        ...prev,
        error: 'Por favor, informe sua senha para confirmar a exclusão.',
      }));
      return;
    }

    try {
      setDeleteModal((prev) => ({ ...prev, loading: true, error: null }));
      await api.deletePolicial(deleteModal.policial.id, deleteModal.senha);
      
      if (editingPolicial?.id === deleteModal.policial.id) {
        closeEditModal();
      }
      
      setSuccess('Policial excluído permanentemente.');
      handleCloseDeleteModal();
      await carregarPoliciais(paginaAtual, itensPorPagina);
      onChanged?.();
    } catch (err) {
      let errorMessage = 'Não foi possível excluir o policial.';
      if (err instanceof Error) {
        errorMessage = err.message;
        // Ajustar mensagens específicas
        if (errorMessage.includes('Senha de administrador')) {
          errorMessage = 'Senha de administrador inválida.';
        } else if (errorMessage.includes('Nenhum administrador encontrado')) {
          errorMessage = 'Nenhum administrador encontrado no sistema.';
        }
      }
      setDeleteModal((prev) => ({
        ...prev,
        error: errorMessage,
        loading: false,
      }));
    }
  };

  const normalizedSearch = searchTerm.trim().toUpperCase();
  const equipeAtual = currentUser.equipe;

  // Verificar se o usuário é ADMINISTRADOR ou SAD (podem ver todos e fazer ações)
  const usuarioPodeVerTodosEAcoes = useMemo(() => {
    const nivelNome = currentUser.nivel?.nome;
    return nivelNome === 'ADMINISTRADOR' || nivelNome === 'SAD' || currentUser.isAdmin === true;
  }, [currentUser]);

  // Verificar se o usuário é ADMINISTRADOR (pode excluir permanentemente)
  const usuarioPodeExcluirPermanentemente = useMemo(() => {
    const nivelNome = currentUser.nivel?.nome;
    return nivelNome === 'ADMINISTRADOR' || currentUser.isAdmin === true;
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

  const policiaisDaEquipe = useMemo(
    () => {
      // Se for ADMINISTRADOR, SAD ou COMANDO, retornar todos os policiais (incluindo desativados)
      if (usuarioPodeVerTodos) {
        return policiais;
      }
      // Caso contrário (OPERAÇÕES), filtrar apenas pela equipe do usuário (incluindo desativados)
      return policiais.filter(
        (policial) => policial.equipe === equipeAtual,
      );
    },
    [policiais, equipeAtual, usuarioPodeVerTodos],
  );

  const filteredPoliciales = useMemo(() => {
    let resultado = policiaisDaEquipe;

    // Aplicar filtro de busca por nome, matrícula ou função
    if (normalizedSearch) {
      resultado = resultado.filter((policial) => {
        // Buscar por nome
        if (policial.nome.includes(normalizedSearch)) {
          return true;
        }
        // Buscar por matrícula
        if (policial.matricula.toUpperCase().includes(normalizedSearch)) {
          return true;
        }
        // Buscar por função
        if (policial.funcao?.nome && policial.funcao.nome.toUpperCase().includes(normalizedSearch)) {
          return true;
        }
        return false;
      });
    }

    // Aplicar filtro por equipe
    if (filtroEquipe) {
      resultado = resultado.filter((policial) => policial.equipe === filtroEquipe);
    }

    // Aplicar filtro por status/condição
    if (filtroStatus) {
      resultado = resultado.filter((policial) => policial.status === filtroStatus);
    }

    // Aplicar filtro por função
    if (filtroFuncao) {
      resultado = resultado.filter((policial) => policial.funcaoId === filtroFuncao);
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
  }, [policiaisDaEquipe, normalizedSearch, filtroEquipe, filtroStatus, filtroFuncao, ordenacao]);

  const registroInicio = totalPoliciais === 0 ? 0 : ((paginaAtual - 1) * itensPorPagina) + 1;
  const registroFim = totalPoliciais === 0 ? 0 : Math.min(paginaAtual * itensPorPagina, totalPoliciais);

  const policiaisPaginados = useMemo(() => {
    return filteredPoliciales;
  }, [filteredPoliciales]);

  // Calcular totais de dias por tipo de afastamento para a modal de visualização
  const resumoDiasPorTipo = useMemo(() => {
    const totais: Record<string, number> = {};
    viewingAfastamentos.forEach((afastamento) => {
      const motivoNome = afastamento.motivo.nome;
      const dias = calcularDiasEntreDatas(afastamento.dataInicio, afastamento.dataFim);
      totais[motivoNome] = (totais[motivoNome] || 0) + dias;
    });
    return Object.entries(totais).sort((a, b) => a[0].localeCompare(b[0], 'pt-BR'));
  }, [viewingAfastamentos]);

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
        <button
          className="ghost"
          type="button"
          onClick={() => void carregarPoliciais(paginaAtual, itensPorPagina)}
        >
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

      {/* Contador de Registros */}
      <div style={{ 
        marginBottom: '16px', 
        padding: '12px 16px', 
        backgroundColor: '#f0f9ff', 
        borderRadius: '8px', 
        border: '1px solid #bae6fd',
        display: 'flex',
        alignItems: 'center',
        gap: '16px',
        flexWrap: 'wrap'
      }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <Typography variant="body2" sx={{ fontWeight: 600, color: 'text.primary' }}>
            Total do efetivo:
          </Typography>
          <Chip 
            label={totalPoliciaisGeral} 
            size="small" 
            sx={{ fontWeight: 600, backgroundColor: '#3b82f6', color: 'white' }}
          />
        </Box>
        {(searchTerm || filtroEquipe || filtroStatus || filtroFuncao) && (
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Typography variant="body2" sx={{ fontWeight: 600, color: 'text.primary' }}>
              Com filtros aplicados:
            </Typography>
            <Chip 
              label={totalPoliciais} 
              size="small" 
              sx={{ fontWeight: 600, backgroundColor: '#10b981', color: 'white' }}
            />
          </Box>
        )}
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
      ) : totalPoliciais === 0 ? (
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
              {policiaisPaginados.map((policial) => (
              <tr key={policial.id}>
                <td>
                  <a
                    href="#"
                    onClick={async (e) => {
                      e.preventDefault();
                      // Carregar dados completos do policial (incluindo restrição médica)
                      try {
                        const policialCompleto = await api.getPolicial(policial.id);
                        setViewingPolicial(policialCompleto);
                      } catch (err) {
                        console.error('Erro ao carregar dados do policial:', err);
                        setViewingPolicial(policial);
                      }
                      
                      // Carregar afastamentos do policial
                      try {
                        setLoadingAfastamentos(true);
                        const afastamentosData = await api.listAfastamentos({
                          policialId: policial.id,
                          includePolicialFuncao: false,
                        });
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
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                      {policial.restricaoMedica && (
                        <span
                          style={{
                            color: '#ef4444',
                            fontSize: '1.1rem',
                            fontWeight: 'bold',
                            lineHeight: 1,
                          }}
                          title={`Restrição médica: ${policial.restricaoMedica.nome}`}
                        >
                          ⚠
                        </span>
                      )}
                      {policial.nome}
                    </span>
                  </a>
                </td>
                <td>{policial.matricula}</td>
                <td>
                  <span className={getPolicialStatusClass(policial.status)}>
                    {
                      POLICIAL_STATUS_OPTIONS.find(
                        (option) => option.value === policial.status,
                      )?.label ?? policial.status
                    }
                  </span>
                </td>
                <td>
                  {policial.funcao?.nome ? (
                    policial.funcao.nome
                  ) : (
                    <span style={{ color: '#64748b', fontStyle: 'italic' }}>-</span>
                  )}
                </td>
                <td>
                  {policial.equipe && policial.equipe !== 'SEM_EQUIPE' ? (
                    <>
                      {EQUIPE_FONETICA[policial.equipe]} ({policial.equipe})
                    </>
                  ) : (
                    <span style={{ color: '#64748b', fontStyle: 'italic' }}>-</span>
                  )}
                </td>
                <td className="actions">
                  {usuarioPodeVerTodosEAcoes ? (
                    <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                      <IconButton
                        onClick={() => openEditModal(policial)}
                        title="Editar"
                        size="small"
                        sx={{
                          color: '#3b82f6',
                          '&:hover': {
                            backgroundColor: '#eff6ff',
                          },
                        }}
                      >
                        <Edit fontSize="small" />
                      </IconButton>
                      {policial.status === 'DESATIVADO' ? (
                        <IconButton
                          onClick={() => handleActivate(policial)}
                          title="Reativar"
                          size="small"
                          sx={{
                            color: '#10b981',
                            '&:hover': {
                              backgroundColor: '#d1fae5',
                            },
                          }}
                        >
                          <CheckCircle fontSize="small" />
                        </IconButton>
                      ) : (
                        <IconButton
                          onClick={() => handleDelete(policial)}
                          title="Desativar"
                          size="small"
                          sx={{
                            color: '#ef4444',
                            '&:hover': {
                              backgroundColor: '#fef2f2',
                            },
                          }}
                        >
                          <Block fontSize="small" />
                        </IconButton>
                      )}
                      {usuarioPodeExcluirPermanentemente && (
                        <IconButton
                          onClick={() => handleOpenDeleteModal(policial)}
                          title="Excluir permanentemente"
                          size="small"
                          sx={{
                            color: '#dc2626',
                            '&:hover': {
                              backgroundColor: '#fee2e2',
                            },
                          }}
                        >
                          <Delete fontSize="small" />
                        </IconButton>
                      )}
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
              Mostrando {registroInicio} a {registroFim} de {totalPoliciais} registro(s)
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

      {editingPolicial && (
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
              </div>
              <label>
                Função
                <select
                  value={editForm.funcaoId ? String(editForm.funcaoId) : ''}
                  onChange={(event) => {
                    const novoFuncaoId = event.target.value ? Number(event.target.value) : undefined;
                    const funcaoSelecionada = novoFuncaoId ? funcoes.find(f => f.id === novoFuncaoId) : null;
                    
                    // Se a função selecionada não permite equipe, limpar o campo de equipe
                    // Se for MOTORISTA DE DIA e a equipe for E, limpar também
                    if (funcaoSelecionada) {
                      const funcaoUpper = funcaoSelecionada.nome.toUpperCase();
                      const naoMostraEquipe = 
                        funcaoUpper.includes('EXPEDIENTE ADM') || 
                        funcaoUpper.includes('CMT UPM') || 
                        funcaoUpper.includes('SUBCMT UPM');
                      
                      const isMotoristaDia = funcaoUpper.includes('MOTORISTA DE DIA');
                      
                      setEditForm((prev) => ({
                        ...prev,
                        funcaoId: novoFuncaoId,
                        equipe: naoMostraEquipe ? undefined : (isMotoristaDia && prev.equipe === 'E' ? undefined : prev.equipe),
                      }));
                    } else {
                      setEditForm((prev) => ({
                        ...prev,
                        funcaoId: novoFuncaoId,
                      }));
                    }
                  }}
                >
                  <option value="">Selecione uma função</option>
                  {funcoesOrdenadas.map((funcao) => (
                    <option key={funcao.id} value={funcao.id}>
                      {funcao.nome}
                    </option>
                  ))}
                </select>
              </label>
              
              {/* Campo Equipe - Mostrar apenas se a função selecionada permitir */}
              {(() => {
                const funcaoSelecionada = editForm.funcaoId ? funcoes.find(f => f.id === editForm.funcaoId) : null;
                const mostrarEquipe = funcaoSelecionada ? (() => {
                  const funcaoUpper = funcaoSelecionada.nome.toUpperCase();
                  return !(
                    funcaoUpper.includes('EXPEDIENTE ADM') || 
                    funcaoUpper.includes('CMT UPM') || 
                    funcaoUpper.includes('SUBCMT UPM')
                  );
                })() : false;
                
                const isMotoristaDia = funcaoSelecionada?.nome.toUpperCase().includes('MOTORISTA DE DIA') || false;
                
                // Filtrar equipes: MOTORISTA DE DIA não pode ter equipe E (Echo)
                const equipesDisponiveis = (() => {
                  let equipes = currentUser.nivel?.nome === 'OPERAÇÕES'
                    ? EQUIPE_OPTIONS.filter((option) => option.value === currentUser.equipe)
                    : EQUIPE_OPTIONS;
                  
                  if (isMotoristaDia) {
                    equipes = equipes.filter((option) => option.value !== 'E');
                  }
                  
                  return equipes;
                })();
                
                return mostrarEquipe ? (
                  <label>
                    Equipe
                    <select
                      value={editForm.equipe || ''}
                      onChange={(event) =>
                        setEditForm((prev) => ({
                          ...prev,
                          equipe: event.target.value ? (event.target.value as Equipe) : undefined,
                        }))
                      }
                      required
                    >
                      <option value="">Selecione uma equipe</option>
                      {equipesDisponiveis.map((option) => (
                        <option key={option.value} value={option.value}>
                          {EQUIPE_FONETICA[option.value]} ({option.value})
                        </option>
                      ))}
                    </select>
                  </label>
                ) : null;
              })()}
              
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
      {viewingPolicial && (
        <div className="modal-backdrop" role="dialog" aria-modal="true" onClick={() => {
            setViewingPolicial(null);
            setViewingAfastamentos([]);
          }}>
            <Box
              component="div"
              onClick={(e) => e.stopPropagation()}
              sx={{
                position: 'relative',
                width: '90%',
                maxWidth: '1400px',
                maxHeight: '85vh',
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
                {viewingPolicial.restricaoMedica && (
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mt: 1 }}>
                    <Typography variant="body1" sx={{ color: 'error.main', fontWeight: 500 }}>
                      Policial com restrição: {viewingPolicial.restricaoMedica.nome}
                    </Typography>
                    <button
                      type="button"
                      onClick={() => {
                        setRemoveRestricaoModal({
                          open: true,
                          policial: viewingPolicial,
                          senha: '',
                          error: null,
                          loading: false,
                        });
                      }}
                      style={{
                        backgroundColor: '#ef4444',
                        border: '1px solid #ef4444',
                        color: '#ffffff',
                        padding: '6px 12px',
                        borderRadius: '6px',
                        cursor: 'pointer',
                        fontSize: '0.875rem',
                        fontWeight: 500,
                        transition: 'background-color 0.2s ease-in-out',
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.backgroundColor = '#dc2626';
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.backgroundColor = '#ef4444';
                      }}
                    >
                      Retirar restrição
                    </button>
                  </Box>
                )}
              </Box>

              {/* Content - Layout de três colunas */}
              <Box sx={{ flex: 1, overflow: 'auto', p: 2 }}>
                <Box sx={{ display: 'flex', gap: 2, flexDirection: { xs: 'column', lg: 'row' } }}>
                  {/* Coluna Esquerda - Dados do Policial */}
                  <Box sx={{ flex: { xs: '1 1 100%', lg: '0 0 22%' }, minWidth: 0 }}>
                  <Paper elevation={2} sx={{ p: 2, height: '100%' }}>
                    {/* Foto do policial */}
                    {viewingPolicial.fotoUrl && (
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
                            image={viewingPolicial.fotoUrl}
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
                          {viewingPolicial.nome}
                        </Typography>
                      </Box>

                      <Divider />

                      <Box>
                        <Typography variant="caption" sx={{ color: 'text.secondary', fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.5 }}>
                          Matrícula
                        </Typography>
                        <Typography variant="body1" sx={{ mt: 0.5 }}>
                          {viewingPolicial.matricula}
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
                                (option) => option.value === viewingPolicial.status,
                              )?.label ?? viewingPolicial.status
                            }
                            size="small"
                            color="default"
                            sx={{ fontWeight: 500, ...getPolicialStatusChipSx(viewingPolicial.status) }}
                          />
                        </Box>
                      </Box>

                      {viewingPolicial.funcao && (
                        <>
                          <Divider />
                          <Box>
                            <Typography variant="caption" sx={{ color: 'text.secondary', fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.5 }}>
                              Função
                            </Typography>
                            <Typography variant="body1" sx={{ mt: 0.5 }}>
                              {viewingPolicial.funcao.nome}
                            </Typography>
                          </Box>
                        </>
                      )}

                      {viewingPolicial.equipe && viewingPolicial.equipe !== 'SEM_EQUIPE' && (
                        <>
                          <Divider />
                          <Box>
                            <Typography variant="caption" sx={{ color: 'text.secondary', fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.5 }}>
                              Equipe
                            </Typography>
                            <Typography variant="body1" sx={{ mt: 0.5 }}>
                              {EQUIPE_FONETICA[viewingPolicial.equipe]} ({viewingPolicial.equipe})
                            </Typography>
                          </Box>
                        </>
                      )}

                      {(viewingPolicial.restricaoMedica || (viewingPolicial.restricoesMedicasHistorico && viewingPolicial.restricoesMedicasHistorico.length > 0)) && (
                        <>
                          <Divider />
                          <Box>
                            <Typography variant="caption" sx={{ color: 'text.secondary', fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.5, mb: 1, display: 'block' }}>
                              Restrições Médicas
                            </Typography>
                            
                            {/* Restrição Ativa */}
                            {viewingPolicial.restricaoMedica && (
                              <Box sx={{ mb: 2, p: 1.5, backgroundColor: '#fef2f2', borderRadius: 1, border: '1px solid #fecaca' }}>
                                <Typography variant="body2" sx={{ fontWeight: 600, color: 'error.main', mb: 0.5 }}>
                                  Ativa: {viewingPolicial.restricaoMedica.nome}
                                </Typography>
                                {viewingPolicial.updatedAt && (
                                  <Typography variant="caption" sx={{ color: 'text.secondary', fontSize: '0.75rem' }}>
                                    Adicionada em: {new Date(viewingPolicial.updatedAt).toLocaleDateString('pt-BR')}
                                  </Typography>
                                )}
                              </Box>
                            )}

                            {/* Histórico de Restrições Removidas */}
                            {viewingPolicial.restricoesMedicasHistorico && viewingPolicial.restricoesMedicasHistorico.length > 0 && (
                              <Box sx={{ mt: 2 }}>
                                <Typography variant="body2" sx={{ fontWeight: 600, color: 'text.primary', mb: 1.5 }}>
                                  Histórico de Restrições
                                </Typography>
                                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
                                  {viewingPolicial.restricoesMedicasHistorico.map((historico) => (
                                    <Box 
                                      key={historico.id}
                                      sx={{ p: 1.5, backgroundColor: '#f9fafb', borderRadius: 1, border: '1px solid #e5e7eb' }}
                                    >
                                      <Typography variant="body2" sx={{ fontSize: '0.875rem', color: 'text.secondary', mb: 0.75, fontWeight: 500 }}>
                                        {historico.restricaoMedica.nome}
                                      </Typography>
                                      <Typography variant="caption" sx={{ color: 'text.secondary', fontSize: '0.75rem', display: 'block' }}>
                                        Colocada em: {new Date(historico.dataInicio).toLocaleDateString('pt-BR')}
                                      </Typography>
                                      <Typography variant="caption" sx={{ color: 'text.secondary', fontSize: '0.75rem', display: 'block' }}>
                                        Removida em: {new Date(historico.dataFim).toLocaleDateString('pt-BR')}
                                      </Typography>
                                      {historico.removidoPorNome && (
                                        <Typography variant="caption" sx={{ color: 'text.secondary', fontSize: '0.75rem', display: 'block' }}>
                                          Removida por: {historico.removidoPorNome}
                                        </Typography>
                                      )}
                                    </Box>
                                  ))}
                                </Box>
                              </Box>
                            )}
                          </Box>
                        </>
                      )}
                    </Box>
                  </Paper>
                  </Box>

                  {/* Coluna Central - Lista de Afastamentos */}
                  <Box sx={{ flex: { xs: '1 1 100%', lg: '0 0 35%' }, minWidth: 0 }}>
                    <Paper elevation={2} sx={{ p: 2, height: '100%', display: 'flex', flexDirection: 'column' }}>
                      <Typography variant="h6" sx={{ mb: 1.5, fontWeight: 600, color: 'primary.main', fontSize: '1.1rem' }}>
                        Afastamentos
                      </Typography>

                    <Box sx={{ flex: 1, overflow: 'auto', maxHeight: 'calc(85vh - 200px)' }}>
                      {loadingAfastamentos ? (
                        <Typography variant="body2" sx={{ color: 'text.secondary', fontStyle: 'italic' }}>
                          Carregando afastamentos...
                        </Typography>
                      ) : viewingAfastamentos.length === 0 ? (
                        <Typography variant="body2" sx={{ color: 'text.secondary', fontStyle: 'italic' }}>
                          Nenhum afastamento registrado para este policial.
                        </Typography>
                      ) : (
                        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
                          {viewingAfastamentos.map((afastamento) => (
                            <Card
                              key={afastamento.id}
                              elevation={1}
                              sx={{
                                p: 1.5,
                                backgroundColor: 'background.paper',
                                border: 1,
                                borderColor: 'divider',
                                '&:hover': {
                                  boxShadow: 2,
                                },
                              }}
                            >
                              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 0.5 }}>
                                <Box sx={{ flex: 1 }}>
                                  <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 0.25, fontSize: '0.9rem' }}>
                                    {afastamento.motivo.nome}
                                  </Typography>
                                  {afastamento.descricao && (
                                    <Typography variant="body2" sx={{ color: 'text.secondary', mb: 0.5, fontSize: '0.8rem' }}>
                                      {afastamento.descricao}
                                    </Typography>
                                  )}
                                </Box>
                                <Chip
                                  label={STATUS_LABEL[afastamento.status]}
                                  size="small"
                                  color={afastamento.status === 'ATIVO' ? 'success' : 'default'}
                                  sx={{ ml: 1, fontSize: '0.7rem', height: '24px' }}
                                />
                              </Box>
                              <Typography variant="caption" sx={{ color: 'text.secondary', fontSize: '0.75rem' }}>
                                {formatPeriodo(afastamento.dataInicio, afastamento.dataFim)}
                              </Typography>
                            </Card>
                          ))}
                        </Box>
                      )}
                    </Box>
                  </Paper>
                  </Box>

                  {/* Coluna Direita - Resumo de Dias por Tipo */}
                  <Box sx={{ flex: { xs: '1 1 100%', lg: '0 0 28%' }, minWidth: 0 }}>
                    <Paper elevation={2} sx={{ p: 2, height: '100%', display: 'flex', flexDirection: 'column' }}>
                      <Typography variant="h6" sx={{ mb: 1.5, fontWeight: 600, color: 'primary.main', fontSize: '1.1rem' }}>
                        Resumo de Afastamentos
                      </Typography>
                      
                      <Box sx={{ flex: 1, overflow: 'auto', maxHeight: 'calc(85vh - 200px)' }}>
                        {loadingAfastamentos ? (
                          <Typography variant="body2" sx={{ color: 'text.secondary', fontStyle: 'italic', fontSize: '0.85rem' }}>
                            Carregando...
                          </Typography>
                        ) : resumoDiasPorTipo.length === 0 ? (
                          <Typography variant="body2" sx={{ color: 'text.secondary', fontStyle: 'italic', fontSize: '0.85rem' }}>
                            Nenhum afastamento registrado.
                          </Typography>
                        ) : (
                          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                            {resumoDiasPorTipo.map(([motivo, totalDias]) => (
                              <Box
                                key={motivo}
                                sx={{
                                  p: 1.5,
                                  backgroundColor: 'background.default',
                                  borderRadius: 1,
                                  border: 1,
                                  borderColor: 'divider',
                                }}
                              >
                                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                  <Typography variant="body2" sx={{ fontWeight: 500, fontSize: '0.85rem' }}>
                                    {motivo}
                                  </Typography>
                                  <Typography variant="body2" sx={{ fontWeight: 600, color: 'primary.main', fontSize: '0.85rem' }}>
                                    {totalDias} {totalDias === 1 ? 'dia' : 'dias'}
                                  </Typography>
                                </Box>
                              </Box>
                            ))}
                          </Box>
                        )}
                      </Box>
                    </Paper>
                  </Box>
                </Box>
              </Box>

              {/* Footer - Botões */}
            <Box sx={{ p: 2, borderTop: 1, borderColor: 'divider', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 2 }}>
              <Box sx={{ display: 'flex', gap: 2 }}>
                <button
                  type="button"
                  style={{
                    backgroundColor: '#ef4444',
                    border: '1px solid #ef4444',
                    color: '#ffffff',
                    padding: '8px 16px',
                    borderRadius: '8px',
                    cursor: 'pointer',
                    fontSize: '0.9rem',
                    fontWeight: 500,
                    transition: 'background-color 0.2s ease-in-out',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.backgroundColor = '#dc2626';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.backgroundColor = '#ef4444';
                  }}
                  onClick={() => {
                    if (!viewingPolicial) return;

                    setRestricaoModal({
                      open: true,
                      policial: viewingPolicial,
                      restricaoMedicaId: viewingPolicial.restricaoMedicaId ?? null,
                      loading: false,
                      error: null,
                    });
                  }}
                >
                  Inserir restrição
                </button>
              </Box>
              <Box sx={{ display: 'flex', gap: 2 }}>
                <button
                  type="button"
                  className="primary"
                  onClick={() => {
                    setViewingPolicial(null);
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
                      setViewingPolicial(null);
                      setViewingAfastamentos([]);
                      openEditModal(viewingPolicial);
                    }}
                  >
                    Editar
                  </button>
                )}
              </Box>
            </Box>
          </Box>
        </div>
      )}

      {/* Modal de Inserir Restrição Médica */}
      {restricaoModal.open && restricaoModal.policial && (
        <div className="modal-backdrop" role="dialog" aria-modal="true" onClick={() => {
          setRestricaoModal({ open: false, policial: null, restricaoMedicaId: null, loading: false, error: null });
        }}>
          <Box
            component="div"
            onClick={(e) => e.stopPropagation()}
            sx={{
              position: 'relative',
              width: '90%',
              maxWidth: '500px',
              backgroundColor: 'white',
              borderRadius: 2,
              boxShadow: 24,
              display: 'flex',
              flexDirection: 'column',
              overflow: 'hidden',
            }}
          >
            <Box sx={{ p: 3, borderBottom: 1, borderColor: 'divider' }}>
              <Typography variant="h5" component="h2" sx={{ fontWeight: 600, color: 'primary.main' }}>
                Inserir Restrição
              </Typography>
              <Typography variant="body2" sx={{ mt: 1, color: 'text.secondary' }}>
                {restricaoModal.policial.nome}
              </Typography>
            </Box>

            <Box sx={{ p: 3 }}>
              {restricaoModal.error && (
                <Box sx={{ mb: 2, p: 2, backgroundColor: 'error.light', borderRadius: 1, color: 'error.dark' }}>
                  {restricaoModal.error}
                </Box>
              )}

              <label style={{ display: 'block', marginBottom: '16px' }}>
                <span style={{ display: 'block', marginBottom: '8px', fontWeight: 500 }}>Restrição Médica</span>
                {loadingRestricoes ? (
                  <Typography variant="body2" sx={{ color: 'text.secondary', fontStyle: 'italic' }}>
                    Carregando restrições...
                  </Typography>
                ) : (
                  <select
                    value={restricaoModal.restricaoMedicaId ?? ''}
                    onChange={(e) => {
                      const value = e.target.value;
                      setRestricaoModal((prev) => ({
                        ...prev,
                        restricaoMedicaId: value === '' ? null : parseInt(value, 10),
                      }));
                    }}
                    disabled={restricaoModal.loading || loadingRestricoes}
                    style={{
                      width: '100%',
                      padding: '8px 12px',
                      fontSize: '1rem',
                      border: '1px solid #cbd5e1',
                      borderRadius: '8px',
                      backgroundColor: 'white',
                    }}
                  >
                    <option value="">Nenhuma restrição</option>
                    {restricoesMedicas.map((restricao) => (
                      <option key={restricao.id} value={restricao.id}>
                        {restricao.nome}
                      </option>
                    ))}
                  </select>
                )}
              </label>
            </Box>

            <Box sx={{ p: 2, borderTop: 1, borderColor: 'divider', display: 'flex', justifyContent: 'flex-end', gap: 2 }}>
              <button
                type="button"
                className="secondary"
                onClick={() => {
                  setRestricaoModal({ open: false, policial: null, restricaoMedicaId: null, loading: false, error: null });
                }}
                disabled={restricaoModal.loading}
              >
                Cancelar
              </button>
              <button
                type="button"
                className="primary"
                disabled={restricaoModal.loading}
                onClick={async () => {
                  if (!restricaoModal.policial) return;

                  try {
                    setRestricaoModal((prev) => ({ ...prev, loading: true, error: null }));
                    const updatedPolicial = await api.updateRestricaoMedicaPolicial(
                      restricaoModal.policial.id,
                      restricaoModal.restricaoMedicaId,
                    );

                    // Atualizar o policial na visualização
                    setViewingPolicial(updatedPolicial);
                    
                    // Recarregar lista de policiais
                    await carregarPoliciais(paginaAtual, itensPorPagina);

                    setRestricaoModal({ open: false, policial: null, restricaoMedicaId: null, loading: false, error: null });
                  } catch (err) {
                    setRestricaoModal((prev) => ({
                      ...prev,
                      loading: false,
                      error: err instanceof Error ? err.message : 'Erro ao salvar restrição médica',
                    }));
                  }
                }}
              >
                {restricaoModal.loading ? 'Salvando...' : 'Salvar'}
              </button>
            </Box>
          </Box>
        </div>
      )}

      {/* Modal de Remover Restrição Médica */}
      {removeRestricaoModal.open && removeRestricaoModal.policial && (
        <div className="modal-backdrop" role="dialog" aria-modal="true" onClick={() => {
          setRemoveRestricaoModal({ open: false, policial: null, senha: '', error: null, loading: false });
        }}>
          <Box
            component="div"
            onClick={(e) => e.stopPropagation()}
            sx={{
              position: 'relative',
              width: '90%',
              maxWidth: '500px',
              backgroundColor: 'white',
              borderRadius: 2,
              boxShadow: 24,
              display: 'flex',
              flexDirection: 'column',
              overflow: 'hidden',
            }}
          >
            <Box sx={{ p: 3, borderBottom: 1, borderColor: 'divider' }}>
              <Typography variant="h5" component="h2" sx={{ fontWeight: 600, color: 'primary.main' }}>
                Retirar Restrição Médica
              </Typography>
              <Typography variant="body2" sx={{ mt: 1, color: 'text.secondary' }}>
                {removeRestricaoModal.policial.nome}
              </Typography>
            </Box>

            <Box sx={{ p: 3 }}>
              <Typography variant="body1" sx={{ mb: 3 }}>
                Tem certeza que deseja retirar a restrição médica <strong>{removeRestricaoModal.policial.restricaoMedica?.nome}</strong> deste policial?
              </Typography>

              {removeRestricaoModal.error && (
                <Box sx={{ mb: 2, p: 2, backgroundColor: 'error.light', borderRadius: 1, color: 'error.dark' }}>
                  {removeRestricaoModal.error}
                </Box>
              )}

              <label style={{ display: 'block', marginBottom: '16px' }}>
                <span style={{ display: 'block', marginBottom: '8px', fontWeight: 500 }}>Digite sua senha para confirmar *</span>
                <input
                  type="password"
                  value={removeRestricaoModal.senha}
                  onChange={(e) => {
                    setRemoveRestricaoModal((prev) => ({
                      ...prev,
                      senha: e.target.value,
                      error: null,
                    }));
                  }}
                  disabled={removeRestricaoModal.loading}
                  style={{
                    width: '100%',
                    padding: '8px 12px',
                    fontSize: '1rem',
                    border: '1px solid #cbd5e1',
                    borderRadius: '8px',
                  }}
                  autoFocus
                />
              </label>
            </Box>

            <Box sx={{ p: 2, borderTop: 1, borderColor: 'divider', display: 'flex', justifyContent: 'flex-end', gap: 2 }}>
              <button
                type="button"
                className="secondary"
                onClick={() => {
                  setRemoveRestricaoModal({ open: false, policial: null, senha: '', error: null, loading: false });
                }}
                disabled={removeRestricaoModal.loading}
              >
                Cancelar
              </button>
              <button
                type="button"
                className="primary"
                disabled={removeRestricaoModal.loading || !removeRestricaoModal.senha}
                onClick={async () => {
                  if (!removeRestricaoModal.policial || !removeRestricaoModal.senha) return;

                  try {
                    setRemoveRestricaoModal((prev) => ({ ...prev, loading: true, error: null }));
                    const updatedPolicial = await api.removeRestricaoMedicaPolicial(
                      removeRestricaoModal.policial.id,
                      removeRestricaoModal.senha,
                    );

                    // Atualizar o policial na visualização
                    setViewingPolicial(updatedPolicial);
                    
                    // Recarregar lista de policiais
                    await carregarPoliciais(paginaAtual, itensPorPagina);

                    setRemoveRestricaoModal({ open: false, policial: null, senha: '', error: null, loading: false });
                  } catch (err) {
                    setRemoveRestricaoModal((prev) => ({
                      ...prev,
                      loading: false,
                      error: err instanceof Error ? err.message : 'Erro ao remover restrição médica',
                    }));
                  }
                }}
              >
                {removeRestricaoModal.loading ? 'Removendo...' : 'Confirmar'}
              </button>
            </Box>
          </Box>
        </div>
      )}

      {/* Modal de Exclusão Permanente */}
      {deleteModal.open && deleteModal.policial && (
        <div className="modal-backdrop" role="dialog" aria-modal="true" onClick={handleCloseDeleteModal}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h3>Excluir Permanentemente</h3>
            <p style={{ marginBottom: '24px', color: '#ef4444', fontWeight: 500 }}>
              ⚠️ Esta ação não pode ser desfeita!
            </p>
            <p style={{ marginBottom: '24px' }}>
              Tem certeza que deseja excluir permanentemente <strong>{deleteModal.policial.nome}</strong> (matrícula {deleteModal.policial.matricula}) do banco de dados?
            </p>
            
            {deleteModal.error && (
              <div className="feedback error" style={{ marginBottom: '16px' }}>
                {deleteModal.error}
                <button
                  type="button"
                  className="feedback-close"
                  onClick={() => setDeleteModal((prev) => ({ ...prev, error: null }))}
                  aria-label="Fechar"
                >
                  ×
                </button>
              </div>
            )}

            <form
              onSubmit={(e) => {
                e.preventDefault();
                void handleConfirmDelete();
              }}
            >
              <label>
                Senha do Administrador
                <input
                  type="password"
                  value={deleteModal.senha}
                  onChange={(event) =>
                    setDeleteModal((prev) => ({
                      ...prev,
                      senha: event.target.value,
                      error: null,
                    }))
                  }
                  placeholder="Digite a senha do administrador"
                  autoFocus
                  disabled={deleteModal.loading}
                  required
                />
              </label>

              <div className="modal-actions">
                <button
                  type="button"
                  className="secondary"
                  onClick={handleCloseDeleteModal}
                  disabled={deleteModal.loading}
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="danger"
                  disabled={deleteModal.loading || !deleteModal.senha.trim()}
                >
                  {deleteModal.loading ? 'Excluindo...' : 'Sim, excluir permanentemente'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </section>
  );
}
