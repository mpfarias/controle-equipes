# Sistema de Recuperação de Senha

## Implementação Completa

Foi implementado um sistema completo de recuperação de senha usando o serviço **Resend** (gratuito, 3000 emails/mês).

## O que foi implementado

### Backend

1. **Nova tabela no banco de dados**: `PasswordResetToken`
   - Armazena tokens de recuperação de senha
   - Tokens expiram em 1 hora
   - Tokens são marcados como usados após o uso

2. **Novos endpoints**:
   - `POST /auth/forgot-password` - Solicita recuperação de senha
   - `POST /auth/reset-password` - Redefine a senha usando o token

3. **Serviço de Email** (`EmailService`):
   - Envia emails HTML formatados com link de recuperação
   - Suporta modo desenvolvimento (retorna token na resposta quando email não está configurado)

### Frontend

1. **Nova tela "Esqueci minha senha"**:
   - Usuário informa a matrícula
   - Sistema gera token e envia por email (ou mostra em modo desenvolvimento)

2. **Nova tela "Redefinir senha"**:
   - Usuário informa o token recebido
   - Define nova senha
   - Confirma a nova senha

3. **Link na tela de login**: "Esqueci minha senha"

## Configuração

### 1. Instalar dependências

```bash
cd afastamentos-api
npm install
```

### 2. Executar migração do banco de dados

```bash
cd afastamentos-api
npx prisma migrate dev --name add_password_reset_token
```

**Nota**: Se o Prisma pedir para resetar o banco, você pode:
- **Opção A**: Resetar (apaga todos os dados): `npx prisma migrate reset`
- **Opção B**: Criar a tabela manualmente (preserva dados):
  ```sql
  CREATE TABLE PasswordResetToken (
    id INT AUTO_INCREMENT PRIMARY KEY,
    token VARCHAR(255) UNIQUE NOT NULL,
    usuarioId INT NOT NULL,
    expiresAt DATETIME NOT NULL,
    used BOOLEAN DEFAULT FALSE,
    createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (usuarioId) REFERENCES Usuario(id) ON DELETE CASCADE
  );
  ```

### 3. Configurar Email (Resend)

**📖 Para instruções detalhadas, consulte:** [`afastamentos-api/CONFIGURACAO_EMAIL.md`](afastamentos-api/CONFIGURACAO_EMAIL.md)

**Resumo rápido:**

1. Crie uma conta gratuita em https://resend.com
2. Obtenha sua API Key em "API Keys"
3. Configure um domínio (ou use o domínio de teste `@resend.dev`)
4. Adicione as variáveis no arquivo `.env`:

```env
RESEND_API_KEY="re_xxxxxxxxxxxxx"
RESEND_FROM_EMAIL="onboarding@resend.dev"  # ou seu domínio verificado
FRONTEND_URL="http://localhost:5173"  # ou URL de produção
```

**Plano Gratuito do Resend**:
- ✅ 3.000 emails por mês
- ✅ 100 emails por dia
- ✅ Sem necessidade de cartão de crédito

### 4. Modo Desenvolvimento (sem email configurado)

Se você não configurar o `RESEND_API_KEY`, o sistema funcionará em modo desenvolvimento:
- O token será retornado na resposta da API
- O token aparecerá na tela para você copiar e usar
- Útil para testes locais

## Como usar

1. **Usuário esquece a senha**:
   - Clica em "Esqueci minha senha" na tela de login
   - Informa a matrícula
   - Recebe email com link de recuperação (ou token em modo desenvolvimento)

2. **Usuário redefine a senha**:
   - Clica no link do email (ou cola o token manualmente)
   - Informa nova senha
   - Confirma a nova senha
   - Faz login com a nova senha

## Segurança

- Tokens expiram em 1 hora
- Tokens são únicos e podem ser usados apenas uma vez
- Tokens anteriores são invalidados quando um novo é gerado
- Senhas são sempre hasheadas no backend
- Não revela se a matrícula existe ou não (por segurança)

## Arquivos modificados/criados

### Backend
- `prisma/schema.prisma` - Adicionado modelo `PasswordResetToken`
- `src/email/email.service.ts` - Novo serviço de email
- `src/email/email.module.ts` - Novo módulo de email
- `src/auth/auth.service.ts` - Métodos `forgotPassword` e `resetPassword`
- `src/auth/auth.controller.ts` - Novos endpoints
- `src/auth/dto/forgot-password.dto.ts` - Novo DTO
- `src/auth/dto/reset-password.dto.ts` - Novo DTO
- `src/auth/auth.module.ts` - Importa EmailModule
- `package.json` - Adicionado `resend`

### Frontend
- `src/api.ts` - Novos métodos `forgotPassword` e `resetPassword`
- `src/App.tsx` - Novas views `ForgotPasswordView` e `ResetPasswordView`

## Próximos passos (opcional)

1. **Adicionar campo email no modelo Usuario**:
   - Atualmente usa email fictício baseado na matrícula
   - Você pode adicionar um campo `email` opcional no modelo `Usuario`

2. **Personalizar template de email**:
   - Edite o HTML em `src/email/email.service.ts`

3. **Adicionar rate limiting**:
   - Limitar tentativas de recuperação de senha por IP/matrícula

