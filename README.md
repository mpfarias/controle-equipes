# 🚀 Sistema de Controle de Afastamentos

Sistema completo para gerenciamento de afastamentos de equipes policiais.

## 🚀 Início Rápido

### Pré-requisitos

- [Node.js](https://nodejs.org/) versão 20 ou superior
- [Docker Desktop](https://www.docker.com/products/docker-desktop/) instalado e rodando

### Passo 1: Setup Automático

Execute o script de setup que vai configurar tudo automaticamente:

```bash
npm install
npm run setup
```

Este comando vai:
- ✅ Verificar se o Docker está instalado
- ✅ Iniciar o banco de dados MySQL em Docker
- ✅ Criar o arquivo `.env` automaticamente
- ✅ Instalar todas as dependências (API e Frontend)
- ✅ Configurar o banco de dados (Prisma migrations)
- ✅ Criar o usuário inicial automaticamente

### Passo 2: Iniciar o Projeto

Após o setup, você precisa iniciar a API e o Frontend em terminais separados:

**Terminal 1 - API:**
```bash
npm run start:api
```
ou
```bash
cd afastamentos-api && npm run start:dev
```

**Terminal 2 - Frontend:**
```bash
npm run start:web
```
ou
```bash
cd afastamentos-web && npm run dev
```

### Passo 3: Acessar o Sistema

- **Frontend:** http://localhost:5173
- **API:** http://localhost:3002

### Login Inicial

Ao iniciar pela primeira vez, o sistema cria automaticamente um usuário:

- **Matrícula:** `ADMIN`
- **Senha:** `admin123`

⚠️ **IMPORTANTE:** Altere a senha após o primeiro login!

---

## 📋 Scripts Disponíveis

Na raiz do projeto:

- `npm run setup` - Configura tudo automaticamente (primeira vez)
- `npm run db:up` - Inicia o banco de dados Docker
- `npm run db:down` - Para o banco de dados Docker
- `npm run db:logs` - Ver logs do banco de dados
- `npm run start:api` - Inicia a API em modo desenvolvimento
- `npm run start:web` - Inicia o Frontend em modo desenvolvimento
- `npm run install:all` - Instala dependências de API e Frontend
- `npm run setup:db` - Apenas configura o banco (migrations + seed)

Na pasta `afastamentos-api`:

- `npm run db:setup` - Configura banco (generate + migrate + seed)
- `npm run prisma:generate` - Gera o Prisma Client
- `npm run prisma:migrate` - Aplica migrations
- `npm run prisma:seed` - Executa o seed (cria usuário inicial)
- `npm run prisma:studio` - Abre o Prisma Studio (interface gráfica do BD)

---

## 🗄️ Banco de Dados

O projeto usa MySQL 8.0 rodando em Docker. O banco é criado e configurado automaticamente pelo script de setup.

### Configuração

- **Container:** `afastamentos-mysql`
- **Porta:** `3306`
- **Database:** `afastamentos_db`
- **Usuário root:** `root` / `root123`
- **URL de conexão:** `mysql://root:root123@localhost:3306/afastamentos_db`

### Parar/Iniciar o banco

```bash
# Parar
npm run db:down
# ou
docker compose down

# Iniciar
npm run db:up
# ou
docker compose up -d
```

### Acessar o banco manualmente

```bash
docker exec -it afastamentos-mysql mysql -u root -proot123 afastamentos_db
```

---

## 📁 Estrutura do Projeto

```
controle-equipes/
├── afastamentos-api/        # Backend NestJS
│   ├── prisma/             # Schema e migrations do banco
│   ├── src/                # Código fonte da API
│   └── ...
├── afastamentos-web/        # Frontend React + Vite
│   ├── src/                # Código fonte do frontend
│   └── ...
├── docker-compose.yml       # Configuração do MySQL em Docker
├── setup.js                 # Script de setup automático
└── package.json             # Scripts úteis do projeto
```

---

## 🔧 Configuração Manual (sem Docker)

Se preferir instalar o MySQL diretamente no Windows:

1. Instale o [MySQL Community Server](https://dev.mysql.com/downloads/mysql/)
2. Crie o banco de dados:
   ```sql
   CREATE DATABASE afastamentos_db;
   ```
3. Configure o arquivo `.env` na pasta `afastamentos-api`:
   ```
   DATABASE_URL="mysql://seu_usuario:sua_senha@localhost:3306/afastamentos_db"
   ```
4. Execute as migrations:
   ```bash
   cd afastamentos-api
   npm run db:setup
   ```

---

## 🐛 Solução de Problemas

### Erro: "Docker não encontrado"
- Instale o Docker Desktop: https://www.docker.com/products/docker-desktop/
- Certifique-se de que o Docker está rodando (ícone na bandeja do sistema)

### Erro: "Não foi possível conectar ao banco"
- Verifique se o Docker está rodando: `docker ps`
- Inicie o banco manualmente: `npm run db:up`
- Aguarde alguns segundos para o MySQL inicializar completamente

### Erro: "Porta 3306 já está em uso"
- Pare o MySQL local se tiver instalado
- Ou altere a porta no `docker-compose.yml`

### Erro: "Module not found"
- Execute: `npm run install:all`
- Ou manualmente em cada pasta: `cd afastamentos-api && npm install`

### O usuário inicial não foi criado
- O usuário é criado automaticamente na primeira inicialização da API
- Se necessário, execute manualmente: `cd afastamentos-api && npm run prisma:seed`

---

## 📚 Documentação Adicional

- `GUIA_INSTALACAO.md` - Guia detalhado de instalação
- `INICIO_RAPIDO.md` - Guia rápido passo a passo
- `CRIAR_USUARIO_INICIAL.md` - Como criar usuários manualmente

---

## 🛑 Parar o Projeto

1. Pressione `Ctrl+C` nos terminais da API e Frontend
2. Para parar o banco de dados:
   ```bash
   npm run db:down
   ```

---

## 📝 Notas

- O banco de dados persiste os dados mesmo após parar o container Docker
- Os dados são salvos em um volume Docker chamado `mysql_data`
- Para limpar completamente (⚠️ apaga todos os dados):
  ```bash
  docker compose down -v
  ```

---

## 🤝 Desenvolvimento

Para contribuir ou desenvolver:

1. Faça o fork do projeto
2. Crie uma branch para sua feature
3. Faça commit das mudanças
4. Envie um pull request

---

## 📄 Licença

Este projeto é privado e não licenciado.

