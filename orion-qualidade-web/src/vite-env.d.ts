/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_URL?: string;
  readonly VITE_ORION_AUTH_TOKEN_KEY?: string;
  readonly VITE_ORION_AUTH_ACESSO_ID_KEY?: string;
  readonly VITE_ORION_SAD_URL?: string;
  readonly VITE_ORION_SAD_PORT?: string;
  readonly VITE_ORION_SUPORTE_URL?: string;
  readonly VITE_ORION_SUPORTE_PORT?: string;
  readonly VITE_ORION_JURIDICO_URL?: string;
  readonly VITE_ORION_JURIDICO_PORT?: string;
  readonly VITE_ORION_PATRIMONIO_URL?: string;
  readonly VITE_ORION_PATRIMONIO_PORT?: string;
  readonly VITE_ORION_MULHER_URL?: string;
  readonly VITE_ORION_MULHER_PORT?: string;
  readonly VITE_SISTEMA_URL_OPERACOES?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
