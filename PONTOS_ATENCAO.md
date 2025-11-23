# Lista Completa de Pontos de Atenção

## 🔴 CRÍTICOS (Segurança e Funcionalidade)

### Backend (API)

1. **Hash de senha no frontend**
   - **Localização**: `afastamentos-web/src/App.tsx` (linha 423)
   - **Problema**: Senha é hasheada no cliente antes de enviar ao servidor
   - **Risco**: Hash pode ser interceptado e reutilizado, senha original nunca chega ao servidor
   - **Solução**: Mover hash para o backend, enviar senha em texto (via HTTPS)

2. **Ausência de autenticação JWT/Token**
   - **Localização**: `afastamentos-api/src/auth/auth.service.ts`
   - **Problema**: Sistema usa apenas login básico, sem tokens de sessão
   - **Risco**: Sem controle de sessão, vulnerável a ataques
   - **Solução**: Implementar JWT com refresh tokens

3. **CORS muito permissivo**
   - **Localização**: `afastamentos-api/src/main.ts` (linha 7)
   - **Problema**: `app.enableCors()` sem configuração específica
   - **Risco**: Permite requisições de qualquer origem
   - **Solução**: Configurar origins específicos, métodos e headers permitidos

4. **Sem rate limiting**
   - **Problema**: Nenhuma proteção contra brute force ou DDoS
   - **Risco**: Sistema vulnerável a ataques de força bruta no login
   - **Solução**: Implementar rate limiting (ex: @nestjs/throttler)

5. **Sem HTTPS enforcement**
   - **Problema**: Não há validação ou redirecionamento para HTTPS
   - **Risco**: Dados podem ser transmitidos em texto plano
   - **Solução**: Configurar HTTPS e redirecionar HTTP

6. **Senha nunca chega ao backend**
   - **Localização**: `afastamentos-api/src/auth/auth.service.ts` (linha 20)
   - **Problema**: Backend recebe hash, não a senha original
   - **Risco**: Impossível validar força da senha, hash pode ser reutilizado
   - **Solução**: Frontend envia senha em texto, backend faz hash

### Frontend (Web)

7. **Hash de senha no frontend (duplicado)**
   - **Localização**: `afastamentos-web/src/App.tsx` (linhas 423, 507)
   - **Problema**: Mesmo problema do backend, mas afeta frontend também
   - **Risco**: Lógica de segurança exposta no cliente
   - **Solução**: Remover bcryptjs do frontend

8. **Armazenamento de sessão no localStorage**
   - **Localização**: `afastamentos-web/src/App.tsx` (linha 2445)
   - **Problema**: Dados do usuário armazenados em localStorage
   - **Risco**: Vulnerável a XSS, dados persistem mesmo após logout se não limpar
   - **Solução**: Usar httpOnly cookies ou sessionStorage

---

## 🟠 IMPORTANTES (Qualidade e Manutenibilidade)

### Backend (API)

9. **Sem testes implementados**
   - **Localização**: Estrutura de testes existe mas vazia
   - **Problema**: Sem cobertura de testes unitários ou E2E
   - **Impacto**: Dificulta refatoração e garante bugs
   - **Solução**: Implementar testes com Jest

10. **Sem documentação da API (Swagger/OpenAPI)**
    - **Problema**: Endpoints não documentados
    - **Impacto**: Dificulta integração e manutenção
    - **Solução**: Adicionar @nestjs/swagger

11. **Sem tratamento de erros global customizado**
    - **Localização**: Apenas exceptions padrão do NestJS
    - **Problema**: Mensagens de erro podem expor detalhes internos
    - **Solução**: Implementar ExceptionFilter global

12. **Sem logging estruturado**
    - **Problema**: Apenas console.log básico
    - **Impacto**: Dificulta debugging e monitoramento
    - **Solução**: Implementar Winston ou Pino

13. **Sem paginação nas listagens**
    - **Localização**: Todos os endpoints GET (findAll)
    - **Problema**: Retorna todos os registros sem limite
    - **Impacto**: Performance degrada com muitos dados
    - **Solução**: Implementar paginação (skip/take)

14. **Sem cache para consultas frequentes**
    - **Problema**: Todas as queries vão direto ao banco
    - **Impacto**: Performance desnecessária
    - **Solução**: Implementar cache (Redis ou in-memory)

### Frontend (Web)

15. **App.tsx extremamente grande (2569 linhas)**
    - **Localização**: `afastamentos-web/src/App.tsx`
    - **Problema**: Toda a lógica em um único arquivo
    - **Impacto**: Dificulta manutenção, testes e colaboração
    - **Solução**: Dividir em componentes menores e hooks customizados

16. **Sem gerenciamento de estado global**
    - **Problema**: Estado gerenciado apenas com useState local
    - **Impacto**: Dificulta compartilhamento de estado entre componentes
    - **Solução**: Implementar Context API ou Zustand

17. **Sem tratamento robusto de erros de rede**
    - **Localização**: `afastamentos-web/src/api.ts` (linha 28)
    - **Problema**: Tratamento básico de erros
    - **Impacto**: UX ruim em falhas de rede
    - **Solução**: Implementar retry, timeout e feedback visual

18. **Sem testes**
    - **Problema**: Nenhum teste implementado
    - **Impacto**: Refatoração arriscada, bugs não detectados
    - **Solução**: Adicionar Jest + React Testing Library

19. **Sem error boundaries**
    - **Problema**: Erros não tratados quebram toda a aplicação
    - **Impacto**: UX ruim, aplicação pode ficar inutilizável
    - **Solução**: Implementar React Error Boundaries

20. **Sem loading skeletons**
    - **Problema**: Apenas texto "Carregando..."
    - **Impacto**: UX menos polida
    - **Solução**: Adicionar skeletons durante carregamento

21. **Sem acessibilidade adequada (ARIA)**
    - **Problema**: Labels ARIA incompletos ou ausentes
    - **Impacto**: Dificulta uso por leitores de tela
    - **Solução**: Adicionar aria-labels, roles, e navegação por teclado

22. **Sem internacionalização (i18n)**
    - **Problema**: Textos hardcoded em português
    - **Impacto**: Dificulta expansão para outros idiomas
    - **Solução**: Implementar react-i18next ou similar

23. **Validação duplicada (frontend + backend)**
    - **Problema**: Lógica de validação repetida
    - **Impacto**: Manutenção duplicada, possível inconsistência
    - **Solução**: Backend como fonte da verdade, frontend apenas UX

### Geral

24. **Filtragem por equipe apenas no frontend**
    - **Localização**: `afastamentos-web/src/App.tsx` (linhas 1071-1087)
    - **Problema**: Backend retorna todos, frontend filtra
    - **Impacto**: Performance ruim, dados desnecessários transferidos
    - **Solução**: Backend filtrar por equipe do usuário autenticado

25. **Sem validação de permissões/roles**
    - **Problema**: Qualquer usuário pode fazer qualquer operação
    - **Impacto**: Sem controle de acesso
    - **Solução**: Implementar guards e decorators de permissão

---

## 🟡 MODERADOS (Melhorias e Otimizações)

### Backend (API)

26. **Sem validação de força de senha**
    - **Localização**: `afastamentos-api/src/usuarios/usuarios.service.ts`
    - **Problema**: Aceita qualquer senha (após hash no frontend)
    - **Solução**: Validar complexidade quando receber senha em texto

27. **Queries do Prisma podem ser otimizadas**
    - **Problema**: Algumas queries fazem includes desnecessários
    - **Solução**: Usar select específico ao invés de include quando possível

28. **Sem índices no banco (além de primary/unique)**
    - **Localização**: `afastamentos-api/prisma/schema.prisma`
    - **Problema**: Queries podem ser lentas sem índices adequados
    - **Solução**: Adicionar índices em campos frequentemente consultados

29. **Sem validação de formato de matrícula**
    - **Problema**: Apenas sanitização, não valida formato específico
    - **Solução**: Validar padrão de matrícula (ex: regex)

30. **Soft delete inconsistente**
    - **Problema**: Afastamentos usam hard delete, outros soft delete
    - **Solução**: Padronizar estratégia (preferir soft delete)

### Frontend (Web)

31. **Sem memoização de componentes pesados**
    - **Problema**: Componentes podem re-renderizar desnecessariamente
    - **Solução**: Usar React.memo, useMemo, useCallback

32. **Sem lazy loading de componentes**
    - **Problema**: Todo código carregado de uma vez
    - **Solução**: Implementar React.lazy para code splitting

33. **Validação de matrícula com debounce pode melhorar**
    - **Localização**: `afastamentos-web/src/App.tsx` (linha 352)
    - **Problema**: Debounce de 300ms pode ser otimizado
    - **Solução**: Usar biblioteca como use-debounce

34. **Sem validação de formulários robusta**
    - **Problema**: Validação manual, sem biblioteca
    - **Solução**: Implementar react-hook-form + zod

35. **Sem animações de transição**
    - **Problema**: Transições abruptas entre estados
    - **Solução**: Adicionar CSS transitions ou Framer Motion

36. **Sem dark mode**
    - **Problema**: Apenas tema claro
    - **Solução**: Implementar sistema de temas

37. **Botão "Vincular" sem funcionalidade**
    - **Localização**: `afastamentos-web/src/App.tsx` (linha 2208)
    - **Problema**: Botão existe mas não faz nada útil
    - **Solução**: Implementar funcionalidade ou remover

38. **Duplicação de código de validação**
    - **Problema**: Lógica de validação repetida em múltiplos lugares
    - **Solução**: Extrair para funções/hooks reutilizáveis

39. **Sem tratamento de timezone**
    - **Problema**: Datas podem ter problemas com timezone
    - **Solução**: Usar biblioteca como date-fns ou dayjs

### Geral

40. **README incompleto**
    - **Problema**: Documentação básica, falta detalhes
    - **Solução**: Adicionar guia de instalação, arquitetura, deploy

41. **Sem variáveis de ambiente documentadas**
    - **Problema**: .env não documentado
    - **Solução**: Criar .env.example e documentar variáveis

42. **Sem CI/CD**
    - **Problema**: Deploy manual
    - **Solução**: Implementar pipeline (GitHub Actions, GitLab CI)

43. **Sem Docker**
    - **Problema**: Dificulta deploy e desenvolvimento consistente
    - **Solução**: Criar Dockerfile e docker-compose.yml

44. **Sem scripts de deploy**
    - **Problema**: Deploy manual, propenso a erros
    - **Solução**: Criar scripts automatizados

---

## 🔵 BAIXOS (Nice to Have)

### Backend (API)

45. **Sem métricas/monitoramento**
    - **Solução**: Adicionar Prometheus, New Relic, ou similar

46. **Sem health check completo**
    - **Localização**: `afastamentos-api/src/health/health.controller.ts`
    - **Problema**: Apenas verifica DB, não outros serviços
    - **Solução**: Expandir health checks

47. **Sem versionamento de API**
    - **Problema**: Endpoints sem versão (ex: /v1/usuarios)
    - **Solução**: Implementar versionamento

### Frontend (Web)

48. **Sem PWA (Progressive Web App)**
    - **Solução**: Adicionar service worker, manifest

49. **Sem analytics**
    - **Solução**: Adicionar Google Analytics ou similar

50. **Sem testes de acessibilidade automatizados**
    - **Solução**: Adicionar axe-core ou similar

51. **Sem otimização de imagens**
    - **Problema**: Apenas SVG, mas pode ter imagens no futuro
    - **Solução**: Preparar pipeline de otimização

### Geral

52. **Sem diagramas de arquitetura**
    - **Solução**: Criar diagramas (Mermaid, Draw.io)

53. **Sem guia de contribuição**
    - **Solução**: Adicionar CONTRIBUTING.md

54. **Sem changelog**
    - **Solução**: Manter CHANGELOG.md

55. **Sem licença explícita**
    - **Problema**: package.json marca como UNLICENSED
    - **Solução**: Definir licença apropriada

---

## 📊 Resumo por Prioridade

- **🔴 Críticos**: 8 pontos (principalmente segurança)
- **🟠 Importantes**: 17 pontos (qualidade e manutenibilidade)
- **🟡 Moderados**: 15 pontos (melhorias e otimizações)
- **🔵 Baixos**: 11 pontos (nice to have)

**Total: 51 pontos de atenção identificados**

---

## 🎯 Priorização Recomendada

### Fase 1 (Urgente - Segurança)
1. Mover hash de senha para backend
2. Implementar JWT authentication
3. Configurar CORS adequadamente
4. Adicionar rate limiting
5. Implementar HTTPS

### Fase 2 (Importante - Qualidade)
6. Dividir App.tsx em componentes
7. Adicionar testes (backend e frontend)
8. Implementar tratamento de erros global
9. Adicionar paginação
10. Implementar Context API ou gerenciamento de estado

### Fase 3 (Melhorias)
11. Adicionar Swagger/OpenAPI
12. Implementar logging estruturado
13. Adicionar error boundaries
14. Melhorar acessibilidade
15. Otimizar queries e adicionar cache

