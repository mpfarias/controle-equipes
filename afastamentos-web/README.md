# Afastamentos Web

Interface web para o sistema de controle de afastamentos.

## Requisitos

- Node.js 20+
- API de afastamentos em execução (porta padrão 3002)

## Configuração

```bash
npm install
```

Opcionalmente, crie um arquivo `.env.local` com a URL da API:

```bash
VITE_API_URL=http://localhost:3002
```

## Desenvolvimento

```bash
npm run dev
```

Acesse http://localhost:5173.

## Build de Produção

```bash
npm run build
npm run preview
```

## Funcionalidades

- Cadastro e listagem de usuários (hash gerado automaticamente no navegador)
- Cadastro, listagem e exclusão de colaboradores
- Registro e acompanhamento de afastamentos com filtros básicos
