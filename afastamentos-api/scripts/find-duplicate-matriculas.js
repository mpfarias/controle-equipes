"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
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
async function findDuplicates() {
    try {
        console.log('Buscando matrículas duplicadas...\n');
        const policiais = await prisma.policial.findMany({
            orderBy: { matricula: 'asc' },
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
        console.log(`❌ Encontradas ${duplicatas.length} matrícula(s) duplicada(s):\n`);
        for (const duplicata of duplicatas) {
            console.log(`\n📋 Matrícula normalizada: ${duplicata.matriculaNormalizada}`);
            console.log(`   Encontrados ${duplicata.policiais.length} registro(s):`);
            for (const policial of duplicata.policiais) {
                const statusNome = policial.status?.nome ?? 'ATIVO';
                console.log(`   - ID: ${policial.id} | Matrícula: ${policial.matricula} | Nome: ${policial.nome} | Status: ${statusNome}`);
            }
        }
        console.log('\n\n💡 Para remover duplicatas, execute o script remove-duplicate-matriculas.ts');
    }
    catch (error) {
        console.error('Erro ao buscar duplicatas:', error);
        throw error;
    }
    finally {
        await prisma.$disconnect();
    }
}
findDuplicates();
//# sourceMappingURL=find-duplicate-matriculas.js.map