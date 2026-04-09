/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_SISTEMA_URL_OPERACOES?: string;
  /** URL do sistema de chamados (ex.: GLPI). Usada em Reportar erro e onde o link de chamado for exibido. */
  readonly VITE_URL_ABRIR_CHAMADO?: string;
  /** URL base do Órion Suporte (gestão de chamados). Preferível em LAN/produção (ex.: http://10.95.91.53:5180). */
  readonly VITE_ORION_SUPORTE_URL?: string;
  /** Porta do Suporte em dev quando `VITE_ORION_SUPORTE_URL` não está definida (padrão 5180). */
  readonly VITE_ORION_SUPORTE_PORT?: string;
  readonly VITE_ORION_QUALIDADE_URL?: string;
  readonly VITE_ORION_QUALIDADE_PORT?: string;
  readonly VITE_ORION_JURIDICO_URL?: string;
  readonly VITE_ORION_JURIDICO_PORT?: string;
  readonly VITE_ORION_PATRIMONIO_URL?: string;
  readonly VITE_ORION_PATRIMONIO_PORT?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
