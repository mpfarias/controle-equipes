const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function main() {
  console.log('Aplicando migration para adicionar restricaoMedicaId ao Policial...\n');

  try {
    // Verificar se a coluna já existe
    const columnExists = await prisma.$queryRawUnsafe(`
      SELECT 1 FROM information_schema.columns 
      WHERE table_name = 'Policial' AND column_name = 'restricaoMedicaId';
    `);

    if (columnExists && columnExists.length > 0) {
      console.log('✅ Coluna restricaoMedicaId já existe na tabela Policial.\n');
      return;
    }

    // Adicionar coluna
    console.log('1. Adicionando coluna restricaoMedicaId...');
    await prisma.$executeRawUnsafe(`
      ALTER TABLE "Policial" ADD COLUMN "restricaoMedicaId" INTEGER;
    `);

    console.log('2. Criando foreign key...');
    await prisma.$executeRawUnsafe(`
      ALTER TABLE "Policial" 
      ADD CONSTRAINT "Policial_restricaoMedicaId_fkey" 
      FOREIGN KEY ("restricaoMedicaId") 
      REFERENCES "RestricaoMedica"("id") 
      ON DELETE SET NULL ON UPDATE CASCADE;
    `);

    console.log('✅ Migration aplicada com sucesso!\n');

    // Marcar migration como aplicada
    console.log('3. Marcando migration como aplicada...');
    await prisma.$executeRawUnsafe(`
      INSERT INTO "_prisma_migrations" ("id", "checksum", "finished_at", "migration_name", "logs", "rolled_back_at", "started_at", "applied_steps_count")
      SELECT 
        gen_random_uuid()::text,
        '',
        CURRENT_TIMESTAMP,
        '20250118001000_add_restricao_medica_to_policial',
        NULL,
        NULL,
        CURRENT_TIMESTAMP,
        1
      WHERE NOT EXISTS (
        SELECT 1 FROM "_prisma_migrations" 
        WHERE "migration_name" = '20250118001000_add_restricao_medica_to_policial'
      );
    `);

    console.log('✅ Migration marcada como aplicada!\n');
  } catch (error) {
    console.error('❌ Erro ao aplicar migration:', error);
    throw error;
  }
}

main()
  .catch((e) => {
    console.error('Erro:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
