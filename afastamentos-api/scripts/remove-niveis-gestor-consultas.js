"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const client_1 = require("@prisma/client");
const prisma = new client_1.PrismaClient();
async function main() {
    console.log('🗑️  Removendo níveis GESTOR e CONSULTAS...\n');
    const nivelGestor = await prisma.usuarioNivel.findUnique({
        where: { nome: 'GESTOR' },
    });
    const nivelConsultas = await prisma.usuarioNivel.findUnique({
        where: { nome: 'CONSULTAS' },
    });
    const nivelOperacoes = await prisma.usuarioNivel.findUnique({
        where: { nome: 'OPERAÇÕES' },
    });
    if (!nivelOperacoes) {
        console.error('❌ Erro: Nível OPERAÇÕES não encontrado. Crie-o antes de executar este script.');
        process.exit(1);
    }
    if (nivelGestor) {
        const usuariosGestor = await prisma.usuario.findMany({
            where: { nivelId: nivelGestor.id },
        });
        if (usuariosGestor.length > 0) {
            console.log(`📋 Encontrados ${usuariosGestor.length} usuário(s) com nível GESTOR:`);
            usuariosGestor.forEach((u) => {
                console.log(`   - ${u.nome} (${u.matricula})`);
            });
            console.log(`\n🔄 Migrando usuários para nível OPERAÇÕES...`);
            await prisma.usuario.updateMany({
                where: { nivelId: nivelGestor.id },
                data: { nivelId: nivelOperacoes.id },
            });
            console.log(`✅ ${usuariosGestor.length} usuário(s) migrado(s) com sucesso.\n`);
        }
        else {
            console.log('ℹ️  Nenhum usuário encontrado com nível GESTOR.\n');
        }
    }
    else {
        console.log('ℹ️  Nível GESTOR não encontrado no banco de dados.\n');
    }
    if (nivelConsultas) {
        const usuariosConsultas = await prisma.usuario.findMany({
            where: { nivelId: nivelConsultas.id },
        });
        if (usuariosConsultas.length > 0) {
            console.log(`📋 Encontrados ${usuariosConsultas.length} usuário(s) com nível CONSULTAS:`);
            usuariosConsultas.forEach((u) => {
                console.log(`   - ${u.nome} (${u.matricula})`);
            });
            console.log(`\n🔄 Migrando usuários para nível OPERAÇÕES...`);
            await prisma.usuario.updateMany({
                where: { nivelId: nivelConsultas.id },
                data: { nivelId: nivelOperacoes.id },
            });
            console.log(`✅ ${usuariosConsultas.length} usuário(s) migrado(s) com sucesso.\n`);
        }
        else {
            console.log('ℹ️  Nenhum usuário encontrado com nível CONSULTAS.\n');
        }
    }
    else {
        console.log('ℹ️  Nível CONSULTAS não encontrado no banco de dados.\n');
    }
    if (nivelGestor) {
        console.log('🗑️  Removendo nível GESTOR...');
        await prisma.usuarioNivel.delete({
            where: { id: nivelGestor.id },
        });
        console.log('✅ Nível GESTOR removido.\n');
    }
    if (nivelConsultas) {
        console.log('🗑️  Removendo nível CONSULTAS...');
        await prisma.usuarioNivel.delete({
            where: { id: nivelConsultas.id },
        });
        console.log('✅ Nível CONSULTAS removido.\n');
    }
    console.log('✅ Processo concluído com sucesso!');
}
main()
    .catch((e) => {
    console.error('❌ Erro ao executar script:', e);
    process.exit(1);
})
    .finally(async () => {
    await prisma.$disconnect();
});
//# sourceMappingURL=remove-niveis-gestor-consultas.js.map