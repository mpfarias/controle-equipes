import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { api } from '../../api';
import type {
  CreateUsuarioInput,
  Equipe,
  EquipeOption,
  FuncaoOption,
  PerguntaSegurancaOption,
  Usuario,
  UsuarioNivelOption,
} from '../../types';
import type { Policial } from '../../types';
import { funcoesParaSelecao } from '../../constants';
import { SISTEMAS_EXTERNOS_OPTIONS } from '../../constants/sistemasExternos';
import { formatNome, formatMatricula } from '../../utils/dateUtils';
import { sortPorPatenteENome } from '../../utils/sortPoliciais';
import type { PermissoesPorTela } from '../../utils/permissions';
import { canEdit, canExcluir, canDesativar } from '../../utils/permissions';
import {
  acessoOrionSuporteParaApi,
  temAcessoOrionSuporteEfetivo,
} from '../../utils/orionSuporteEfetivo';
import type { ConfirmConfig } from '../common/ConfirmDialog';
import { ImageCropper } from '../common/ImageCropper';
import {
  IconButton,
  Tooltip,
  Box,
  Card,
  CardMedia,
  CardActions,
  Typography,
  Autocomplete,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  InputAdornment,
  Button,
  Alert,
  Stack,
  Paper,
  ToggleButton,
  ToggleButtonGroup,
  FormLabel,
  FormHelperText,
} from '@mui/material';
import {
  Edit,
  Block,
  CheckCircle,
  Delete,
  PhotoCamera,
  AddPhotoAlternate,
  Visibility,
  VisibilityOff,
  Description,
  FactCheck,
  Gavel,
  Inventory2,
  Hub,
  SupportAgent,
} from '@mui/icons-material';

const SISTEMA_ICON: Record<string, React.ReactNode> = {
  SAD: <Description sx={{ fontSize: 22 }} />,
  PATRIMONIO: <Inventory2 sx={{ fontSize: 22 }} />,
  OPERACOES: <Hub sx={{ fontSize: 22 }} />,
  ORION_QUALIDADE: <FactCheck sx={{ fontSize: 22 }} />,
  ORION_JURIDICO: <Gavel sx={{ fontSize: 22 }} />,
};

/** IDs enviados à API quando o perfil é Administrador (acesso a todos os sistemas integrados). */
const TODOS_SISTEMAS_INTEGRADOS_IDS = SISTEMAS_EXTERNOS_OPTIONS.map((o) => o.id);

const ROTULOS_TODOS_SISTEMAS_INTEGRADOS = SISTEMAS_EXTERNOS_OPTIONS.map((o) => o.label).join(', ');

const ROTULO_ORION_SUPORTE = 'Órion Suporte';

function formatSistemasPermitidosList(ids?: string[] | null): string {
  if (!ids?.length) {
    return '—';
  }
  return ids
    .map((id) => SISTEMAS_EXTERNOS_OPTIONS.find((o) => o.id === id)?.label ?? id)
    .join(', ');
}

function SistemasPermitidosSelector({
  value,
  onChange,
  disabled,
  orionSuporte,
  onOrionSuporteChange,
  mostrarOrionSuporte = true,
}: {
  value: string[];
  onChange: (ids: string[]) => void;
  disabled?: boolean;
  /** Quando informado com `onOrionSuporteChange`, exibe o cartão no mesmo estilo dos demais sistemas. */
  orionSuporte?: boolean;
  onOrionSuporteChange?: (enabled: boolean) => void;
  /** Apenas administradores veem o cartão Órion Suporte (conceder/negar acesso no usuário). */
  mostrarOrionSuporte?: boolean;
}) {
  const handleChange = (_event: React.MouseEvent<HTMLElement>, next: string[]) => {
    onChange(next);
  };

  const showSuporteCard =
    mostrarOrionSuporte && onOrionSuporteChange != null && typeof orionSuporte === 'boolean';

  return (
    <FormControl component="fieldset" variant="standard" fullWidth disabled={disabled} sx={{ mt: 1 }}>
      <FormLabel
        component="legend"
        required
        focused={false}
        sx={{
          position: 'static',
          transform: 'none',
          typography: 'subtitle2',
          fontWeight: 700,
          letterSpacing: '0.04em',
          color: 'text.primary',
          mb: 0,
        }}
      >
        Sistemas
      </FormLabel>
      <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 1, mb: 1.5, lineHeight: 1.5 }}>
        Módulos integrados do ecossistema (atalhos no SAD e tela de escolha de sistema).
        {mostrarOrionSuporte
          ? ' Se nenhum estiver marcado, o perfil precisa ter acesso ao Órion Suporte (nível ou usuário).'
          : ' Se nenhum estiver marcado, o nível de acesso precisa prever acesso ao Órion Suporte (definido pelo administrador).'}
      </Typography>
      <Paper
        variant="outlined"
        sx={(theme) => ({
          p: 1.5,
          borderRadius: 2,
          borderColor: 'divider',
          background:
            theme.palette.mode === 'dark'
              ? 'linear-gradient(145deg, rgba(255,255,255,0.04) 0%, rgba(0,0,0,0.18) 100%)'
              : 'rgba(0,0,0,0.02)',
          boxShadow: theme.palette.mode === 'dark' ? 'inset 0 1px 0 rgba(255,255,255,0.06)' : 'none',
        })}
      >
        <Box
          sx={{
            display: 'grid',
            gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, 1fr)', lg: 'repeat(3, 1fr)' },
            gap: 1.25,
            width: '100%',
          }}
        >
          <ToggleButtonGroup
            value={value}
            exclusive={false}
            onChange={handleChange}
            aria-label="Sistemas permitidos"
            sx={{
              display: 'contents',
              '& .MuiToggleButtonGroup-grouped': {
                border: '1px solid',
                borderColor: 'divider',
                borderRadius: '10px !important',
                m: '0 !important',
              },
            }}
          >
            {SISTEMAS_EXTERNOS_OPTIONS.map((s) => {
            const on = value.includes(s.id);
            return (
              <ToggleButton
                key={s.id}
                value={s.id}
                sx={(theme) => ({
                  py: 1.5,
                  px: 1.75,
                  textAlign: 'left',
                  textTransform: 'none',
                  justifyContent: 'flex-start',
                  alignItems: 'flex-start',
                  flexDirection: 'column',
                  gap: 0.75,
                  transition: 'border-color 0.2s, background-color 0.2s, box-shadow 0.2s',
                  borderColor: on ? theme.palette.secondary.main : undefined,
                  bgcolor: on
                    ? theme.palette.mode === 'dark'
                      ? 'rgba(255, 122, 26, 0.1)'
                      : 'rgba(255, 122, 26, 0.06)'
                    : 'transparent',
                  boxShadow: on ? `0 0 0 1px ${theme.palette.secondary.main}40` : 'none',
                  '&:hover': {
                    bgcolor: on
                      ? theme.palette.mode === 'dark'
                        ? 'rgba(255, 122, 26, 0.14)'
                        : 'rgba(255, 122, 26, 0.09)'
                      : theme.palette.action.hover,
                  },
                  '&.Mui-selected': {
                    bgcolor: theme.palette.mode === 'dark' ? 'rgba(255, 122, 26, 0.12)' : 'rgba(255, 122, 26, 0.08)',
                    '&:hover': {
                      bgcolor: theme.palette.mode === 'dark' ? 'rgba(255, 122, 26, 0.16)' : 'rgba(255, 122, 26, 0.1)',
                    },
                  },
                })}
              >
                <Stack direction="row" alignItems="center" spacing={1.25} sx={{ width: '100%' }}>
                  <Box
                    sx={(theme) => ({
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      width: 40,
                      height: 40,
                      borderRadius: 1.5,
                      flexShrink: 0,
                      color: on ? theme.palette.secondary.main : 'text.secondary',
                      bgcolor: on
                        ? theme.palette.mode === 'dark'
                          ? 'rgba(255, 122, 26, 0.15)'
                          : 'rgba(255, 122, 26, 0.12)'
                        : theme.palette.mode === 'dark'
                          ? 'rgba(255,255,255,0.06)'
                          : 'rgba(0,0,0,0.04)',
                    })}
                  >
                    {SISTEMA_ICON[s.id] ?? <Hub sx={{ fontSize: 22 }} />}
                  </Box>
                  <Box sx={{ minWidth: 0, flex: 1 }}>
                    <Typography variant="body2" fontWeight={on ? 700 : 600} color="text.primary" sx={{ lineHeight: 1.35 }}>
                      {s.label}
                    </Typography>
                    <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.35, lineHeight: 1.4 }}>
                      {on ? 'Acesso autorizado' : 'Clique para habilitar'}
                    </Typography>
                  </Box>
                  {on ? (
                    <CheckCircle sx={{ fontSize: 20, color: 'secondary.main', flexShrink: 0, opacity: 0.95 }} />
                  ) : null}
                </Stack>
              </ToggleButton>
            );
          })}
          </ToggleButtonGroup>
          {showSuporteCard ? (
            <ToggleButton
                value="__orion_suporte__"
                selected={orionSuporte}
                disabled={disabled}
                onClick={() => onOrionSuporteChange!(!orionSuporte)}
                aria-pressed={orionSuporte}
                sx={(theme) => {
                  const on = orionSuporte;
                  return {
                    py: 1.5,
                    px: 1.75,
                    width: '100%',
                    textAlign: 'left',
                    textTransform: 'none',
                    justifyContent: 'flex-start',
                    alignItems: 'flex-start',
                    flexDirection: 'column',
                    gap: 0.75,
                    borderRadius: '10px !important',
                    border: '1px solid',
                    transition: 'border-color 0.2s, background-color 0.2s, box-shadow 0.2s',
                    borderColor: on ? theme.palette.secondary.main : 'divider',
                    bgcolor: on
                      ? theme.palette.mode === 'dark'
                        ? 'rgba(255, 122, 26, 0.1)'
                        : 'rgba(255, 122, 26, 0.06)'
                      : 'transparent',
                    boxShadow: on ? `0 0 0 1px ${theme.palette.secondary.main}40` : 'none',
                    '&:hover': {
                      bgcolor: on
                        ? theme.palette.mode === 'dark'
                            ? 'rgba(255, 122, 26, 0.14)'
                            : 'rgba(255, 122, 26, 0.09)'
                        : theme.palette.action.hover,
                    },
                    '&.Mui-selected': {
                      bgcolor: theme.palette.mode === 'dark' ? 'rgba(255, 122, 26, 0.12)' : 'rgba(255, 122, 26, 0.08)',
                      '&:hover': {
                        bgcolor: theme.palette.mode === 'dark' ? 'rgba(255, 122, 26, 0.16)' : 'rgba(255, 122, 26, 0.1)',
                      },
                    },
                  };
                }}
              >
                <Stack direction="row" alignItems="center" spacing={1.25} sx={{ width: '100%' }}>
                  <Box
                    sx={(theme) => ({
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      width: 40,
                      height: 40,
                      borderRadius: 1.5,
                      flexShrink: 0,
                      color: orionSuporte ? theme.palette.secondary.main : 'text.secondary',
                      bgcolor: orionSuporte
                        ? theme.palette.mode === 'dark'
                          ? 'rgba(255, 122, 26, 0.15)'
                          : 'rgba(255, 122, 26, 0.12)'
                        : theme.palette.mode === 'dark'
                          ? 'rgba(255,255,255,0.06)'
                          : 'rgba(0,0,0,0.04)',
                    })}
                  >
                    <SupportAgent sx={{ fontSize: 22 }} />
                  </Box>
                  <Box sx={{ minWidth: 0, flex: 1 }}>
                    <Typography
                      variant="body2"
                      fontWeight={orionSuporte ? 700 : 600}
                      color="text.primary"
                      sx={{ lineHeight: 1.35 }}
                    >
                      Órion Suporte
                    </Typography>
                    <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.35, lineHeight: 1.4 }}>
                      {orionSuporte ? 'Acesso autorizado' : 'Clique para habilitar'}
                    </Typography>
                  </Box>
                  {orionSuporte ? (
                    <CheckCircle sx={{ fontSize: 20, color: 'secondary.main', flexShrink: 0, opacity: 0.95 }} />
                  ) : null}
                </Stack>
            </ToggleButton>
          ) : null}
        </Box>
      </Paper>
      <FormHelperText sx={{ mt: 1.25, mx: 0, lineHeight: 1.45 }}>
        É necessário manter ao menos um módulo integrado selecionado para concluir o cadastro ou a edição (exceto quando
        o acesso ao Órion Suporte cobre o perfil, conforme regras acima).
        {mostrarOrionSuporte ? ' O Órion Suporte é opcional (somente administradores alteram aqui).' : ''}
      </FormHelperText>
    </FormControl>
  );
}

interface UsuariosSectionProps {
  currentUser: Usuario;
  openConfirm: (config: ConfirmConfig) => void;
  onCurrentUserUpdate?: (user: Usuario) => void;
  permissoes?: PermissoesPorTela | null;
}

export function UsuariosSection({
  currentUser,
  openConfirm,
  onCurrentUserUpdate,
  permissoes,
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
    fotoUrl: undefined as string | null | undefined,
    sistemasPermitidos: ['SAD'] as string[],
    acessoOrionSuporte: false,
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
    fotoUrl: undefined as string | null | undefined,
    sistemasPermitidos: ['SAD'] as string[],
    acessoOrionSuporte: false,
  };

  const [usuarios, setUsuarios] = useState<Usuario[]>([]);
  /** Lista completa (sem paginação) para validar matrícula e funções únicas — a tabela usa só a página atual */
  const [usuariosParaValidacao, setUsuariosParaValidacao] = useState<Usuario[]>([]);
  const [loadingUsuariosValidacao, setLoadingUsuariosValidacao] = useState(false);
  const [policiais, setPoliciais] = useState<Policial[]>([]);
  const [usuarioNiveis, setUsuarioNiveis] = useState<UsuarioNivelOption[]>([]);
  const [funcoes, setFuncoes] = useState<FuncaoOption[]>([]);
  const [equipes, setEquipes] = useState<EquipeOption[]>([]);
  const [perguntasSeguranca, setPerguntasSeguranca] = useState<PerguntaSegurancaOption[]>([]);
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
  const [editLoading, setEditLoading] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [matriculaError, setMatriculaError] = useState<string | null>(null);
  const matriculaTimeoutRef = useRef<number | null>(null);
  const [showImageCropper, setShowImageCropper] = useState(false);
  const [imageForCrop, setImageForCrop] = useState('');
  const [fotoContext, setFotoContext] = useState<'create' | 'edit'>('create');
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const fileInputRefEdit = useRef<HTMLInputElement | null>(null);
  const fileSelectInProgressRef = useRef(false);
  const fileDialogCancelTimeoutRef = useRef<number | null>(null);
  const [fileSelectBlocking, setFileSelectBlocking] = useState(false);
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

  const carregarUsuarios = useCallback(
    async (page: number, pageSize: number, opts?: { silent?: boolean }) => {
      const silent = opts?.silent === true;
      try {
        if (!silent) {
          setLoading(true);
        }
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
        if (!silent) {
          setLoading(false);
        }
      }
    },
    [],
  );

  const carregarUsuariosParaValidacao = useCallback(async (opts?: { silent?: boolean }) => {
    const silent = opts?.silent === true;
    try {
      if (!silent) {
        setLoadingUsuariosValidacao(true);
      }
      const lista = await api.listUsuarios();
      setUsuariosParaValidacao(lista);
    } catch (err) {
      console.error('Erro ao carregar usuários para validação:', err);
    } finally {
      if (!silent) {
        setLoadingUsuariosValidacao(false);
      }
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

  const carregarEquipes = useCallback(async () => {
    try {
      const data = await api.listEquipes();
      setEquipes(data);
    } catch (err) {
      console.error('Erro ao carregar equipes:', err);
    }
  }, []);

  const carregarPerguntasSeguranca = useCallback(async () => {
    try {
      const data = await api.listPerguntasSeguranca();
      setPerguntasSeguranca(data);
    } catch (err) {
      console.error('Erro ao carregar perguntas de segurança:', err);
    }
  }, []);

  const carregarPoliciais = useCallback(async () => {
    try {
      const nivelNome = currentUser.nivel?.nome;
      const usuarioPodeVerTodos =
        nivelNome === 'ADMINISTRADOR' ||
        nivelNome === 'SAD' ||
        nivelNome === 'COMANDO' ||
        currentUser.isAdmin === true;
      const params: { includeAfastamentos?: boolean; includeRestricoes?: boolean; equipe?: string } = {
        includeAfastamentos: false,
        includeRestricoes: false,
      };
      if (!usuarioPodeVerTodos && currentUser.equipe) {
        params.equipe = currentUser.equipe;
      }
      const data = await api.listPoliciais(params);
      const filtrados = data.filter((p) => p.status !== 'DESATIVADO');
      setPoliciais(filtrados);
    } catch (err) {
      console.error('Erro ao carregar policiais:', err);
    }
  }, [currentUser.equipe, currentUser.nivel?.nome, currentUser.isAdmin]);

  const policiaisOrdenados = useMemo(() => sortPorPatenteENome(policiais), [policiais]);

  const funcoesAtivas = useMemo(() => {
    return funcoesParaSelecao(funcoes).filter((f) => f.ativo !== false);
  }, [funcoes]);


  const equipesAtivas = useMemo(() => {
    return [...equipes]
      .filter((e) => e.ativo)
      .sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR', { sensitivity: 'base' }));
  }, [equipes]);

  const equipesAtivasSemSemEquipe = useMemo(() => {
    // Filtrar SEM_EQUIPE se ainda existir no banco (para compatibilidade)
    return equipesAtivas.filter((e) => e.nome !== 'SEM_EQUIPE');
  }, [equipesAtivas]);

  const perguntasAtivas = useMemo(() => {
    return [...perguntasSeguranca]
      .filter((p) => p.ativo)
      .sort((a, b) => a.texto.localeCompare(b.texto, 'pt-BR', { sensitivity: 'base' }));
  }, [perguntasSeguranca]);

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

  /** Sistemas integrados + Órion Suporte quando houver acesso (Suporte não entra em `sistemasPermitidos` na API). */
  const textoSistemasPermitidosNaLista = useCallback(
    (u: Usuario) => {
      const ehAdmin = isUsuarioAdministrador(u);
      const base = ehAdmin
        ? ROTULOS_TODOS_SISTEMAS_INTEGRADOS
        : formatSistemasPermitidosList(u.sistemasPermitidos);
      const temSuporte = temAcessoOrionSuporteEfetivo(u) || ehAdmin;
      if (!temSuporte) {
        return base;
      }
      if (base === '—') {
        return ROTULO_ORION_SUPORTE;
      }
      return `${base}, ${ROTULO_ORION_SUPORTE}`;
    },
    [isUsuarioAdministrador],
  );

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
    const usuarioExistente = usuariosParaValidacao.find((u) => {
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
  }, [usuariosParaValidacao, funcoes]);

  const validateMatricula = useCallback((matricula: string) => {
    if (loadingUsuariosValidacao) {
      return;
    }

    const matriculaTrimmed = matricula.trim().toUpperCase();
    if (!matriculaTrimmed) {
      setMatriculaError(null);
      return;
    }

    const matriculaExists = usuariosParaValidacao.some(
      (usuario) => usuario.matricula.toUpperCase() === matriculaTrimmed,
    );

    if (matriculaExists) {
      setMatriculaError('Esta matrícula já está cadastrada.');
    } else {
      setMatriculaError(null);
    }
  }, [usuariosParaValidacao, loadingUsuariosValidacao]);

  useEffect(() => {
    void carregarUsuarios(paginaAtual, itensPorPagina);
  }, [carregarUsuarios, paginaAtual, itensPorPagina]);

  useEffect(() => {
    void carregarUsuariosParaValidacao();
  }, [carregarUsuariosParaValidacao]);

  useEffect(() => {
    void carregarNiveis();
    void carregarFuncoes();
    void carregarEquipes();
    void carregarPerguntasSeguranca();
    void carregarPoliciais();
  }, [carregarNiveis, carregarFuncoes, carregarEquipes, carregarPerguntasSeguranca, carregarPoliciais]);

  useEffect(() => {
    if (equipesAtivasSemSemEquipe.length === 0) {
      return;
    }
    const equipePadrao = equipesAtivasSemSemEquipe[0].nome;
    if (!form.equipe || !equipesAtivasSemSemEquipe.some((e) => e.nome === form.equipe)) {
      setForm((prev) => ({ ...prev, equipe: equipePadrao }));
    }
    if (
      editingUsuario &&
      (!editForm.equipe || !equipesAtivasSemSemEquipe.some((e) => e.nome === editForm.equipe))
    ) {
      setEditForm((prev) => ({ ...prev, equipe: equipePadrao }));
    }
  }, [equipesAtivasSemSemEquipe, form.equipe, editForm.equipe, editingUsuario]);

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
          const caiuEmAdmin = primeiroNivel.nome === 'ADMINISTRADOR';
          setForm((prev) => ({
            ...prev,
            nivelId: primeiroNivel.id,
            sistemasPermitidos: caiuEmAdmin ? [...TODOS_SISTEMAS_INTEGRADOS_IDS] : ['SAD'],
            acessoOrionSuporte: caiuEmAdmin,
          }));
        }
      }
    }
  }, [niveisDisponiveis, form.nivelId]);

  // Revalidar matrícula quando a lista completa de usuários for atualizada
  useEffect(() => {
    if (form.matricula.trim() && !loadingUsuariosValidacao) {
      validateMatricula(form.matricula);
    }
  }, [usuariosParaValidacao, form.matricula, validateMatricula, loadingUsuariosValidacao]);

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
    // Se o campo alterado for nivelId, verificar se precisa limpar a equipe
    if (field === 'nivelId') {
      const funcoesFiltradas = funcoesParaSelecao(funcoes);
      setForm((prev) => {
        const prevNivel = usuarioNiveis.find((n) => n.id === prev.nivelId);
        const novoNivel = usuarioNiveis.find((n) => n.id === (value as number));
        const isOperacoes = novoNivel?.nome === 'OPERAÇÕES';
        const isAdminNivel = novoNivel?.nome === 'ADMINISTRADOR';
        const wasAdmin = prevNivel?.nome === 'ADMINISTRADOR';

        let sistemasPermitidos = prev.sistemasPermitidos;
        let acessoOrionSuporte = prev.acessoOrionSuporte;
        if (isAdminNivel) {
          sistemasPermitidos = [...TODOS_SISTEMAS_INTEGRADOS_IDS];
          acessoOrionSuporte = true;
        } else if (wasAdmin && !isAdminNivel) {
          sistemasPermitidos = ['SAD'];
          acessoOrionSuporte = false;
        }

        const funcaoAindaDisponivel = prev.funcaoId
          ? funcoesFiltradas.some((f) => f.id === prev.funcaoId)
          : true;

        return {
          ...prev,
          nivelId: (value as number) || 0,
          equipe: isOperacoes ? prev.equipe : ('A' as Equipe),
          sistemasPermitidos,
          acessoOrionSuporte,
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
    setShowImageCropper(false);
    setImageForCrop('');
    setFileSelectBlocking(false);
    fileSelectInProgressRef.current = false;
    if (fileInputRef.current) fileInputRef.current.value = '';
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
    setEditLoading(false);
    setShowImageCropper(false);
    setImageForCrop('');
    setFileSelectBlocking(false);
    fileSelectInProgressRef.current = false;
    if (fileInputRef.current) fileInputRef.current.value = '';
    if (fileInputRefEdit.current) fileInputRefEdit.current.value = '';
  };

  const openFileDialog = (ctx: 'create' | 'edit') => (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.detail > 1) return;
    if (fileSelectInProgressRef.current) return;
    if (fileDialogCancelTimeoutRef.current) {
      clearTimeout(fileDialogCancelTimeoutRef.current);
      fileDialogCancelTimeoutRef.current = null;
    }
    fileSelectInProgressRef.current = true;
    setFileSelectBlocking(true);
    setFotoContext(ctx);
    const input = ctx === 'create' ? fileInputRef.current : fileInputRefEdit.current;
    requestAnimationFrame(() => {
      input?.click();
    });
    fileDialogCancelTimeoutRef.current = window.setTimeout(() => {
      fileDialogCancelTimeoutRef.current = null;
      fileSelectInProgressRef.current = false;
      setFileSelectBlocking(false);
    }, 2000);
  };

  const handleFileSelect = (ctx: 'create' | 'edit') => (event: React.ChangeEvent<HTMLInputElement>) => {
    const input = event.target;
    const file = input.files?.[0];
    if (fileDialogCancelTimeoutRef.current) {
      clearTimeout(fileDialogCancelTimeoutRef.current);
      fileDialogCancelTimeoutRef.current = null;
    }
    if (file) {
      input.blur();
      if (!file.type.startsWith('image/')) {
        fileSelectInProgressRef.current = false;
        setFileSelectBlocking(false);
        if (ctx === 'create') setError('Por favor, selecione uma imagem válida.');
        else setEditError('Por favor, selecione uma imagem válida.');
        return;
      }
      if (file.size > 5 * 1024 * 1024) {
        fileSelectInProgressRef.current = false;
        setFileSelectBlocking(false);
        if (ctx === 'create') setError('A imagem deve ter no máximo 5MB.');
        else setEditError('A imagem deve ter no máximo 5MB.');
        return;
      }
      setFotoContext(ctx);
      const reader = new FileReader();
      reader.onload = (e) => {
        setImageForCrop(e.target?.result as string);
        setShowImageCropper(true);
        setError(null);
        setEditError(null);
        setFileSelectBlocking(false);
        setTimeout(() => {
          fileSelectInProgressRef.current = false;
        }, 300);
      };
      reader.readAsDataURL(file);
      input.value = '';
    } else {
      fileSelectInProgressRef.current = false;
      setFileSelectBlocking(false);
    }
  };

  const handleCropComplete = (croppedImageUrl: string) => {
    if (fotoContext === 'create') {
      setForm((prev) => ({ ...prev, fotoUrl: croppedImageUrl }));
    } else {
      setEditForm((prev) => ({ ...prev, fotoUrl: croppedImageUrl }));
    }
    setShowImageCropper(false);
    setImageForCrop('');
    if (fileInputRef.current) fileInputRef.current.value = '';
    if (fileInputRefEdit.current) fileInputRefEdit.current.value = '';
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    setSuccess(null);

    if (loadingUsuariosValidacao) {
      setError('Aguarde o carregamento dos dados para validar matrículas.');
      return;
    }

    const nome = form.nome.trim();
    const matricula = form.matricula.trim();

    if (!nome || !matricula) {
      setError('Informe nome e matrícula.');
      return;
    }

    // Validar matrícula antes de submeter (lista completa, não só a página da tabela)
    const matriculaExists = usuariosParaValidacao.some(
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

    const nivelSelecionado = usuarioNiveis.find((n) => n.id === form.nivelId);

    if (!form.sistemasPermitidos?.length) {
      const ehPerfilAdminCriacao = nivelSelecionado?.nome === 'ADMINISTRADOR';
      const acessoGravar = ehPerfilAdminCriacao
        ? true
        : currentUserIsAdmin
          ? acessoOrionSuporteParaApi(
              form.acessoOrionSuporte,
              nivelSelecionado?.acessoOrionSuporte === true,
            )
          : null;
      const podeSomenteSuporte = temAcessoOrionSuporteEfetivo({
        isAdmin: Boolean(ehPerfilAdminCriacao),
        acessoOrionSuporte: acessoGravar,
        nivel: nivelSelecionado
          ? { acessoOrionSuporte: nivelSelecionado.acessoOrionSuporte }
          : undefined,
      });
      if (!podeSomenteSuporte) {
        setError(
          currentUserIsAdmin
            ? 'Selecione ao menos um sistema integrado ou habilite o Órion Suporte (perfil ou nível).'
            : 'Selecione ao menos um sistema integrado ou use um nível que já conceda Órion Suporte.',
        );
        return;
      }
    }

    // Validar se está tentando criar usuário como ADMINISTRADOR sem permissão
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
      const ehPerfilAdmin = nivelSelecionado?.nome === 'ADMINISTRADOR';
      const payload: CreateUsuarioInput = {
        nome,
        matricula,
        senha: form.senha,
        perguntaSeguranca: form.perguntaSeguranca.trim() || undefined,
        respostaSeguranca: form.respostaSeguranca.trim() || undefined,
        nivelId: form.nivelId,
        funcaoId: form.funcaoId,
        // Enviar equipe: se for OPERAÇÕES, usar o valor selecionado; caso contrário, enviar null (sem equipe)
        equipe: nivelSelecionado?.nome === 'OPERAÇÕES' ? form.equipe : undefined,
        fotoUrl: form.fotoUrl ?? undefined,
        sistemasPermitidos: ehPerfilAdmin
          ? [...TODOS_SISTEMAS_INTEGRADOS_IDS]
          : [...form.sistemasPermitidos],
        acessoOrionSuporte: ehPerfilAdmin
          ? true
          : currentUserIsAdmin
            ? acessoOrionSuporteParaApi(
                form.acessoOrionSuporte,
                nivelSelecionado?.acessoOrionSuporte === true,
              )
            : null,
      };
      await api.createUsuario(payload);
      resetForm();
      setSuccess('Usuário cadastrado com sucesso.');
      await carregarUsuarios(paginaAtual, itensPorPagina, { silent: true });
      await carregarUsuariosParaValidacao({ silent: true });
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
    // Se o campo alterado for nivelId, verificar se precisa limpar a equipe
    if (field === 'nivelId') {
      setEditForm((prev) => {
        const prevNivel = usuarioNiveis.find((n) => n.id === prev.nivelId);
        const novoNivel = usuarioNiveis.find((n) => n.id === (value as number));
        const isOperacoes = novoNivel?.nome === 'OPERAÇÕES';
        const isAdminNivel = novoNivel?.nome === 'ADMINISTRADOR';
        const wasAdmin = prevNivel?.nome === 'ADMINISTRADOR';

        let sistemasPermitidos = prev.sistemasPermitidos;
        let acessoOrionSuporte = prev.acessoOrionSuporte;
        if (isAdminNivel) {
          sistemasPermitidos = [...TODOS_SISTEMAS_INTEGRADOS_IDS];
          acessoOrionSuporte = true;
        } else if (wasAdmin && !isAdminNivel) {
          sistemasPermitidos = ['SAD'];
          acessoOrionSuporte = false;
        }

        return {
          ...prev,
          nivelId: (value as number) || 0,
          equipe: isOperacoes ? prev.equipe : 'A',
          sistemasPermitidos,
          acessoOrionSuporte,
        };
      });
      return;
    }
    setEditForm((prev) => ({ ...prev, [field]: value }));
  };

  const handleEdit = async (usuario: Usuario) => {
    setEditingUsuario(usuario);
    setEditError(null);
    setEditLoading(true);
    setShowImageCropper(false);
    const applyForm = (u: Usuario) => {
      let nivelId = u.nivelId ?? 0;
      const usuarioEditadoIsAdmin = isUsuarioAdministrador(u);
      if (usuarioEditadoIsAdmin && !currentUserIsAdmin) {
        nivelId = u.nivelId ?? 0;
      } else if (!nivelId && niveisDisponiveis.length > 0) {
        const primeiroNivel = niveisDisponiveis.find(n => n.nome === 'OPERAÇÕES') || niveisDisponiveis[0];
        nivelId = primeiroNivel?.id ?? 0;
      }
      const nivelDoUsuario = usuarioNiveis.find(n => n.id === nivelId);
      const isOperacoes = nivelDoUsuario?.nome === 'OPERAÇÕES';
      const adminUser = isUsuarioAdministrador(u);
      setEditForm({
        nome: u.nome,
        matricula: u.matricula,
        senha: '',
        confirmarSenha: '',
        perguntaSeguranca: u.perguntaSeguranca || '',
        respostaSeguranca: '',
        equipe: isOperacoes ? (u.equipe ?? 'A') : 'A',
        nivelId: nivelId,
        funcaoId: u.funcaoId ?? undefined,
        fotoUrl: u.fotoUrl ?? null,
        sistemasPermitidos: adminUser
          ? [...TODOS_SISTEMAS_INTEGRADOS_IDS]
          : Array.isArray(u.sistemasPermitidos) && u.sistemasPermitidos.length > 0
            ? [...u.sistemasPermitidos]
            : ['SAD'],
        acessoOrionSuporte: adminUser ? true : temAcessoOrionSuporteEfetivo(u),
      });
    };
    applyForm(usuario);
    try {
      const usuarioCompleto = await api.getUsuario(usuario.id);
      setEditingUsuario(usuarioCompleto);
      applyForm(usuarioCompleto);
    } catch (err) {
      setEditError(err instanceof Error ? err.message : 'Não foi possível carregar os dados do usuário.');
    } finally {
      setEditLoading(false);
    }
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

    const nivelSelecionadoEdit = usuarioNiveis.find((n) => n.id === editForm.nivelId);
    const ehPerfilAdminEdit = nivelSelecionadoEdit?.nome === 'ADMINISTRADOR';

    if (!editForm.sistemasPermitidos?.length) {
      const acessoGravarEdit = ehPerfilAdminEdit
        ? true
        : currentUserIsAdmin
          ? acessoOrionSuporteParaApi(
              editForm.acessoOrionSuporte,
              nivelSelecionadoEdit?.acessoOrionSuporte === true,
            )
          : null;
      const podeSomenteSuporteEdit = temAcessoOrionSuporteEfetivo({
        isAdmin: Boolean(ehPerfilAdminEdit),
        acessoOrionSuporte: acessoGravarEdit,
        nivel: nivelSelecionadoEdit ?? undefined,
      });
      if (!podeSomenteSuporteEdit) {
        setEditError(
          currentUserIsAdmin
            ? 'Selecione ao menos um sistema integrado ou habilite o Órion Suporte (perfil ou nível).'
            : 'Selecione ao menos um sistema integrado ou use um nível que já conceda Órion Suporte.',
        );
        return;
      }
    }

    // Validar se está tentando editar usuário para ADMINISTRADOR sem permissão
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

    const matriculaDuplicada = usuariosParaValidacao.some(
      (u) =>
        u.id !== editingUsuario.id &&
        u.matricula.toUpperCase() === matricula.toUpperCase(),
    );
    if (matriculaDuplicada) {
      setEditError('Esta matrícula já está cadastrada para outro usuário.');
      return;
    }

    const novaSenha = editForm.senha;
    const payloadBase: Partial<CreateUsuarioInput> & { fotoUrl?: string | null } = {
      nome,
      matricula,
      perguntaSeguranca: editForm.perguntaSeguranca.trim() || undefined,
      respostaSeguranca: editForm.respostaSeguranca.trim() || undefined,
      // Enviar equipe: se for OPERAÇÕES, usar o valor selecionado; caso contrário, enviar null (sem equipe)
      equipe: nivelSelecionadoEdit?.nome === 'OPERAÇÕES' ? editForm.equipe : undefined,
      nivelId: editForm.nivelId,
      funcaoId: editForm.funcaoId,
      fotoUrl: editForm.fotoUrl ?? undefined,
      sistemasPermitidos: ehPerfilAdminEdit
        ? [...TODOS_SISTEMAS_INTEGRADOS_IDS]
        : [...editForm.sistemasPermitidos],
    };
    if (currentUserIsAdmin) {
      payloadBase.acessoOrionSuporte = ehPerfilAdminEdit
        ? true
        : acessoOrionSuporteParaApi(
            editForm.acessoOrionSuporte,
            nivelSelecionadoEdit?.acessoOrionSuporte === true,
          );
    }

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
          const atualizado = await api.updateUsuario(editingUsuario.id, payload);
          setUsuarios((prev) => prev.map((u) => (u.id === atualizado.id ? atualizado : u)));
          setSuccess('Usuário atualizado com sucesso.');
          resetEditForm();
          await carregarUsuarios(paginaAtual, itensPorPagina, { silent: true });
          await carregarUsuariosParaValidacao({ silent: true });

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
          await carregarUsuariosParaValidacao();
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
          await carregarUsuarios(paginaAtual, itensPorPagina, { silent: true });
          await carregarUsuariosParaValidacao({ silent: true });
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
      await carregarUsuarios(paginaAtual, itensPorPagina, { silent: true });
      await carregarUsuariosParaValidacao({ silent: true });
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
        <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '1fr 1fr 1fr' }, gap: 2 }}>
          <Autocomplete
            options={policiaisOrdenados}
            getOptionLabel={(option) => `${option.nome} - ${formatMatricula(option.matricula)}`}
            value={policiaisOrdenados.find((p) => p.nome === form.nome && p.matricula === form.matricula) ?? null}
            onChange={(_event, newValue) => {
              setForm((prev) => ({
                ...prev,
                nome: newValue ? newValue.nome : '',
                matricula: newValue ? newValue.matricula : '',
              }));
              setMatriculaError(null);
            }}
            renderInput={(params) => (
              <TextField
                {...params}
                label="Nome"
                placeholder="Digite o nome ou matrícula para buscar"
                required={!form.nome}
                variant="outlined"
                size="small"
              />
            )}
            filterOptions={(options, { inputValue }) => {
              const term = inputValue.toLowerCase();
              return options.filter(
                (option) =>
                  option.nome.toLowerCase().includes(term) ||
                  option.matricula.toLowerCase().includes(term)
              );
            }}
            noOptionsText="Nenhum policial encontrado"
            isOptionEqualToValue={(option, value) => option.id === value.id}
          />
          <TextField
            label="Matrícula"
            value={form.matricula}
            onChange={(event) => handleChange('matricula', event.target.value)}
            placeholder="Matrícula"
            required
            fullWidth
            variant="outlined"
            size="small"
            error={!!matriculaError}
            helperText={matriculaError}
          />
          <FormControl fullWidth variant="outlined" size="small" required>
            <InputLabel>Nível</InputLabel>
            <Select
              value={form.nivelId || ''}
              onChange={(event) =>
                handleChange('nivelId', event.target.value ? Number(event.target.value) : 0)
              }
              label="Nível"
            >
              <MenuItem value="">Selecione um nível</MenuItem>
              {niveisDisponiveis.map((nivel) => (
                <MenuItem key={nivel.id} value={nivel.id}>
                  {formatNome(nivel.nome)}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        </Box>
        <Box
          sx={{
            display: 'grid',
            gridTemplateColumns: isNivelOperacoes(form.nivelId) ? { xs: '1fr', md: '1fr 1fr' } : '1fr',
            gap: 2,
            mt: 2,
          }}
        >
          {isNivelOperacoes(form.nivelId) && (
            <FormControl fullWidth variant="outlined" size="small" required>
              <InputLabel>Equipe</InputLabel>
              <Select
                value={form.equipe}
                onChange={(event) => handleChange('equipe', event.target.value)}
                label="Equipe"
              >
                <MenuItem value="">Selecione uma equipe</MenuItem>
                {equipesAtivasSemSemEquipe.map((option) => (
                  <MenuItem key={option.id} value={option.nome}>
                    {formatNome(option.nome)}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          )}
          <FormControl fullWidth variant="outlined" size="small">
            <InputLabel>Função</InputLabel>
            <Select
              value={form.funcaoId || ''}
              onChange={(event) =>
                handleChange('funcaoId', event.target.value ? Number(event.target.value) : undefined)
              }
              label="Função"
            >
              <MenuItem value="">Selecione uma função</MenuItem>
              {funcoesAtivas.map((funcao) => (
                <MenuItem key={funcao.id} value={funcao.id}>
                  {formatNome(funcao.nome)}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        </Box>
        <SistemasPermitidosSelector
          value={form.sistemasPermitidos}
          onChange={(ids) => setForm((prev) => ({ ...prev, sistemasPermitidos: ids }))}
          mostrarOrionSuporte={currentUserIsAdmin}
          orionSuporte={currentUserIsAdmin ? form.acessoOrionSuporte : undefined}
          onOrionSuporteChange={
            currentUserIsAdmin
              ? (enabled) => setForm((prev) => ({ ...prev, acessoOrionSuporte: enabled }))
              : undefined
          }
          disabled={usuarioNiveis.find((n) => n.id === form.nivelId)?.nome === 'ADMINISTRADOR'}
        />
        <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' }, gap: 2, mt: 2 }}>
          <TextField
            label="Senha"
            type={showPassword ? 'text' : 'password'}
            value={form.senha}
            onChange={(event) => handleChange('senha', event.target.value)}
            placeholder="Informe uma senha forte"
            required
            fullWidth
            variant="outlined"
            size="small"
            InputProps={{
              endAdornment: (
                <InputAdornment position="end">
                  <IconButton
                    aria-label={showPassword ? 'Ocultar senha' : 'Mostrar senha'}
                    onClick={() => setShowPassword(!showPassword)}
                    edge="end"
                  >
                    {showPassword ? <VisibilityOff /> : <Visibility />}
                  </IconButton>
                </InputAdornment>
              ),
            }}
          />
          <TextField
            label="Confirmar senha"
            type={showConfirmPassword ? 'text' : 'password'}
            value={form.confirmarSenha}
            onChange={(event) => handleChange('confirmarSenha', event.target.value)}
            placeholder="Repita a senha"
            required
            fullWidth
            variant="outlined"
            size="small"
            InputProps={{
              endAdornment: (
                <InputAdornment position="end">
                  <IconButton
                    aria-label={showConfirmPassword ? 'Ocultar senha' : 'Mostrar senha'}
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    edge="end"
                  >
                    {showConfirmPassword ? <VisibilityOff /> : <Visibility />}
                  </IconButton>
                </InputAdornment>
              ),
            }}
          />
        </Box>
        <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' }, gap: 2, mt: 2 }}>
          <FormControl fullWidth variant="outlined" size="small">
            <InputLabel>Pergunta de Segurança</InputLabel>
            <Select
              value={form.perguntaSeguranca}
              onChange={(event) => handleChange('perguntaSeguranca', event.target.value)}
              label="Pergunta de Segurança"
            >
              <MenuItem value="">Selecione uma pergunta</MenuItem>
              {perguntasAtivas.map((pergunta) => (
                <MenuItem key={pergunta.id} value={pergunta.texto}>
                  {formatNome(pergunta.texto)}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
          <TextField
            label="Resposta de Segurança"
            type="text"
            value={form.respostaSeguranca}
            onChange={(event) => handleChange('respostaSeguranca', event.target.value)}
            placeholder="Digite a resposta"
            fullWidth
            variant="outlined"
            size="small"
          />
        </Box>
        <Box sx={{ mt: 2 }}>
          <Typography variant="body2" sx={{ mb: 1, color: 'text.secondary' }}>
            Foto do usuário
          </Typography>
          <Box sx={{ display: 'flex', justifyContent: 'flex-start', mt: 1, position: 'relative' }}>
            {fileSelectBlocking && fotoContext === 'create' && (
              <Box
                sx={{
                  position: 'absolute',
                  inset: 0,
                  width: 120,
                  height: 160,
                  zIndex: 10,
                  cursor: 'wait',
                }}
                onClick={(e) => e.stopPropagation()}
              />
            )}
            <Card
              sx={{
                position: 'relative',
                width: 120,
                height: 160,
                borderRadius: 2,
                boxShadow: 2,
              }}
            >
              {form.fotoUrl ? (
                <>
                  <CardMedia
                    component="img"
                    image={form.fotoUrl}
                    alt="Foto do usuário"
                    sx={{ width: '100%', height: '100%', objectFit: 'cover' }}
                  />
                  <CardActions
                    sx={{
                      position: 'absolute',
                      bottom: 0,
                      left: 0,
                      right: 0,
                      background: 'linear-gradient(to top, rgba(0,0,0,0.7) 0%, rgba(0,0,0,0) 100%)',
                      justifyContent: 'center',
                      padding: '6px',
                    }}
                  >
                    <IconButton
                      size="small"
                      onClick={openFileDialog('create')}
                      sx={{ color: 'white', backgroundColor: 'rgba(255,255,255,0.2)', '&:hover': { backgroundColor: 'rgba(255,255,255,0.3)' } }}
                      title="Alterar foto"
                    >
                      <PhotoCamera fontSize="small" />
                    </IconButton>
                    <IconButton
                      size="small"
                      onClick={() => {
                        setForm((prev) => ({ ...prev, fotoUrl: undefined }));
                        if (fileInputRef.current) fileInputRef.current.value = '';
                      }}
                      sx={{ color: 'white', backgroundColor: 'rgba(255,255,255,0.2)', '&:hover': { backgroundColor: 'rgba(239, 68, 68, 0.8)' } }}
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
                    backgroundColor: 'rgba(0,0,0,0.15)',
                    cursor: 'pointer',
                    '&:hover': { backgroundColor: 'rgba(0,0,0,0.25)' },
                  }}
                  onClick={openFileDialog('create')}
                >
                  <AddPhotoAlternate sx={{ fontSize: 36, color: 'var(--text-secondary)', mb: 0.5 }} />
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
              onChange={handleFileSelect('create')}
              style={{ display: 'none' }}
            />
          </Box>
        </Box>
        <Box sx={{ mt: 3 }}>
          <Button
            type="submit"
            variant="contained"
            disabled={submitting || loadingUsuariosValidacao}
            sx={{ minWidth: 180 }}
          >
            {submitting ? 'Salvando...' : loadingUsuariosValidacao ? 'Carregando…' : 'Cadastrar usuário'}
          </Button>
        </Box>
      </form>

      <div>
        <h3>Lista de usuários</h3>
      </div>
      <Box sx={{ display: 'flex', gap: 2, alignItems: 'center', flexWrap: 'wrap', mb: 2 }}>
        <TextField
          size="small"
          placeholder="Pesquisar por nome"
          value={searchTerm}
          onChange={(event) => setSearchTerm(event.target.value.toUpperCase())}
          sx={{ minWidth: 200 }}
        />
        <FormControl size="small" sx={{ minWidth: 140 }}>
          <InputLabel>Itens por página</InputLabel>
          <Select
            value={itensPorPagina}
            onChange={(event) => {
              setItensPorPagina(Number(event.target.value));
              setPaginaAtual(1);
            }}
            label="Itens por página"
          >
            <MenuItem value={10}>10 / página</MenuItem>
            <MenuItem value={20}>20 / página</MenuItem>
            <MenuItem value={50}>50 / página</MenuItem>
            <MenuItem value={100}>100 / página</MenuItem>
          </Select>
        </FormControl>
      </Box>
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
              <th>Sistemas</th>
              <th>Órion Suporte</th>
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
                    ? { backgroundColor: 'var(--alert-error-bg)' }
                    : undefined
                }
              >
                <td>{usuario.nome}</td>
                <td>{formatMatricula(usuario.matricula)}</td>
                <td>{textoSistemasPermitidosNaLista(usuario)}</td>
                <td>
                  {temAcessoOrionSuporteEfetivo(usuario) || isUsuarioAdministrador(usuario)
                    ? 'Sim'
                    : 'Não'}
                </td>
                <td>{usuario.nivel?.nome || '-'}</td>
                <td className="actions">
                  {usuario.status === 'ATIVO' && canEdit(permissoes, 'usuarios') && (
                    <Tooltip title="Editar" arrow>
                      <IconButton
                        size="small"
                        onClick={() => handleEdit(usuario)}
                        sx={{ color: 'var(--accent-muted)' }}
                      >
                        <Edit />
                      </IconButton>
                    </Tooltip>
                  )}
                  {usuario.id !== currentUser.id && (
                    <>
                      {usuario.status === 'ATIVO' && canDesativar(permissoes, 'usuarios') && (
                        <Tooltip title="Desativar" arrow>
                          <IconButton
                            size="small"
                            onClick={() => handleDelete(usuario)}
                            color="warning"
                          >
                            <Block />
                          </IconButton>
                        </Tooltip>
                      )}
                      {usuario.status === 'DESATIVADO' && canDesativar(permissoes, 'usuarios') && (
                        <Tooltip title="Ativar" arrow>
                          <IconButton
                            size="small"
                            onClick={() => handleActivate(usuario)}
                            color="success"
                          >
                            <CheckCircle />
                          </IconButton>
                        </Tooltip>
                      )}
                      {canExcluir(permissoes, 'usuarios') && (
                        <Tooltip title="Excluir" arrow>
                          <IconButton
                            size="small"
                            onClick={() => handleDeletePermanent(usuario)}
                            color="error"
                          >
                            <Delete />
                          </IconButton>
                        </Tooltip>
                      )}
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
            backgroundColor: 'rgba(0,0,0,0.15)',
            borderRadius: '8px',
            border: '1px solid var(--border-soft)',
          }}
        >
          <div style={{ fontSize: '0.9rem', color: 'var(--text-secondary)' }}>
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
            <span style={{ padding: '0 12px', fontSize: '0.9rem', color: 'var(--text-secondary)' }}>
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
              <Typography variant="body2" sx={{ mb: 1, color: 'text.secondary' }}>
                Foto do usuário
              </Typography>
              <Box sx={{ display: 'flex', justifyContent: 'flex-start', marginBottom: 2, position: 'relative' }}>
                {fileSelectBlocking && fotoContext === 'edit' && (
                  <Box
                    sx={{
                      position: 'absolute',
                      inset: 0,
                      width: 120,
                      height: 160,
                      zIndex: 10,
                      cursor: 'wait',
                    }}
                    onClick={(e) => e.stopPropagation()}
                  />
                )}
                <Card
                  sx={{
                    position: 'relative',
                    width: 120,
                    height: 160,
                    borderRadius: 2,
                    boxShadow: 2,
                  }}
                >
                  {editLoading ? (
                    <Box
                      sx={{
                        width: '100%',
                        height: '100%',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        backgroundColor: 'rgba(0,0,0,0.15)',
                        fontSize: '0.8rem',
                        color: 'var(--text-secondary)',
                      }}
                    >
                      Carregando...
                    </Box>
                  ) : editForm.fotoUrl ? (
                    <>
                      <CardMedia
                        key={String(editForm.fotoUrl?.slice(0, 80))}
                        component="img"
                        image={editForm.fotoUrl}
                        alt="Foto do usuário"
                        sx={{ width: '100%', height: '100%', objectFit: 'cover' }}
                      />
                      <CardActions
                        sx={{
                          position: 'absolute',
                          bottom: 0,
                          left: 0,
                          right: 0,
                          background: 'linear-gradient(to top, rgba(0,0,0,0.7) 0%, rgba(0,0,0,0) 100%)',
                          justifyContent: 'center',
                          padding: '6px',
                        }}
                      >
                        <IconButton
                          size="small"
                          onClick={openFileDialog('edit')}
                          sx={{ color: 'white', backgroundColor: 'rgba(255,255,255,0.2)', '&:hover': { backgroundColor: 'rgba(255,255,255,0.3)' } }}
                          title="Alterar foto"
                        >
                          <PhotoCamera fontSize="small" />
                        </IconButton>
                        <IconButton
                          size="small"
                          onClick={() => {
                            setEditForm((prev) => ({ ...prev, fotoUrl: null }));
                            if (fileInputRefEdit.current) fileInputRefEdit.current.value = '';
                          }}
                          sx={{ color: 'white', backgroundColor: 'rgba(255,255,255,0.2)', '&:hover': { backgroundColor: 'rgba(239, 68, 68, 0.8)' } }}
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
                        backgroundColor: 'rgba(0,0,0,0.15)',
                        cursor: 'pointer',
                        '&:hover': { backgroundColor: 'rgba(255,255,255,0.1)' },
                      }}
                      onClick={openFileDialog('edit')}
                    >
                      <AddPhotoAlternate sx={{ fontSize: 36, color: 'var(--text-secondary)', mb: 0.5 }} />
                      <Typography variant="caption" color="text.secondary">
                        Adicionar foto
                      </Typography>
                    </Box>
                  )}
                </Card>
                <input
                  ref={fileInputRefEdit}
                  type="file"
                  accept="image/*"
                  onChange={handleFileSelect('edit')}
                  style={{ display: 'none' }}
                />
              </Box>
              <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '1fr 1fr 1fr' }, gap: 2, mb: 2 }}>
                <TextField
                  label="Nome"
                  value={editForm.nome}
                  onChange={(event) => handleEditChange('nome', event.target.value.toUpperCase())}
                  required
                  fullWidth
                  variant="outlined"
                  size="small"
                />
                <TextField
                  label="Matrícula"
                  value={editForm.matricula}
                  onChange={(event) => handleEditChange('matricula', event.target.value)}
                  required
                  fullWidth
                  variant="outlined"
                  size="small"
                />
                <FormControl fullWidth variant="outlined" size="small" required>
                  <InputLabel>Nível</InputLabel>
                  <Select
                    value={editForm.nivelId || ''}
                    onChange={(event) =>
                      handleEditChange('nivelId', event.target.value ? Number(event.target.value) : 0)
                    }
                    label="Nível"
                    disabled={editingUsuario ? isUsuarioAdministrador(editingUsuario) && !currentUserIsAdmin : false}
                    MenuProps={{ sx: { zIndex: 1500 } }}
                  >
                    <MenuItem value="">Selecione um nível</MenuItem>
                    {niveisDisponiveis.map((nivel) => (
                      <MenuItem key={nivel.id} value={nivel.id}>
                        {nivel.nome}
                      </MenuItem>
                    ))}
                  </Select>
                  {editingUsuario && isUsuarioAdministrador(editingUsuario) && !currentUserIsAdmin && (
                    <Typography variant="caption" sx={{ mt: 0.5, display: 'block', color: 'text.secondary' }}>
                      Apenas administradores podem alterar o nível de outros administradores.
                    </Typography>
                  )}
                </FormControl>
              </Box>
              <Box
                sx={{
                  display: 'grid',
                  gridTemplateColumns: isNivelOperacoes(editForm.nivelId) ? { xs: '1fr', md: '1fr 1fr' } : '1fr',
                  gap: 2,
                  mb: 2,
                }}
              >
                {isNivelOperacoes(editForm.nivelId) && (
                  <FormControl fullWidth variant="outlined" size="small" required>
                    <InputLabel>Equipe</InputLabel>
                    <Select
                      value={editForm.equipe}
                      onChange={(event) => handleEditChange('equipe', event.target.value)}
                      label="Equipe"
                      MenuProps={{ sx: { zIndex: 1500 } }}
                    >
                      <MenuItem value="">Selecione uma equipe</MenuItem>
                      {equipesAtivasSemSemEquipe.map((option) => (
                        <MenuItem key={option.id} value={option.nome}>
                          {formatNome(option.nome)}
                        </MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                )}
                <FormControl fullWidth variant="outlined" size="small">
                  <InputLabel>Função</InputLabel>
                  <Select
                    value={editForm.funcaoId || ''}
                    onChange={(event) =>
                      handleEditChange('funcaoId', event.target.value ? Number(event.target.value) : undefined)
                    }
                    label="Função"
                    MenuProps={{ sx: { zIndex: 1500 } }}
                  >
                    <MenuItem value="">Selecione uma função</MenuItem>
                    {funcoesAtivas.map((funcao) => (
                      <MenuItem key={funcao.id} value={funcao.id}>
                        {funcao.nome}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Box>
              <SistemasPermitidosSelector
                value={editForm.sistemasPermitidos}
                onChange={(ids) => setEditForm((prev) => ({ ...prev, sistemasPermitidos: ids }))}
                mostrarOrionSuporte={currentUserIsAdmin}
                orionSuporte={currentUserIsAdmin ? editForm.acessoOrionSuporte : undefined}
                onOrionSuporteChange={
                  currentUserIsAdmin
                    ? (enabled) =>
                        setEditForm((prev) => ({ ...prev, acessoOrionSuporte: enabled }))
                    : undefined
                }
                disabled={usuarioNiveis.find((n) => n.id === editForm.nivelId)?.nome === 'ADMINISTRADOR'}
              />
              <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' }, gap: 2, mb: 2 }}>
                <TextField
                  label="Nova senha"
                  type={showEditPassword ? 'text' : 'password'}
                  value={editForm.senha}
                  onChange={(event) => handleEditChange('senha', event.target.value)}
                  placeholder="Informe uma nova senha (opcional)"
                  fullWidth
                  variant="outlined"
                  size="small"
                  InputProps={{
                    endAdornment: (
                      <InputAdornment position="end">
                        <IconButton
                          aria-label={showEditPassword ? 'Ocultar senha' : 'Mostrar senha'}
                          onClick={() => setShowEditPassword(!showEditPassword)}
                          edge="end"
                        >
                          {showEditPassword ? <VisibilityOff /> : <Visibility />}
                        </IconButton>
                      </InputAdornment>
                    ),
                  }}
                />
                <TextField
                  label="Confirmar nova senha"
                  type={showEditConfirmPassword ? 'text' : 'password'}
                  value={editForm.confirmarSenha}
                  onChange={(event) => handleEditChange('confirmarSenha', event.target.value)}
                  placeholder="Repita a nova senha"
                  fullWidth
                  variant="outlined"
                  size="small"
                  InputProps={{
                    endAdornment: (
                      <InputAdornment position="end">
                        <IconButton
                          aria-label={showEditConfirmPassword ? 'Ocultar senha' : 'Mostrar senha'}
                          onClick={() => setShowEditConfirmPassword(!showEditConfirmPassword)}
                          edge="end"
                        >
                          {showEditConfirmPassword ? <VisibilityOff /> : <Visibility />}
                        </IconButton>
                      </InputAdornment>
                    ),
                  }}
                />
              </Box>
              <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' }, gap: 2, mb: 2 }}>
                <FormControl fullWidth variant="outlined" size="small">
                  <InputLabel>Pergunta de Segurança</InputLabel>
                  <Select
                    value={editForm.perguntaSeguranca}
                    onChange={(event) => handleEditChange('perguntaSeguranca', event.target.value)}
                    label="Pergunta de Segurança"
                    MenuProps={{ sx: { zIndex: 1500 } }}
                  >
                    <MenuItem value="">Selecione uma pergunta</MenuItem>
                    {perguntasAtivas.map((pergunta) => (
                      <MenuItem key={pergunta.id} value={pergunta.texto}>
                        {formatNome(pergunta.texto)}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
                <TextField
                  label="Resposta de Segurança"
                  type="text"
                  value={editForm.respostaSeguranca}
                  onChange={(event) => handleEditChange('respostaSeguranca', event.target.value)}
                  placeholder="Deixe em branco para não alterar"
                  fullWidth
                  variant="outlined"
                  size="small"
                />
              </Box>
              <Box sx={{ display: 'flex', gap: 2, justifyContent: 'flex-end', mt: 2 }}>
                <Button
                  type="button"
                  variant="outlined"
                  onClick={resetEditForm}
                  disabled={editSubmitting}
                >
                  Cancelar
                </Button>
                <Button
                  type="submit"
                  variant="contained"
                  disabled={editSubmitting}
                >
                  {editSubmitting ? 'Salvando...' : 'Salvar alterações'}
                </Button>
              </Box>
            </form>
          </div>
        </div>
      )}

      {showImageCropper && (
        <div className="modal-backdrop modal-backdrop-top" role="dialog" aria-modal="true">
          <div className="modal" style={{ maxWidth: '800px' }}>
            <h3>Enquadrar foto</h3>
            <ImageCropper
              imageSrc={imageForCrop}
              onCropComplete={handleCropComplete}
              onCancel={() => {
                setShowImageCropper(false);
                setImageForCrop('');
                fileSelectInProgressRef.current = false;
                setFileSelectBlocking(false);
                if (fileInputRef.current) fileInputRef.current.value = '';
                if (fileInputRefEdit.current) fileInputRefEdit.current.value = '';
              }}
            />
          </div>
        </div>
      )}

      {/* Modal de Exclusão Permanente com Confirmação de Senha */}
      {deleteModal.open && deleteModal.usuario && (
        <div className="modal-backdrop" role="dialog" aria-modal="true">
          <div className="modal" style={{ maxWidth: '500px' }}>
            <h3>Excluir usuário permanentemente</h3>
            <Alert severity="error" sx={{ mb: 2 }}>
              <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>
                ATENÇÃO: Esta ação é IRREVERSÍVEL!
              </Typography>
              <Typography variant="body2" sx={{ mt: 1 }}>
                O usuário <strong>{deleteModal.usuario.nome}</strong> (matrícula{' '}
                <strong>{formatMatricula(deleteModal.usuario.matricula)}</strong>) será removido
                permanentemente do banco de dados.
              </Typography>
              <Typography variant="body2" sx={{ mt: 1 }}>
                Se tem certeza que realmente quer excluir o registro do banco de dados,
                digite a senha do administrador para confirmar a operação.
              </Typography>
            </Alert>

            {deleteModal.error && (
              <Alert severity="error" sx={{ mb: 2 }} onClose={() => setDeleteModal((prev) => ({ ...prev, error: null }))}>
                {deleteModal.error}
              </Alert>
            )}

            <form
              onSubmit={(e) => {
                e.preventDefault();
                void handleConfirmDelete();
              }}
            >
              <TextField
                label="Senha do Administrador"
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
                fullWidth
                variant="outlined"
                size="small"
                sx={{ mb: 2 }}
              />

              <Box sx={{ display: 'flex', gap: 2, justifyContent: 'flex-end' }}>
                <Button
                  type="button"
                  variant="outlined"
                  onClick={handleCloseDeleteModal}
                  disabled={deleteModal.loading}
                >
                  Cancelar
                </Button>
                <Button
                  type="submit"
                  variant="contained"
                  color="error"
                  disabled={deleteModal.loading || !deleteModal.senha.trim()}
                >
                  {deleteModal.loading ? 'Excluindo...' : 'Sim, excluir permanentemente'}
                </Button>
              </Box>
            </form>
          </div>
        </div>
      )}
    </section>
  );
}
