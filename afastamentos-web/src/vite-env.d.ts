/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_SISTEMA_URL_PATRIMONIO?: string;
  readonly VITE_SISTEMA_URL_OPERACOES?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
