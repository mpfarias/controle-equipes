"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const client_1 = require("@prisma/client");
const prisma = new client_1.PrismaClient();
async function main() {
    console.log('🗑️  Removendo funções que não estão em uppercase...\n');
    const todasFuncoes = await prisma.funcao.findMany({
        orderBy: { nome: 'asc' },
    });
    console.log(`📋 Total de funções encontradas: ${todasFuncoes.length}\n`);
    const funcoesUppercase = [];
    const funcoesLowercase = [];
    todasFuncoes.forEach((funcao) => {
        const isUppercase = funcao.nome === funcao.nome.toUpperCase() && funcao.nome !== funcao.nome.toLowerCase();
        if (isUppercase) {
            funcoesUppercase.push(funcao);
        }
        else {
            funcoesLowercase.push(funcao);
        }
    });
    console.log(`✅ Funções em UPPERCASE (serão mantidas): ${funcoesUppercase.length}`);
    funcoesUppercase.forEach((f) => {
        console.log(`   - ${f.nome} (ID: ${f.id})`);
    });
    console.log(`\n🗑️  Funções que não estão em UPPERCASE (serão removidas): ${funcoesLowercase.length}`);
    funcoesLowercase.forEach((f) => {
        console.log(`   - ${f.nome} (ID: ${f.id})`);
    });
    if (funcoesLowercase.length === 0) {
        console.log('\n✅ Nenhuma função precisa ser removida. Todas estão em uppercase!');
        return;
    }
    console.log('\n🔍 Verificando se há usuários ou policiais usando essas funções...');
    for (const funcao of funcoesLowercase) {
        const usuariosComFuncao = await prisma.usuario.findMany({
            where: { funcaoId: funcao.id },
            select: { id: true, nome: true, matricula: true },
        });
        const policiaisComFuncao = await prisma.policial.findMany({
            where: { funcaoId: funcao.id },
            select: { id: true, nome: true, matricula: true },
        });
        if (usuariosComFuncao.length > 0 || policiaisComFuncao.length > 0) {
            console.log(`\n⚠️  ATENÇÃO: A função "${funcao.nome}" está sendo usada:`);
            if (usuariosComFuncao.length > 0) {
                console.log(`   - ${usuariosComFuncao.length} usuário(s):`);
                usuariosComFuncao.forEach((u) => {
                    console.log(`     * ${u.nome} (${u.matricula})`);
                });
            }
            if (policiaisComFuncao.length > 0) {
                console.log(`   - ${policiaisComFuncao.length} policial(is):`);
                policiaisComFuncao.forEach((p) => {
                    console.log(`     * ${p.nome} (${p.matricula})`);
                });
            }
            console.log(`\n   🔄 Removendo a função "${funcao.nome}" e limpando referências...`);
            await prisma.usuario.updateMany({
                where: { funcaoId: funcao.id },
                data: { funcaoId: null },
            });
            await prisma.policial.updateMany({
                where: { funcaoId: funcao.id },
                data: { funcaoId: null },
            });
            console.log(`   ✅ Referências removidas.`);
        }
    }
    console.log(`\n🗑️  Removendo ${funcoesLowercase.length} função(ões)...`);
    for (const funcao of funcoesLowercase) {
        await prisma.funcao.delete({
            where: { id: funcao.id },
        });
        console.log(`   ✅ Função "${funcao.nome}" removida.`);
    }
    console.log(`\n✅ Processo concluído! ${funcoesUppercase.length} função(ões) mantida(s) e ${funcoesLowercase.length} função(ões) removida(s).`);
}
main()
    .catch((e) => {
    console.error('❌ Erro ao executar script:', e);
    process.exit(1);
})
    .finally(async () => {
    await prisma.$disconnect();
});
//# sourceMappingURL=remove-funcoes-lowercase.js.map