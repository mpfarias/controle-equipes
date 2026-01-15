import { useState } from 'react';
import { api } from '../../api';
import { PasswordInput } from '../common/PasswordInput';

interface SecurityQuestionViewProps {
  matricula?: string;
  pergunta?: string;
  onBack: () => void;
  onSuccess: () => void;
}

export function SecurityQuestionView({
  matricula: initialMatricula,
  pergunta: initialPergunta,
  onBack,
  onSuccess,
}: SecurityQuestionViewProps) {
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
