/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_URL?: string;
  readonly VITE_ORION_SAD_URL?: string;
  readonly VITE_ORION_SAD_PORT?: string;
  readonly VITE_ORION_QUALIDADE_URL?: string;
  readonly VITE_ORION_QUALIDADE_PORT?: string;
  readonly VITE_ORION_JURIDICO_URL?: string;
  readonly VITE_ORION_JURIDICO_PORT?: string;
  readonly VITE_ORION_PATRIMONIO_URL?: string;
  readonly VITE_ORION_PATRIMONIO_PORT?: string;
  readonly VITE_ORION_MULHER_URL?: string;
  readonly VITE_ORION_MULHER_PORT?: string;
  readonly VITE_ORION_ASSESSORIA_URL?: string;
  readonly VITE_ORION_ASSESSORIA_PORT?: string;
  readonly VITE_ORION_OPERACOES_URL?: string;
  readonly VITE_ORION_OPERACOES_PORT?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
