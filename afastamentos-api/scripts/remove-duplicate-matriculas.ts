import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

/**
 * Normaliza matrícula removendo zeros à esquerda para comparação
 */
function normalizeMatriculaForComparison(matricula: string): string {
  const cleaned = matricula.trim().toUpperCase().replace(/[^0-9X]/g, '');
  if (cleaned.startsWith('X')) {
    return cleaned;
  }
  const withoutLeadingZeros = cleaned.replace(/^0+/, '');
  return withoutLeadingZeros || '0';
}

/**
 * Remove duplicatas, mantendo apenas o registro mais recente (ou ativo se houver)
 */
async function removeDuplicates() {
  try {
    console.log('Buscando e removendo matrículas duplicadas...\n');

    const policiais = await prisma.policial.findMany({
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      include: { status: true },
    });

    // Agrupar por matrícula normalizada
    const grupos = new Map<string, typeof policiais>();

    for (const policial of policiais) {
      const normalized = normalizeMatriculaForComparison(policial.matricula);
      if (!grupos.has(normalized)) {
        grupos.set(normalized, []);
      }
      grupos.get(normalized)!.push(policial);
    }

    // Encontrar grupos com mais de um policial
    const duplicatas: Array<{
      matriculaNormalizada: string;
      policiais: typeof policiais;
    }> = [];

    for (const [normalized, policiaisGrupo] of grupos.entries()) {
      if (policiaisGrupo.length > 1) {
        duplicatas.push({
          matriculaNormalizada: normalized,
          policiais: policiaisGrupo,
        });
      }
    }

    if (duplicatas.length === 0) {
      console.log('✅ Nenhuma matrícula duplicada encontrada!');
      return;
    }

    console.log(`❌ Encontradas ${duplicatas.length} matrícula(s) duplicada(s)\n`);

    let totalRemovidos = 0;

    for (const duplicata of duplicatas) {
      const policiais = duplicata.policiais;
      
      // Priorizar manter: 1) Registro ATIVO, 2) Mais recente
      const ativos = policiais.filter(p => p.status?.nome === 'ATIVO');
      const paraManter = ativos.length > 0 
        ? ativos[0] // Manter o primeiro ativo (já ordenado por data)
        : policiais[0]; // Se não houver ativo, manter o mais recente
      
      const paraRemover = policiais.filter(p => p.id !== paraManter.id);

      console.log(`\n📋 Matrícula: ${paraManter.matricula} (normalizada: ${duplicata.matriculaNormalizada})`);
      const statusManter = paraManter.status?.nome ?? 'ATIVO';
      console.log(`   ✅ Mantendo: ID ${paraManter.id} | ${paraManter.nome} | Status: ${statusManter}`);

      for (const remover of paraRemover) {
        // Verificar se tem afastamentos associados
        const afastamentos = await prisma.afastamento.count({
          where: { policialId: remover.id },
        });

        if (afastamentos > 0) {
          console.log(`   ⚠️  Pulando ID ${remover.id} (${remover.nome}) - possui ${afastamentos} afastamento(s). Remova manualmente após migrar os afastamentos.`);
          continue;
        }

        // Remover o registro duplicado
        await prisma.policial.delete({
          where: { id: remover.id },
        });

        const statusRemover = remover.status?.nome ?? 'ATIVO';
        console.log(`   ❌ Removido: ID ${remover.id} | ${remover.nome} | Status: ${statusRemover}`);
        totalRemovidos++;
      }
    }

    console.log(`\n\n✅ Processo concluído! ${totalRemovidos} registro(s) duplicado(s) removido(s).`);
  } catch (error) {
    console.error('❌ Erro ao remover duplicatas:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

// Executar apenas se chamado diretamente
if (require.main === module) {
  removeDuplicates()
    .then(() => process.exit(0))
    .catch((error) => {
      console.error(error);
      process.exit(1);
    });
}

export { removeDuplicates };
