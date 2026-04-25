import { Injectable } from '@nestjs/common';

/** Placeholder até o domínio Assessoria ser modelado. */
@Injectable()
export class OrionAssessoriaService {
  getPublicMeta() {
    return {
      sistema: 'orion-assessoria',
      nome: 'Órion Assessoria',
      versao: '0.0.0',
      fase: 'estrutura-inicial',
    };
  }

  sessaoResumo(usuario: { id: number; nome: string; matricula: string }) {
    return {
      ok: true,
      sistema: 'orion-assessoria',
      usuario: {
        id: usuario.id,
        nome: usuario.nome,
        matricula: usuario.matricula,
      },
      mensagem: 'Endpoint reservado para futuras funcionalidades do Órion Assessoria.',
    };
  }
}
