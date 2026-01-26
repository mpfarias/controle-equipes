# Refatoração do App.tsx

## Estrutura Criada

### ✅ Componentes Extraídos

1. **Constantes** (`src/constants/index.ts`)
   - `TABS`, `STATUS_LABEL`, `POLICIAL_STATUS_OPTIONS`
   - `EQUIPE_OPTIONS`, `PERGUNTAS_SEGURANCA`
   - Tipo `TabKey`

2. **Utilitários** (`src/utils/dateUtils.ts`)
   - `formatDate()`
   - `calcularDiasEntreDatas()`
   - `formatPeriodo()`

3. **Componentes Comuns** (`src/components/common/`)
   - `ConfirmDialog.tsx` - Modal de confirmação
   - `PasswordInput.tsx` - Input de senha com toggle de visibilidade

4. **Componentes de Autenticação** (`src/components/auth/`)
   - `LoginView.tsx`
   - `ForgotPasswordView.tsx`
   - `ResetPasswordView.tsx`
   - `SecurityQuestionView.tsx`

### ⏳ Próximos Passos

As seções principais são muito grandes e devem ser extraídas gradualmente:

1. **Seções** (`src/components/sections/`)
   - `UsuariosSection.tsx` (~1300 linhas)
   - `PoliciaisSection.tsx` (~700 linhas)
   - `AfastamentosSection.tsx` (~1000 linhas)
   - `DashboardSection.tsx` (~200 linhas)
   - `MostrarEquipeSection.tsx` (~400 linhas)

2. **App.tsx Principal**
   - Atualizar imports para usar os novos componentes
   - Manter apenas a lógica de roteamento e estado global

## Benefícios da Refatoração

- ✅ **Manutenibilidade**: Código mais fácil de entender e modificar
- ✅ **Reutilização**: Componentes podem ser reutilizados
- ✅ **Testabilidade**: Componentes isolados são mais fáceis de testar
- ✅ **Organização**: Estrutura de pastas clara e lógica
- ✅ **Performance**: Possibilidade de lazy loading das seções

## Estrutura Final Proposta

```
src/
├── components/
│   ├── auth/
│   │   ├── LoginView.tsx
│   │   ├── ForgotPasswordView.tsx
│   │   ├── ResetPasswordView.tsx
│   │   ├── SecurityQuestionView.tsx
│   │   └── index.ts
│   ├── sections/
│   │   ├── UsuariosSection.tsx
│   │   ├── PoliciaisSection.tsx
│   │   ├── AfastamentosSection.tsx
│   │   ├── DashboardSection.tsx
│   │   ├── MostrarEquipeSection.tsx
│   │   └── index.ts
│   └── common/
│       ├── ConfirmDialog.tsx
│       ├── PasswordInput.tsx
│       └── index.ts
├── constants/
│   └── index.ts
├── utils/
│   └── dateUtils.ts
├── App.tsx (reduzido para ~200-300 linhas)
├── api.ts
├── types.ts
└── main.tsx
```
