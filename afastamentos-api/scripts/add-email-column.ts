import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  try {
    console.log('Adicionando coluna email à tabela Usuario...');
    
    await prisma.$executeRawUnsafe(`
      ALTER TABLE Usuario 
      ADD COLUMN IF NOT EXISTS email VARCHAR(255) NULL
    `);
    
    console.log('✅ Coluna email adicionada com sucesso!');
  } catch (error) {
    // Se IF NOT EXISTS não funcionar, tentar sem
    try {
      await prisma.$executeRawUnsafe(`
        ALTER TABLE Usuario 
        ADD COLUMN email VARCHAR(255) NULL
      `);
      console.log('✅ Coluna email adicionada com sucesso!');
    } catch (err) {
      if (err instanceof Error && err.message.includes('Duplicate column name')) {
        console.log('ℹ️ Coluna email já existe no banco de dados.');
      } else {
        console.error('❌ Erro ao adicionar coluna:', err);
        throw err;
      }
    }
  } finally {
    await prisma.$disconnect();
  }
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });

