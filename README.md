# Sistema Órion — Ecossistema COPOM

Plataforma integrada de apoio operacional e administrativo ao COPOM: **um backend (API)**, **PostgreSQL** e **várias aplicações web (SPAs)** que compartilham autenticação e perfil de usuário. O repositório `controle-equipes` concentra o código desses projetos.

---

## Sumário

1. [Visão geral](#1-visão-geral)
2. [Ecossistema — sistemas individuais](#2-ecossistema--sistemas-individuais)
3. [Arquitetura lógica](#3-arquitetura-lógica)
4. [Backend único (`afastamentos-api`)](#4-backend-único-afastamentos-api)
5. [Autenticação, sessão e navegação entre apps](#5-autenticação-sessão-e-navegação-entre-apps)
6. [Autorização: níveis, telas e sistemas permitidos](#6-autorização-níveis-telas-e-sistemas-permitidos)
7. [Modelagem de dados (Prisma / PostgreSQL)](#7-modelagem-de-dados-prisma--postgresql)
8. [Fluxos operacionais principais](#8-fluxos-operacionais-principais)
9. [Ambiente de desenvolvimento](#9-ambiente-de-desenvolvimento)
10. [Deploy, segurança e observabilidade](#10-deploy-segurança-e-observabilidade)
11. [Licença](#11-licença)

---

## 1. Visão geral

O **Órion** organiza informações de pessoal (policiais), afastamentos, férias, escalas, trocas de serviço, restrições, patrimônio, qualidade, chamados de suporte e módulos em expansão (Jurídico, Operações, Agenda, Mulher). O **núcleo operacional** vive no app **Órion SAD** (`afastamentos-web`). Os demais apps são **módulos de domínio** ou **fachadas** que consomem a mesma API e o mesmo cadastro de usuários.

**Stack principal**

| Camada | Tecnologia |
|--------|------------|
| API | NestJS 11 (TypeScript), Passport JWT, Prisma 7 + adapter `pg` |
| Persistência | PostgreSQL 16, Prisma ORM |
| Frontends | React 19 (Vite 7), MUI |
| Infra local (DB) | Docker Compose (`postgres:16-alpine`) |

Documentação interna adicional: `afastamentos-web/REFACTORING.md` (estrutura do SAD).

---

## 2. Ecossistema — sistemas individuais

Cada pasta na raiz do monorepo é um pacote npm independente, exceto o `package.json` raiz que orquestra scripts de desenvolvimento.

| Pasta | Nome de produto | Papel | Porta dev (padrão) |
|-------|-----------------|--------|---------------------|
| `afastamentos-api` | API Órion | **Única API HTTP** do ecossistema: auth, SAD, escalas, suporte, qualidade, patrimônio, placeholders | `3002` (`PORT`) |
| `afastamentos-web` | **Órion SAD** | Afastamentos, efetivo, escalas, relatórios, usuários/níveis | `5173` |
| `orion-suporte-web` | **Órion Suporte** | Chamados (`ErrorReport`): protocolo, status, comentários, fila admin | `5180` |
| `orion-qualidade-web` | **Órion Qualidade** | Registros de qualidade + dashboard de chamadas (XLSX no cliente); API com Integra SSP opcional | `5182` |
| `orion-juridico-web` | **Órion Jurídico** | SPA estrutural; API placeholder | `5183` |
| `orion-patrimonio-web` | **Órion Patrimônio** | Bens patrimoniais (`PatrimonioBem`) | `5184` |
| `orion-mulher-web` | **Órion Mulher** | SPA em evolução; permissão `ORION_MULHER`; sem módulo API dedicado | `5185` |
| `orion-agenda-web` | **Órion Agenda** | Agenda institucional de compromissos | `5186` |
| `orion-operacoes-web` | **Órion Operações** | SPA estrutural (checagem `OPERACOES`); API placeholder | `5187` |

**Identificadores em `Usuario.sistemasPermitidos`** (constante `SISTEMAS_EXTERNOS_IDS` em `afastamentos-api/src/usuarios/constants/sistemas-externos.ts`):

`SAD`, `OPERACOES`, `ORION_QUALIDADE`, `ORION_JURIDICO`, `ORION_PATRIMONIO`, `ORION_MULHER`, `ORION_AGENDA`.

O cadastro aceita IDs legados `PATRIMONIO` / `PATRIMONIO_OPERACOES`, normalizados no serviço para `ORION_PATRIMONIO` (e `OPERACOES` quando aplicável).

O **Órion Suporte** não usa um ID nessa lista: combina `UsuarioNivel.acessoOrionSuporte` e override `Usuario.acessoOrionSuporte` (tri-state).

Jurídico, Agenda e Operações expõem `GET /<modulo>` (meta pública) e `GET /<modulo>/v1/sessao` (autenticada).

---

## 3. Arquitetura lógica

```mermaid
flowchart TB
  subgraph clients [Navegador — SPAs React]
    SAD[Órion SAD]
    SUP[Órion Suporte]
    QUA[Órion Qualidade]
    JUR[Órion Jurídico]
    PAT[Órion Patrimônio]
    MUL[Órion Mulher]
    AGD[Órion Agenda]
    OPE[Órion Operações]
  end

  subgraph api [afastamentos-api — NestJS]
    AUTH[Auth JWT]
    CORE[Policiais / Afastamentos / Escalas / ...]
    ORQ[orion-qualidade]
    ORP[orion-patrimonio]
    ORJ[orion-juridico]
    ORA[orion-agenda]
    ORO[orion-operacoes]
    ERR[error-reports]
  end

  DB[(PostgreSQL)]

  clients -->|HTTPS JSON + Bearer JWT| api
  api --> DB
```

- **Não há microsserviços** por domínio: módulos Nest compartilham `PrismaService` e o mesmo schema.
- **Frontends** são estáticos; regras de negócio sensíveis ficam na API.
- **Autenticação** usa sempre `DATABASE_URL` (Prisma). Bancos opcionais (ex.: Integra SSP) são só para ferramentas específicas.

---

## 4. Backend único (`afastamentos-api`)

### 4.1 Módulos Nest (domínios)

| Módulo | Prefixo / rotas | Responsabilidade |
|--------|-----------------|------------------|
| `AuthModule` | `/auth` | Login, JWT, recuperação de senha, `GET /auth/me`, troca de senha |
| `PoliciaisModule` | `/policiais` | CRUD, status, função, restrição médica, foto, upload PDF, bulk |
| `AfastamentosModule` | `/afastamentos` | Afastamentos, motivos, encerramento sob demanda |
| `EscalasModule` | `/escalas` | Parâmetros, informações, escalas geradas, quantitativo extras |
| `TrocaServicoModule` | `/troca-servico` | Trocas 12×24, `POST .../processar-revertes` |
| `RestricoesAfastamentoModule` | `/restricoes-afastamento` | Restrições por ano/motivo |
| `UsuariosModule` | `/usuarios` | Usuários, níveis, funções, equipes, perguntas de segurança |
| `SvgModule` | `/svg` | Horários para geração visual |
| `RelatoriosModule` | `/relatorios` | Registro e logs de relatórios emitidos |
| `AuditModule` | `/audit` | `AuditLog` |
| `ErrosModule` | `/erros` | `ErroLog` + filtro HTTP global |
| `AcessosModule` | `/acessos` | `AcessoLog` (login/logout de sessão na API) |
| `ErrorReportsModule` | `/error-reports` | Chamados de suporte |
| `OrionQualidadeModule` | `/orion-qualidade` | Registros + Integra SSP (opcional) |
| `OrionPatrimonioModule` | `/orion-patrimonio` | Bens patrimoniais |
| `OrionJuridicoModule` | `/orion-juridico` | Placeholder |
| `OrionAgendaModule` | `/orion-agenda` | Compromissos institucionais |
| `OrionOperacoesModule` | `/orion-operacoes` | Placeholder |
| `HealthModule` | `/health` | `GET /health/db` (público) |

Na subida (`main.ts` → `ensureInitialUser`), a API garante nível `ADMINISTRADOR` e um usuário admin se não existir (ver [9.5](#95-primeiro-acesso-e-credenciais)).

### 4.2 Guards globais (`app.module.ts`)

1. **`JwtAuthGuard`** — exige JWT em `Authorization: Bearer`, exceto `@Public()`.
2. **`RolesGuard`** — interpreta `@Roles()`, `@AnyAuthenticated()` e rotas sem decorator (ver [6.4](#64-matriz-de-autorização)).
3. **`ThrottlerGuard`** — limite global **300 req/min**; rotas sensíveis com limites menores no controller:
   - `POST /auth/login`: **5/min**
   - `POST /auth/forgot-password` e `reset-password-by-security-question`: **3/min**
   - `POST /auth/change-password`: **10/min**

Decorators: `@Public()`, `@AnyAuthenticated()`, `@Roles('ADMINISTRADOR', 'SAD', …)`, `@CurrentUser()`.

### 4.3 Configuração e `main.ts`

- Variáveis em **`afastamentos-api/.env`** (modelo: `.env.example`).
- Body JSON até **10MB** (anexos base64 em chamados).
- **Helmet** + CSP em produção (`connectSrc` usa `FRONTEND_URL` e `API_URL`).
- **CORS**: desenvolvimento `origin: true`; produção lista fixa em `main.ts` + `FRONTEND_URL` + `ORION_SUPORTE_FRONTEND_URL`. Incluir origens de **Agenda (5186)** e **Operações (5187)** ao publicar esses fronts.

### 4.4 Endpoints úteis (referência rápida)

| Método | Rota | Notas |
|--------|------|--------|
| `GET` | `/health/db` | Público; testa conexão Prisma |
| `POST` | `/auth/login` | Público; retorna JWT |
| `GET` | `/auth/me` | Perfil do usuário autenticado |
| `POST` | `/acessos/login` | Registra `AcessoLog` (complementar ao auth) |
| `POST` | `/policiais/upload` | Extrai lista de PDF (`pdf-parse`) |
| `POST` | `/policiais/bulk` | Cadastro em lote |
| `POST` | `/escalas/geradas` | Persiste snapshot montado no front |
| `POST` | `/troca-servico/processar-revertes` | Restaura equipes após fim dos turnos |
| `GET` | `/orion-qualidade/v1/integra-ssp/status` | Diagnóstico do pool opcional |
| `POST` | `/orion-qualidade/v1/policiais/equipes-por-nome` | Cruza nomes com `Policial` no Prisma |

Prefixos completos dos módulos Órion: `/orion-qualidade/v1/...`, `/orion-patrimonio/v1/...`, etc.

---

## 5. Autenticação, sessão e navegação entre apps

### 5.1 Login

1. `POST /auth/login` com matrícula e senha.
2. Resposta inclui **JWT** e metadados de sessão; o front grava token e `acessoId` quando aplicável.
3. `GET /auth/me` devolve o perfil (sem `senhaHash`) para apps que não usam `GET /usuarios/:id`.

### 5.2 Armazenamento do token (ecossistema)

Referência: `afastamentos-web/src/constants/orionEcossistemaAuth.ts` (copiado nos outros apps).

| Chave `sessionStorage` | Variável opcional |
|------------------------|-------------------|
| `orion-ecossistema:jwt` | `VITE_ORION_AUTH_TOKEN_KEY` |
| `orion-ecossistema:acessoId` | `VITE_ORION_AUTH_ACESSO_ID_KEY` |

Chaves legadas `afastamentos-web:token` são migradas automaticamente na leitura.

- **Mesma origem** (proxy reverso unificado): sessão compartilhada.
- **Origens diferentes** (dev em portas distintas): handoff `#orion_sso=<jwt>` via `buildUrlComHandoffJwt()` — o fragmento não é enviado ao servidor.

### 5.3 Pós-login no SAD

`SelecionarSistemaView` + `sistemaDestinos.ts` redirecionam conforme `sistemasPermitidos` e URLs `VITE_ORION_*` de cada módulo (ver `.env.example` em cada SPA).

---

## 6. Autorização: níveis, telas e sistemas permitidos

Existem **quatro mecanismos** que convivem — não são intercambiáveis:

```mermaid
flowchart LR
  JWT[JWT válido]
  JWT --> Roles["@Roles → UsuarioNivel.nome"]
  JWT --> Telas["telaKey → UI do SAD"]
  JWT --> Sist["sistemasPermitidos → SPAs Órion"]
  JWT --> Sup["acessoOrionSuporte → Suporte"]
```

### 6.1 Administrador

- `Usuario.isAdmin` ou nível **`ADMINISTRADOR`** bypassam `@Roles()` no `RolesGuard`.
- Módulos Órion (`ORION_QUALIDADE`, etc.) também tratam admin como acesso liberado no serviço.

### 6.2 Permissões por tela (SAD)

`UsuarioNivelPermissao`: `(nivelId, telaKey, acao)` com `acao ∈ { VISUALIZAR, EDITAR, DESATIVAR, EXCLUIR }`.

Avaliadas no **frontend** (`permissions.ts`) para exibir/ocultar abas e botões. Não substituem `@Roles()` na API.

### 6.3 Sistemas externos (SPAs)

`Usuario.sistemasPermitidos` define quais apps o usuário pode abrir e quais serviços `orion-*` aceitam o JWT. Cada módulo valida o ID no **service** (ex.: `podeAcessarOrionQualidade`).

**Órion Qualidade** não usa `telaKey` no SAD — só `ORION_QUALIDADE` no cadastro do usuário.

### 6.4 Matriz de autorização

| Mecanismo | Onde vale | Exemplo |
|-----------|-----------|---------|
| `UsuarioNivelPermissao` | UI do SAD | Editar afastamentos se `telaKey=afastamentos` + `EDITAR` |
| `@Roles('…')` | Endpoints da API | Escrita em `/policiais` exige nível `SAD` ou `ADMINISTRADOR` |
| `@AnyAuthenticated()` | Endpoints da API | Qualquer JWT; regra extra no **service** se necessário |
| Sem `@Roles` no handler | API | Qualquer autenticado (ex.: partes de `/escalas` leitura) |
| `sistemasPermitidos` | SPAs + `/orion-*` | `ORION_PATRIMONIO` para CRUD de bens |
| `acessoOrionSuporte` | Suporte | Fila admin: checado no `ErrorReportsService`, não só no guard |

**Níveis padrão** (seed / `on-startup`): `ADMINISTRADOR`, `SAD`, `COMANDO`, `OPERAÇÕES`.

Uso típico de `@Roles` na API: `ADMINISTRADOR`, `SAD` (cadastros), `COMANDO` (auditoria, acessos, exclusão de escalas salvas).

### 6.5 Telas do SAD (`telaKey`)

Configuradas em **Gestão do Sistema → Níveis de acesso** (`PERMISSION_TABS` em `afastamentos-web/src/constants/index.ts`):

| `telaKey` | Descrição |
|-----------|-----------|
| `dashboard` | Dashboard |
| `afastamentos-mes` | Afastamentos do mês |
| `afastamentos` | Gerenciar afastamentos |
| `restricao-afastamento` | Gerar restrição de afastamento |
| `policiais` | Cadastrar policial |
| `equipe` | Efetivo / equipe |
| `calendario` | Calendário das equipes |
| `escalas-gerar` | Escalas — gerar e gravar |
| `escalas-consultar` | Escalas — consultar / imprimir |
| `troca-servico` | Troca de serviço |
| `usuarios` | Cadastrar usuários |
| `gestao-sistema` | Gestão do sistema (níveis, funções, equipes) |
| `relatorios` | Relatórios |

Abas de navegação agrupam subáreas (`afastamentos`, `equipe`, `escalas`, `sistema`). A tela **`reportar-erro`** existe no menu para todos os autenticados (chamado técnico), sem depender de `telaKey`.

Chave legada `escalas` (única) pode ainda existir em permissões antigas no banco até reconfiguração.

### 6.6 Órion Suporte

- `UsuarioNivel.acessoOrionSuporte` (padrão do nível).
- `Usuario.acessoOrionSuporte`: `null` = herda; `true`/`false` = força ou bloqueia.

Rotas `GET /error-reports/admin/*` usam `@AnyAuthenticated()`; a fila administrativa é filtrada no **service** conforme essas flags.

Modelo **`ErrorReport`**: protocolo de 15 dígitos, status, categoria, histórico JSON (`acoes`), anexo opcional (data URL base64).

---

## 7. Modelagem de dados (Prisma / PostgreSQL)

Detalhe canônico: `afastamentos-api/prisma/schema.prisma`.

### 7.1 Núcleo SAD (pessoal e afastamentos)

- **`Policial`**: identidade, `StatusPolicial`, `Funcao`, `RestricaoMedica` ativa, `expediente12x36Fase` (enum `PAR`/`IMPAR` no próprio registro), equipe, foto, desativação.
- **`RestricaoMedica`**, **`RestricaoMedicaHistorico`**: catálogo e histórico por policial.
- **`Afastamento`**, **`MotivoAfastamento`**, **`AfastamentoStatus`** (`ATIVO`, `ENCERRADO`, `DESATIVADO`).
- **`FeriasPolicial`**: por ano civil, confirmação/reprogramação, `semMesDefinido`.
- **`TrocaServico`**: pares A/B, turnos, restauração de equipe.
- **`RestricaoAfastamento`** / **`TipoRestricaoAfastamento`**.

### 7.2 Escalas

- **`EscalaParametro`**, **`HorarioSvg`**, **`EscalaInformacao`**.
- **`EscalaGerada`** + **`EscalaGeradaLinha`**: tipos `OPERACIONAL`, `EXPEDIENTE`, `MOTORISTAS`, `EXTRAORDINARIA`; `impressaoDraft` (JSON de impressão).
- **`PolicialContagemEscalaExtra`**: contagem por policial em extras **salvas**.

Função «Superior de dia» é excluída de escala salva e de regras operacionais (`funcao-supervisor-dia.ts`).

### 7.3 Funções e equipes

- **`Funcao`**: `escalaOperacional`, `escalaMotorista`, `escalaExpediente`, `vinculoEquipe`, `expedienteHorarioPreset`, `equipeReferencia`.
- **`EquipeOption`**: catálogo A–E, `SEM_EQUIPE`.

### 7.4 Usuários e segurança

- **`Usuario`**, **`UsuarioNivel`**, **`UsuarioNivelPermissao`**, **`PerguntaSeguranca`**.

### 7.5 Módulos Órion

- **Qualidade**: `QualidadeRegistro` + `QualidadeRegistroStatus`.
- **Patrimônio**: `PatrimonioBem` + `PatrimonioBemSituacao`.
- **Suporte**: `ErrorReport`, `ErrorReportProtocolSequence`.

### 7.6 Auditoria e logs

- **`AuditLog`**, **`RelatorioLog`**, **`ErroLog`**, **`AcessoLog`**.

---

## 8. Fluxos operacionais principais

### 8.1 Cadastro de policial e afastamento

Permissão nas telas do SAD → API valida conflitos (incl. férias e restrições) → `Policial` / `Afastamento` → auditoria.

**Importação em massa**: `POST /policiais/upload` (PDF) → revisão no front → `POST /policiais/bulk`.

**Encerramento automático de afastamentos**: ao listar/consultar afastamentos, a API executa `markExpiredAfastamentos()` — afastamentos `ATIVO` com `dataFim` até **ontem** passam para `ENCERRADO` (não é job agendado/cron).

### 8.2 Geração de escala

1. Front lê parâmetros, funções, afastamentos, horários SVG e monta as linhas **no navegador**.
2. Operador persiste com `POST /escalas/geradas` (snapshot + `EscalaGeradaLinha`).
3. Consulta/impressão via `GET /escalas/geradas` e sub-recursos.

Não há endpoint de “calcular escala” no servidor — a lógica de montagem está no SAD.

### 8.3 Troca de serviço

Dois policiais, datas e turnos (`DIURNO`/`NOTURNO`); status `ATIVA` até conclusão/cancelamento. `POST /troca-servico/processar-revertes` restaura equipes após o fim dos turnos em Brasília.

### 8.4 Órion Qualidade

Além dos **registros** (`QualidadeRegistro` via API):

- **Dashboard de chamadas**: importação de planilha **XLSX no cliente** (não persiste na API principal); gráficos e tabelas por turno/hora/atendente.
- **Integra SSP** (opcional): `INTEGRA_SSP_DATABASE_URL` na API — pool separado para ferramentas; status em `GET /orion-qualidade/v1/integra-ssp/status`. Login e permissões **nunca** usam esse banco.
- **Equipes por nome**: `POST /orion-qualidade/v1/policiais/equipes-por-nome` cruza nomes da planilha com `Policial` no Prisma.

### 8.5 Órion Patrimônio

SPA + JWT → `/orion-patrimonio/v1/bens` (CRUD) com validação de `ORION_PATRIMONIO` em `sistemasPermitidos`.

### 8.6 Suporte

Qualquer autenticado: `POST /error-reports`. Com permissão de suporte: fila admin, comentários, mudança de status.

---

## 9. Ambiente de desenvolvimento

### 9.1 Pré-requisitos

- **Node.js** compatível com TypeScript 5.7+ (API) e 5.9 / Vite 7 (fronts).
- **Docker Desktop** para PostgreSQL local.

### 9.2 Banco de dados

```bash
npm run db:up
```

Compose (`docker-compose.yml`) — padrão:

| Variável | Valor padrão |
|----------|----------------|
| `POSTGRES_USER` | `postgres` |
| `POSTGRES_PASSWORD` | `postgres123` |
| `POSTGRES_DB` | `afastamentos_db` |
| Porta | `5432` |

Use a **mesma senha** em `DATABASE_URL` (ex.: `postgresql://postgres:postgres123@localhost:5432/afastamentos_db`). O `npm run setup` cria `afastamentos-api/.env` com esse padrão.

```bash
npm run setup          # raiz: Docker, .env, install, migrate, seed
npm run setup:db       # só Prisma na API
```

### 9.3 Rodar API + todos os fronts

```bash
npm run install:all
npm run start:full
```

- **`start:full`**: API + todos os SPAs via `concurrently`.
- **Não** rode `start:api` junto com `start:full` (mesma porta).
- API já rodando: `npm run start:full:without-api`.

| Serviço | Porta |
|---------|-------|
| API | 3002 |
| SAD | 5173 |
| Suporte | 5180 |
| Qualidade | 5182 |
| Jurídico | 5183 |
| Patrimônio | 5184 |
| Mulher | 5185 |
| Agenda | 5186 |
| Operações | 5187 |

Cada SPA: `VITE_API_URL=http://localhost:3002` (ver `*.env.example` em cada pasta).

Scripts individuais na raiz: `start:api`, `start:web`, `start:orion-qualidade`, etc.

### 9.4 Monorepo

Sem workspaces npm obrigatórios: cada pasta tem `node_modules`. `install:all` instala todos os pacotes.

### 9.5 Primeiro acesso e credenciais

Após `npm run setup` ou primeira subida da API:

| Item | Padrão | Variáveis |
|------|--------|-----------|
| Matrícula admin | `1966901` | `ADMIN_MATRICULA` |
| Senha admin | `admin123` | `ADMIN_SENHA` (startup) / `ADMIN_PASSWORD` (scripts) |

**Troque senhas e defina `JWT_SECRET` antes de produção.**

Reset manual de senha do admin (com API parada ou banco acessível):

```bash
cd afastamentos-api
npm run build
node scripts/reset-admin-password.cjs
```

### 9.6 Variáveis de ambiente

#### API (`afastamentos-api/.env`)

| Variável | Obrigatória | Descrição |
|----------|-------------|-----------|
| `DATABASE_URL` | Sim | PostgreSQL principal (Prisma) |
| `JWT_SECRET` | Sim em produção | Assinatura do JWT |
| `PORT` | Não | Padrão `3002` |
| `NODE_ENV` | Não | `production` ativa CORS restrito e CSP |
| `FRONTEND_URL` | Produção | Origem do SAD (CORS + CSP) |
| `API_URL` | Produção | Origem da API (CSP `connectSrc`) |
| `ORION_SUPORTE_FRONTEND_URL` | Opcional | Origem do Suporte (CORS) |
| `ADMIN_MATRICULA` / `ADMIN_SENHA` | Não | Usuário criado no `on-startup` |
| `INTEGRA_SSP_DATABASE_URL` | Não | Pool opcional Órion Qualidade |
| `DATABASE_SSL_REJECT_UNAUTHORIZED` | Não | TLS Postgres (`false` se cert. interno) |
| `DATABASE_PG_TLS_INSECURE` | Não | Atalho para TLS permissivo |
| `SERVER_HOST` | Não | Host exibido no log de bind |

#### Frontends (ex.: `afastamentos-web/.env`)

| Variável | Descrição |
|----------|-----------|
| `VITE_API_URL` | Base da API |
| `VITE_ORION_<SISTEMA>_URL` | URL completa do SPA (recomendado em LAN) |
| `VITE_ORION_<SISTEMA>_PORT` | Porta dev se URL omitida (mesmo host da página) |
| `VITE_ORION_AUTH_TOKEN_KEY` | Chave customizada do JWT no `sessionStorage` |
| `VITE_ORION_AUTH_ACESSO_ID_KEY` | Chave customizada do id de acesso |

Copie de `*.env.example` em cada pasta do monorepo.

### 9.7 Scripts de manutenção (API)

Em `afastamentos-api/package.json`:

| Script | Uso |
|--------|-----|
| `db:setup` | `generate` + `migrate deploy` + `seed` |
| `prisma:studio` | UI do banco |
| `prisma:migrate:dev` | Nova migration em dev |
| `remove:niveis`, `verificar:contagem`, `find:duplicatas`, etc. | Utilitários pontuais (`scripts/`) |

---

## 10. Deploy, segurança e observabilidade

### 10.1 Build e execução

| Pacote | Build | Execução produção |
|--------|-------|-------------------|
| `afastamentos-api` | `npm run build` | `npm run start:prod` (`node dist/main`) |
| Cada `*-web` | `npm run build` | Servir pasta `dist/` (nginx, CDN, App Platform, etc.) |

Não versionar **`afastamentos-api/dist/`** — artefato de build local.

### 10.2 Produção — checklist

- [ ] `NODE_ENV=production`
- [ ] `JWT_SECRET` forte e exclusivo
- [ ] `DATABASE_URL` do ambiente produtivo
- [ ] `FRONTEND_URL` + URLs de cada SPA publicado
- [ ] Revisar lista `allowedOrigins` em `main.ts` (incluir **5186**, **5187** e domínios reais)
- [ ] Senhas padrão (`admin123`, Postgres) alteradas
- [ ] HTTPS no proxy reverso; JWT só em `sessionStorage` (mitigar XSS)

### 10.3 Segurança

- **Helmet + CSP** em produção: `connectSrc` deve incluir API e fronts que fazem `fetch`.
- **JWT** no cliente: `sessionStorage`; handoff SSO via hash (não query string).
- **Rate limit**: global 300/min + limites em `/auth/*`.
- **Validação**: `ValidationPipe` global (`whitelist`, `forbidNonWhitelisted`).

### 10.4 Observabilidade

| Log | Origem típica |
|-----|----------------|
| `ErroLog` | Exceções HTTP (`HttpExceptionFilter`) |
| `AcessoLog` | Login/logout via `/acessos` |
| `AuditLog` | CRUD sensível (policiais, afastamentos, etc.) |
| `RelatorioLog` | Emissão de relatórios no SAD |

`GET /health/db` para health check de banco (load balancer / monitoramento).

---

## 11. Licença

Projeto **privado** — todos os direitos reservados.

---

## Créditos

Desenvolvido no contexto operacional do **COPOM**, com foco em missão, rastreabilidade e evolução modular dos domínios Órion.
