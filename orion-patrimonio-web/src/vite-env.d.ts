/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_URL?: string;
  readonly VITE_ORION_SAD_URL?: string;
  readonly VITE_ORION_SAD_PORT?: string;
  readonly VITE_ORION_SUPORTE_URL?: string;
  readonly VITE_ORION_SUPORTE_PORT?: string;
  readonly VITE_ORION_QUALIDADE_URL?: string;
  readonly VITE_ORION_QUALIDADE_PORT?: string;
  readonly VITE_ORION_JURIDICO_URL?: string;
  readonly VITE_ORION_JURIDICO_PORT?: string;
  readonly VITE_ORION_PATRIMONIO_URL?: string;
  readonly VITE_ORION_PATRIMONIO_PORT?: string;
  readonly VITE_SISTEMA_URL_OPERACOES?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
