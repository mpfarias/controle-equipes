import { Injectable } from '@nestjs/common';

/** Placeholder até o domínio Operações ser modelado. */
@Injectable()
export class OrionOperacoesService {
  getPublicMeta() {
    return {
      sistema: 'orion-operacoes',
      nome: 'Órion Operações',
      versao: '0.0.0',
      fase: 'estrutura-inicial',
    };
  }

  sessaoResumo(usuario: { id: number; nome: string; matricula: string }) {
    return {
      ok: true,
      sistema: 'orion-operacoes',
      usuario: {
        id: usuario.id,
        nome: usuario.nome,
        matricula: usuario.matricula,
      },
      mensagem: 'Endpoint reservado para futuras funcionalidades do Órion Operações.',
    };
  }
}
