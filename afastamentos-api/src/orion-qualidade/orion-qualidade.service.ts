import { Injectable } from '@nestjs/common';

/** Placeholder até o domínio de Qualidade ser modelado (indicadores, auditorias, etc.). */
@Injectable()
export class OrionQualidadeService {
  getPublicMeta() {
    return {
      sistema: 'orion-qualidade',
      nome: 'Órion Qualidade',
      versao: '0.0.0',
      fase: 'estrutura-inicial',
    };
  }

  sessaoResumo(usuario: { id: number; nome: string; matricula: string }) {
    return {
      ok: true,
      sistema: 'orion-qualidade',
      usuario: {
        id: usuario.id,
        nome: usuario.nome,
        matricula: usuario.matricula,
      },
      mensagem: 'Endpoint reservado para futuras funcionalidades do Órion Qualidade.',
    };
  }
}
