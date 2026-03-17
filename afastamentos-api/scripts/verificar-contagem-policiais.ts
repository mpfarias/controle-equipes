/**
 * Script de varredura para verificar:
 * 1. Registros duplicados (matrícula, nome+dataNascimento)
 * 2. Contagem correta: total, ativos, desativados
 * 3. Consistência entre banco e o que a API retornaria
 *
 * Uso: npm run verificar:contagem
 */
import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { Pool } from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  console.error('⚠️  DATABASE_URL não está definida. Verifique o arquivo .env');
  process.exit(1);
}
const pool = new Pool({ connectionString: databaseUrl });
const prisma = new PrismaClient({ adapter: new PrismaPg(pool) });

function normalizeMatricula(matricula: string): string {
  const cleaned = matricula.trim().toUpperCase().replace(/[^0-9X]/g, '');
  if (cleaned.startsWith('X')) return cleaned;
  const withoutLeadingZeros = cleaned.replace(/^0+/, '');
  return withoutLeadingZeros || '0';
}

async function main() {
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('  VARREDURA DE CONTAGEM E DUPLICADOS - POLICIAIS');
  console.log('═══════════════════════════════════════════════════════════════\n');

  const policiais = await prisma.policial.findMany({
    orderBy: { matricula: 'asc' },
    include: { status: true },
  });

  const totalGeral = policiais.length;

  // 1. Contagem por status
  const porStatus: Record<string, number> = {};
  for (const p of policiais) {
    const s = p.status?.nome ?? 'ATIVO';
    porStatus[s] = (porStatus[s] ?? 0) + 1;
  }

  const desativados = porStatus['DESATIVADO'] ?? 0;
  const disponiveis = totalGeral - desativados;

  console.log('📊 CONTAGEM GERAL');
  console.log('───────────────────────────────────────────────────────────────');
  console.log(`   Total de registros no banco:     ${totalGeral}`);
  console.log(`   Desativados (não contam):       ${desativados}`);
  console.log(`   Disponíveis (ativos para contagem): ${disponiveis}`);
  console.log('');
  console.log('   Por status:');
  for (const [status, count] of Object.entries(porStatus).sort((a, b) => b[1] - a[1])) {
    console.log(`     - ${status}: ${count}`);
  }
  console.log('');

  // 2. Verificar totalDisponiveis no banco (como a API faz)
  const statusDesativado = await prisma.statusPolicial.findUnique({
    where: { nome: 'DESATIVADO' },
    select: { id: true },
  });
  const totalDisponiveisDb = statusDesativado
    ? await prisma.policial.count({
        where: { statusId: { not: statusDesativado.id } },
      })
    : totalGeral;
  console.log('📊 VERIFICAÇÃO API (totalDisponiveis)');
  console.log('───────────────────────────────────────────────────────────────');
  console.log(`   totalDisponiveis (exclui DESATIVADO): ${totalDisponiveisDb}`);
  if (totalDisponiveisDb !== disponiveis) {
    console.log(`   ⚠️  DIFERENÇA: esperado ${disponiveis}, banco retorna ${totalDisponiveisDb}`);
  } else {
    console.log(`   ✅ Consistente`);
  }
  console.log('');

  // 3. Duplicados por matrícula
  const gruposMatricula = new Map<string, typeof policiais>();
  for (const p of policiais) {
    const norm = normalizeMatricula(p.matricula);
    if (!gruposMatricula.has(norm)) gruposMatricula.set(norm, []);
    gruposMatricula.get(norm)!.push(p);
  }
  const duplicatasMatricula = [...gruposMatricula.entries()].filter(([, arr]) => arr.length > 1);

  console.log('📋 DUPLICADOS POR MATRÍCULA');
  console.log('───────────────────────────────────────────────────────────────');
  if (duplicatasMatricula.length === 0) {
    console.log('   ✅ Nenhuma matrícula duplicada encontrada.');
  } else {
    console.log(`   ❌ Encontradas ${duplicatasMatricula.length} matrícula(s) duplicada(s):\n`);
    for (const [norm, arr] of duplicatasMatricula) {
      console.log(`   Matrícula normalizada: ${norm} (${arr.length} registros)`);
      for (const p of arr) {
        console.log(`     - ID: ${p.id} | Matrícula: ${p.matricula} | Nome: ${p.nome} | Status: ${p.status?.nome ?? 'ATIVO'}`);
      }
      console.log('');
    }
  }
  console.log('');

  // 4. Possíveis duplicados por nome + dataNascimento (mesma pessoa)
  const gruposNomeData = new Map<string, typeof policiais>();
  for (const p of policiais) {
    const nomeNorm = (p.nome ?? '').trim().toUpperCase();
    const dataStr = p.dataNascimento ? p.dataNascimento.toISOString().split('T')[0] : 'sem-data';
    const chave = `${nomeNorm}|${dataStr}`;
    if (!gruposNomeData.has(chave)) gruposNomeData.set(chave, []);
    gruposNomeData.get(chave)!.push(p);
  }
  const duplicatasNomeData = [...gruposNomeData.entries()].filter(([, arr]) => arr.length > 1);

  console.log('📋 POSSÍVEIS DUPLICADOS (nome + data de nascimento)');
  console.log('───────────────────────────────────────────────────────────────');
  if (duplicatasNomeData.length === 0) {
    console.log('   ✅ Nenhum grupo suspeito encontrado.');
  } else {
    console.log(`   ⚠️  ${duplicatasNomeData.length} grupo(s) com mesmo nome e data de nascimento:\n`);
    for (const [chave, arr] of duplicatasNomeData.slice(0, 10)) {
      const [nome, data] = chave.split('|');
      console.log(`   Nome: ${nome} | Data: ${data} (${arr.length} registros)`);
      for (const p of arr) {
        console.log(`     - ID: ${p.id} | Matrícula: ${p.matricula} | Status: ${p.status?.nome ?? 'ATIVO'}`);
      }
      console.log('');
    }
    if (duplicatasNomeData.length > 10) {
      console.log(`   ... e mais ${duplicatasNomeData.length - 10} grupo(s).`);
    }
  }
  console.log('');

  // 5. Resumo
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('  RESUMO');
  console.log('═══════════════════════════════════════════════════════════════');
  console.log(`  • O que deve aparecer no Dashboard/cards: ${totalDisponiveisDb} policiais`);
  console.log(`  • O que NÃO deve contar: ${desativados} desativados`);
  if (duplicatasMatricula.length > 0) {
    console.log(`  • Matrículas duplicadas: ${duplicatasMatricula.length} (execute find-duplicate-matriculas.ts)`);
  }
  console.log('');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
