const { PrismaClient } = require('@prisma/client');
const { execSync } = require('child_process');

const prisma = new PrismaClient();

async function main() {
  console.log('🔧 Iniciando migração de motivo para tabela...\n');

  try {
    // 1. Criar a tabela MotivoAfastamento
    console.log('1. Criando tabela MotivoAfastamento...');
    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS "MotivoAfastamento" (
        "id" SERIAL NOT NULL,
        "nome" TEXT NOT NULL,
        "descricao" TEXT,
        "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT "MotivoAfastamento_pkey" PRIMARY KEY ("id")
      );
    `);

    // Criar índice único no nome
    await prisma.$executeRawUnsafe(`
      CREATE UNIQUE INDEX IF NOT EXISTS "MotivoAfastamento_nome_key" ON "MotivoAfastamento"("nome");
    `);
    console.log('   ✅ Tabela MotivoAfastamento criada\n');

    // 2. Inserir motivos iniciais
    console.log('2. Inserindo motivos iniciais...');
    const motivos = [
      { nome: 'Férias', descricao: 'Período de férias' },
      { nome: 'Abono', descricao: 'Abono de faltas' },
      { nome: 'Dispensa recompensa', descricao: 'Dispensa recompensa' },
      { nome: 'LTSP', descricao: 'Licença para tratamento de saúde' },
      { nome: 'Aniversário', descricao: 'Dia de aniversário' },
      { nome: 'Outro', descricao: 'Outro motivo' },
    ];

    for (const motivoData of motivos) {
      await prisma.$executeRawUnsafe(`
        INSERT INTO "MotivoAfastamento" ("nome", "descricao", "createdAt", "updatedAt")
        VALUES ($1, $2, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
        ON CONFLICT ("nome") DO NOTHING;
      `, motivoData.nome, motivoData.descricao || null);
    }
    console.log('   ✅ Motivos inseridos\n');

    // 3. Verificar se há dados na tabela Afastamento
    const count = await prisma.$queryRawUnsafe('SELECT COUNT(*) as count FROM "Afastamento"');
    const totalAfastamentos = parseInt(count[0].count);

    if (totalAfastamentos === 0) {
      console.log('3. Nenhum afastamento encontrado. Adicionando coluna motivoId...');
      // Se não houver dados, podemos adicionar a coluna diretamente como NOT NULL
      await prisma.$executeRawUnsafe(`
        ALTER TABLE "Afastamento"
        ADD COLUMN IF NOT EXISTS "motivoId" INTEGER;
      `);
      console.log('   ✅ Coluna motivoId adicionada\n');
    } else {
      console.log(`3. Encontrados ${totalAfastamentos} afastamento(s). Migrando dados...`);
      // Adicionar coluna motivoId como NULL primeiro
      await prisma.$executeRawUnsafe(`
        ALTER TABLE "Afastamento"
        ADD COLUMN IF NOT EXISTS "motivoId" INTEGER;
      `);

      // Migrar dados existentes
      const afastamentos = await prisma.$queryRawUnsafe(`
        SELECT DISTINCT "motivo" FROM "Afastamento" WHERE "motivo" IS NOT NULL;
      `);

      for (const row of afastamentos) {
        const motivoNome = row.motivo?.trim();
        if (!motivoNome) continue;

        // Buscar ou criar motivo
        const motivoResult = await prisma.$queryRawUnsafe(`
          SELECT "id" FROM "MotivoAfastamento" WHERE "nome" = $1;
        `, motivoNome);

        let motivoId;
        if (motivoResult.length > 0) {
          motivoId = motivoResult[0].id;
        } else {
          // Criar motivo se não existir (caso haja algum motivo customizado)
          const insertResult = await prisma.$queryRawUnsafe(`
            INSERT INTO "MotivoAfastamento" ("nome", "descricao", "createdAt", "updatedAt")
            VALUES ($1, $2, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
            RETURNING "id";
          `, motivoNome, null);
          motivoId = insertResult[0].id;
        }

        // Atualizar afastamentos com este motivo
        await prisma.$executeRawUnsafe(`
          UPDATE "Afastamento"
          SET "motivoId" = $1
          WHERE "motivo" = $2 AND "motivoId" IS NULL;
        `, motivoId, motivoNome);
      }

      // Verificar se todos os afastamentos têm motivoId
      const semMotivoId = await prisma.$queryRawUnsafe(`
        SELECT COUNT(*) as count FROM "Afastamento" WHERE "motivoId" IS NULL;
      `);
      const countSemMotivoId = parseInt(semMotivoId[0].count);

      if (countSemMotivoId > 0) {
        console.log(`   ⚠️  Aviso: ${countSemMotivoId} afastamento(s) sem motivoId. Atribuindo "Outro"...`);
        const outroResult = await prisma.$queryRawUnsafe(`
          SELECT "id" FROM "MotivoAfastamento" WHERE "nome" = 'Outro';
        `);
        if (outroResult.length > 0) {
          const outroId = outroResult[0].id;
          await prisma.$executeRawUnsafe(`
            UPDATE "Afastamento"
            SET "motivoId" = $1
            WHERE "motivoId" IS NULL;
          `, outroId);
        }
      }

      console.log('   ✅ Dados migrados\n');
    }

    // 4. Tornar motivoId NOT NULL
    console.log('4. Tornando motivoId obrigatório...');
    await prisma.$executeRawUnsafe(`
      ALTER TABLE "Afastamento"
      ALTER COLUMN "motivoId" SET NOT NULL;
    `);
    console.log('   ✅ Coluna motivoId é obrigatória agora\n');

    // 5. Adicionar foreign key
    console.log('5. Adicionando foreign key...');
    await prisma.$executeRawUnsafe(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM pg_constraint
          WHERE conname = 'Afastamento_motivoId_fkey'
        ) THEN
          ALTER TABLE "Afastamento"
          ADD CONSTRAINT "Afastamento_motivoId_fkey"
          FOREIGN KEY ("motivoId") REFERENCES "MotivoAfastamento"("id")
          ON DELETE RESTRICT ON UPDATE CASCADE;
        END IF;
      END $$;
    `);
    console.log('   ✅ Foreign key adicionada\n');

    // 6. Dropar coluna motivo antiga
    console.log('6. Removendo coluna motivo antiga...');
    await prisma.$executeRawUnsafe(`
      ALTER TABLE "Afastamento"
      DROP COLUMN IF EXISTS "motivo";
    `);
    console.log('   ✅ Coluna motivo removida\n');

    console.log('✅ Migração concluída com sucesso!\n');
  } catch (error) {
    console.error('❌ Erro na migração:', error);
    throw error;
  }
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
