## Guia de Deploy (Produção)

Este guia cobre os ajustes operacionais necessários para colocar o sistema em produção.

### 1) Variáveis de ambiente

Configure as variáveis abaixo no ambiente de produção (API):

- `NODE_ENV=production`
- `DATABASE_URL=postgresql://USER:PASSWORD@HOST:5432/DBNAME`
- `JWT_SECRET=...`
- `ADMIN_MATRICULA=...`
- `ADMIN_SENHA=...`
- `FRONTEND_URL=https://seu-frontend.exemplo`
- `API_URL=https://sua-api.exemplo`

Observações:
- `JWT_SECRET`, `ADMIN_MATRICULA` e `ADMIN_SENHA` são obrigatórias em produção.
- `FRONTEND_URL` e `API_URL` são usadas para CORS e CSP.

### 2) Banco de dados

Suba o PostgreSQL (ex.: Docker):

```bash
docker compose up -d
```

### 3) Migrations e seed

Na pasta `afastamentos-api`:

```bash
npm install
npm run prisma:generate
npm run prisma:migrate
# opcional, se precisar dados iniciais:
npm run prisma:seed
```

### 4) Build e execução da API

```bash
cd afastamentos-api
npm run build
npm run start:prod
```

### 5) Build e publicação do frontend

```bash
cd afastamentos-web
npm install
npm run build
```

Os arquivos de produção ficam em `afastamentos-web/dist`.
Publique esse diretório no seu servidor web.

### 6) Reverse proxy e HTTPS

Configure um reverse proxy (ex.: Nginx/Apache) com TLS:

- Frontend: `https://seu-frontend.exemplo`
- API: `https://sua-api.exemplo`

Habilite redirecionamento HTTP -> HTTPS e HSTS.

### 7) Checklist final

- Teste login, criação/edição de usuários, policiais e afastamentos.
- Verifique acesso por níveis (ADMIN/SAD/COMANDO/OPERAÇÕES).
- Confirme backups e monitoramento de logs.

