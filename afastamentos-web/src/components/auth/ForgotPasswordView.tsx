import { useState } from 'react';
import { api } from '../../api';

interface ForgotPasswordViewProps {
  onBack: () => void;
  onSecurityQuestionReceived: (matricula: string, pergunta: string) => void;
}

export function ForgotPasswordView({
  onBack,
  onSecurityQuestionReceived,
}: ForgotPasswordViewProps) {
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

      {perguntaSeguranca && (
        <div
          className="feedback"
          style={{
            backgroundColor: 'var(--alert-info-bg)',
            borderColor: 'var(--accent-muted)',
            color: 'var(--alert-info-text)',
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
