const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function main() {
  console.log('Aplicando migration para RestricaoMedica...\n');

  try {
    // Verificar se a tabela já existe
    const tableExists = await prisma.$queryRawUnsafe(`
      SELECT 1 FROM information_schema.tables 
      WHERE table_name = 'RestricaoMedica';
    `);

    if (tableExists && tableExists.length > 0) {
      console.log('✅ Tabela RestricaoMedica já existe. Verificando registros...');
      
      const count = await prisma.$queryRawUnsafe(`
        SELECT COUNT(*) as count FROM "RestricaoMedica";
      `);
      
      if (count[0].count > 0) {
        console.log('✅ Registros já existem na tabela.\n');
        return;
      }
    } else {
      // Criar tabela
      console.log('1. Criando tabela RestricaoMedica...');
      await prisma.$executeRawUnsafe(`
        CREATE TABLE "RestricaoMedica" (
          "id" SERIAL NOT NULL,
          "nome" TEXT NOT NULL,
          "descricao" TEXT,
          "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
          "updatedAt" TIMESTAMP(3) NOT NULL,
          CONSTRAINT "RestricaoMedica_pkey" PRIMARY KEY ("id")
        );
      `);

      console.log('2. Criando índice único...');
      await prisma.$executeRawUnsafe(`
        CREATE UNIQUE INDEX "RestricaoMedica_nome_key" ON "RestricaoMedica"("nome");
      `);

      console.log('✅ Tabela criada com sucesso!\n');
    }

    // Inserir registros
    console.log('3. Inserindo registros iniciais...');
    await prisma.$executeRawUnsafe(`
      INSERT INTO "RestricaoMedica" ("nome", "createdAt", "updatedAt") 
      VALUES
        ('Restrição médica', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
        ('Porte de arma suspenso', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
      ON CONFLICT ("nome") DO NOTHING;
    `);

    console.log('✅ Registros inseridos com sucesso!\n');

    // Marcar migration como aplicada
    console.log('4. Marcando migration como aplicada...');
    await prisma.$executeRawUnsafe(`
      INSERT INTO "_prisma_migrations" ("id", "checksum", "finished_at", "migration_name", "logs", "rolled_back_at", "started_at", "applied_steps_count")
      SELECT 
        gen_random_uuid()::text,
        '',
        CURRENT_TIMESTAMP,
        '20250118000000_add_restricao_medica_table',
        NULL,
        NULL,
        CURRENT_TIMESTAMP,
        1
      WHERE NOT EXISTS (
        SELECT 1 FROM "_prisma_migrations" 
        WHERE "migration_name" = '20250118000000_add_restricao_medica_table'
      );
    `);

    console.log('✅ Migration aplicada com sucesso!\n');
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
