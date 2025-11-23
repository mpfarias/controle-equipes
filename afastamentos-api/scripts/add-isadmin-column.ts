import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('Adicionando coluna isAdmin à tabela Usuario...');
  
  await prisma.$executeRawUnsafe(`
    ALTER TABLE Usuario ADD COLUMN isAdmin BOOLEAN DEFAULT FALSE;
  `);
  
  console.log('Coluna isAdmin adicionada com sucesso!');
}

main()
  .catch((e) => {
    console.error('Erro ao adicionar coluna isAdmin:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

