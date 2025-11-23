# 🚀 Como Iniciar o Projeto

## Primeira Vez (Setup Completo)

### 1. Instalar Docker Desktop

Baixe e instale: https://www.docker.com/products/docker-desktop/

Certifique-se de que o Docker está rodando (ícone na bandeja do sistema).

### 2. Executar o Setup Automático

Na raiz do projeto, execute:

```bash
npm install
npm run setup
```

Este comando vai fazer tudo automaticamente:
- ✅ Iniciar o banco de dados MySQL no Docker
- ✅ Criar o arquivo `.env` automaticamente
- ✅ Instalar todas as dependências (API e Frontend)
- ✅ Configurar o banco de dados (migrations)
- ✅ Criar o usuário inicial automaticamente

### 3. Iniciar o Projeto

Agora você precisa iniciar a API e o Frontend em terminais separados:

**Terminal 1 - API:**
```bash
npm run start:api
```

**Terminal 2 - Frontend:**
```bash
npm run start:web
```

### 4. Acessar

- **Frontend:** http://localhost:5173
- **API:** http://localhost:3002

### 5. Login

Use as credenciais criadas automaticamente:

- **Matrícula:** `ADMIN`
- **Senha:** `admin123`

⚠️ **IMPORTANTE:** Altere a senha após o primeiro login!

---

## Próximas Vezes (Projeto Já Configurado)

Se você já rodou o setup uma vez:

### 1. Iniciar o Banco de Dados

```bash
npm run db:up
```

### 2. Iniciar a API e Frontend

**Terminal 1 - API:**
```bash
npm run start:api
```

**Terminal 2 - Frontend:**
```bash
npm run start:web
```

Pronto! O sistema já cria o usuário inicial automaticamente na primeira inicialização da API.

---

## Scripts Úteis

### Banco de Dados

```bash
npm run db:up        # Inicia o banco de dados
npm run db:down      # Para o banco de dados
npm run db:logs      # Ver logs do banco
npm run db:setup     # Apenas configura o banco (migrations + seed)
```

### Aplicação

```bash
npm run start:api    # Inicia a API
npm run start:web    # Inicia o Frontend
npm run install:all  # Instala dependências de tudo
```

### Prisma (na pasta afastamentos-api)

```bash
cd afastamentos-api
npm run prisma:studio    # Interface gráfica do banco
npm run prisma:migrate   # Aplica migrations
npm run prisma:seed      # Cria usuário inicial manualmente
```

---

## Problemas Comuns

### "Docker não encontrado"
- Instale o Docker Desktop primeiro
- Certifique-se de que está rodando

### "Não foi possível conectar ao banco"
- Verifique se o Docker está rodando: `docker ps`
- Inicie o banco: `npm run db:up`
- Aguarde alguns segundos para o MySQL inicializar

### "Usuário inicial não criado"
- O usuário é criado automaticamente quando a API inicia pela primeira vez
- Se necessário, execute: `cd afastamentos-api && npm run prisma:seed`

### "Porta já em uso"
- Pare outros serviços nas portas 3002 ou 3306
- Ou altere as portas nos arquivos de configuração

---

## Parar o Projeto

1. Pressione `Ctrl+C` nos terminais da API e Frontend
2. (Opcional) Para o banco de dados:
   ```bash
   npm run db:down
   ```

---

## Recriar Tudo do Zero

Se quiser limpar tudo e começar do zero:

```bash
# Parar e remover containers e volumes
docker compose down -v

# Executar setup novamente
npm run setup
```

⚠️ **ATENÇÃO:** Isso apaga todos os dados do banco!

---

## Ajuda Adicional

- `README.md` - Documentação completa
- `GUIA_INSTALACAO.md` - Guia detalhado de instalação
- `INICIO_RAPIDO.md` - Guia rápido passo a passo

