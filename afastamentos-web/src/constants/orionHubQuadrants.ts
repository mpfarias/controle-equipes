import {

  SISTEMA_ID_APP_ATUAL,

  SISTEMA_ID_ORION_JURIDICO,

  SISTEMA_ID_ORION_PATRIMONIO,

  SISTEMA_ID_ORION_QUALIDADE,

  SISTEMA_ID_ORION_SUPORTE,

} from './sistemaDestinos';



export type OrionHubQuadrantKey = 'topLeft' | 'topRight' | 'bottomLeft' | 'bottomRight';



export type OrionHubQuadrantDef =

  | {

      key: OrionHubQuadrantKey;

      tipo: 'administrativo';

      title: string;

      subtitle: string;

    }

  | {

      key: OrionHubQuadrantKey;

      tipo: 'gerenciamento';

      title: string;

      subtitle: string;

    }

  | {

      key: OrionHubQuadrantKey;

      tipo: 'estrategico';

      title: string;

      subtitle: string;

    }

  | {

      key: OrionHubQuadrantKey;

      tipo: 'sistema';

      sistemaId: string;

      title: string;

      subtitle: string;

    };



/** Módulos exibidos no quadrante Administrativo (filtrados por perfil). */

export const ORION_HUB_ADMIN_SISTEMAS = [

  SISTEMA_ID_APP_ATUAL,

  SISTEMA_ID_ORION_JURIDICO,

  SISTEMA_ID_ORION_SUPORTE,

] as const;



/** Módulos exibidos no quadrante Gerenciamento Operacional (filtrados por perfil). */

export const ORION_HUB_GERENCIAMENTO_SISTEMAS = ['OPERACOES', SISTEMA_ID_ORION_PATRIMONIO] as const;



/** Quatro quadrantes nos cantos da tela hub. */

export const ORION_HUB_QUADRANTS: OrionHubQuadrantDef[] = [

  {

    key: 'topLeft',

    tipo: 'administrativo',

    title: 'Administrativo',

    subtitle: 'SAD, Jurídico e Suporte',

  },

  {

    key: 'topRight',

    tipo: 'gerenciamento',

    title: 'Gerenciamento Operacional',

    subtitle: 'Operações e Patrimônio',

  },

  {

    key: 'bottomLeft',

    tipo: 'estrategico',

    title: 'Estratégico',

    subtitle: 'Em breve',

  },

  {

    key: 'bottomRight',

    tipo: 'sistema',

    sistemaId: SISTEMA_ID_ORION_QUALIDADE,

    title: 'Avaliação e Qualidade',

    subtitle: 'Órion Qualidade',

  },

];



/** IDs de sistemas já representados nos quadrantes (não repetir em extras). */

export function orionHubSistemasNosQuadrantes(): string[] {

  const ids: string[] = [];

  for (const q of ORION_HUB_QUADRANTS) {

    if (q.tipo === 'sistema') ids.push(q.sistemaId);

    if (q.tipo === 'administrativo') ids.push(...ORION_HUB_ADMIN_SISTEMAS);

    if (q.tipo === 'gerenciamento') ids.push(...ORION_HUB_GERENCIAMENTO_SISTEMAS);

  }

  return ids;

}


