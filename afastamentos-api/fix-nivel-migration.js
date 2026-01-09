const { PrismaClient } = require('@prisma/client');
const { execSync } = require('child_process');
const path = require('path');

const prisma = new PrismaClient();

async function main() {
  console.log('🔧 Corrigindo estrutura de níveis de usuário...\n');

  try {
    // 0. Remover enum type primeiro (se existir) para evitar conflito de nome
    console.log('0. Removendo tipo enum UsuarioNivel (se existir)...');
    try {
      // Primeiro, remover a coluna nivel se existir
      await prisma.$executeRawUnsafe(`
        DO $$ 
        BEGIN
          IF EXISTS (
            SELECT 1 FROM information_schema.columns 
            WHERE table_name = 'Usuario' AND column_name = 'nivel'
          ) THEN
            ALTER TABLE "Usuario" DROP COLUMN "nivel";
          END IF;
        END $$;
      `);
    } catch (e) {
      // Ignora erro
    }
    
    try {
      await prisma.$executeRawUnsafe(`DROP TYPE IF EXISTS "UsuarioNivel" CASCADE;`);
      console.log('   ✅ Tipo enum removido\n');
    } catch (e) {
      console.log('   ✅ Tipo enum não encontrado\n');
    }

    // 1. Criar tabela UsuarioNivel se não existir
    console.log('1. Criando tabela UsuarioNivel...');
    const tableExists = await prisma.$queryRawUnsafe(`
      SELECT 1 FROM information_schema.tables 
      WHERE table_name = 'UsuarioNivel';
    `);
    
    if (!tableExists || tableExists.length === 0) {
      await prisma.$executeRawUnsafe(`
        CREATE TABLE "UsuarioNivel" (
          "id" SERIAL NOT NULL,
          "nome" TEXT NOT NULL,
          "descricao" TEXT,
          "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
          "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
          CONSTRAINT "UsuarioNivel_pkey" PRIMARY KEY ("id"),
          CONSTRAINT "UsuarioNivel_nome_key" UNIQUE ("nome")
        );
      `);
      console.log('   ✅ Tabela UsuarioNivel criada\n');
    } else {
      console.log('   ✅ Tabela UsuarioNivel já existe\n');
    }

    // 2. Popular níveis iniciais
    console.log('2. Populando níveis iniciais...');
    await prisma.$executeRawUnsafe(`
      INSERT INTO "UsuarioNivel" ("nome", "descricao", "createdAt", "updatedAt") 
      VALUES
        ('ADMINISTRADOR', 'Acesso completo ao sistema', NOW(), NOW()),
        ('GESTOR', 'Acesso para gestão de dados', NOW(), NOW()),
        ('CONSULTAS', 'Acesso apenas para consultas', NOW(), NOW())
      ON CONFLICT ("nome") DO NOTHING;
    `);
    console.log('   ✅ Níveis populados\n');

    // 3. Verificar e remover coluna nivel (enum) se existir (já removido no passo 0, mas verificando)
    console.log('3. Verificando coluna nivel...');
    const columnExists = await prisma.$queryRawUnsafe(`
      SELECT 1 FROM information_schema.columns 
      WHERE table_name = 'Usuario' AND column_name = 'nivel';
    `);
    
    if (columnExists && columnExists.length > 0) {
      await prisma.$executeRawUnsafe(`ALTER TABLE "Usuario" DROP COLUMN "nivel";`);
      console.log('   ✅ Coluna nivel removida\n');
    } else {
      console.log('   ✅ Coluna nivel não encontrada\n');
    }

    // 4. Adicionar coluna nivelId se não existir
    console.log('4. Adicionando coluna nivelId...');
    const nivelIdExists = await prisma.$queryRawUnsafe(`
      SELECT 1 FROM information_schema.columns 
      WHERE table_name = 'Usuario' AND column_name = 'nivelId';
    `);
    
    if (!nivelIdExists || nivelIdExists.length === 0) {
      await prisma.$executeRawUnsafe(`ALTER TABLE "Usuario" ADD COLUMN "nivelId" INTEGER;`);
      console.log('   ✅ Coluna nivelId adicionada\n');
    } else {
      console.log('   ✅ Coluna nivelId já existe\n');
    }

    // 5. Adicionar foreign key se não existir
    console.log('5. Adicionando foreign key...');
    const fkExists = await prisma.$queryRawUnsafe(`
      SELECT 1 FROM information_schema.table_constraints 
      WHERE constraint_name = 'Usuario_nivelId_fkey';
    `);
    
    if (!fkExists || fkExists.length === 0) {
      await prisma.$executeRawUnsafe(`
        ALTER TABLE "Usuario" 
        ADD CONSTRAINT "Usuario_nivelId_fkey" 
        FOREIGN KEY ("nivelId") REFERENCES "UsuarioNivel"("id") 
        ON DELETE SET NULL ON UPDATE CASCADE;
      `);
      console.log('   ✅ Foreign key adicionada\n');
    } else {
      console.log('   ✅ Foreign key já existe\n');
    }

    // 6. Migrar dados existentes (set default to CONSULTAS)
    console.log('6. Migrando dados existentes...');
    await prisma.$executeRawUnsafe(`
      UPDATE "Usuario" 
      SET "nivelId" = (SELECT "id" FROM "UsuarioNivel" WHERE "nome" = 'CONSULTAS' LIMIT 1)
      WHERE "nivelId" IS NULL;
    `);
    console.log('   ✅ Dados migrados\n');


    console.log('✅ Estrutura corrigida com sucesso!\n');
    console.log('🔄 Tentando regenerar Prisma Client...\n');

    // 8. Regenerar Prisma Client (pode falhar se servidor estiver rodando)
    const apiDir = path.join(__dirname);
    process.chdir(apiDir);
    try {
      execSync('npx prisma generate', { stdio: 'inherit', shell: true });
      console.log('\n✅ Prisma Client regenerado!\n');
    } catch (e) {
      console.log('\n⚠️  Não foi possível regenerar o Prisma Client (servidor pode estar rodando)\n');
      console.log('📝 Para finalizar, execute manualmente:\n');
      console.log('   1. Pare o servidor da API (Ctrl+C)\n');
      console.log('   2. Execute: npm run prisma:generate\n');
      console.log('   3. Reinicie o servidor\n');
    }

  } catch (error) {
    console.error('❌ Erro:', error.message);
    throw error;
  }
}

main()
  .catch((e) => {
    console.error('❌ Erro ao executar script:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
