import { useState } from 'react';
import { api } from '../../api';
import { PasswordInput } from '../common/PasswordInput';

interface ResetPasswordViewProps {
  token?: string;
  onBack: () => void;
  onSuccess: () => void;
}

export function ResetPasswordView({
  token: initialToken,
  onBack,
  onSuccess,
}: ResetPasswordViewProps) {
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
          <PasswordInput
            value={novaSenha}
            onChange={setNovaSenha}
            placeholder="Mínimo de 6 caracteres"
            autoComplete="new-password"
            required
            minLength={6}
          />
        </label>
        <label>
          Confirmar senha
          <PasswordInput
            value={confirmarSenha}
            onChange={setConfirmarSenha}
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
