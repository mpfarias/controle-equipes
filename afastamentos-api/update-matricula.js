const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  try {
    // Garantir que o usuário com matrícula 1966901 tenha isAdmin: true
    const user = await prisma.usuario.findUnique({ where: { matricula: '1966901' } });
    if (user) {
      if (!user.isAdmin) {
        await prisma.usuario.update({ 
          where: { id: user.id }, 
          data: { isAdmin: true } 
        });
        console.log('✅ Campo isAdmin definido como true para o usuário 1966901');
      } else {
        console.log('✅ Usuário 1966901 já possui isAdmin: true');
      }
      const updated = await prisma.usuario.findUnique({ where: { matricula: '1966901' } });
      if (updated) {
        console.log(`✅ Verificado: ID=${updated.id}, Nome=${updated.nome}, Matrícula=${updated.matricula}, isAdmin=${updated.isAdmin}`);
      }
    } else {
      console.log('⚠️  Usuário com matrícula 1966901 não encontrado');
    }
  } catch (e) {
    console.error('❌ Erro:', e.message);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();
