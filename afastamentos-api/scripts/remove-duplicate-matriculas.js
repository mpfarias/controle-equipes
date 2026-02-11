"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.removeDuplicates = removeDuplicates;
const client_1 = require("@prisma/client");
const prisma = new client_1.PrismaClient();
function normalizeMatriculaForComparison(matricula) {
    const cleaned = matricula.trim().toUpperCase().replace(/[^0-9X]/g, '');
    if (cleaned.startsWith('X')) {
        return cleaned;
    }
    const withoutLeadingZeros = cleaned.replace(/^0+/, '');
    return withoutLeadingZeros || '0';
}
async function removeDuplicates() {
    try {
        console.log('Buscando e removendo matrículas duplicadas...\n');
        const policiais = await prisma.policial.findMany({
            orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
            include: { status: true },
        });
        const grupos = new Map();
        for (const policial of policiais) {
            const normalized = normalizeMatriculaForComparison(policial.matricula);
            if (!grupos.has(normalized)) {
                grupos.set(normalized, []);
            }
            grupos.get(normalized).push(policial);
        }
        const duplicatas = [];
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
            const ativos = policiais.filter(p => p.status?.nome === 'ATIVO');
            const paraManter = ativos.length > 0
                ? ativos[0]
                : policiais[0];
            const paraRemover = policiais.filter(p => p.id !== paraManter.id);
            console.log(`\n📋 Matrícula: ${paraManter.matricula} (normalizada: ${duplicata.matriculaNormalizada})`);
            const statusManter = paraManter.status?.nome ?? 'ATIVO';
            console.log(`   ✅ Mantendo: ID ${paraManter.id} | ${paraManter.nome} | Status: ${statusManter}`);
            for (const remover of paraRemover) {
                const afastamentos = await prisma.afastamento.count({
                    where: { policialId: remover.id },
                });
                if (afastamentos > 0) {
                    console.log(`   ⚠️  Pulando ID ${remover.id} (${remover.nome}) - possui ${afastamentos} afastamento(s). Remova manualmente após migrar os afastamentos.`);
                    continue;
                }
                await prisma.policial.delete({
                    where: { id: remover.id },
                });
                const statusRemover = remover.status?.nome ?? 'ATIVO';
                console.log(`   ❌ Removido: ID ${remover.id} | ${remover.nome} | Status: ${statusRemover}`);
                totalRemovidos++;
            }
        }
        console.log(`\n\n✅ Processo concluído! ${totalRemovidos} registro(s) duplicado(s) removido(s).`);
    }
    catch (error) {
        console.error('❌ Erro ao remover duplicatas:', error);
        throw error;
    }
    finally {
        await prisma.$disconnect();
    }
}
if (require.main === module) {
    removeDuplicates()
        .then(() => process.exit(0))
        .catch((error) => {
        console.error(error);
        process.exit(1);
    });
}
//# sourceMappingURL=remove-duplicate-matriculas.js.map