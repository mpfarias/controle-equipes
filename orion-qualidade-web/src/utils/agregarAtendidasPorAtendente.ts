import type { ChamadaXlsxRow } from '../types/chamadasXlsx';
import { classificarStatusParaGraficoChamada } from './agregarChamadasPorHora';
import { formatarNomeTitulo } from './formatNomeTitulo';

export type AtendenteAtendidas = {
  /** Rótulo exibido no eixo (nome do atendente). */
  nome: string;
  quantidade: number;
  /**
   * Valor da coluna Ramal no primeiro registro ATENDIDA deste atendente (ordem das linhas no arquivo).
   * Se o mesmo nome aparecer com ramais diferentes depois, mantém-se só o primeiro.
   */
  ramal: string;
};

/**
 * Conta chamadas com status ATENDIDA (mesma regra do gráfico por hora), agrupadas por coluna Atendente.
 */
export function agregarAtendidasPorAtendente(rows: ChamadaXlsxRow[]): AtendenteAtendidas[] {
  const map = new Map<string, { quantidade: number; ramal: string }>();
  for (const row of rows) {
    if (classificarStatusParaGraficoChamada(row.status) !== 'atendida') continue;
    const bruto = row.atendente?.trim() ? row.atendente.trim() : '';
    const nome = bruto ? formatarNomeTitulo(bruto) : '(Não informado)';
    const ramalLinha = (row.ramal ?? '').trim();
    const cur = map.get(nome);
    if (cur) {
      cur.quantidade += 1;
    } else {
      map.set(nome, { quantidade: 1, ramal: ramalLinha });
    }
  }
  return Array.from(map.entries())
    .map(([nome, { quantidade, ramal }]) => ({ nome, quantidade, ramal }))
    .sort((a, b) => b.quantidade - a.quantidade || a.nome.localeCompare(b.nome, 'pt-BR'));
}
