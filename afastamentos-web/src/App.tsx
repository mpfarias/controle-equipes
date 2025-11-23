import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { api } from './api.ts';
import type {
  Afastamento,
  AfastamentoStatus,
  Colaborador,
  LoginInput,
  PolicialStatus,
  Usuario,
  CreateUsuarioInput,
  Equipe,
} from './types.ts';

type TabKey = 'dashboard' | 'afastamentos' | 'colaboradores' | 'equipe' | 'usuarios';

type ConfirmDialogConfig = {
  open: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  onConfirm?: () => Promise<void> | void;
};

type ConfirmConfig = Omit<ConfirmDialogConfig, 'open'>;

const TABS: { key: TabKey; label: string }[] = [
  { key: 'dashboard', label: 'Afastamentos do mês' },
  { key: 'afastamentos', label: 'Gerenciar afastamentos' },
  { key: 'colaboradores', label: 'Cadastrar Policial' },
  { key: 'equipe', label: 'Mostrar Equipe' },
  { key: 'usuarios', label: 'Cadastrar usuários' },
];

const STATUS_LABEL: Record<AfastamentoStatus, string> = {
  ATIVO: 'Ativo',
  ENCERRADO: 'Encerrado',
};

const POLICIAL_STATUS_OPTIONS: { value: PolicialStatus; label: string }[] = [
  { value: 'ATIVO', label: 'Ativo' },
  { value: 'DESIGNADO', label: 'Designado' },
  { value: 'COMISSIONADO', label: 'Comissionado' },
  { value: 'PTTC', label: 'PTTC' },
];

const EQUIPE_OPTIONS: { value: Equipe; label: string }[] = [
  { value: 'A', label: 'Equipe A' },
  { value: 'B', label: 'Equipe B' },
  { value: 'C', label: 'Equipe C' },
  { value: 'D', label: 'Equipe D' },
  { value: 'E', label: 'Equipe E' },
];

const PERGUNTAS_SEGURANCA = [
  'Qual o nome da sua mãe?',
  'Qual o nome do seu pai?',
  'Qual o nome do seu primeiro animal de estimação?',
  'Qual o nome da cidade onde você nasceu?',
  'Qual o nome da sua escola primária?',
  'Qual o nome do seu melhor amigo de infância?',
  'Qual o nome do seu primeiro professor?',
  'Qual o apelido que você tinha na infância?',
  'Qual o nome da sua primeira rua?',
  'Qual o nome do seu primeiro emprego?',
];

const EQUIPE_FONETICA: Record<Equipe, string> = {
  A: 'Alfa',
  B: 'Bravo',
  C: 'Charlie',
  D: 'Delta',
  E: 'Echo',
};

function ConfirmDialog({
  config,
  onCancel,
  onConfirm,
}: {
  config: ConfirmDialogConfig;
  onCancel: () => void;
  onConfirm: () => Promise<void>;
}) {
  const { open, title, message, confirmLabel, cancelLabel } = config;
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open) {
      setLoading(false);
    }
  }, [open]);

  if (!open) {
    return null;
  }

  const handleConfirm = async () => {
    try {
      setLoading(true);
      await onConfirm();
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="modal-backdrop">
      <div className="modal">
        <h3>{title}</h3>
        <p>{message}</p>
        <div className="modal-actions">
          <button
            type="button"
            className="secondary"
            onClick={onCancel}
            disabled={loading}
          >
            {cancelLabel ?? 'Cancelar'}
          </button>
          <button
            type="button"
            className="danger"
            onClick={handleConfirm}
            disabled={loading}
          >
            {loading ? 'Aguarde...' : confirmLabel ?? 'Confirmar'}
          </button>
        </div>
      </div>
    </div>
  );
}

const MOTIVO_OPTIONS = [
  'Férias',
  'Abono',
  'Dispensa recompensa',
  'LTSP',
  'Aniversário',
  'Outro',
] as const;

const STORAGE_KEY = 'afastamentos-web:usuario';

function formatDate(value?: string | null) {
  if (!value) {
    return '—';
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat('pt-BR').format(date);
}

function calcularDiasEntreDatas(dataInicio: string, dataFim?: string | null): number {
  if (!dataFim) {
    return 0;
  }
  const inicio = new Date(dataInicio);
  const fim = new Date(dataFim);
  inicio.setHours(0, 0, 0, 0);
  fim.setHours(0, 0, 0, 0);
  const diffTime = Math.abs(fim.getTime() - inicio.getTime());
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1; // +1 para incluir o dia inicial
  return diffDays;
}

function formatPeriodo(dataInicio: string, dataFim?: string | null): string {
  const dataInicioFormatada = formatDate(dataInicio);
  const dataFimFormatada = formatDate(dataFim);
  const dias = calcularDiasEntreDatas(dataInicio, dataFim);
  
  if (!dataFim) {
    return `${dataInicioFormatada} (em aberto)`;
  }
  
  return `${dataInicioFormatada} — ${dataFimFormatada} (${dias} ${dias === 1 ? 'dia' : 'dias'})`;
}

type AuthView = 'login' | 'forgot-password' | 'reset-password' | 'security-question';

function LoginView({
  onSuccess,
  onForgotPassword,
}: {
  onSuccess: (usuario: Usuario) => void;
  onForgotPassword: () => void;
}) {
  const [form, setForm] = useState<LoginInput>({ matricula: '', senha: '' });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleChange = (field: keyof LoginInput, value: string) => {
    if (field === 'matricula') {
      value = value.replace(/[^0-9xX]/g, '').toUpperCase();
    }
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);

    if (!form.matricula.trim() || !form.senha) {
      setError('Informe matrícula e senha.');
      return;
    }

    try {
      setLoading(true);
      const usuario = await api.login({
        matricula: form.matricula.trim(),
        senha: form.senha,
      });
      onSuccess(usuario);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Credenciais inválidas. Tente novamente.',
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <section className="login-card">
      <h2>Acessar o sistema</h2>
      <p>Entre com a matrícula e a senha cadastrada.</p>

      {error && <div className="feedback error">{error}</div>}

      <form onSubmit={handleSubmit}>
        <label>
          Matrícula
          <input
            value={form.matricula}
            onChange={(event) => handleChange('matricula', event.target.value)}
            placeholder="Ex: 23456x"
            autoComplete="username"
            required
          />
        </label>
        <label>
          Senha
          <input
            type="password"
            value={form.senha}
            onChange={(event) => handleChange('senha', event.target.value)}
            placeholder="Digite a senha"
            autoComplete="current-password"
            required
          />
        </label>
        <button className="primary" type="submit" disabled={loading}>
          {loading ? 'Validando...' : 'Entrar'}
        </button>
      </form>
      <div style={{ textAlign: 'center', marginTop: '1rem' }}>
        <button
          type="button"
          className="link-button"
          onClick={onForgotPassword}
          style={{
            background: 'none',
            border: 'none',
            color: '#1d4ed8',
            cursor: 'pointer',
            textDecoration: 'underline',
            fontSize: '0.9rem',
          }}
        >
          Esqueci minha senha
        </button>
      </div>
    </section>
  );
}

function ForgotPasswordView({
  onBack,
  onSecurityQuestionReceived,
}: {
  onBack: () => void;
  onSecurityQuestionReceived: (matricula: string, pergunta: string) => void;
}) {
  const [matricula, setMatricula] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [perguntaSeguranca, setPerguntaSeguranca] = useState<string | null>(null);

  const handleChange = (value: string) => {
    setMatricula(value.replace(/[^0-9xX]/g, '').toUpperCase());
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    setSuccess(null);
    setPerguntaSeguranca(null);

    if (!matricula.trim()) {
      setError('Informe a matrícula.');
      return;
    }

    try {
      setLoading(true);
      const result = await api.forgotPassword(matricula.trim());
      
      if (result.perguntaSeguranca) {
        setPerguntaSeguranca(result.perguntaSeguranca);
        onSecurityQuestionReceived(matricula.trim(), result.perguntaSeguranca);
      } else {
        setSuccess(result.message);
      }
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Não foi possível processar a solicitação. Tente novamente.',
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <section className="login-card">
      <h2>Recuperar senha</h2>
      <p>Informe sua matrícula para receber instruções de recuperação de senha.</p>

      {error && <div className="feedback error">{error}</div>}
      {success && <div className="feedback success">{success}</div>}

      {perguntaSeguranca && (
        <div
          className="feedback"
          style={{
            backgroundColor: '#eff6ff',
            borderColor: '#3b82f6',
            color: '#1e40af',
            padding: '1rem',
            borderRadius: '4px',
            marginBottom: '1rem',
          }}
        >
          <p style={{ margin: '0 0 0.5rem 0', fontWeight: 'bold' }}>
            Pergunta de Segurança:
          </p>
          <p style={{ margin: '0 0 1rem 0' }}>{perguntaSeguranca}</p>
          <p style={{ margin: '1rem 0 0', fontSize: '0.9rem' }}>
            A pergunta foi exibida acima. Clique em "Continuar" para responder.
          </p>
        </div>
      )}


      <form onSubmit={handleSubmit}>
        <label>
          Matrícula
          <input
            value={matricula}
            onChange={(event) => handleChange(event.target.value)}
            placeholder="Ex: 23456x"
            autoComplete="username"
            required
          />
        </label>
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <button
            type="button"
            className="secondary"
            onClick={onBack}
            disabled={loading}
          >
            Voltar
          </button>
          <button className="primary" type="submit" disabled={loading}>
            {loading ? 'Enviando...' : 'Enviar'}
          </button>
        </div>
      </form>
    </section>
  );
}

function ResetPasswordView({
  token: initialToken,
  onBack,
  onSuccess,
}: {
  token?: string;
  onBack: () => void;
  onSuccess: () => void;
}) {
  const [token, setToken] = useState(initialToken || '');
  const [novaSenha, setNovaSenha] = useState('');
  const [confirmarSenha, setConfirmarSenha] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    setSuccess(null);

    if (!token.trim()) {
      setError('Token é obrigatório.');
      return;
    }

    if (!novaSenha) {
      setError('Informe a nova senha.');
      return;
    }

    if (novaSenha.length < 6) {
      setError('A senha deve ter pelo menos 6 caracteres.');
      return;
    }

    if (novaSenha !== confirmarSenha) {
      setError('As senhas não coincidem.');
      return;
    }

    try {
      setLoading(true);
      const result = await api.resetPassword(token.trim(), novaSenha);
      setSuccess(result.message);
      setTimeout(() => {
        onSuccess();
      }, 2000);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Não foi possível redefinir a senha. Verifique o token e tente novamente.',
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <section className="login-card">
      <h2>Redefinir senha</h2>
      <p>Informe o token recebido e defina uma nova senha.</p>

      {error && <div className="feedback error">{error}</div>}
      {success && <div className="feedback success">{success}</div>}

      <form onSubmit={handleSubmit}>
        <label>
          Token
          <input
            value={token}
            onChange={(event) => setToken(event.target.value)}
            placeholder="Cole o token recebido"
            required
            disabled={!!initialToken}
          />
        </label>
        <label>
          Nova senha
          <input
            type="password"
            value={novaSenha}
            onChange={(event) => setNovaSenha(event.target.value)}
            placeholder="Mínimo de 6 caracteres"
            autoComplete="new-password"
            required
            minLength={6}
          />
        </label>
        <label>
          Confirmar senha
          <input
            type="password"
            value={confirmarSenha}
            onChange={(event) => setConfirmarSenha(event.target.value)}
            placeholder="Digite a senha novamente"
            autoComplete="new-password"
            required
            minLength={6}
          />
        </label>
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <button
            type="button"
            className="secondary"
            onClick={onBack}
            disabled={loading}
          >
            Voltar
          </button>
          <button className="primary" type="submit" disabled={loading}>
            {loading ? 'Redefinindo...' : 'Redefinir senha'}
          </button>
        </div>
      </form>
    </section>
  );
}

function SecurityQuestionView({
  matricula: initialMatricula,
  pergunta: initialPergunta,
  onBack,
  onSuccess,
}: {
  matricula?: string;
  pergunta?: string;
  onBack: () => void;
  onSuccess: () => void;
}) {
  const [matricula] = useState(initialMatricula || '');
  const [pergunta] = useState(initialPergunta || '');
  const [respostaSeguranca, setRespostaSeguranca] = useState('');
  const [novaSenha, setNovaSenha] = useState('');
  const [confirmarSenha, setConfirmarSenha] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    setSuccess(null);

    if (!respostaSeguranca.trim()) {
      setError('Informe a resposta da pergunta de segurança.');
      return;
    }

    if (!novaSenha) {
      setError('Informe a nova senha.');
      return;
    }

    if (novaSenha.length < 6) {
      setError('A senha deve ter pelo menos 6 caracteres.');
      return;
    }

    if (novaSenha !== confirmarSenha) {
      setError('As senhas não coincidem.');
      return;
    }

    try {
      setLoading(true);
      const result = await api.resetPasswordBySecurityQuestion(
        matricula,
        respostaSeguranca.trim(),
        novaSenha,
      );
      setSuccess(result.message);
      setTimeout(() => {
        onSuccess();
      }, 2000);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Não foi possível redefinir a senha. Verifique a resposta e tente novamente.',
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <section className="login-card">
      <h2>Responder pergunta de segurança</h2>
      <p>Responda a pergunta abaixo e defina uma nova senha.</p>

      {error && <div className="feedback error">{error}</div>}
      {success && <div className="feedback success">{success}</div>}

      {pergunta && (
        <div
          className="feedback"
          style={{
            backgroundColor: '#eff6ff',
            borderColor: '#3b82f6',
            color: '#1e40af',
            padding: '1rem',
            borderRadius: '4px',
            marginBottom: '1rem',
          }}
        >
          <p style={{ margin: '0 0 0.5rem 0', fontWeight: 'bold' }}>
            Pergunta de Segurança:
          </p>
          <p style={{ margin: 0 }}>{pergunta}</p>
        </div>
      )}

      <form onSubmit={handleSubmit}>
        <label>
          Resposta
          <input
            type="text"
            value={respostaSeguranca}
            onChange={(event) => setRespostaSeguranca(event.target.value)}
            placeholder="Digite a resposta da pergunta"
            autoComplete="off"
            required
          />
        </label>
        <label>
          Nova senha
          <input
            type="password"
            value={novaSenha}
            onChange={(event) => setNovaSenha(event.target.value)}
            placeholder="Mínimo de 6 caracteres"
            autoComplete="new-password"
            required
            minLength={6}
          />
        </label>
        <label>
          Confirmar senha
          <input
            type="password"
            value={confirmarSenha}
            onChange={(event) => setConfirmarSenha(event.target.value)}
            placeholder="Digite a senha novamente"
            autoComplete="new-password"
            required
            minLength={6}
          />
        </label>
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <button
            type="button"
            className="secondary"
            onClick={onBack}
            disabled={loading}
          >
            Voltar
          </button>
          <button className="primary" type="submit" disabled={loading}>
            {loading ? 'Redefinindo...' : 'Redefinir senha'}
          </button>
        </div>
      </form>
    </section>
  );
}

function UsuariosSection({
  currentUser,
  openConfirm,
}: {
  currentUser: Usuario;
  openConfirm: (config: ConfirmConfig) => void;
}) {
  const initialCreateForm = {
    nome: '',
    matricula: '',
    senha: '',
    confirmarSenha: '',
    perguntaSeguranca: '',
    respostaSeguranca: '',
    equipe: 'A' as Equipe,
  };

  const initialEditForm = {
    nome: '',
    matricula: '',
    senha: '',
    confirmarSenha: '',
    perguntaSeguranca: '',
    respostaSeguranca: '',
    equipe: 'A' as Equipe,
  };

  const [usuarios, setUsuarios] = useState<Usuario[]>([]);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [form, setForm] = useState(initialCreateForm);
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

  const carregarUsuarios = useCallback(async () => {
    try {
      setLoading(true);
      // Passar o ID do usuário logado para o backend verificar se é admin
      const userId = currentUser?.id;
      const data = await api.listUsuarios(userId);
      setUsuarios(data);
      setError(null);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Não foi possível carregar os usuários.',
      );
    } finally {
      setLoading(false);
    }
  }, [currentUser?.id]);

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
    void carregarUsuarios();
  }, [carregarUsuarios]);

  // Revalidar matrícula quando a lista de usuários for atualizada
  useEffect(() => {
    if (form.matricula.trim() && !loading) {
      validateMatricula(form.matricula);
    }
  }, [usuarios, form.matricula, validateMatricula, loading]);

  const handleChange = (field: keyof typeof form, value: string) => {
    if (field === 'nome') {
      value = value.toUpperCase();
    }
    if (field === 'matricula') {
      value = value.replace(/[^0-9xX]/g, '').toUpperCase();
      setForm((prev) => ({ ...prev, [field]: value }));
      
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
        validateMatricula(value);
      }, 300);
      
      return;
    }
    if (field === 'equipe') {
      value = value.toUpperCase();
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

    try {
      setSubmitting(true);
      await api.createUsuario(
        {
          nome,
          matricula,
          senha: form.senha,
          perguntaSeguranca: form.perguntaSeguranca.trim() || undefined,
          respostaSeguranca: form.respostaSeguranca.trim() || undefined,
          equipe: form.equipe,
        },
        currentUser.id,
      );
      resetForm();
      setSuccess('Usuário cadastrado com sucesso.');
      await carregarUsuarios();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Não foi possível criar o usuário.',
      );
    } finally {
      setSubmitting(false);
    }
  };

  const handleEditChange = (field: keyof typeof editForm, value: string) => {
    if (field === 'nome') {
      value = value.toUpperCase();
    }
    if (field === 'matricula') {
      value = value.replace(/[^0-9xX]/g, '').toUpperCase();
    }
    if (field === 'equipe') {
      value = value.toUpperCase();
    }
    setEditForm((prev) => ({ ...prev, [field]: value }));
  };

  const handleEdit = (usuario: Usuario) => {
    setEditingUsuario(usuario);
    setEditForm({
      nome: usuario.nome,
      matricula: usuario.matricula,
      senha: '',
      confirmarSenha: '',
      perguntaSeguranca: usuario.perguntaSeguranca || '',
      respostaSeguranca: '',
      equipe: usuario.equipe ?? 'A',
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

    const novaSenha = editForm.senha;
    const payloadBase: Partial<CreateUsuarioInput> = {
      nome,
      matricula,
      perguntaSeguranca: editForm.perguntaSeguranca.trim() || undefined,
      respostaSeguranca: editForm.respostaSeguranca.trim() || undefined,
      equipe: editForm.equipe,
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
          await api.updateUsuario(editingUsuario.id, payload, currentUser.id);
          setSuccess('Usuário atualizado com sucesso.');
          resetEditForm();
          await carregarUsuarios();
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
          await api.removeUsuario(usuario.id, currentUser.id);
          if (editingUsuario?.id === usuario.id) {
            resetEditForm();
          }
          setSuccess('Usuário desativado.');
          await carregarUsuarios();
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
          await api.activateUsuario(usuario.id, currentUser.id);
          if (editingUsuario?.id === usuario.id) {
            resetEditForm();
          }
          setSuccess('Usuário ativado.');
          await carregarUsuarios();
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
      await api.deleteUsuario(deleteModal.usuario.id, deleteModal.senha, currentUser.id);
      
      if (editingUsuario?.id === deleteModal.usuario.id) {
        resetEditForm();
      }
      
      setSuccess('Usuário excluído permanentemente.');
      handleCloseDeleteModal();
      await carregarUsuarios();
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
    if (!normalizedSearch) {
      return usuarios;
    }
    return usuarios.filter((usuario) =>
      usuario.nome.includes(normalizedSearch),
    );
  }, [usuarios, normalizedSearch]);

  return (
    <section>
      <div>
        <h2>Usuários</h2>
        <p>Cadastre usuários responsáveis pelo acesso ao painel.</p>
      </div>

      {error && <div className="feedback error">{error}</div>}
      {success && <div className="feedback success">{success}</div>}

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
        </div>
        <div className="grid two-columns">
          <label>
            Senha
            <input
              type="password"
              value={form.senha}
              onChange={(event) => handleChange('senha', event.target.value)}
              placeholder="Informe uma senha forte"
              required
            />
          </label>
          <label>
            Confirmar senha
            <input
              type="password"
              value={form.confirmarSenha}
              onChange={(event) => handleChange('confirmarSenha', event.target.value)}
              placeholder="Repita a senha"
              required
            />
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
                <td>{usuario.equipe}</td>
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
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {editingUsuario && (
        <div className="modal-backdrop" role="dialog" aria-modal="true">
          <div className="modal modal-large">
            <h3>Editar usuário</h3>
            {editError && <div className="feedback error">{editError}</div>}
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
              </div>
              <div className="grid two-columns">
                <label>
                  Nova senha
                  <input
                    type="password"
                    value={editForm.senha}
                    onChange={(event) =>
                      handleEditChange('senha', event.target.value)
                    }
                    placeholder="Informe uma nova senha (opcional)"
                  />
                </label>
                <label>
                  Confirmar nova senha
                  <input
                    type="password"
                    value={editForm.confirmarSenha}
                    onChange={(event) =>
                      handleEditChange('confirmarSenha', event.target.value)
                    }
                    placeholder="Repita a nova senha"
                  />
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
              <strong>ATENÇÃO: Esta ação é IRREVERSÍVEL!</strong>
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

function ColaboradoresSection({
  currentUser,
  onChanged,
}: {
  currentUser: Usuario;
  onChanged?: () => void;
}) {
  const initialForm = { nome: '', matricula: '', status: 'ATIVO' as PolicialStatus };
  const [colaboradores, setColaboradores] = useState<Colaborador[]>([]);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [form, setForm] = useState(initialForm);
  const [matriculaError, setMatriculaError] = useState<string | null>(null);
  const matriculaTimeoutRef = useRef<number | null>(null);
  const [reativarModal, setReativarModal] = useState<{
    open: boolean;
    colaborador: Colaborador | null;
    loading: boolean;
  }>({
    open: false,
    colaborador: null,
    loading: false,
  });

  const carregarColaboradores = useCallback(async () => {
    try {
      setLoading(true);
      const data = await api.listColaboradores();
      setColaboradores(data);
    } catch (err) {
      // Silenciosamente falha, não precisa mostrar erro aqui
    } finally {
      setLoading(false);
    }
  }, []);

  const validateMatricula = useCallback((matricula: string) => {
    // Se a lista ainda não foi carregada, não valida
    if (loading || (colaboradores.length === 0 && !error)) {
      return;
    }

    const matriculaTrimmed = matricula.trim().toUpperCase();
    if (!matriculaTrimmed) {
      setMatriculaError(null);
      return;
    }

    const matriculaExists = colaboradores.some(
      (colaborador) => colaborador.matricula.toUpperCase() === matriculaTrimmed,
    );

    if (matriculaExists) {
      setMatriculaError('Esta matrícula já está cadastrada.');
    } else {
      setMatriculaError(null);
    }
  }, [colaboradores, loading, error]);

  useEffect(() => {
    void carregarColaboradores();
  }, [carregarColaboradores]);

  // Revalidar matrícula quando a lista de colaboradores for atualizada
  useEffect(() => {
    if (form.matricula.trim() && !loading) {
      validateMatricula(form.matricula);
    }
  }, [colaboradores, form.matricula, validateMatricula, loading]);

  // Limpar timeout ao desmontar o componente
  useEffect(() => {
    return () => {
      if (matriculaTimeoutRef.current) {
        clearTimeout(matriculaTimeoutRef.current);
      }
    };
  }, []);

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
    const matriculaExists = colaboradores.some(
      (colaborador) => colaborador.matricula.toUpperCase() === matricula.toUpperCase(),
    );
    if (matriculaExists) {
      setMatriculaError('Esta matrícula já está cadastrada.');
      setError('Esta matrícula já está cadastrada.');
      return;
    }

    try {
      setSubmitting(true);
      await api.createColaborador(
        { 
          nome, 
          matricula, 
          status: form.status,
          equipe: currentUser.equipe,
        },
        currentUser.id,
      );
      setSuccess('Policial cadastrado com sucesso.');

      setForm(initialForm);
      setMatriculaError(null);
      if (matriculaTimeoutRef.current) {
        clearTimeout(matriculaTimeoutRef.current);
        matriculaTimeoutRef.current = null;
      }
      await carregarColaboradores();
      onChanged?.();
    } catch (err) {
      // Verificar se é erro de colaborador desativado
      let errorData: unknown = null;
      
      if (err instanceof Error && 'data' in err) {
        errorData = (err as Error & { data: unknown }).data;
      } else if (err instanceof Error) {
        // Tentar fazer parse da mensagem caso o erro venha como string JSON
        try {
          errorData = JSON.parse(err.message);
        } catch {
          // Não é JSON, usar mensagem direta
        }
      }

      if (
        errorData &&
        typeof errorData === 'object' &&
        errorData !== null &&
        'message' in errorData &&
        errorData.message === 'COLABORADOR_DESATIVADO' &&
        'colaborador' in errorData
      ) {
        // Mostrar modal de reativação
        setReativarModal({
          open: true,
          colaborador: errorData.colaborador as Colaborador,
          loading: false,
        });
        setSubmitting(false);
        return;
      }
      
      setError(
        err instanceof Error
          ? err.message
          : 'Não foi possível cadastrar o policial.',
      );
    } finally {
      setSubmitting(false);
    }
  };

  const handleCloseReativarModal = () => {
    setReativarModal({
      open: false,
      colaborador: null,
      loading: false,
    });
  };

  const handleConfirmReativar = async () => {
    if (!reativarModal.colaborador) {
      return;
    }

    try {
      setReativarModal((prev) => ({ ...prev, loading: true }));
      setError(null);
      
      // Reativar o colaborador
      await api.activateColaborador(reativarModal.colaborador.id, currentUser.id);
      
      // Atualizar os dados do colaborador reativado com os novos dados do formulário
      await api.updateColaborador(
        reativarModal.colaborador.id,
        {
          nome: form.nome.trim(),
          status: form.status,
          equipe: currentUser.equipe,
        },
        currentUser.id,
      );

      setSuccess('Policial reativado e atualizado com sucesso.');
      setForm(initialForm);
      setMatriculaError(null);
      if (matriculaTimeoutRef.current) {
        clearTimeout(matriculaTimeoutRef.current);
        matriculaTimeoutRef.current = null;
      }
      handleCloseReativarModal();
      await carregarColaboradores();
      onChanged?.();
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Não foi possível reativar o policial.',
      );
      setReativarModal((prev) => ({ ...prev, loading: false }));
    }
  };

  return (
    <section>
      <div>
        <h2>
          {`Cadastrar Policial - ${
            currentUser.equipe
              ? `Equipe ${EQUIPE_FONETICA[currentUser.equipe]} (${currentUser.equipe})`
              : 'Equipe'
          }`}
        </h2>
      </div>

      {error && <div className="feedback error">{error}</div>}
      {success && <div className="feedback success">{success}</div>}

      <form onSubmit={handleSubmit}>
        <div className="grid two-columns">
          <label>
            Nome
            <input
              autoFocus
              value={form.nome}
              onChange={(event) =>
                setForm((prev) => ({
                  ...prev,
                  nome: event.target.value.toUpperCase(),
                }))
              }
              placeholder="2º SGT JOÃO PEREIRA DA SILVA"
              required
            />
          </label>
          <label>
            Matrícula
            <input
              value={form.matricula}
              onChange={(event) => {
                const value = event.target.value
                  .replace(/[^0-9xX]/g, '')
                  .toUpperCase();
                setForm((prev) => ({
                  ...prev,
                  matricula: value,
                }));

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
                  validateMatricula(value);
                }, 300);
              }}
              placeholder="Matrícula"
              required
              className={matriculaError ? 'input-error' : ''}
              aria-invalid={matriculaError ? 'true' : 'false'}
            />
            {matriculaError && (
              <span className="field-error">{matriculaError}</span>
            )}
          </label>
        </div>
        <label>
          Status
          <select
            value={form.status}
            onChange={(event) =>
              setForm((prev) => ({
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
        <div className="form-actions">
          <button className="primary" type="submit" disabled={submitting}>
            {submitting ? 'Salvando...' : 'Cadastrar policial'}
          </button>
        </div>
      </form>

      {/* Modal de Reativação de Colaborador Desativado */}
      {reativarModal.open && reativarModal.colaborador && (
        <div className="modal-backdrop" role="dialog" aria-modal="true">
          <div className="modal" style={{ maxWidth: '500px' }}>
            <h3>Colaborador já cadastrado</h3>
            <div className="feedback" style={{ marginBottom: '16px', backgroundColor: '#fef3c7', borderColor: '#f59e0b', color: '#92400e' }}>
              <strong>Este colaborador já existe no sistema, porém está desativado.</strong>
              <p style={{ margin: '8px 0 0', fontSize: '0.9rem' }}>
                <strong>Nome:</strong> {reativarModal.colaborador.nome}
              </p>
              <p style={{ margin: '4px 0 0', fontSize: '0.9rem' }}>
                <strong>Matrícula:</strong> {reativarModal.colaborador.matricula}
              </p>
              <p style={{ margin: '8px 0 0', fontSize: '0.9rem' }}>
                Deseja reativar este colaborador com os dados informados?
              </p>
            </div>

            <div className="modal-actions">
              <button
                type="button"
                className="secondary"
                onClick={handleCloseReativarModal}
                disabled={reativarModal.loading}
              >
                Cancelar
              </button>
              <button
                type="button"
                className="primary"
                onClick={handleConfirmReativar}
                disabled={reativarModal.loading}
              >
                {reativarModal.loading ? 'Reativando...' : 'Sim, reativar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}

function AfastamentosSection({
  currentUser,
  openConfirm,
}: {
  currentUser: Usuario;
  openConfirm: (config: ConfirmConfig) => void;
}) {
  const initialForm = {
    colaboradorId: '',
    motivo: 'Férias' as (typeof MOTIVO_OPTIONS)[number],
    outroMotivo: '',
    descricao: '',
    dataInicio: '',
    dataFim: '',
  };

  const [afastamentos, setAfastamentos] = useState<Afastamento[]>([]);
  const [colaboradores, setColaboradores] = useState<Colaborador[]>([]);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [form, setForm] = useState(initialForm);
  const [searchTerm, setSearchTerm] = useState('');
  const [motivoFiltro, setMotivoFiltro] = useState<string>('');
  const [selectedMonth, setSelectedMonth] = useState<string>('');
  const [conflitosModal, setConflitosModal] = useState<{
    open: boolean;
    conflitos: Afastamento[];
    dataVerificada: string;
  }>({
    open: false,
    conflitos: [],
    dataVerificada: '',
  });
  const [validacaoDiasModal, setValidacaoDiasModal] = useState<{
    open: boolean;
    tipo: 'ferias' | 'abono';
    diasUsados: number;
    diasRestantes: number;
    diasSolicitados: number;
    colaboradorNome: string;
    ultrapassa: boolean;
  }>({
    open: false,
    tipo: 'ferias',
    diasUsados: 0,
    diasRestantes: 0,
    diasSolicitados: 0,
    colaboradorNome: '',
    ultrapassa: false,
  });

  const carregarDados = useCallback(async () => {
    try {
      setLoading(true);
      const [afastamentosData, colaboradoresData] = await Promise.all([
        api.listAfastamentos(),
        api.listColaboradores(),
      ]);
      
      const equipeAtual = currentUser.equipe;
      
      // Filtrar colaboradores por equipe (se houver equipe definida)
      const colaboradoresFiltrados = equipeAtual
        ? colaboradoresData.filter((colaborador) => 
            colaborador.equipe && colaborador.equipe === equipeAtual
          )
        : colaboradoresData;
      
      // Filtrar afastamentos apenas da equipe do usuário logado
      const afastamentosFiltrados = equipeAtual
        ? afastamentosData.filter((afastamento) => {
            const colaboradorEquipe = afastamento.colaborador?.equipe;
            // Incluir apenas se o colaborador tiver equipe e corresponder à equipe do usuário
            return colaboradorEquipe && colaboradorEquipe === equipeAtual;
          })
        : afastamentosData;
      
      setAfastamentos(afastamentosFiltrados);
      setColaboradores(colaboradoresFiltrados);
      setColaboradores(colaboradoresFiltrados);
      setError(null);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Não foi possível carregar os dados.',
      );
    } finally {
      setLoading(false);
    }
  }, [currentUser.equipe]);

  useEffect(() => {
    void carregarDados();
  }, [carregarDados]);

  // Função para calcular dias entre duas datas
  const calcularDiasEntreDatas = useCallback((dataInicio: string, dataFim?: string): number => {
    if (!dataFim) {
      return 0; // Sem data fim, não calcula
    }
    const inicio = new Date(dataInicio);
    const fim = new Date(dataFim);
    inicio.setHours(0, 0, 0, 0);
    fim.setHours(0, 0, 0, 0);
    const diffTime = Math.abs(fim.getTime() - inicio.getTime());
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1; // +1 para incluir o dia inicial
    return diffDays;
  }, []);

  // Função para calcular dias usados no ano para um motivo específico
  const calcularDiasUsadosNoAno = useCallback((
    colaboradorId: number,
    motivo: string,
    ano: number,
  ): number => {
    const afastamentosDoAno = afastamentos.filter((afastamento) => {
      if (afastamento.colaboradorId !== colaboradorId || afastamento.motivo !== motivo) {
        return false;
      }
      const dataInicio = new Date(afastamento.dataInicio);
      return dataInicio.getFullYear() === ano;
    });

    let totalDias = 0;
    for (const afastamento of afastamentosDoAno) {
      const dias = calcularDiasEntreDatas(
        afastamento.dataInicio,
        afastamento.dataFim || undefined,
      );
      totalDias += dias;
    }

    return totalDias;
  }, [afastamentos, calcularDiasEntreDatas]);

  // Função para verificar se dois períodos se sobrepõem
  const periodosSobrepostos = useCallback((
    inicio1: string,
    fim1: string | null | undefined,
    inicio2: string,
    fim2: string | null | undefined,
  ): boolean => {
    const dataInicio1 = new Date(inicio1);
    const dataFim1 = fim1 ? new Date(fim1) : null;
    const dataInicio2 = new Date(inicio2);
    const dataFim2 = fim2 ? new Date(fim2) : null;

    // Normalizar para comparar apenas a data (sem hora)
    dataInicio1.setHours(0, 0, 0, 0);
    if (dataFim1) dataFim1.setHours(0, 0, 0, 0);
    dataInicio2.setHours(0, 0, 0, 0);
    if (dataFim2) dataFim2.setHours(0, 0, 0, 0);

    // Verificar sobreposição: períodos se sobrepõem se há pelo menos um dia em comum
    // Período 1: [inicio1, fim1] - o policial está de férias até o dia fim1 (inclusive)
    // Período 2: [inicio2, fim2] - o policial estaria de férias a partir do dia inicio2 (inclusive)
    // Sobreposição se: inicio1 < fim2 && inicio2 < fim1
    // (usar < em vez de <= porque se um termina em X e outro começa em X, não há sobreposição - são adjacentes)
    if (dataFim1 && dataFim2) {
      // Ambos têm data fim
      const condicao1 = dataInicio1.getTime() < dataFim2.getTime();
      const condicao2 = dataInicio2.getTime() < dataFim1.getTime();
      const haSobreposicaoBasica = condicao1 && condicao2;

      // Se não há sobreposição básica, verificar se são adjacentes (um termina em X, outro começa em X)
      // Adjacentes não são considerados sobrepostos
      if (!haSobreposicaoBasica) {
        const saoAdjacentes1 = dataInicio2.getTime() === dataFim1.getTime(); // Período 2 começa quando período 1 termina
        const saoAdjacentes2 = dataInicio1.getTime() === dataFim2.getTime(); // Período 1 começa quando período 2 termina
        
        // Se são adjacentes, não há sobreposição
        return !(saoAdjacentes1 || saoAdjacentes2);
      }

      // Há sobreposição básica
      return true;
    } else if (dataFim1 && !dataFim2) {
      // Período 1 tem fim, período 2 não tem fim
      return dataInicio2.getTime() <= dataFim1.getTime();
    } else if (!dataFim1 && dataFim2) {
      // Período 1 não tem fim, período 2 tem fim
      return dataInicio1.getTime() <= dataFim2.getTime();
    } else {
      // Ambos não têm fim - sempre há sobreposição
      return true;
    }
  }, []);

  // Função para verificar conflitos em todo o intervalo de dias (excluindo o próprio policial)
  const verificarConflitos = useCallback((dataInicio: string, dataFim?: string | null, colaboradorIdExcluir?: number): Afastamento[] => {
    if (!dataInicio) {
      return [];
    }

    // Verificar todos os afastamentos ativos que se sobrepõem com o período informado
    // Excluindo o próprio policial que está sendo cadastrado
    const conflitos = afastamentos.filter((afastamento) => {
      // Excluir o próprio policial
      if (colaboradorIdExcluir && afastamento.colaboradorId === colaboradorIdExcluir) {
        return false;
      }

      // Verificar se o período do afastamento existente se sobrepõe com o período informado
      return periodosSobrepostos(
        dataInicio,
        dataFim || null,
        afastamento.dataInicio,
        afastamento.dataFim || null,
      );
    });

    return conflitos;
  }, [afastamentos, periodosSobrepostos]);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    setSuccess(null);

    if (!form.colaboradorId) {
      setError('Selecione um policial.');
      return;
    }

    const motivoFinal =
      form.motivo === 'Outro' ? form.outroMotivo.trim() : form.motivo;

    if (!motivoFinal) {
      setError('Informe o motivo do afastamento.');
      return;
    }

    if (!form.dataInicio) {
      setError('Informe a data de início.');
      return;
    }

    // PRIMEIRO: Verificar se o próprio policial já tem afastamento no período
    const colaboradorId = Number(form.colaboradorId);
    const afastamentosDoMesmoPolicial = afastamentos.filter(
      (afastamento) =>
        afastamento.colaboradorId === colaboradorId &&
        afastamento.status === 'ATIVO',
    );

    // Verificar se algum afastamento do mesmo policial se sobrepõe com o período informado
    for (const afastamentoExistente of afastamentosDoMesmoPolicial) {
      const haSobreposicao = periodosSobrepostos(
        form.dataInicio,
        form.dataFim || null,
        afastamentoExistente.dataInicio,
        afastamentoExistente.dataFim || null,
      );

      if (haSobreposicao) {
        setError(
          `Este policial já possui um afastamento ativo no período selecionado (${afastamentoExistente.motivo} de ${formatDate(afastamentoExistente.dataInicio)} até ${formatDate(afastamentoExistente.dataFim)}). Por favor, altere as datas.`,
        );
        return;
      }
    }

    // SEGUNDO: Verificar conflitos de afastamentos de OUTROS policiais no intervalo de dias
    const conflitos = verificarConflitos(form.dataInicio, form.dataFim || null, colaboradorId);
    
    if (conflitos.length > 0) {
      // Mostrar modal de conflitos informando sobre outros policiais afastados
      setConflitosModal({
        open: true,
        conflitos,
        dataVerificada: form.dataFim ? `${form.dataInicio} e ${form.dataFim}` : form.dataInicio,
      });
      return;
    }

    // Validar se férias não pode ser antes da data atual
    if (motivoFinal === 'Férias') {
      const dataInicio = new Date(form.dataInicio);
      const hoje = new Date();
      hoje.setHours(0, 0, 0, 0);
      dataInicio.setHours(0, 0, 0, 0);
      
      if (dataInicio < hoje) {
        setError('A data de início das férias não pode ser anterior à data atual.');
        return;
      }
    }

    // Validar férias e abono
    if (motivoFinal === 'Férias' || motivoFinal === 'Abono') {
      const colaboradorId = Number(form.colaboradorId);
      const colaborador = colaboradores.find((c) => c.id === colaboradorId);
      
      if (!colaborador) {
        setError('Colaborador não encontrado.');
        return;
      }

      const dataInicio = new Date(form.dataInicio);
      const ano = dataInicio.getFullYear();
      const diasSolicitados = calcularDiasEntreDatas(form.dataInicio, form.dataFim || undefined);
      
      if (!form.dataFim) {
        setError('Para férias e abono, é necessário informar a data de término.');
        return;
      }

      // Validar sobreposição de férias (não pode ter férias sobrepostas)
      if (motivoFinal === 'Férias') {
        const fériasExistentes = afastamentos.filter(
          (afastamento) =>
            afastamento.colaboradorId === colaboradorId &&
            afastamento.motivo === 'Férias' &&
            afastamento.status === 'ATIVO',
        );

        for (const feriasExistente of fériasExistentes) {
          // Verificar se há sobreposição: períodos se sobrepõem se há pelo menos um dia em comum
          // Período novo: [form.dataInicio, form.dataFim]
          // Período existente: [feriasExistente.dataInicio, feriasExistente.dataFim]
          // Sobreposição se: novoInicio <= existenteFim && existenteInicio <= novoFim
          
          // Criar datas de forma segura (usando formato ISO para evitar problemas de timezone)
          // Extrair apenas a parte da data (YYYY-MM-DD) de strings ISO
          const extrairDataStr = (dataStr: string): string => {
            if (!dataStr) return '';
            // Se já está no formato YYYY-MM-DD, retornar direto
            if (dataStr.match(/^\d{4}-\d{2}-\d{2}$/)) {
              return dataStr;
            }
            // Se está no formato ISO, extrair a parte da data
            return dataStr.split('T')[0];
          };

          const novoInicioStr = form.dataInicio;
          const novoFimStr = form.dataFim || null;
          const existenteInicioStr = extrairDataStr(feriasExistente.dataInicio);
          const existenteFimStr = feriasExistente.dataFim 
            ? extrairDataStr(feriasExistente.dataFim) 
            : null;

          // Comparar strings de data diretamente (formato YYYY-MM-DD)
          // Strings no formato YYYY-MM-DD podem ser comparadas diretamente
          let haSobreposicao = false;
          
          if (novoFimStr && existenteFimStr) {
            // Ambos têm data fim
            // Sobreposição se há pelo menos um dia em comum
            // Períodos consecutivos (um termina no dia X, outro começa no dia X+1) NÃO se sobrepõem
            // Strings no formato YYYY-MM-DD podem ser comparadas diretamente
            
            // Verificar sobreposição: períodos se sobrepõem se há pelo menos um dia em comum
            // Período existente: [existenteInicio, existenteFim] - o policial está de férias até o dia existenteFim (inclusive)
            // Período novo: [novoInicio, novoFim] - o policial estaria de férias a partir do dia novoInicio (inclusive)
            // Sobreposição se: novoInicio < existenteFim && existenteInicio < novoFim
            // (usar < em vez de <= porque se um termina em X e outro começa em X, não há sobreposição - são adjacentes)
            
            const condicao1 = novoInicioStr < existenteFimStr;
            const condicao2 = existenteInicioStr < novoFimStr;
            const haSobreposicaoBasica = condicao1 && condicao2;
            
            // Se não há sobreposição básica, verificar se são adjacentes (um termina em X, outro começa em X)
            // Adjacentes não são considerados sobrepostos
            if (!haSobreposicaoBasica) {
              const saoAdjacentes1 = novoInicioStr === existenteFimStr; // Novo começa quando existente termina
              const saoAdjacentes2 = existenteInicioStr === novoFimStr; // Existente começa quando novo termina
              
              // Se são adjacentes, não há sobreposição
              haSobreposicao = !(saoAdjacentes1 || saoAdjacentes2);
            } else {
              // Há sobreposição básica
              haSobreposicao = true;
            }
          } else if (novoFimStr && !existenteFimStr) {
            // Novo tem fim, existente não tem fim (sem fim = infinito)
            // Sobreposição se: existenteInicio <= novoFim
            haSobreposicao = existenteInicioStr <= novoFimStr;
          } else if (!novoFimStr && existenteFimStr) {
            // Novo não tem fim (infinito), existente tem fim
            // Sobreposição se: novoInicio <= existenteFim
            haSobreposicao = novoInicioStr <= existenteFimStr;
          } else {
            // Ambos não têm fim - sempre há sobreposição
            haSobreposicao = true;
          }

          if (haSobreposicao) {
            setError(
              'Policial já em usufruto de férias no período selecionado. Alterar a data.',
            );
            return;
          }
        }
      }

      const diasUsados = calcularDiasUsadosNoAno(colaboradorId, motivoFinal, ano);
      const limiteDias = motivoFinal === 'Férias' ? 30 : 5;
      const diasRestantes = limiteDias - diasUsados;
      const totalAposCadastro = diasUsados + diasSolicitados;
      const ultrapassa = totalAposCadastro > limiteDias;

      // Validar se o período solicitado ultrapassa o limite
      if (diasSolicitados > limiteDias) {
        setValidacaoDiasModal({
          open: true,
          tipo: motivoFinal === 'Férias' ? 'ferias' : 'abono',
          diasUsados,
          diasRestantes,
          diasSolicitados,
          colaboradorNome: colaborador.nome,
          ultrapassa: true,
        });
        return;
      }

      // Mostrar modal informativo mesmo se não ultrapassar
      setValidacaoDiasModal({
        open: true,
        tipo: motivoFinal === 'Férias' ? 'ferias' : 'abono',
        diasUsados,
        diasRestantes,
        diasSolicitados,
        colaboradorNome: colaborador.nome,
        ultrapassa: ultrapassa,
      });
      return;
    }

    // Se não houver conflitos e validações passaram, submeter normalmente
    await submeterAfastamento();
  };

  const submeterAfastamento = async () => {
    const motivoFinal =
      form.motivo === 'Outro' ? form.outroMotivo.trim() : form.motivo;

    try {
      setSubmitting(true);
      await api.createAfastamento(
        {
          colaboradorId: Number(form.colaboradorId),
          motivo: motivoFinal,
          descricao: form.descricao.trim() || undefined,
          dataInicio: form.dataInicio,
          dataFim: form.dataFim || undefined,
        },
        currentUser.id,
      );
      setForm(initialForm);
      setSuccess('Afastamento cadastrado com sucesso.');
      await carregarDados();
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Não foi possível criar o afastamento.',
      );
    } finally {
      setSubmitting(false);
    }
  };

  const handleConfirmarConflito = async () => {
    setConflitosModal({ open: false, conflitos: [], dataVerificada: '' });
    await submeterAfastamento();
  };

  const handleCancelarConflito = () => {
    setConflitosModal({ open: false, conflitos: [], dataVerificada: '' });
  };

  const handleConfirmarValidacaoDias = async () => {
    if (validacaoDiasModal.ultrapassa) {
      // Se ultrapassa, não permite cadastrar
      setValidacaoDiasModal({
        open: false,
        tipo: 'ferias',
        diasUsados: 0,
        diasRestantes: 0,
        diasSolicitados: 0,
        colaboradorNome: '',
        ultrapassa: false,
      });
      return;
    }

    // Se não ultrapassa, fecha o modal e continua com a submissão
    setValidacaoDiasModal({
      open: false,
      tipo: 'ferias',
      diasUsados: 0,
      diasRestantes: 0,
      diasSolicitados: 0,
      colaboradorNome: '',
      ultrapassa: false,
    });

    // Verificar conflitos novamente antes de submeter (caso algo tenha mudado)
    const colaboradorId = Number(form.colaboradorId);
    const conflitos = verificarConflitos(form.dataInicio, form.dataFim || null, colaboradorId);
    
    if (conflitos.length > 0) {
      // Mostrar modal de conflitos
      setConflitosModal({
        open: true,
        conflitos,
        dataVerificada: form.dataFim ? `${form.dataInicio} e ${form.dataFim}` : form.dataInicio,
      });
      return;
    }

    // Se não houver conflitos, submeter normalmente
    await submeterAfastamento();
  };

  const handleCancelarValidacaoDias = () => {
    setValidacaoDiasModal({
      open: false,
      tipo: 'ferias',
      diasUsados: 0,
      diasRestantes: 0,
      diasSolicitados: 0,
      colaboradorNome: '',
      ultrapassa: false,
    });
  };

  const handleDelete = (afastamento: Afastamento) => {
    openConfirm({
      title: 'Remover afastamento',
      message: `Deseja remover o afastamento "${afastamento.motivo}" do policial ${afastamento.colaborador.nome}?`,
      confirmLabel: 'Remover',
      onConfirm: async () => {
        try {
          setError(null);
          await api.removeAfastamento(afastamento.id, currentUser.id);
          setSuccess('Afastamento removido.');
          await carregarDados();
        } catch (err) {
          setError(
            err instanceof Error
              ? err.message
              : 'Não foi possível remover o afastamento.',
          );
        }
      },
    });
  };

  const colaboradoresOrdenados = useMemo(
    () =>
      [...colaboradores].sort((a, b) =>
        a.nome.localeCompare(b.nome, 'pt-BR', { sensitivity: 'base' }),
      ),
    [colaboradores],
  );
 
  const normalizedSearch = searchTerm.trim().toUpperCase();

  // Função para verificar se um período de afastamento se sobrepõe com um mês específico
  const periodoSobrepoeMes = useCallback((
    dataInicio: string,
    dataFim: string | null | undefined,
    year: number,
    month: number,
  ): boolean => {
    // Calcular primeiro e último dia do mês
    const primeiroDiaMes = new Date(year, month - 1, 1);
    const ultimoDiaMes = new Date(year, month, 0, 23, 59, 59); // Último dia do mês

    // Normalizar datas
    primeiroDiaMes.setHours(0, 0, 0, 0);
    ultimoDiaMes.setHours(23, 59, 59, 999);

    const inicioAfastamento = new Date(dataInicio);
    inicioAfastamento.setHours(0, 0, 0, 0);

    const fimAfastamento = dataFim ? new Date(dataFim) : null;
    if (fimAfastamento) {
      fimAfastamento.setHours(23, 59, 59, 999);
    }

    // Verificar sobreposição:
    // O período se sobrepõe se:
    // - O início do afastamento está dentro do mês, OU
    // - O fim do afastamento está dentro do mês, OU
    // - O afastamento engloba todo o mês (início antes e fim depois)
    if (fimAfastamento) {
      // Afastamento com data fim: verifica se há sobreposição
      return (
        (inicioAfastamento <= ultimoDiaMes && fimAfastamento >= primeiroDiaMes)
      );
    } else {
      // Afastamento sem data fim: verifica se começa antes ou durante o mês
      return inicioAfastamento <= ultimoDiaMes;
    }
  }, []);

  const afastamentosFiltrados = useMemo(() => {
    const [year, month] = selectedMonth.split('-').map(Number);

    const filtradoPorMes = !selectedMonth || Number.isNaN(year) || Number.isNaN(month)
      ? afastamentos
      : afastamentos.filter((afastamento) => {
          return periodoSobrepoeMes(
            afastamento.dataInicio,
            afastamento.dataFim,
            year,
            month,
          );
        });

    const filtradoPorMotivo =
      motivoFiltro
        ? filtradoPorMes.filter((afastamento) => afastamento.motivo === motivoFiltro)
        : filtradoPorMes;

    if (!normalizedSearch) {
      return filtradoPorMotivo;
    }

    return filtradoPorMotivo.filter((afastamento) =>
      afastamento.colaborador.nome.includes(normalizedSearch),
    );
  }, [afastamentos, motivoFiltro, normalizedSearch, selectedMonth, periodoSobrepoeMes]);

  const descricaoPeriodo = useMemo(() => {
    if (!selectedMonth) {
      return 'Todos os períodos';
    }

    const [year, month] = selectedMonth.split('-').map(Number);
    if (Number.isNaN(year) || Number.isNaN(month)) {
      return 'Todos os períodos';
    }

    if (month < 1 || month > 12) {
      return 'Todos os períodos';
    }

    const dataReferencia = new Date(year, month - 1, 1);

    if (Number.isNaN(dataReferencia.getTime())) {
      return 'Todos os períodos';
    }

    return new Intl.DateTimeFormat('pt-BR', {
      month: 'long',
      year: 'numeric',
    }).format(dataReferencia);
  }, [selectedMonth]);

  return (
    <section>
      <div>
        <h2>Afastamentos</h2>
        <p>Registre e acompanhe os afastamentos ativos e concluídos.</p>
      </div>

      {error && <div className="feedback error">{error}</div>}
      {success && <div className="feedback success">{success}</div>}

      <form onSubmit={handleSubmit}>
        <div className="grid two-columns">
          <label>
            Policial
            <select
              value={form.colaboradorId}
              onChange={(event) =>
                setForm((prev) => ({
                  ...prev,
                  colaboradorId: event.target.value,
                }))
              }
              required
            >
              <option value="">Selecione</option>
              {colaboradoresOrdenados.map((colaborador) => (
                <option key={colaborador.id} value={colaborador.id}>
                  {colaborador.nome} — {colaborador.matricula}
                </option>
              ))}
            </select>
          </label>
          <label>
            Motivo
            <select
              value={form.motivo}
              onChange={(event) =>
                setForm((prev) => ({
                  ...prev,
                  motivo: event.target.value as (typeof MOTIVO_OPTIONS)[number],
                }))
              }
            >
              {MOTIVO_OPTIONS.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </label>
        </div>
        {form.motivo === 'Outro' && (
          <label>
            Outro motivo
            <input
              value={form.outroMotivo}
              onChange={(event) =>
                setForm((prev) => ({
                  ...prev,
                  outroMotivo: event.target.value.toUpperCase(),
                }))
              }
              placeholder="Informe o motivo"
              required
            />
          </label>
        )}
        <label>
          Descrição (opcional)
          <textarea
            rows={3}
            value={form.descricao}
            onChange={(event) =>
              setForm((prev) => ({ ...prev, descricao: event.target.value }))
            }
            placeholder="Detalhes adicionais..."
          />
        </label>
        <div className="grid two-columns">
          <label>
            Data de início
            <input
              type="date"
              value={form.dataInicio}
              onChange={(event) =>
                setForm((prev) => ({ ...prev, dataInicio: event.target.value }))
              }
              required
            />
          </label>
          <label>
            Data de término
            <input
              type="date"
              value={form.dataFim}
              onChange={(event) =>
                setForm((prev) => ({ ...prev, dataFim: event.target.value }))
              }
            />
          </label>
        </div>
        <div className="form-actions">
          <button className="primary" type="submit" disabled={submitting}>
            {submitting ? 'Salvando...' : 'Cadastrar afastamento'}
          </button>
        </div>
      </form>

      <div>
        <div className="section-header">
          <h3>Lista de afastamentos</h3>
        </div>
        <div className="list-controls">
          <input
            className="search-input"
            value={searchTerm}
            onChange={(event) => setSearchTerm(event.target.value.toUpperCase())}
            placeholder="Pesquisar por nome"
          />
          <select
            className="search-input"
            value={motivoFiltro}
            onChange={(event) => setMotivoFiltro(event.target.value)}
          >
            <option value="">Todos os motivos</option>
            {MOTIVO_OPTIONS.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
          <input
            type="month"
            className="search-input"
            value={selectedMonth}
            onChange={(event) => setSelectedMonth(event.target.value)}
          />
          <span className="badge badge-muted">{descricaoPeriodo}</span>
        </div>
        {loading ? (
          <p className="empty-state">Carregando afastamentos...</p>
        ) : afastamentosFiltrados.length === 0 ? (
          <p className="empty-state">
            {selectedMonth
              ? 'Nenhum afastamento registrado neste mês.'
              : 'Nenhum afastamento cadastrado.'}
          </p>
        ) : (
          <table className="table">
            <thead>
              <tr>
                <th>Policial</th>
                <th>Motivo</th>
                <th>Período</th>
                <th>Status</th>
                <th>Ações</th>
              </tr>
            </thead>
            <tbody>
              {afastamentosFiltrados.map((afastamento) => (
                <tr key={afastamento.id}>
                  <td>
                    <div>{afastamento.colaborador.nome}</div>
                    <small>{afastamento.colaborador.matricula}</small>
                  </td>
                  <td>
                    <div>{afastamento.motivo}</div>
                    {afastamento.descricao && (
                      <small>{afastamento.descricao}</small>
                    )}
                  </td>
                  <td>
                    {formatPeriodo(afastamento.dataInicio, afastamento.dataFim)}
                  </td>
                  <td>
                    <span className="badge">
                      {STATUS_LABEL[afastamento.status]}
                    </span>
                  </td>
                  <td className="actions">
                    <button
                      className="danger"
                      type="button"
                      onClick={() => handleDelete(afastamento)}
                    >
                      Remover
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Modal de Conflitos de Afastamento */}
      {conflitosModal.open && (
        <div className="modal-backdrop">
          <div className="modal" style={{ maxWidth: '600px' }}>
            <h3>Conflito de Afastamentos</h3>
            <p>
              Existem {conflitosModal.conflitos.length} policial(is) já afastado(s) no período selecionado:
            </p>
            <div style={{ margin: '8px 0 16px', padding: '12px', backgroundColor: '#f1f5f9', borderRadius: '6px', color: '#475569' }}>
              <strong>Período do novo afastamento:</strong>
              <div style={{ marginTop: '4px' }}>
                {formatPeriodo(form.dataInicio, form.dataFim || null)}
              </div>
            </div>
            <div style={{ maxHeight: '400px', overflowY: 'auto', marginBottom: '16px' }}>
              <table className="table" style={{ fontSize: '0.85rem' }}>
                <thead>
                  <tr>
                    <th>Policial</th>
                    <th>Motivo</th>
                    <th>Período</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {conflitosModal.conflitos.map((afastamento) => (
                    <tr key={afastamento.id}>
                      <td>
                        <div>{afastamento.colaborador.nome}</div>
                        <small>{afastamento.colaborador.matricula}</small>
                      </td>
                      <td>
                        <div>{afastamento.motivo}</div>
                        {afastamento.descricao && (
                          <small>{afastamento.descricao}</small>
                        )}
                      </td>
                      <td>
                        {formatPeriodo(afastamento.dataInicio, afastamento.dataFim)}
                      </td>
                      <td>
                        <span className="badge">
                          {STATUS_LABEL[afastamento.status]}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p style={{ marginTop: '16px', color: '#64748b', fontSize: '0.9rem' }}>
              Deseja cadastrar o afastamento mesmo assim?
            </p>
            <div className="modal-actions">
              <button
                type="button"
                className="secondary"
                onClick={handleCancelarConflito}
                disabled={submitting}
              >
                Não
              </button>
              <button
                type="button"
                className="primary"
                onClick={handleConfirmarConflito}
                disabled={submitting}
              >
                {submitting ? 'Salvando...' : 'Sim'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal de Validação de Dias (Férias/Abono) */}
      {validacaoDiasModal.open && (
        <div className="modal-backdrop">
          <div className="modal" style={{ maxWidth: '500px' }}>
            <h3>
              {validacaoDiasModal.tipo === 'ferias' ? 'Validação de Férias' : 'Validação de Abono'}
            </h3>
            {validacaoDiasModal.ultrapassa ? (
              <>
                <div className="feedback error" style={{ marginBottom: '16px' }}>
                  <strong>Período inválido!</strong>
                  <p style={{ margin: '8px 0 0', fontSize: '0.9rem' }}>
                    O período informado de <strong>{validacaoDiasModal.diasSolicitados} dias</strong> ultrapassa o limite de{' '}
                    <strong>{validacaoDiasModal.tipo === 'ferias' ? '30 dias' : '5 dias'}</strong> por ano.
                  </p>
                </div>
                <p style={{ marginBottom: '16px', color: '#475569' }}>
                  <strong>{validacaoDiasModal.colaboradorNome}</strong> já usufruiu{' '}
                  <strong>{validacaoDiasModal.diasUsados} dias</strong> de{' '}
                  {validacaoDiasModal.tipo === 'ferias' ? 'férias' : 'abono'} no ano, restando apenas{' '}
                  <strong>{validacaoDiasModal.diasRestantes} dias</strong>.
                </p>
              </>
            ) : (
              <p style={{ marginBottom: '16px', color: '#475569' }}>
                <strong>{validacaoDiasModal.colaboradorNome}</strong> já usufruiu{' '}
                <strong>{validacaoDiasModal.diasUsados} dias</strong> de{' '}
                {validacaoDiasModal.tipo === 'ferias' ? 'férias' : 'abono'} no ano, restando apenas{' '}
                <strong>{validacaoDiasModal.diasRestantes} dias</strong>.
              </p>
            )}
            <p style={{ marginBottom: '16px', color: '#64748b', fontSize: '0.9rem' }}>
              Período solicitado: <strong>{validacaoDiasModal.diasSolicitados} dias</strong>
            </p>
            {!validacaoDiasModal.ultrapassa && (
              <p style={{ marginBottom: '16px', color: '#166534', fontSize: '0.9rem' }}>
                Após este cadastro, restarão{' '}
                <strong>{validacaoDiasModal.diasRestantes - validacaoDiasModal.diasSolicitados} dias</strong>.
              </p>
            )}
            <div className="modal-actions">
              <button
                type="button"
                className="secondary"
                onClick={handleCancelarValidacaoDias}
                disabled={submitting}
              >
                {validacaoDiasModal.ultrapassa ? 'Fechar' : 'Cancelar'}
              </button>
              {!validacaoDiasModal.ultrapassa && (
                <button
                  type="button"
                  className="primary"
                  onClick={handleConfirmarValidacaoDias}
                  disabled={submitting}
                >
                  {submitting ? 'Salvando...' : 'Confirmar e continuar'}
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </section>
  );
}

function DashboardSection({ currentUser }: { currentUser: Usuario }) {
  const [afastamentos, setAfastamentos] = useState<Afastamento[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [motivoFiltro, setMotivoFiltro] = useState<string>('');
  const [selectedMonth, setSelectedMonth] = useState<string>(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  });

  const carregarAfastamentos = useCallback(async () => {
    try {
      setLoading(true);
      const data = await api.listAfastamentos();
      const equipeAtual = currentUser.equipe;
      
      // Filtrar afastamentos apenas da equipe do usuário logado
      const filtrados = equipeAtual
        ? data.filter((afastamento) => {
            const colaboradorEquipe = afastamento.colaborador?.equipe;
            // Incluir apenas se o colaborador tiver equipe e corresponder à equipe do usuário
            return colaboradorEquipe && colaboradorEquipe === equipeAtual;
          })
        : data;
      
      setAfastamentos(filtrados);
      setError(null);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Não foi possível carregar os afastamentos.',
      );
    } finally {
      setLoading(false);
    }
  }, [currentUser.equipe]);

  useEffect(() => {
    void carregarAfastamentos();
  }, [carregarAfastamentos]);

  // Função para verificar se um período de afastamento se sobrepõe com um mês específico
  const periodoSobrepoeMes = useCallback((
    dataInicio: string,
    dataFim: string | null | undefined,
    year: number,
    month: number,
  ): boolean => {
    // Calcular primeiro e último dia do mês
    const primeiroDiaMes = new Date(year, month - 1, 1);
    const ultimoDiaMes = new Date(year, month, 0, 23, 59, 59); // Último dia do mês

    // Normalizar datas
    primeiroDiaMes.setHours(0, 0, 0, 0);
    ultimoDiaMes.setHours(23, 59, 59, 999);

    const inicioAfastamento = new Date(dataInicio);
    inicioAfastamento.setHours(0, 0, 0, 0);

    const fimAfastamento = dataFim ? new Date(dataFim) : null;
    if (fimAfastamento) {
      fimAfastamento.setHours(23, 59, 59, 999);
    }

    // Verificar sobreposição:
    // O período se sobrepõe se:
    // - O início do afastamento está dentro do mês, OU
    // - O fim do afastamento está dentro do mês, OU
    // - O afastamento engloba todo o mês (início antes e fim depois)
    if (fimAfastamento) {
      // Afastamento com data fim: verifica se há sobreposição
      return (
        (inicioAfastamento <= ultimoDiaMes && fimAfastamento >= primeiroDiaMes)
      );
    } else {
      // Afastamento sem data fim: verifica se começa antes ou durante o mês
      return inicioAfastamento <= ultimoDiaMes;
    }
  }, []);

  const afastamentosFiltrados = useMemo(() => {
    const normalizedSearch = searchTerm.trim().toUpperCase();
 
    const [year, month] = selectedMonth.split('-').map(Number);
 
    const filtradoPorMes =
      Number.isNaN(year) || Number.isNaN(month)
        ? afastamentos
        : afastamentos.filter((afastamento) => {
            return periodoSobrepoeMes(
              afastamento.dataInicio,
              afastamento.dataFim,
              year,
              month,
            );
          });

    const filtradoPorMotivo =
      motivoFiltro
        ? filtradoPorMes.filter((afastamento) => afastamento.motivo === motivoFiltro)
        : filtradoPorMes;

    if (!normalizedSearch) {
      return filtradoPorMotivo;
    }

    return filtradoPorMotivo.filter((afastamento) =>
      afastamento.colaborador.nome.includes(normalizedSearch),
    );
  }, [afastamentos, searchTerm, motivoFiltro, selectedMonth, periodoSobrepoeMes]);

  const descricaoPeriodo = useMemo(() => {
    const [year, month] = selectedMonth.split('-').map(Number);

    if (Number.isNaN(year) || Number.isNaN(month) || month < 1 || month > 12) {
      const agora = new Date();
      return new Intl.DateTimeFormat('pt-BR', {
        month: 'long',
        year: 'numeric',
      }).format(agora);
    }

    const dataReferencia = new Date(year, month - 1, 1);

    if (Number.isNaN(dataReferencia.getTime())) {
      const agora = new Date();
      return new Intl.DateTimeFormat('pt-BR', {
        month: 'long',
        year: 'numeric',
      }).format(agora);
    }

    return new Intl.DateTimeFormat('pt-BR', {
      month: 'long',
      year: 'numeric',
    }).format(dataReferencia);
  }, [selectedMonth]);

  return (
    <section>
      <div className="section-header">
        <div>
          <h2>Afastamentos do mês</h2>
          <p className="subtitle">Período: {descricaoPeriodo}</p>
        </div>
      </div>
      <div className="list-controls">
        <input
          className="search-input"
          value={searchTerm}
          onChange={(event) => setSearchTerm(event.target.value.toUpperCase())}
          placeholder="Pesquisar por nome"
        />
        <select
          className="search-input"
          value={motivoFiltro}
          onChange={(event) => setMotivoFiltro(event.target.value)}
        >
          <option value="">Todos os motivos</option>
          {MOTIVO_OPTIONS.map((option) => (
            <option key={option} value={option}>
              {option}
            </option>
          ))}
        </select>
        <input
          type="month"
          className="search-input"
          value={selectedMonth}
          onChange={(event) => setSelectedMonth(event.target.value)}
        />
        <button className="ghost" type="button" onClick={() => void carregarAfastamentos()}>
          Atualizar lista
        </button>
      </div>

      {error && <div className="feedback error">{error}</div>}

      {loading ? (
        <p className="empty-state">Carregando afastamentos...</p>
      ) : afastamentosFiltrados.length === 0 ? (
        <p className="empty-state">Nenhum afastamento encontrado para o período.</p>
      ) : (
        <table className="table">
          <thead>
            <tr>
              <th>Policial</th>
              <th>Motivo</th>
              <th>Período</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {afastamentosFiltrados.map((afastamento) => (
              <tr key={afastamento.id}>
                <td>
                  <div>{afastamento.colaborador.nome}</div>
                  <small>{afastamento.colaborador.matricula}</small>
                </td>
                <td>
                  <div>{afastamento.motivo}</div>
                  {afastamento.descricao && <small>{afastamento.descricao}</small>}
                </td>
                <td>
                  {formatPeriodo(afastamento.dataInicio, afastamento.dataFim)}
                </td>
                <td>
                  <span className="badge">{STATUS_LABEL[afastamento.status]}</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </section>
  );
}

function MostrarEquipeSection({
  currentUser,
  openConfirm,
  onChanged,
  refreshKey,
}: {
  currentUser: Usuario;
  openConfirm: (config: ConfirmConfig) => void;
  onChanged?: () => void;
  refreshKey?: number;
}) {
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
  });
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
 
  useEffect(() => {
    void carregarColaboradores();
  }, [carregarColaboradores, refreshKey]);

  const openEditModal = (colaborador: Colaborador) => {
    setEditingColaborador(colaborador);
    setEditForm({
      nome: colaborador.nome,
      matricula: colaborador.matricula,
      status: colaborador.status,
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
    };

    openConfirm({
      title: 'Confirmar edição',
      message: `Deseja salvar as alterações para ${editingColaborador.nome}?`,
      confirmLabel: 'Salvar',
      onConfirm: async () => {
        try {
          setEditSubmitting(true);
          setEditError(null);
          await api.updateColaborador(editingColaborador.id, payload, currentUser.id);
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
          await api.removeColaborador(colaborador.id, currentUser.id);
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

  const colaboradoresDaEquipe = useMemo(
    () =>
      colaboradores.filter(
        (colaborador) =>
          colaborador.equipe === equipeAtual &&
          colaborador.status !== 'DESATIVADO',
      ),
    [colaboradores, equipeAtual],
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
          Equipe{' '}
          {equipeAtual
            ? `${EQUIPE_FONETICA[equipeAtual]} (${equipeAtual})`
            : '—'}
        </h2>
        <p>Visualize os policiais cadastrados e execute ações rápidas.</p>
      </div>

      {error && <div className="feedback error">{error}</div>}
      {success && <div className="feedback success">{success}</div>}

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

export default function App() {
  const [activeTab, setActiveTab] = useState<TabKey>('dashboard');
  const [currentUser, setCurrentUser] = useState<Usuario | null>(null);
  const [authView, setAuthView] = useState<AuthView>('login');
  const [resetToken, setResetToken] = useState<string | null>(null);
  const [securityQuestionData, setSecurityQuestionData] = useState<{
    matricula: string;
    pergunta: string;
  } | null>(null);
  const [confirmDialog, setConfirmDialog] = useState<ConfirmDialogConfig>({
    open: false,
    title: '',
    message: '',
  });
  const [colaboradoresVersion, setColaboradoresVersion] = useState(0);

  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        setCurrentUser(JSON.parse(stored) as Usuario);
      }
    } catch (error) {
      console.warn('Não foi possível restaurar o usuário da sessão.', error);
    }

    // Verificar se há token na URL (reset de senha)
    const urlParams = new URLSearchParams(window.location.search);
    const token = urlParams.get('token');
    if (token) {
      setResetToken(token);
      setAuthView('reset-password');
      // Limpar a URL
      window.history.replaceState({}, '', window.location.pathname);
    }
  }, []);

  const handleLoginSuccess = (usuario: Usuario) => {
    setCurrentUser(usuario);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(usuario));
  };

  const handleLogout = () => {
    setCurrentUser(null);
    localStorage.removeItem(STORAGE_KEY);
  };

  const openConfirm = useCallback((config: ConfirmConfig) => {
    setConfirmDialog({
      open: true,
      confirmLabel: 'Confirmar',
      cancelLabel: 'Cancelar',
      ...config,
    });
  }, []);
 
  const notifyColaboradoresChanged = useCallback(() => {
    setColaboradoresVersion((value) => value + 1);
  }, []);

  const closeConfirm = useCallback(() => {
    setConfirmDialog((prev) => ({
      ...prev,
      open: false,
    }));
  }, []);

  const handleConfirmDialog = useCallback(async () => {
    try {
      if (confirmDialog.onConfirm) {
        await confirmDialog.onConfirm();
      }
    } finally {
      closeConfirm();
    }
  }, [confirmDialog, closeConfirm]);

  if (!currentUser) {
    const handleForgotPassword = () => {
      setAuthView('forgot-password');
    };

    const handleBackToLogin = () => {
      setAuthView('login');
      setResetToken(null);
      setSecurityQuestionData(null);
    };

    const handleSecurityQuestionReceived = (matricula: string, pergunta: string) => {
      setSecurityQuestionData({ matricula, pergunta });
      setAuthView('security-question');
    };

    const handleResetSuccess = () => {
      setAuthView('login');
      setResetToken(null);
    };

    return (
      <div className="app-container">
        <header>
          <h1>Sistema de Afastamentos</h1>
          <p>
            {authView === 'login' && 'Informe sua matrícula e senha para acessar o painel.'}
            {authView === 'forgot-password' && 'Recupere sua senha informando sua matrícula.'}
            {authView === 'reset-password' && 'Defina uma nova senha para sua conta.'}
          </p>
        </header>
        {authView === 'login' && (
          <LoginView onSuccess={handleLoginSuccess} onForgotPassword={handleForgotPassword} />
        )}
        {authView === 'forgot-password' && (
          <ForgotPasswordView
            onBack={handleBackToLogin}
            onSecurityQuestionReceived={handleSecurityQuestionReceived}
          />
        )}
        {authView === 'security-question' && securityQuestionData && (
          <SecurityQuestionView
            matricula={securityQuestionData.matricula}
            pergunta={securityQuestionData.pergunta}
            onBack={handleBackToLogin}
            onSuccess={handleResetSuccess}
          />
        )}
        {authView === 'reset-password' && (
          <ResetPasswordView
            token={resetToken || undefined}
            onBack={handleBackToLogin}
            onSuccess={handleResetSuccess}
          />
        )}
      </div>
    );
  }

  return (
    <div className="app-container">
      <header>
        <div>
          <h1>
            {`Sistema de Afastamentos${
              currentUser.equipe ? ` - Equipe ${currentUser.equipe}` : ''
            }`}
          </h1>
          <p>Gerencie usuários, colaboradores e afastamentos da equipe.</p>
        </div>
        <div className="header-actions">
          <span>
            {currentUser.nome} — {currentUser.matricula}
          </span>
          <button
            type="button"
            className="logout-button"
            onClick={handleLogout}
          >
            Sair
          </button>
        </div>
      </header>

      <ul className="tabs" role="tablist">
        {TABS.map((tab) => (
          <li key={tab.key} role="presentation">
            <button
              role="tab"
              aria-selected={activeTab === tab.key}
              type="button"
              className={activeTab === tab.key ? 'tab active' : 'tab'}
              onClick={() => setActiveTab(tab.key)}
            >
              {tab.label}
            </button>
          </li>
        ))}
      </ul>

      {activeTab === 'dashboard' && <DashboardSection currentUser={currentUser} />}
      {activeTab === 'afastamentos' && (
        <AfastamentosSection
          currentUser={currentUser}
          openConfirm={openConfirm}
        />
      )}
      {activeTab === 'colaboradores' && (
         <ColaboradoresSection
           currentUser={currentUser}
           onChanged={notifyColaboradoresChanged}
         />
       )}
       {activeTab === 'equipe' && (
         <MostrarEquipeSection
           currentUser={currentUser}
           openConfirm={openConfirm}
           onChanged={notifyColaboradoresChanged}
           refreshKey={colaboradoresVersion}
         />
       )}
      {activeTab === 'usuarios' && (
        <UsuariosSection currentUser={currentUser} openConfirm={openConfirm} />
      )}

      <ConfirmDialog
        config={confirmDialog}
        onCancel={closeConfirm}
        onConfirm={handleConfirmDialog}
      />
    </div>
  );
}
