import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('Removendo tabela PasswordResetToken...');
  
  await prisma.$executeRawUnsafe(`
    DROP TABLE IF EXISTS PasswordResetToken;
  `);
  
  console.log('Tabela PasswordResetToken removida com sucesso!');
}

main()
  .catch((e) => {
    console.error('Erro ao remover tabela PasswordResetToken:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

