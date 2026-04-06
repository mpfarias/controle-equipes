import { Injectable } from '@nestjs/common';

/** Placeholder até o domínio Jurídico ser modelado (processos, prazos, peças, etc.). */
@Injectable()
export class OrionJuridicoService {
  getPublicMeta() {
    return {
      sistema: 'orion-juridico',
      nome: 'Órion Jurídico',
      versao: '0.0.0',
      fase: 'estrutura-inicial',
    };
  }

  sessaoResumo(usuario: { id: number; nome: string; matricula: string }) {
    return {
      ok: true,
      sistema: 'orion-juridico',
      usuario: {
        id: usuario.id,
        nome: usuario.nome,
        matricula: usuario.matricula,
      },
      mensagem: 'Endpoint reservado para futuras funcionalidades do Órion Jurídico.',
    };
  }
}
