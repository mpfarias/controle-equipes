# ⚡ Início Rápido

Guia rápido para rodar o projeto pela primeira vez.

## 📦 Passo 1: Instalar Docker Desktop

1. Baixe: https://www.docker.com/products/docker-desktop/
2. Instale e inicie o Docker Desktop
3. Aguarde até que o Docker esteja rodando (ícone verde na bandeja)

## 🗄️ Passo 2: Iniciar o Banco de Dados

Na raiz do projeto, execute:

```bash
docker-compose up -d
```

Isso vai criar e iniciar o MySQL em um container Docker.

**Verificar se está rodando:**
```bash
docker ps
```

Deve mostrar o container `afastamentos-mysql`.

## ⚙️ Passo 3: Configurar a API

### 3.1 Criar arquivo .env

Na pasta `afastamentos-api`, crie um arquivo `.env` com:

```
DATABASE_URL="mysql://root:root123@localhost:3306/afastamentos_db"
```

### 3.2 Instalar dependências

```bash
cd afastamentos-api
npm install
```

### 3.3 Configurar Prisma

```bash
npx prisma generate
npx prisma migrate deploy
```

Se der erro na última linha, tente:
```bash
npx prisma migrate dev
```

## 🖥️ Passo 4: Instalar e Configurar o Frontend

```bash
cd ../afastamentos-web
npm install
```

(Opcional) Crie um arquivo `.env.local` com:
```
VITE_API_URL=http://localhost:3002
```

## 👤 Passo 5: Criar Primeiro Usuário

```bash
cd ../afastamentos-api

# Com valores padrão (admin/admin123)
node create-user.js

# Ou personalizado
node create-user.js "SEU NOME" "sua_matricula" "sua_senha" "A"
```

## 🚀 Passo 6: Rodar o Projeto

### Terminal 1 - API:
```bash
cd afastamentos-api
npm run start:dev
```

Aguarde ver: `🚀 API disponível em: http://localhost:3002`

### Terminal 2 - Frontend:
```bash
cd afastamentos-web
npm run dev
```

Aguarde ver: `Local: http://localhost:5173`

## ✅ Pronto!

1. Acesse: http://localhost:5173
2. Faça login com:
   - Matrícula: `admin` (ou a que você criou)
   - Senha: `admin123` (ou a que você definiu)

---

## 🆘 Problemas?

### Erro de conexão com o banco
```bash
# Verificar se o MySQL está rodando
docker ps

# Se não estiver, iniciar
docker-compose up -d
```

### Porta já em uso
- Pare outros serviços usando as portas 3002 ou 3306
- Ou altere as portas nos arquivos de configuração

### Erro "Module not found"
```bash
# Reinstalar dependências
rm -rf node_modules package-lock.json
npm install
```

---

📚 Para mais detalhes, veja o arquivo `GUIA_INSTALACAO.md`

