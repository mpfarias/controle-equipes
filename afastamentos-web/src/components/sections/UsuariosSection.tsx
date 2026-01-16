import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { api } from '../../api';
import type {
  CreateUsuarioInput,
  Equipe,
  FuncaoOption,
  Usuario,
  UsuarioNivelOption,
} from '../../types';
import { EQUIPE_OPTIONS, PERGUNTAS_SEGURANCA } from '../../constants';
import type { ConfirmConfig } from '../common/ConfirmDialog';

interface UsuariosSectionProps {
  currentUser: Usuario;
  openConfirm: (config: ConfirmConfig) => void;
  onCurrentUserUpdate?: (user: Usuario) => void;
}

export function UsuariosSection({
  currentUser,
  openConfirm,
  onCurrentUserUpdate,
}: UsuariosSectionProps) {
  const initialCreateForm = {
    nome: '',
    matricula: '',
    senha: '',
    confirmarSenha: '',
    perguntaSeguranca: '',
    respostaSeguranca: '',
    equipe: 'A' as Equipe,
    nivelId: 0 as number, // Será preenchido quando os níveis forem carregados
    funcaoId: undefined as number | undefined,
  };

  const initialEditForm = {
    nome: '',
    matricula: '',
    senha: '',
    confirmarSenha: '',
    perguntaSeguranca: '',
    respostaSeguranca: '',
    equipe: 'A' as Equipe,
    nivelId: 0 as number, // Será preenchido quando os níveis forem carregados ou ao editar
    funcaoId: undefined as number | undefined,
  };

  const [usuarios, setUsuarios] = useState<Usuario[]>([]);
  const [usuarioNiveis, setUsuarioNiveis] = useState<UsuarioNivelOption[]>([]);
  const [funcoes, setFuncoes] = useState<FuncaoOption[]>([]);
  const [loading, setLoading] = useState(false);
  const [paginaAtual, setPaginaAtual] = useState(1);
  const [itensPorPagina, setItensPorPagina] = useState(20);
  const [totalUsuarios, setTotalUsuarios] = useState(0);
  const [totalPaginas, setTotalPaginas] = useState(1);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [form, setForm] = useState(initialCreateForm);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [showEditPassword, setShowEditPassword] = useState(false);
  const [showEditConfirmPassword, setShowEditConfirmPassword] = useState(false);
  const [editingUsuario, setEditingUsuario] = useState<Usuario | null>(null);
  const [editForm, setEditForm] = useState(initialEditForm);
  const [editSubmitting, setEditSubmitting] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [matriculaError, setMatriculaError] = useState<string | null>(null);
  const matriculaTimeoutRef = useRef<number | null>(null);
  const [deleteModal, setDeleteModal] = useState<{
    open: boolean;
    usuario: Usuario | null;
    senha: string;
    error: string | null;
    loading: boolean;
  }>({
    open: false,
    usuario: null,
    senha: '',
    error: null,
    loading: false,
  });

  const carregarUsuarios = useCallback(async (page: number, pageSize: number) => {
    try {
      setLoading(true);
      const data = await api.listUsuariosPaginated({
        page,
        pageSize,
      });
      setUsuarios(data.usuarios);
      const totalPages = Math.max(1, data.totalPages);
      setTotalUsuarios(data.total);
      setTotalPaginas(totalPages);
      if (page > totalPages) {
        setPaginaAtual(totalPages);
      }
      setError(null);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Não foi possível carregar os usuários.',
      );
    } finally {
      setLoading(false);
    }
  }, []);

  const carregarNiveis = useCallback(async () => {
    try {
      const data = await api.listUsuarioNiveis();
      setUsuarioNiveis(data);
    } catch (err) {
      console.error('Erro ao carregar níveis:', err);
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

  // Função helper para filtrar funções baseado no nível
  const filtrarFuncoesPorNivel = useCallback((nivelId: number | undefined | null): FuncaoOption[] => {
    if (!nivelId) {
      return [];
    }
    
    const nivelSelecionado = usuarioNiveis.find(n => n.id === nivelId);
    if (!nivelSelecionado) {
      return [];
    }
    
    let funcoesFiltradas: FuncaoOption[] = [];
    
    switch (nivelSelecionado.nome) {
      case 'ADMINISTRADOR':
        // ADMINISTRADOR: todas as funções
        funcoesFiltradas = funcoes;
        break;
      case 'COMANDO':
        // COMANDO: CMT UPM e SUBCMT UPM
        funcoesFiltradas = funcoes.filter(f => 
          f.nome === 'CMT UPM' || f.nome === 'SUBCMT UPM'
        );
        break;
      case 'SAD':
        // SAD: EXPEDIENTE ADM
        funcoesFiltradas = funcoes.filter(f => 
          f.nome === 'EXPEDIENTE ADM'
        );
        break;
      case 'OPERAÇÕES':
        // OPERAÇÕES: OFICIAL DE OPERAÇÕES COPOM, OFICIAL DE OPERAÇÕES COPOM - AUXILIAR, DESPACHANTE 190, 
        // TELEFONISTA 190, TELEFONISTA 190 - AUXILIAR, ANALISTA, SUPERVISOR ATENDIMENTO 190, SUPERVISOR DESPACHO 190
        funcoesFiltradas = funcoes.filter(f => 
          f.nome === 'OFICIAL DE OPERAÇÕES COPOM' ||
          f.nome === 'OFICIAL DE OPERAÇÕES COPOM - AUXILIAR' ||
          f.nome === 'DESPACHANTE 190' ||
          f.nome === 'TELEFONISTA 190' ||
          f.nome === 'TELEFONISTA 190 - AUXILIAR' ||
          f.nome === 'ANALISTA' ||
          f.nome === 'SUPERVISOR ATENDIMENTO 190' ||
          f.nome === 'SUPERVISOR DESPACHO 190'
        );
        break;
      default:
        funcoesFiltradas = [];
    }
    
    // Ordenar alfabeticamente
    return funcoesFiltradas.sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR', { sensitivity: 'base' }));
  }, [funcoes, usuarioNiveis]);

  // Filtrar e ordenar funções de acordo com o nível selecionado no formulário de criação
  const funcoesDisponiveis = useMemo(() => {
    return filtrarFuncoesPorNivel(form.nivelId);
  }, [form.nivelId, filtrarFuncoesPorNivel]);

  // Filtrar e ordenar funções de acordo com o nível selecionado no formulário de edição
  const funcoesDisponiveisEdit = useMemo(() => {
    return filtrarFuncoesPorNivel(editForm.nivelId);
  }, [editForm.nivelId, filtrarFuncoesPorNivel]);

  // Função helper para verificar se o usuário é administrador
  const isUsuarioAdministrador = useCallback((usuario: Usuario): boolean => {
    // Verificar se tem isAdmin = true
    if (usuario.isAdmin === true) {
      return true;
    }
    // Verificar se o nível é ADMINISTRADOR
    if (usuario.nivel?.nome === 'ADMINISTRADOR') {
      return true;
    }
    // Verificar se o nivelId corresponde ao nível ADMINISTRADOR
    const nivelAdmin = usuarioNiveis.find((n: UsuarioNivelOption) => n.nome === 'ADMINISTRADOR');
    if (nivelAdmin && usuario.nivelId === nivelAdmin.id) {
      return true;
    }
    return false;
  }, [usuarioNiveis]);

  // Verificar se o usuário logado é administrador
  const currentUserIsAdmin = useMemo(() => {
    return isUsuarioAdministrador(currentUser);
  }, [currentUser, isUsuarioAdministrador]);

  // Filtrar níveis disponíveis: remover ADMINISTRADOR se o usuário não for admin
  const niveisDisponiveis = useMemo(() => {
    if (currentUserIsAdmin) {
      return usuarioNiveis;
    }
    return usuarioNiveis.filter((nivel: UsuarioNivelOption) => nivel.nome !== 'ADMINISTRADOR');
  }, [usuarioNiveis, currentUserIsAdmin]);

  // Verificar se o nível selecionado é OPERAÇÕES
  const isNivelOperacoes = useCallback((nivelId: number | undefined | null): boolean => {
    if (!nivelId) return false;
    const nivel = usuarioNiveis.find(n => n.id === nivelId);
    return nivel?.nome === 'OPERAÇÕES';
  }, [usuarioNiveis]);

  // Verificar se já existe um usuário com a função CMT UPM ou SUBCMT UPM
  const verificarFuncaoUnica = useCallback((funcaoId: number | undefined, excluirUsuarioId?: number): { existe: boolean; nomeFuncao: string | null } => {
    if (!funcaoId) {
      return { existe: false, nomeFuncao: null };
    }

    const funcao = funcoes.find(f => f.id === funcaoId);
    if (!funcao) {
      return { existe: false, nomeFuncao: null };
    }

    const nomeFuncao = funcao.nome;
    // Verificar apenas para CMT UPM e SUBCMT UPM
    if (nomeFuncao !== 'CMT UPM' && nomeFuncao !== 'SUBCMT UPM') {
      return { existe: false, nomeFuncao: null };
    }

    // Verificar se já existe outro usuário com essa função
    const usuarioExistente = usuarios.find(u => {
      // Excluir o próprio usuário sendo editado
      if (excluirUsuarioId && u.id === excluirUsuarioId) {
        return false;
      }
      return u.funcao?.nome === nomeFuncao;
    });

    return {
      existe: !!usuarioExistente,
      nomeFuncao: usuarioExistente ? nomeFuncao : null,
    };
  }, [usuarios, funcoes]);

  const validateMatricula = useCallback((matricula: string) => {
    // Se a lista ainda não foi carregada, não valida
    if (loading || usuarios.length === 0 && !error) {
      return;
    }

    const matriculaTrimmed = matricula.trim().toUpperCase();
    if (!matriculaTrimmed) {
      setMatriculaError(null);
      return;
    }

    const matriculaExists = usuarios.some(
      (usuario) => usuario.matricula.toUpperCase() === matriculaTrimmed,
    );

    if (matriculaExists) {
      setMatriculaError('Esta matrícula já está cadastrada.');
    } else {
      setMatriculaError(null);
    }
  }, [usuarios, loading, error]);

  useEffect(() => {
    void carregarUsuarios(paginaAtual, itensPorPagina);
  }, [carregarUsuarios, paginaAtual, itensPorPagina]);

  useEffect(() => {
    void carregarNiveis();
    void carregarFuncoes();
  }, [carregarNiveis, carregarFuncoes]);

  // Quando os níveis forem carregados, definir o primeiro como padrão se não houver seleção
  useEffect(() => {
    if (niveisDisponiveis.length > 0) {
      // Se o form ainda não tem um nivelId válido, usar o primeiro nível disponível (geralmente OPERAÇÕES)
      if (!form.nivelId || form.nivelId === 0) {
        const primeiroNivel = niveisDisponiveis.find(n => n.nome === 'OPERAÇÕES') || niveisDisponiveis[0];
        if (primeiroNivel) {
          setForm(prev => ({ ...prev, nivelId: primeiroNivel.id }));
        }
      }
      // Se o nível selecionado não está mais disponível (ex: era ADMINISTRADOR e usuário não é admin), resetar
      const nivelSelecionado = niveisDisponiveis.find(n => n.id === form.nivelId);
      if (!nivelSelecionado && form.nivelId !== 0) {
        const primeiroNivel = niveisDisponiveis.find(n => n.nome === 'OPERAÇÕES') || niveisDisponiveis[0];
        if (primeiroNivel) {
          setForm(prev => ({ ...prev, nivelId: primeiroNivel.id }));
        }
      }
    }
  }, [niveisDisponiveis, form.nivelId]);

  // Revalidar matrícula quando a lista de usuários for atualizada
  useEffect(() => {
    if (form.matricula.trim() && !loading) {
      validateMatricula(form.matricula);
    }
  }, [usuarios, form.matricula, validateMatricula, loading]);

  const handleChange = (field: keyof typeof form, value: string | number | undefined) => {
    if (field === 'nome' && typeof value === 'string') {
      value = value.toUpperCase();
    }
    if (field === 'matricula' && typeof value === 'string') {
      value = value.replace(/[^0-9xX]/g, '').toUpperCase();
      setForm((prev) => ({ ...prev, [field]: value as string }));
      
      // Limpar timeout anterior
      if (matriculaTimeoutRef.current) {
        clearTimeout(matriculaTimeoutRef.current);
      }
      
      // Limpar erro imediatamente se o campo estiver vazio
      if (!value.trim()) {
        setMatriculaError(null);
        return;
      }
      
      // Validar após 300ms de inatividade (debounce)
      matriculaTimeoutRef.current = setTimeout(() => {
        validateMatricula(value as string);
      }, 300);
      
      return;
    }
    if (field === 'equipe' && typeof value === 'string') {
      value = value.toUpperCase();
    }
    // Se o campo alterado for nivelId, verificar se precisa limpar a equipe e função
    if (field === 'nivelId') {
      setForm((prev) => {
        const novoNivel = usuarioNiveis.find(n => n.id === (value as number));
        const isOperacoes = novoNivel?.nome === 'OPERAÇÕES';
        
        // Verificar se a função atual ainda está disponível para o novo nível
        const funcoesDisponiveisNovoNivel = filtrarFuncoesPorNivel(value as number);
        const funcaoAindaDisponivel = prev.funcaoId 
          ? funcoesDisponiveisNovoNivel.some(f => f.id === prev.funcaoId)
          : true;
        
        return {
          ...prev,
          nivelId: (value as number) || 0,
          // Se não for OPERAÇÕES, manter 'A' como padrão (mas não será enviado)
          equipe: isOperacoes ? prev.equipe : 'A' as Equipe,
          // Se a função não estiver mais disponível, limpar
          funcaoId: funcaoAindaDisponivel ? prev.funcaoId : undefined,
        };
      });
      return;
    }
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const resetForm = () => {
    setForm(initialCreateForm);
    setMatriculaError(null);
    if (matriculaTimeoutRef.current) {
      clearTimeout(matriculaTimeoutRef.current);
      matriculaTimeoutRef.current = null;
    }
  };

  // Limpar timeout ao desmontar o componente
  useEffect(() => {
    return () => {
      if (matriculaTimeoutRef.current) {
        clearTimeout(matriculaTimeoutRef.current);
      }
    };
  }, []);

  const resetEditForm = () => {
    setEditForm(initialEditForm);
    setEditingUsuario(null);
    setEditError(null);
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    setSuccess(null);

    const nome = form.nome.trim();
    const matricula = form.matricula.trim();

    if (!nome || !matricula) {
      setError('Informe nome e matrícula.');
      return;
    }

    // Validar matrícula antes de submeter
    const matriculaExists = usuarios.some(
      (usuario) => usuario.matricula.toUpperCase() === matricula.toUpperCase(),
    );
    if (matriculaExists) {
      setMatriculaError('Esta matrícula já está cadastrada.');
      setError('Esta matrícula já está cadastrada.');
      return;
    }

    if (form.senha.length < 6) {
      setError('A senha deve ter pelo menos 6 caracteres.');
      return;
    }

    if (form.senha !== form.confirmarSenha) {
      setError('As senhas informadas não conferem.');
      return;
    }

    if (!form.nivelId || form.nivelId === 0) {
      setError('Selecione um nível para o usuário.');
      return;
    }

    // Validar se está tentando criar usuário como ADMINISTRADOR sem permissão
    const nivelSelecionado = usuarioNiveis.find(n => n.id === form.nivelId);
    if (nivelSelecionado?.nome === 'ADMINISTRADOR' && !currentUserIsAdmin) {
      setError('Apenas administradores podem cadastrar outros usuários como administradores.');
      return;
    }

    // Validar se já existe um usuário com CMT UPM ou SUBCMT UPM
    if (form.funcaoId) {
      const validacaoFuncao = verificarFuncaoUnica(form.funcaoId);
      if (validacaoFuncao.existe && validacaoFuncao.nomeFuncao) {
        setError(`Já existe um usuário cadastrado com a função ${validacaoFuncao.nomeFuncao}. Apenas um usuário pode ter essa função.`);
        return;
      }
    }

    try {
      setSubmitting(true);
      const nivelSelecionado = usuarioNiveis.find(n => n.id === form.nivelId);
      const payload: CreateUsuarioInput = {
        nome,
        matricula,
        senha: form.senha,
        perguntaSeguranca: form.perguntaSeguranca.trim() || undefined,
        respostaSeguranca: form.respostaSeguranca.trim() || undefined,
        nivelId: form.nivelId,
        funcaoId: form.funcaoId,
        // Enviar equipe: se for OPERAÇÕES, usar o valor selecionado; caso contrário, enviar "SEM_EQUIPE"
        equipe: nivelSelecionado?.nome === 'OPERAÇÕES' ? form.equipe : 'SEM_EQUIPE' as Equipe,
      };
      await api.createUsuario(payload);
      resetForm();
      setSuccess('Usuário cadastrado com sucesso.');
      await carregarUsuarios(paginaAtual, itensPorPagina);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Não foi possível criar o usuário.',
      );
    } finally {
      setSubmitting(false);
    }
  };

  const handleEditChange = (
    field: keyof typeof editForm,
    value: string | number | undefined,
  ) => {
    if (field === 'nome' && typeof value === 'string') {
      value = value.toUpperCase();
    }
    if (field === 'matricula' && typeof value === 'string') {
      value = value.replace(/[^0-9xX]/g, '').toUpperCase();
    }
    if (field === 'equipe' && typeof value === 'string') {
      value = value.toUpperCase();
    }
    // Se o campo alterado for nivelId, verificar se precisa limpar a equipe e função
    if (field === 'nivelId') {
      setEditForm((prev) => {
        const novoNivel = usuarioNiveis.find(n => n.id === (value as number));
        const isOperacoes = novoNivel?.nome === 'OPERAÇÕES';
        
        // Verificar se a função atual ainda está disponível para o novo nível
        const funcoesDisponiveisNovoNivel = filtrarFuncoesPorNivel(value as number);
        const funcaoAindaDisponivel = prev.funcaoId 
          ? funcoesDisponiveisNovoNivel.some(f => f.id === prev.funcaoId)
          : true;
        
        return {
          ...prev,
          nivelId: (value as number) || 0,
          // Se não for OPERAÇÕES, definir equipe como SEM_EQUIPE
          equipe: isOperacoes ? prev.equipe : 'SEM_EQUIPE' as Equipe,
          // Se a função não estiver mais disponível, limpar
          funcaoId: funcaoAindaDisponivel ? prev.funcaoId : undefined,
        };
      });
      return;
    }
    setEditForm((prev) => ({ ...prev, [field]: value }));
  };

  const handleEdit = (usuario: Usuario) => {
    setEditingUsuario(usuario);
    // Se o usuário não tiver nivelId, usar o primeiro nível disponível (geralmente OPERAÇÕES)
    let nivelId = usuario.nivelId ?? 0;
    
    // Se o usuário sendo editado é administrador e o usuário logado não é admin,
    // manter o nível ADMINISTRADOR (não permitir alteração)
    const usuarioEditadoIsAdmin = isUsuarioAdministrador(usuario);
    if (usuarioEditadoIsAdmin && !currentUserIsAdmin) {
      // Manter o nível atual do usuário sendo editado
      nivelId = usuario.nivelId ?? 0;
    } else if (!nivelId && niveisDisponiveis.length > 0) {
      const primeiroNivel = niveisDisponiveis.find(n => n.nome === 'OPERAÇÕES') || niveisDisponiveis[0];
      nivelId = primeiroNivel?.id ?? 0;
    }
    
    // Verificar se a função do usuário está disponível para o nível dele
    const funcoesDisponiveisParaNivel = filtrarFuncoesPorNivel(nivelId);
    const funcaoDisponivel = usuario.funcaoId 
      ? funcoesDisponiveisParaNivel.some(f => f.id === usuario.funcaoId)
      : true;
    
    const nivelDoUsuario = usuarioNiveis.find(n => n.id === nivelId);
    const isOperacoes = nivelDoUsuario?.nome === 'OPERAÇÕES';
    
    setEditForm({
      nome: usuario.nome,
      matricula: usuario.matricula,
      senha: '',
      confirmarSenha: '',
      perguntaSeguranca: usuario.perguntaSeguranca || '',
      respostaSeguranca: '',
      // Se for OPERAÇÕES, usar a equipe do usuário (ou 'A' como padrão); caso contrário, usar 'SEM_EQUIPE'
      equipe: isOperacoes ? (usuario.equipe ?? 'A') : 'SEM_EQUIPE' as Equipe,
      nivelId: nivelId,
      funcaoId: funcaoDisponivel ? (usuario.funcaoId ?? undefined) : undefined,
    });
    setEditError(null);
  };

  const handleEditSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!editingUsuario) {
      return;
    }

    const nome = editForm.nome.trim();
    const matricula = editForm.matricula.trim();

    if (!nome || !matricula) {
      setEditError('Informe nome e matrícula.');
      return;
    }

    if (editForm.senha) {
      if (editForm.senha.length < 6) {
        setEditError('A senha deve ter pelo menos 6 caracteres.');
        return;
      }

      if (editForm.senha !== editForm.confirmarSenha) {
        setEditError('As senhas informadas não conferem.');
        return;
      }
    }

    if (!editForm.nivelId || editForm.nivelId === 0) {
      setEditError('Selecione um nível para o usuário.');
      return;
    }

    // Validar se está tentando editar usuário para ADMINISTRADOR sem permissão
    const nivelSelecionadoEdit = usuarioNiveis.find(n => n.id === editForm.nivelId);
    if (nivelSelecionadoEdit?.nome === 'ADMINISTRADOR' && !currentUserIsAdmin) {
      setEditError('Apenas administradores podem definir outros usuários como administradores.');
      return;
    }

    // Validar se já existe um usuário com CMT UPM ou SUBCMT UPM (excluindo o próprio usuário sendo editado)
    if (editForm.funcaoId) {
      const validacaoFuncao = verificarFuncaoUnica(editForm.funcaoId, editingUsuario.id);
      if (validacaoFuncao.existe && validacaoFuncao.nomeFuncao) {
        setEditError(`Já existe um usuário cadastrado com a função ${validacaoFuncao.nomeFuncao}. Apenas um usuário pode ter essa função.`);
        return;
      }
    }

    const novaSenha = editForm.senha;
    const payloadBase: Partial<CreateUsuarioInput> = {
      nome,
      matricula,
      perguntaSeguranca: editForm.perguntaSeguranca.trim() || undefined,
      respostaSeguranca: editForm.respostaSeguranca.trim() || undefined,
      // Enviar equipe: se for OPERAÇÕES, usar o valor selecionado; caso contrário, enviar "SEM_EQUIPE"
      equipe: nivelSelecionadoEdit?.nome === 'OPERAÇÕES' ? editForm.equipe : 'SEM_EQUIPE' as Equipe,
      nivelId: editForm.nivelId,
      funcaoId: editForm.funcaoId,
    };

    openConfirm({
      title: 'Confirmar edição',
      message: `Deseja salvar as alterações para ${editingUsuario.nome}?`,
      confirmLabel: 'Salvar',
      onConfirm: async () => {
        try {
          setEditSubmitting(true);
          const payload: Partial<CreateUsuarioInput> = { ...payloadBase };
          if (novaSenha) {
            payload.senha = novaSenha;
          }
          await api.updateUsuario(editingUsuario.id, payload);
          setSuccess('Usuário atualizado com sucesso.');
          resetEditForm();
          await carregarUsuarios(paginaAtual, itensPorPagina);
          
          // Se o usuário editado for o usuário logado, atualizar currentUser
          if (editingUsuario.id === currentUser.id && onCurrentUserUpdate) {
            try {
              const updatedUser = await api.getUsuario(currentUser.id);
              if (updatedUser) {
                onCurrentUserUpdate(updatedUser);
              }
            } catch (err) {
              console.warn('Não foi possível atualizar dados do usuário logado:', err);
            }
          }
        } catch (err) {
          setEditError(
            err instanceof Error ? err.message : 'Não foi possível atualizar o usuário.',
          );
        } finally {
          setEditSubmitting(false);
        }
      },
    });
  };

  const handleDelete = (usuario: Usuario) => {
    openConfirm({
      title: 'Desativar usuário',
      message: `Deseja desativar o usuário ${usuario.nome} (matrícula ${usuario.matricula})?`,
      confirmLabel: 'Desativar',
      onConfirm: async () => {
        try {
          setError(null);
          await api.removeUsuario(usuario.id);
          if (editingUsuario?.id === usuario.id) {
            resetEditForm();
          }
          setSuccess('Usuário desativado.');
          await carregarUsuarios(paginaAtual, itensPorPagina);
        } catch (err) {
          setError(
            err instanceof Error
              ? err.message
              : 'Não foi possível desativar o usuário.',
          );
        }
      },
    });
  };

  const handleActivate = (usuario: Usuario) => {
    openConfirm({
      title: 'Ativar usuário',
      message: `Deseja ativar o usuário ${usuario.nome} (matrícula ${usuario.matricula})?`,
      confirmLabel: 'Ativar',
      onConfirm: async () => {
        try {
          setError(null);
          await api.activateUsuario(usuario.id);
          if (editingUsuario?.id === usuario.id) {
            resetEditForm();
          }
          setSuccess('Usuário ativado.');
          await carregarUsuarios(paginaAtual, itensPorPagina);
        } catch (err) {
          setError(
            err instanceof Error
              ? err.message
              : 'Não foi possível ativar o usuário.',
          );
        }
      },
    });
  };

  const handleDeletePermanent = (usuario: Usuario) => {
    setDeleteModal({
      open: true,
      usuario,
      senha: '',
      error: null,
      loading: false,
    });
  };

  const handleCloseDeleteModal = () => {
    setDeleteModal({
      open: false,
      usuario: null,
      senha: '',
      error: null,
      loading: false,
    });
  };

  const handleConfirmDelete = async () => {
    if (!deleteModal.usuario) {
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
      await api.deleteUsuario(deleteModal.usuario.id, deleteModal.senha);
      
      if (editingUsuario?.id === deleteModal.usuario.id) {
        resetEditForm();
      }
      
      setSuccess('Usuário excluído permanentemente.');
      handleCloseDeleteModal();
      await carregarUsuarios(paginaAtual, itensPorPagina);
    } catch (err) {
      let errorMessage = 'Não foi possível excluir o usuário.';
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
  const filteredUsuarios = useMemo(() => {
    // Primeiro, filtrar por busca se houver
    let usuariosFiltrados = usuarios;
    if (normalizedSearch) {
      usuariosFiltrados = usuarios.filter((usuario) =>
        usuario.nome.includes(normalizedSearch),
      );
    }
    
    // Se o usuário logado não é administrador, remover administradores da lista
    if (!currentUserIsAdmin) {
      usuariosFiltrados = usuariosFiltrados.filter((usuario) => 
        !isUsuarioAdministrador(usuario)
      );
    }
    
    return usuariosFiltrados;
  }, [usuarios, normalizedSearch, currentUserIsAdmin, isUsuarioAdministrador]);

  const totalVisivel = normalizedSearch ? filteredUsuarios.length : totalUsuarios;
  const registroInicio = totalVisivel === 0 ? 0 : ((paginaAtual - 1) * itensPorPagina) + 1;
  const registroFim = totalVisivel === 0 ? 0 : Math.min(paginaAtual * itensPorPagina, totalVisivel);

  return (
    <section>
      <div>
        <h2>Usuários</h2>
        <p>Cadastre usuários responsáveis pelo acesso ao painel.</p>
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

      <form onSubmit={handleSubmit}>
        <div className="grid three-columns">
          <label>
            Nome
            <input
              autoFocus
              value={form.nome}
              onChange={(event) => handleChange('nome', event.target.value)}
              placeholder="2º SGT MARIA SILVA"
              required
            />
          </label>
          <label>
            Matrícula
            <input
              value={form.matricula}
              onChange={(event) => handleChange('matricula', event.target.value)}
              placeholder="Matrícula"
              required
              className={matriculaError ? 'input-error' : ''}
              aria-invalid={matriculaError ? 'true' : 'false'}
            />
            {matriculaError && (
              <span className="field-error">{matriculaError}</span>
            )}
          </label>
          <label>
            Nível
            <select
              value={form.nivelId || ''}
              onChange={(event) =>
                handleChange(
                  'nivelId',
                  event.target.value ? Number(event.target.value) : 0,
                )
              }
              required
            >
              <option value="">Selecione um nível</option>
              {niveisDisponiveis.map((nivel) => (
                <option key={nivel.id} value={nivel.id}>
                  {nivel.nome}
                </option>
              ))}
            </select>
          </label>
        </div>
        <div className={isNivelOperacoes(form.nivelId) ? 'grid two-columns' : 'grid one-column'}>
          {isNivelOperacoes(form.nivelId) && (
            <label>
              Equipe
              <select
                value={form.equipe}
                onChange={(event) => handleChange('equipe', event.target.value)}
                required
              >
                {EQUIPE_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
          )}
          <label>
            Função
            <select
              value={form.funcaoId || ''}
              onChange={(event) =>
                handleChange(
                  'funcaoId',
                  event.target.value ? Number(event.target.value) : undefined,
                )
              }
            >
              <option value="">Selecione uma função</option>
              {funcoesDisponiveis.map((funcao) => (
                <option key={funcao.id} value={funcao.id}>
                  {funcao.nome}
                </option>
              ))}
            </select>
          </label>
        </div>
        <div className="grid two-columns">
          <label>
            Senha
            <div className="password-input-wrapper">
              <input
                type={showPassword ? 'text' : 'password'}
                value={form.senha}
                onChange={(event) => handleChange('senha', event.target.value)}
                placeholder="Informe uma senha forte"
                required
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="password-toggle"
                tabIndex={-1}
              >
                {showPassword ? (
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"></path>
                    <line x1="1" y1="1" x2="23" y2="23"></line>
                  </svg>
                ) : (
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
                    <circle cx="12" cy="12" r="3"></circle>
                  </svg>
                )}
              </button>
            </div>
          </label>
          <label>
            Confirmar senha
            <div className="password-input-wrapper">
              <input
                type={showConfirmPassword ? 'text' : 'password'}
                value={form.confirmarSenha}
                onChange={(event) => handleChange('confirmarSenha', event.target.value)}
                placeholder="Repita a senha"
                required
              />
              <button
                type="button"
                onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                className="password-toggle"
                tabIndex={-1}
              >
                {showConfirmPassword ? (
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"></path>
                    <line x1="1" y1="1" x2="23" y2="23"></line>
                  </svg>
                ) : (
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
                    <circle cx="12" cy="12" r="3"></circle>
                  </svg>
                )}
              </button>
            </div>
          </label>
        </div>
        <div className="grid two-columns">
          <label>
            Pergunta de Segurança
            <select
              value={form.perguntaSeguranca}
              onChange={(event) => handleChange('perguntaSeguranca', event.target.value)}
            >
              <option value="">Selecione uma pergunta</option>
              {PERGUNTAS_SEGURANCA.map((pergunta) => (
                <option key={pergunta} value={pergunta}>
                  {pergunta}
                </option>
              ))}
            </select>
          </label>
          <label>
            Resposta de Segurança
            <input
              type="text"
              value={form.respostaSeguranca}
              onChange={(event) => handleChange('respostaSeguranca', event.target.value)}
              placeholder="Digite a resposta"
            />
          </label>
        </div>
        <div className="form-actions">
          <button className="primary" type="submit" disabled={submitting}>
            {submitting ? 'Salvando...' : 'Cadastrar usuário'}
          </button>
        </div>
      </form>

      <div>
        <h3>Lista de usuários</h3>
      </div>
      <div className="list-controls">
        <input
          className="search-input"
          value={searchTerm}
          onChange={(event) => setSearchTerm(event.target.value.toUpperCase())}
          placeholder="Pesquisar por nome"
        />
        <select
          value={itensPorPagina}
          onChange={(event) => {
            setItensPorPagina(Number(event.target.value));
            setPaginaAtual(1);
          }}
          style={{ maxWidth: '140px' }}
          aria-label="Itens por página"
        >
          <option value={10}>10 / página</option>
          <option value={20}>20 / página</option>
          <option value={50}>50 / página</option>
          <option value={100}>100 / página</option>
        </select>
      </div>
      {loading ? (
        <p className="empty-state">Carregando usuários...</p>
      ) : filteredUsuarios.length === 0 ? (
        <p className="empty-state">Nenhum usuário cadastrado.</p>
      ) : (
        <table className="table">
          <thead>
            <tr>
              <th>Nome</th>
              <th>Matrícula</th>
              <th>Equipe</th>
              <th>Nível</th>
              <th>Ações</th>
            </tr>
          </thead>
          <tbody>
            {filteredUsuarios.map((usuario) => (
              <tr
                key={usuario.id}
                style={
                  usuario.status === 'DESATIVADO'
                    ? { backgroundColor: '#fee2e2' }
                    : undefined
                }
              >
                <td>{usuario.nome}</td>
                <td>{usuario.matricula}</td>
                <td>{usuario.equipe === 'SEM_EQUIPE' ? 'Sem Equipe' : usuario.equipe}</td>
                <td>{usuario.nivel?.nome || '-'}</td>
                <td className="actions">
                  {usuario.status === 'ATIVO' && (
                    <button
                      className="secondary"
                      type="button"
                      onClick={() => handleEdit(usuario)}
                    >
                      Editar
                    </button>
                  )}
                  {usuario.id !== currentUser.id && (
                    <>
                      {usuario.status === 'ATIVO' ? (
                        <button
                          className="danger"
                          type="button"
                          onClick={() => handleDelete(usuario)}
                        >
                          Desativar
                        </button>
                      ) : (
                        <button
                          className="primary"
                          type="button"
                          onClick={() => handleActivate(usuario)}
                        >
                          Ativar
                        </button>
                      )}
                      <button
                        className="danger-delete"
                        type="button"
                        onClick={() => handleDeletePermanent(usuario)}
                      >
                        Excluir
                      </button>
                    </>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {totalPaginas > 1 && (
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginTop: '16px',
            padding: '12px',
            backgroundColor: '#f8f9fa',
            borderRadius: '8px',
            border: '1px solid #e9ecef',
          }}
        >
          <div style={{ fontSize: '0.9rem', color: '#64748b' }}>
            Mostrando {registroInicio} a {registroFim} de {totalVisivel} registro(s)
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

      {editingUsuario && (
        <div className="modal-backdrop" role="dialog" aria-modal="true">
          <div className="modal modal-large">
            <h3>Editar usuário</h3>
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
            <form onSubmit={handleEditSubmit}>
              <div className="grid three-columns">
                <label>
                  Nome
                  <input
                    value={editForm.nome}
                    onChange={(event) =>
                      handleEditChange('nome', event.target.value)
                    }
                    required
                  />
                </label>
                <label>
                  Matrícula
                  <input
                    value={editForm.matricula}
                    onChange={(event) =>
                      handleEditChange('matricula', event.target.value)
                    }
                    required
                  />
                </label>
                <label>
                  Nível
                  <select
                    value={editForm.nivelId || ''}
                    onChange={(event) =>
                      handleEditChange(
                        'nivelId',
                        event.target.value ? Number(event.target.value) : 0,
                      )
                    }
                    required
                    disabled={editingUsuario ? isUsuarioAdministrador(editingUsuario) && !currentUserIsAdmin : false}
                  >
                    <option value="">Selecione um nível</option>
                    {niveisDisponiveis.map((nivel) => (
                      <option key={nivel.id} value={nivel.id}>
                        {nivel.nome}
                      </option>
                    ))}
                  </select>
                  {editingUsuario && isUsuarioAdministrador(editingUsuario) && !currentUserIsAdmin && (
                    <span style={{ fontSize: '0.85rem', color: '#64748b', marginTop: '4px', display: 'block' }}>
                      Apenas administradores podem alterar o nível de outros administradores.
                    </span>
                  )}
                </label>
              </div>
              <div className={isNivelOperacoes(editForm.nivelId) ? 'grid two-columns' : 'grid one-column'}>
                {isNivelOperacoes(editForm.nivelId) && (
                  <label>
                    Equipe
                    <select
                      value={editForm.equipe}
                      onChange={(event) =>
                        handleEditChange('equipe', event.target.value)
                      }
                      required
                    >
                      {EQUIPE_OPTIONS.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  </label>
                )}
                <label>
                  Função
                  <select
                    value={editForm.funcaoId || ''}
                    onChange={(event) =>
                      handleEditChange(
                        'funcaoId',
                        event.target.value ? Number(event.target.value) : undefined,
                      )
                    }
                  >
                    <option value="">Selecione uma função</option>
                    {funcoesDisponiveisEdit.map((funcao) => (
                      <option key={funcao.id} value={funcao.id}>
                        {funcao.nome}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
              <div className="grid two-columns">
                <label>
                  Nova senha
                  <div className="password-input-wrapper">
                    <input
                      type={showEditPassword ? 'text' : 'password'}
                      value={editForm.senha}
                      onChange={(event) =>
                        handleEditChange('senha', event.target.value)
                      }
                      placeholder="Informe uma nova senha (opcional)"
                    />
                    <button
                      type="button"
                      onClick={() => setShowEditPassword(!showEditPassword)}
                      className="password-toggle"
                      tabIndex={-1}
                    >
                      {showEditPassword ? (
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"></path>
                          <line x1="1" y1="1" x2="23" y2="23"></line>
                        </svg>
                      ) : (
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
                          <circle cx="12" cy="12" r="3"></circle>
                        </svg>
                      )}
                    </button>
                  </div>
                </label>
                <label>
                  Confirmar nova senha
                  <div className="password-input-wrapper">
                    <input
                      type={showEditConfirmPassword ? 'text' : 'password'}
                      value={editForm.confirmarSenha}
                      onChange={(event) =>
                        handleEditChange('confirmarSenha', event.target.value)
                      }
                      placeholder="Repita a nova senha"
                    />
                    <button
                      type="button"
                      onClick={() => setShowEditConfirmPassword(!showEditConfirmPassword)}
                      className="password-toggle"
                      tabIndex={-1}
                    >
                      {showEditConfirmPassword ? (
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"></path>
                          <line x1="1" y1="1" x2="23" y2="23"></line>
                        </svg>
                      ) : (
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
                          <circle cx="12" cy="12" r="3"></circle>
                        </svg>
                      )}
                    </button>
                  </div>
                </label>
              </div>
              <div className="grid two-columns">
                <label>
                  Pergunta de Segurança
                  <select
                    value={editForm.perguntaSeguranca}
                    onChange={(event) =>
                      handleEditChange('perguntaSeguranca', event.target.value)
                    }
                  >
                    <option value="">Selecione uma pergunta</option>
                    {PERGUNTAS_SEGURANCA.map((pergunta) => (
                      <option key={pergunta} value={pergunta}>
                        {pergunta}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  Resposta de Segurança
                  <input
                    type="text"
                    value={editForm.respostaSeguranca}
                    onChange={(event) =>
                      handleEditChange('respostaSeguranca', event.target.value)
                    }
                    placeholder="Deixe em branco para não alterar"
                  />
                </label>
              </div>
              <div className="modal-actions">
                <button
                  type="button"
                  className="secondary"
                  onClick={resetEditForm}
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

      {/* Modal de Exclusão Permanente com Confirmação de Senha */}
      {deleteModal.open && deleteModal.usuario && (
        <div className="modal-backdrop" role="dialog" aria-modal="true">
          <div className="modal" style={{ maxWidth: '500px' }}>
            <h3>Excluir usuário permanentemente</h3>
            <div className="feedback error" style={{ marginBottom: '16px' }}>
              <strong>ATENã‡ãƒO: Esta ação é IRREVERSãVEL!</strong>
              <p style={{ margin: '8px 0 0', fontSize: '0.9rem' }}>
                O usuário <strong>{deleteModal.usuario.nome}</strong> (matrícula{' '}
                <strong>{deleteModal.usuario.matricula}</strong>) será removido
                permanentemente do banco de dados.
              </p>
              <p style={{ margin: '8px 0 0', fontSize: '0.9rem' }}>
                Se tem certeza que realmente quer excluir o registro do banco de dados,
                digite a senha do administrador para confirmar a operação.
              </p>
            </div>

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
