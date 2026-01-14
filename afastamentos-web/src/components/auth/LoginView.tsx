import { useState } from 'react';
import { api } from '../../api';
import type { LoginInput, Usuario } from '../../types';
import { PasswordInput } from '../common/PasswordInput';

interface LoginViewProps {
  onSuccess: (loginResponse: { accessToken: string; usuario: Usuario }) => void;
  onForgotPassword: () => void;
}

export function LoginView({ onSuccess, onForgotPassword }: LoginViewProps) {
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
      const loginResponse = await api.login({
        matricula: form.matricula.trim(),
        senha: form.senha,
      });
      onSuccess(loginResponse);
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
          <PasswordInput
            value={form.senha}
            onChange={(value) => handleChange('senha', value)}
            placeholder="Digite a senha"
            autoComplete="current-password"
            required
          />
        </label>
        <button className="primary" type="submit" disabled={loading}>
          {loading ? 'Logando...' : 'Entrar'}
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
