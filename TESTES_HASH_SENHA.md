# Testes - Correção Hash de Senha no Backend

## ✅ Verificações Estáticas Realizadas

- [x] Sem erros de lint no código
- [x] Removido `bcryptjs` do frontend
- [x] DTO atualizado para receber `senha` em texto
- [x] Service fazendo hash no backend
- [x] Frontend enviando `senha` em texto
- [x] Tipos TypeScript atualizados

## 🧪 Testes Manuais Recomendados

### 1. Teste de Criação de Usuário

**Passos:**
1. Acesse a tela "Cadastrar usuários"
2. Preencha o formulário:
   - Nome: "TESTE USUARIO"
   - Matrícula: "12345X"
   - Equipe: "A"
   - Senha: "senha123"
   - Confirmar senha: "senha123"
3. Clique em "Cadastrar usuário"

**Resultado Esperado:**
- ✅ Usuário criado com sucesso
- ✅ Mensagem de sucesso exibida
- ✅ Usuário aparece na lista
- ✅ Senha salva como hash no banco (verificar no banco de dados)

**Verificação no Banco:**
```sql
SELECT id, nome, matricula, senhaHash FROM Usuario WHERE matricula = '12345X';
-- senhaHash deve ser um hash bcrypt (começa com $2a$ ou $2b$)
```

### 2. Teste de Login com Usuário Criado

**Passos:**
1. Faça logout (se estiver logado)
2. Tente fazer login com:
   - Matrícula: "12345X"
   - Senha: "senha123"

**Resultado Esperado:**
- ✅ Login bem-sucedido
- ✅ Redirecionamento para o dashboard
- ✅ Dados do usuário carregados corretamente

### 3. Teste de Edição de Usuário (Alterar Senha)

**Passos:**
1. Acesse "Cadastrar usuários"
2. Clique em "Editar" em um usuário existente
3. Preencha:
   - Nova senha: "novaSenha456"
   - Confirmar nova senha: "novaSenha456"
4. Clique em "Salvar alterações"

**Resultado Esperado:**
- ✅ Usuário atualizado com sucesso
- ✅ Nova senha salva como hash no banco
- ✅ Login com nova senha funciona
- ✅ Login com senha antiga não funciona

### 4. Teste de Validação de Senha (Frontend)

**Passos:**
1. Tente criar usuário com senha curta:
   - Senha: "12345" (menos de 6 caracteres)

**Resultado Esperado:**
- ✅ Erro: "A senha deve ter pelo menos 6 caracteres."
- ✅ Formulário não submete

### 5. Teste de Validação de Senha (Backend)

**Passos:**
1. Use uma ferramenta como Postman ou curl para fazer requisição direta à API:
```bash
POST http://localhost:3002/usuarios
Content-Type: application/json

{
  "nome": "TESTE API",
  "matricula": "99999X",
  "senha": "123",  // Senha muito curta
  "equipe": "A",
  "responsavelId": 1
}
```

**Resultado Esperado:**
- ✅ Status 400 (Bad Request)
- ✅ Mensagem de erro sobre tamanho mínimo da senha

### 6. Teste de Confirmação de Senha

**Passos:**
1. Tente criar usuário com senhas diferentes:
   - Senha: "senha123"
   - Confirmar senha: "senha456"

**Resultado Esperado:**
- ✅ Erro: "As senhas informadas não conferem."
- ✅ Formulário não submete

### 7. Teste de Segurança (Verificar Hash no Banco)

**Passos:**
1. Crie um usuário com senha conhecida
2. Verifique no banco de dados se a senha está hasheada

**Resultado Esperado:**
- ✅ Campo `senhaHash` contém hash bcrypt
- ✅ Hash não é igual à senha original
- ✅ Hash começa com `$2a$` ou `$2b$` (formato bcrypt)

### 8. Teste de Login com Senha Incorreta

**Passos:**
1. Tente fazer login com senha errada:
   - Matrícula: "12345X"
   - Senha: "senhaErrada"

**Resultado Esperado:**
- ✅ Erro: "Credenciais inválidas."
- ✅ Não faz login

## 🔍 Verificações Adicionais

### No Backend (API)

1. **Verificar se bcrypt está instalado:**
   ```bash
   cd afastamentos-api
   npm list bcryptjs
   ```

2. **Verificar logs do servidor:**
   - Ao criar usuário, não deve haver erros
   - Hash deve ser gerado sem problemas

### No Frontend (Web)

1. **Verificar se bcryptjs foi removido:**
   ```bash
   cd afastamentos-web
   npm list bcryptjs
   # Deve retornar erro (não encontrado)
   ```

2. **Verificar no DevTools (Network):**
   - Requisição POST `/usuarios` deve enviar `senha` (não `senhaHash`)
   - Payload não deve conter hash

## ⚠️ Problemas Conhecidos a Verificar

1. **Se o login parar de funcionar:**
   - Verificar se usuários antigos têm senhaHash válido
   - Pode ser necessário resetar senhas de usuários existentes

2. **Se criação de usuário falhar:**
   - Verificar se o backend está rodando
   - Verificar logs do servidor para erros
   - Verificar se bcryptjs está instalado no backend

3. **Se validação não funcionar:**
   - Verificar se ValidationPipe está configurado no main.ts
   - Verificar mensagens de erro do backend

## 📝 Checklist de Testes

- [ ] Criar novo usuário funciona
- [ ] Login com novo usuário funciona
- [ ] Editar senha de usuário funciona
- [ ] Login com senha editada funciona
- [ ] Validação de senha curta funciona (frontend)
- [ ] Validação de senha curta funciona (backend)
- [ ] Confirmação de senha funciona
- [ ] Senha está hasheada no banco
- [ ] Login com senha incorreta falha
- [ ] bcryptjs removido do frontend
- [ ] bcryptjs presente no backend

## 🎯 Resultado Esperado Final

Após todos os testes:
- ✅ Senhas são hasheadas no backend
- ✅ Frontend não faz hash de senhas
- ✅ Segurança melhorada
- ✅ Funcionalidade mantida

