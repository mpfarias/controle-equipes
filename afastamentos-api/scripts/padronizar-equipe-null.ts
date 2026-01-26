import { PrismaClient } from '@prisma/client';
import { Pool } from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';
import * as dotenv from 'dotenv';

dotenv.config();

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);

const prisma = new PrismaClient({
  adapter,
  log: ['error'],
});

async function main() {
  console.log('=== Padronizando equipe: SEM_EQUIPE -> NULL ===\n');
  
  // 1. Atualizar policiais com equipe SEM_EQUIPE para NULL
  console.log('1. Atualizando policiais com equipe SEM_EQUIPE para NULL...');
  const resultadoPoliciais = await prisma.policial.updateMany({
    where: { equipe: 'SEM_EQUIPE' },
    data: { equipe: null },
  });
  console.log(`   ✅ ${resultadoPoliciais.count} policiais atualizados\n`);
  
  // 2. Primeiro, alterar a constraint para permitir NULL
  console.log('2. Alterando constraint da coluna equipe para permitir NULL...');
  try {
    await prisma.$executeRaw`ALTER TABLE "Usuario" ALTER COLUMN equipe DROP NOT NULL`;
    await prisma.$executeRaw`ALTER TABLE "Usuario" ALTER COLUMN equipe DROP DEFAULT`;
    console.log('   ✅ Constraint alterada com sucesso\n');
  } catch (error: any) {
    if (error.message?.includes('does not exist') || error.message?.includes('não existe')) {
      console.log('   ⚠️  Constraint já removida ou não existe\n');
    } else {
      throw error;
    }
  }
  
  // 3. Atualizar usuários com equipe SEM_EQUIPE para NULL
  console.log('3. Atualizando usuários com equipe SEM_EQUIPE para NULL...');
  const resultadoUsuariosRaw = await prisma.$executeRaw`
    UPDATE "Usuario" 
    SET equipe = NULL 
    WHERE equipe = 'SEM_EQUIPE'
  `;
  console.log(`   ✅ ${resultadoUsuariosRaw} usuários atualizados\n`);
  
  // 4. Verificar resultado
  console.log('3. Verificando resultado...');
  const countPoliciaisSemEquipe = await prisma.policial.count({
    where: { equipe: 'SEM_EQUIPE' },
  });
  // Usar query raw para contar usuários com equipe NULL
  const countUsuariosSemEquipe = await prisma.$queryRaw<[{ count: bigint }]>`
    SELECT COUNT(*)::int as count FROM "Usuario" WHERE equipe = 'SEM_EQUIPE'
  `;
  const countPoliciaisNull = await prisma.policial.count({
    where: { equipe: null },
  });
  // Usar query raw para contar usuários com equipe NULL
  const countUsuariosNull = await prisma.$queryRaw<[{ count: bigint }]>`
    SELECT COUNT(*)::int as count FROM "Usuario" WHERE equipe IS NULL
  `;
  
  console.log(`   Policiais com equipe SEM_EQUIPE: ${countPoliciaisSemEquipe}`);
  console.log(`   Policiais com equipe NULL: ${countPoliciaisNull}`);
  console.log(`   Usuários com equipe SEM_EQUIPE: ${Number(countUsuariosSemEquipe[0].count)}`);
  console.log(`   Usuários com equipe NULL: ${Number(countUsuariosNull[0].count)}\n`);
  
  console.log('✅ Padronização concluída!');
}

main()
  .catch((e) => {
    console.error('Erro:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
