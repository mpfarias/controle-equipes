# 🚀 Guia de Instalação - Sistema de Controle de Afastamentos

Este guia vai te ajudar a configurar e rodar o projeto no seu PC, incluindo o banco de dados MySQL.

## 📋 Pré-requisitos

Antes de começar, você precisa ter instalado:
- [Node.js](https://nodejs.org/) versão 20 ou superior
- [Git](https://git-scm.com/) (para clonar o repositório, se necessário)

## 🗄️ Opção 1: Usar Docker (RECOMENDADO - Mais Fácil)

### Passo 1: Instalar Docker Desktop

1. Baixe o [Docker Desktop para Windows](https://www.docker.com/products/docker-desktop/)
2. Instale e inicie o Docker Desktop
3. Aguarde até que o Docker esteja rodando (ícone na bandeja do sistema)

### Passo 2: Criar arquivo docker-compose.yml

Crie um arquivo `docker-compose.yml` na raiz do projeto (mesmo nível das pastas `afastamentos-api` e `afastamentos-web`):

```yaml
version: '3.8'

services:
  mysql:
    image: mysql:8.0
    container_name: afastamentos-mysql
    restart: always
    environment:
      MYSQL_ROOT_PASSWORD: root123
      MYSQL_DATABASE: afastamentos_db
      MYSQL_USER: afastamentos_user
      MYSQL_PASSWORD: afastamentos_pass
    ports:
      - "3306:3306"
    volumes:
      - mysql_data:/var/lib/mysql

volumes:
  mysql_data:
```

### Passo 3: Iniciar o banco de dados

Abra o terminal na raiz do projeto e execute:

```bash
docker-compose up -d
```

Isso vai:
- Baixar a imagem do MySQL 8.0
- Criar e iniciar o container
- Criar o banco de dados `afastamentos_db`
- Deixar o MySQL rodando na porta 3306

**URL de conexão:** `mysql://root:root123@localhost:3306/afastamentos_db`

---

## 🗄️ Opção 2: Instalar MySQL no Windows

### Passo 1: Instalar MySQL

1. Baixe o [MySQL Installer para Windows](https://dev.mysql.com/downloads/installer/)
2. Escolha a opção "MySQL Installer - Full"
3. Durante a instalação:
   - Escolha "Developer Default"
   - Configure uma senha para o usuário `root` (anote essa senha!)
   - Aceite as configurações padrão

### Passo 2: Verificar instalação

Abra o terminal e teste:

```bash
mysql --version
```

### Passo 3: Criar o banco de dados

Abra o MySQL Command Line Client ou execute:

```bash
mysql -u root -p
```

Digite sua senha do root e execute:

```sql
CREATE DATABASE afastamentos_db CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE USER 'afastamentos_user'@'localhost' IDENTIFIED BY 'afastamentos_pass';
GRANT ALL PRIVILEGES ON afastamentos_db.* TO 'afastamentos_user'@'localhost';
FLUSH PRIVILEGES;
EXIT;
```

**URL de conexão:** `mysql://afastamentos_user:afastamentos_pass@localhost:3306/afastamentos_db`

---

## ⚙️ Configuração do Projeto

### Passo 1: Configurar variáveis de ambiente da API

1. Vá para a pasta `afastamentos-api`
2. Crie um arquivo `.env` baseado no `.env.example`:

```bash
cd afastamentos-api
copy .env.example .env
```

3. Edite o arquivo `.env` e ajuste a `DATABASE_URL` conforme sua configuração:

**Se usou Docker:**
```
DATABASE_URL="mysql://root:root123@localhost:3306/afastamentos_db"
```

**Se instalou MySQL:**
```
DATABASE_URL="mysql://afastamentos_user:afastamentos_pass@localhost:3306/afastamentos_db"
```

### Passo 2: Instalar dependências da API

```bash
cd afastamentos-api
npm install
```

### Passo 3: Configurar o Prisma e rodar migrations

```bash
# Gerar o cliente Prisma
npx prisma generate

# Rodar as migrations para criar as tabelas
npx prisma migrate deploy
```

Se der erro na última linha, tente:
```bash
npx prisma migrate dev
```

### Passo 4: Instalar dependências do Frontend

```bash
cd ../afastamentos-web
npm install
```

### Passo 5: Configurar variáveis de ambiente do Frontend (Opcional)

Crie um arquivo `.env.local` na pasta `afastamentos-web`:

```
VITE_API_URL=http://localhost:3002
```

---

## 🚀 Executando o Projeto

### Terminal 1: Iniciar a API

```bash
cd afastamentos-api
npm run start:dev
```

A API estará rodando em: `http://localhost:3002`

### Terminal 2: Iniciar o Frontend

```bash
cd afastamentos-web
npm run dev
```

O frontend estará rodando em: `http://localhost:5173`

---

## ✅ Verificação

1. **Verificar se o MySQL está rodando:**
   - Docker: `docker ps` (deve mostrar o container `afastamentos-mysql`)
   - MySQL instalado: O serviço deve estar rodando nos serviços do Windows

2. **Verificar se a API está funcionando:**
   - Acesse: `http://localhost:3002/health`
   - Deve retornar um JSON com status

3. **Verificar se o Frontend está funcionando:**
   - Acesse: `http://localhost:5173`
   - Deve abrir a tela de login

---

## 👤 Criar primeiro usuário

Como não há usuários no banco ainda, você precisará criar um manualmente ou criar um script. 

**Opção 1: Usar o Prisma Studio (Interface gráfica)**

```bash
cd afastamentos-api
npx prisma studio
```

Isso abrirá uma interface web onde você pode:
1. Ir na tabela `Usuario`
2. Adicionar um novo registro
3. Preencher os campos necessários
4. **IMPORTANTE:** Para o campo `senhaHash`, você precisa gerar o hash da senha

**Opção 2: Criar um script de seed (recomendado)**

Veja a seção abaixo sobre criar usuário inicial.

---

## 🔧 Solução de Problemas

### Erro de conexão com o banco
- Verifique se o MySQL está rodando
- Confira se a `DATABASE_URL` no `.env` está correta
- Teste a conexão: `mysql -u root -p` (ou o usuário que você configurou)

### Erro "Module not found"
- Execute `npm install` novamente nas pastas corretas
- Limpe o cache: `npm cache clean --force`

### Porta já em uso
- Se a porta 3002 estiver ocupada, altere no `main.ts` da API
- Se a porta 3306 (MySQL) estiver ocupada, pare o MySQL existente ou mude a porta no docker-compose.yml

### Erro nas migrations
- Tente: `npx prisma migrate reset` (CUIDADO: isso apaga todos os dados!)
- Ou: `npx prisma db push` (cria/atualiza o schema sem migrations)

---

## 🛑 Parar os serviços

**Se usou Docker:**
```bash
docker-compose down
```

**Se instalou MySQL:**
- Pare o serviço MySQL pelos Serviços do Windows

---

## 📝 Próximos passos

Após configurar tudo, você precisará criar seu primeiro usuário para fazer login. Veja o próximo arquivo `CRIAR_USUARIO_INICIAL.md` para instruções.

