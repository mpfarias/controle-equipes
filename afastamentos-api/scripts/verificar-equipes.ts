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
  console.log('=== Verificando equipes cadastradas ===\n');
  
  const equipes = await prisma.equipeOption.findMany({
    orderBy: { nome: 'asc' },
  });
  
  console.log('Equipes cadastradas:');
  equipes.forEach(e => {
    console.log(`  - ${e.nome} (ativo: ${e.ativo})`);
  });
  
  const semEquipe = await prisma.equipeOption.findFirst({
    where: { nome: 'SEM_EQUIPE' },
  });
  
  console.log('\nSEM_EQUIPE encontrada:', semEquipe ? `Sim (ativo: ${semEquipe.ativo})` : 'Não');
  
  // Verificar quantos policiais têm equipe SEM_EQUIPE
  const countSemEquipe = await prisma.policial.count({
    where: { equipe: 'SEM_EQUIPE' },
  });
  
  console.log(`\nTotal de policiais com equipe SEM_EQUIPE: ${countSemEquipe}`);
  
  // Verificar policiais EXPEDIENTE ADM por equipe
  const funcaoExpediente = await prisma.funcao.findFirst({
    where: { nome: { contains: 'EXPEDIENTE ADM', mode: 'insensitive' } },
  });
  
  if (funcaoExpediente) {
    const policiais = await prisma.policial.findMany({
      where: {
        funcaoId: funcaoExpediente.id,
        status: { nome: { not: 'DESATIVADO' } },
      },
      select: { id: true, nome: true, matricula: true, equipe: true },
    });
    
    console.log(`\nTotal de policiais EXPEDIENTE ADM: ${policiais.length}`);
    
    const porEquipe = policiais.reduce((acc, p) => {
      const eq = p.equipe || 'NULL';
      acc[eq] = (acc[eq] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);
    
    console.log('Por equipe:', porEquipe);
    
    // Mostrar os 3 policiais específicos
    const tresPoliciais = policiais.filter(p => 
      p.matricula === '2150522' || 
      p.matricula === '00159980' || 
      p.matricula === '00213209'
    );
    
    console.log('\nOs 3 policiais específicos:');
    tresPoliciais.forEach(p => {
      console.log(`  - ${p.nome} (${p.matricula}) - Equipe: ${p.equipe || 'NULL'}`);
    });
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
