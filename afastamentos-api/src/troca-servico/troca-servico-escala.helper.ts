/** Parâmetros de escala (mesmo formato de `EscalasService.getParametros`). */
export type TrocaServicoEscalaParametros = {
  dataInicioEquipes: string;
  dataInicioMotoristas: string;
  sequenciaEquipes: string;
  sequenciaMotoristas: string;
};

function dateFromYmd(ymd: string): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(ymd.trim());
  if (!m) return null;
  const y = Number(m[1]);
  const mo = Number(m[2]) - 1;
  const d = Number(m[3]);
  const dt = new Date(y, mo, d);
  if (dt.getFullYear() !== y || dt.getMonth() !== mo || dt.getDate() !== d) return null;
  return dt;
}

const DATA_MIN_CALENDARIO = new Date(2026, 0, 1);

/**
 * Escala **12×24** das cinco equipes (calendário, aba Equipes). Alinhado a `calcularEquipesOperacionalDia` no front.
 */
export function calcularEquipesOperacionalDia(
  ymd: string,
  p: TrocaServicoEscalaParametros,
): { equipeDia: string; equipeNoite: string } | null {
  const dataAtual = dateFromYmd(ymd);
  if (!dataAtual || dataAtual.getTime() < DATA_MIN_CALENDARIO.getTime()) return null;
  const dataInicio = dateFromYmd(p.dataInicioEquipes);
  if (!dataInicio) return null;
  const sequencia = p.sequenciaEquipes
    .split(',')
    .map((s) => s.trim().toUpperCase())
    .filter(Boolean);
  const n = sequencia.length;
  if (n === 0) return null;
  const diffTime = dataAtual.getTime() - dataInicio.getTime();
  const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
  const posicaoDia = ((diffDays % n) + n) % n;
  const posicaoNoite = (posicaoDia - 1 + n) % n;
  return { equipeDia: sequencia[posicaoDia]!, equipeNoite: sequencia[posicaoNoite]! };
}

/** Rodízio **24×72** dos motoristas (aba Motoristas do calendário). */
export function calcularEquipeMotoristasDia(ymd: string, p: TrocaServicoEscalaParametros): string | null {
  const dataAtual = dateFromYmd(ymd);
  if (!dataAtual || dataAtual.getTime() < DATA_MIN_CALENDARIO.getTime()) return null;
  const seq = p.sequenciaMotoristas
    .split(',')
    .map((s) => s.trim().toUpperCase())
    .filter(Boolean);
  const nm = seq.length;
  if (nm === 0) return null;
  const dataInicio = dateFromYmd(p.dataInicioMotoristas);
  if (!dataInicio) return null;
  const diffTime = dataAtual.getTime() - dataInicio.getTime();
  const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
  if (diffDays < 0) return null;
  return seq[diffDays % nm] ?? null;
}

export type PolicialParaValidacaoServicoDia = {
  equipe: string | null;
  funcao: { nome: string } | null;
  status: { nome: string } | null;
};

/**
 * Garante que o policial está escalado na data informada.
 *
 * Duas escalas distintas (como no `CalendarioSection`: aba Equipes vs aba Motoristas):
 * - **Escala das equipes (12×24)**: cinco equipes (padrão D,E,B,A,C), turno **dia** (07h–19h) e **noite** (19h–07h);
 *   a cada dia civil avança o rodízio; a noite fica “um passo atrás” do dia na sequência circular.
 * - **Escala de motoristas (24×72)**: rodízio próprio (A,B,C,D) com data de início própria — só para função motorista de dia.
 *
 * DESIGNADO / PTTC / COMISSIONADO sem equipe operacional: não há ciclo fixo no cadastro — aceita.
 */
export function validarPolicialDeServicoNoDia(
  policial: PolicialParaValidacaoServicoDia,
  ymd: string,
  parametros: TrocaServicoEscalaParametros,
): { ok: true } | { ok: false; motivo: string } {
  const fn = policial.funcao?.nome?.toUpperCase() ?? '';
  const motorista = fn.includes('MOTORISTA DE DIA');
  const eq = policial.equipe?.trim() ?? '';
  const st = policial.status?.nome?.toUpperCase() ?? '';
  const statusPermiteSemCiclo = st === 'DESIGNADO' || st === 'PTTC' || st === 'COMISSIONADO';

  // Motorista: calendário da escala de motoristas (mesma regra que tipo MOTORISTAS ao gerar escala).
  if (motorista) {
    const em = calcularEquipeMotoristasDia(ymd, parametros);
    if (em == null) {
      return {
        ok: false,
        motivo: `Não foi possível determinar a escala 24×72 (motorista de dia; equipes A–D) para ${ymd}. Verifique data de início e sequência de motoristas nos parâmetros da escala.`,
      };
    }
    if (eq !== em) {
      return {
        ok: false,
        motivo: `Na data ${ymd}, na escala 24×72 (motorista de dia) o serviço é da equipe ${em}; a equipe cadastrada do policial é ${eq || '—'}.`,
      };
    }
    return { ok: true };
  }

  // Escala 12×24 das equipes: mesma regra que aba Equipes do calendário e tipo OPERACIONAL ao gerar escala.
  const equipeOperacional = Boolean(eq && eq !== 'SEM_EQUIPE');
  if (equipeOperacional) {
    const op = calcularEquipesOperacionalDia(ymd, parametros);
    if (op == null) {
      return {
        ok: false,
        motivo: `Não foi possível determinar a escala 12×24 das equipes para ${ymd}. Verifique data de início e sequência das equipes nos parâmetros da escala.`,
      };
    }
    if (eq !== op.equipeDia && eq !== op.equipeNoite) {
      return {
        ok: false,
        motivo: `Na data ${ymd}, a escala 12×24 das equipes prevê serviço para ${op.equipeDia} (turno dia) e ${op.equipeNoite} (turno noite); a equipe do policial é ${eq}. Escolha um dia em que a própria equipe esteja de serviço nessa escala.`,
      };
    }
    return { ok: true };
  }

  if (statusPermiteSemCiclo) {
    return { ok: true };
  }

  return {
    ok: false,
    motivo:
      'Não foi possível validar o dia de serviço: é necessário equipe operacional (exceto SEM_EQUIPE) para a escala 12×24 das equipes, ou função de motorista de dia para a escala 24×72 (motorista de dia), ou status DESIGNADO, PTTC ou COMISSIONADO.',
  };
}

/**
 * Mesma regra de {@link validarPolicialDeServicoNoDia}, mas em **troca de serviço** o policial pode cumprir
 * na data informada o turno que seria da **equipe de origem do parceiro** (substituição), ainda que a própria
 * equipe não esteja no dia/noite da escala 12×24 nesse dia civil.
 * Motoristas e demais casos seguem só a validação direta.
 */
export function validarPolicialDeServicoNoDiaEmContextoTroca(
  policial: PolicialParaValidacaoServicoDia,
  ymd: string,
  parametros: TrocaServicoEscalaParametros,
  equipeParceiraOrigem: string | null,
): { ok: true } | { ok: false; motivo: string } {
  const direto = validarPolicialDeServicoNoDia(policial, ymd, parametros);
  if (direto.ok) return direto;

  const fn = policial.funcao?.nome?.toUpperCase() ?? '';
  if (fn.includes('MOTORISTA DE DIA')) {
    return direto;
  }

  const eq = policial.equipe?.trim() ?? '';
  const equipeOperacional = Boolean(eq && eq !== 'SEM_EQUIPE');
  if (!equipeOperacional) {
    return direto;
  }

  const ep = (equipeParceiraOrigem ?? '').trim();
  if (!ep || ep === 'SEM_EQUIPE') {
    return direto;
  }

  const op = calcularEquipesOperacionalDia(ymd, parametros);
  if (op == null) {
    return direto;
  }
  if (ep === op.equipeDia || ep === op.equipeNoite) {
    return { ok: true };
  }

  return {
    ok: false,
    motivo: `Na data ${ymd}, na escala 12×24, o serviço é da equipe ${op.equipeDia} (turno dia) e ${op.equipeNoite} (turno noite). O policial é da equipe ${eq} e o parceiro da troca da equipe ${ep}. Para troca, a data deve ser um dia em que **a equipe de um dos dois** esteja de serviço nessa escala (serviço próprio ou em substituição ao parceiro).`,
  };
}
