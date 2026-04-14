/**
 * Preenche/atualiza turnoServicoA e turnoServicoB nas trocas já cadastradas,
 * usando a mesma lógica conceitual da API (equipe de origem do parceiro no dia + motorista = diurno).
 *
 * Uso: npm run backfill:troca-turnos
 */
import 'dotenv/config';
import { PrismaClient, TrocaServicoTurno } from '@prisma/client';
import { Pool } from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';
import { ESCALA_CHAVE, ESCALA_DEFAULTS } from '../src/escalas/escalas.constants';
import {
  calcularEquipesOperacionalDia,
  type TrocaServicoEscalaParametros,
} from '../src/troca-servico/troca-servico-escala.helper';

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  console.error('DATABASE_URL não definida.');
  process.exit(1);
}

const pool = new Pool({ connectionString: databaseUrl });
const prisma = new PrismaClient({ adapter: new PrismaPg(pool) });

function dateToYmd(d: Date): string {
  return d.toISOString().slice(0, 10);
}

async function loadParametros(): Promise<TrocaServicoEscalaParametros> {
  const rows = await prisma.escalaParametro.findMany();
  const map = new Map(rows.map((r) => [r.chave, r.valor]));
  return {
    dataInicioEquipes: map.get(ESCALA_CHAVE.DATA_INICIO_EQUIPES) ?? ESCALA_DEFAULTS[ESCALA_CHAVE.DATA_INICIO_EQUIPES]!,
    dataInicioMotoristas:
      map.get(ESCALA_CHAVE.DATA_INICIO_MOTORISTAS) ?? ESCALA_DEFAULTS[ESCALA_CHAVE.DATA_INICIO_MOTORISTAS]!,
    sequenciaEquipes: map.get(ESCALA_CHAVE.SEQUENCIA_EQUIPES) ?? ESCALA_DEFAULTS[ESCALA_CHAVE.SEQUENCIA_EQUIPES]!,
    sequenciaMotoristas:
      map.get(ESCALA_CHAVE.SEQUENCIA_MOTORISTAS) ?? ESCALA_DEFAULTS[ESCALA_CHAVE.SEQUENCIA_MOTORISTAS]!,
  };
}

function inferTurnoServico(
  ymd: string,
  equipeParceiroOrigem: string | null,
  policialCumpre: { funcao: { nome: string } | null },
  parametros: TrocaServicoEscalaParametros,
): TrocaServicoTurno {
  const fn = policialCumpre.funcao?.nome?.toUpperCase() ?? '';
  if (fn.includes('MOTORISTA DE DIA')) {
    return TrocaServicoTurno.DIURNO;
  }

  const ep = (equipeParceiroOrigem ?? '').trim();
  if (!ep || ep === 'SEM_EQUIPE') {
    return TrocaServicoTurno.NOTURNO;
  }

  const op = calcularEquipesOperacionalDia(ymd, parametros);
  if (!op) {
    return TrocaServicoTurno.NOTURNO;
  }
  if (ep === op.equipeDia) {
    return TrocaServicoTurno.DIURNO;
  }
  if (ep === op.equipeNoite) {
    return TrocaServicoTurno.NOTURNO;
  }
  return TrocaServicoTurno.NOTURNO;
}

async function main() {
  const parametros = await loadParametros();
  console.log('Parâmetros escala (equipes):', parametros.dataInicioEquipes, parametros.sequenciaEquipes);

  const trocas = await prisma.trocaServico.findMany({
    orderBy: { id: 'asc' },
    include: {
      policialA: { include: { funcao: true } },
      policialB: { include: { funcao: true } },
    },
  });

  if (trocas.length === 0) {
    console.log('Nenhuma troca cadastrada.');
    await prisma.$disconnect();
    await pool.end();
    return;
  }

  let atualizadas = 0;
  let inalteradas = 0;

  for (const t of trocas) {
    const ymdA = dateToYmd(t.dataServicoA);
    const ymdB = dateToYmd(t.dataServicoB);
    const novoA = inferTurnoServico(ymdA, t.equipeOrigemB, t.policialA, parametros);
    const novoB = inferTurnoServico(ymdB, t.equipeOrigemA, t.policialB, parametros);

    if (novoA === t.turnoServicoA && novoB === t.turnoServicoB) {
      inalteradas += 1;
      continue;
    }

    await prisma.trocaServico.update({
      where: { id: t.id },
      data: { turnoServicoA: novoA, turnoServicoB: novoB },
    });
    atualizadas += 1;
    console.log(
      `id=${t.id} status=${t.status} A ${ymdA}: ${t.turnoServicoA}→${novoA} | B ${ymdB}: ${t.turnoServicoB}→${novoB}`,
    );
  }

  console.log(`\nTotal: ${trocas.length} | Atualizadas: ${atualizadas} | Já corretas: ${inalteradas}`);

  await prisma.$disconnect();
  await pool.end();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
