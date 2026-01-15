import { PrismaClient, Equipe } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('Atualizando equipe de policiais com função "EXPEDIENTE ADM"...\n');
  
  // Buscar a função "EXPEDIENTE ADM"
  const funcaoExpedienteAdm = await prisma.funcao.findFirst({
    where: {
      nome: {
        contains: 'EXPEDIENTE ADM',
        mode: 'insensitive',
      },
    },
  });
  
  if (!funcaoExpedienteAdm) {
    console.log('Função "EXPEDIENTE ADM" não encontrada no sistema.');
    return;
  }
  
  console.log(`Função encontrada: ${funcaoExpedienteAdm.nome} (ID: ${funcaoExpedienteAdm.id})\n`);
  
  // Buscar todos os policiais com essa função
  const policiais = await prisma.policial.findMany({
    where: {
      funcaoId: funcaoExpedienteAdm.id,
    },
    include: {
      funcao: true,
    },
  });
  
  if (policiais.length === 0) {
    console.log('Nenhum policial encontrado com a função "EXPEDIENTE ADM".');
    return;
  }
  
  console.log(`Encontrados ${policiais.length} policial(is) com a função "EXPEDIENTE ADM".\n`);
  
  // Contar quantos já estão com SEM_EQUIPE
  const jaSemEquipe = policiais.filter(p => p.equipe === Equipe.SEM_EQUIPE).length;
  console.log(`- ${jaSemEquipe} já estão com equipe "SEM_EQUIPE"`);
  console.log(`- ${policiais.length - jaSemEquipe} precisam ser atualizados\n`);
  
  // Atualizar todos os policiais para SEM_EQUIPE
  const resultado = await prisma.policial.updateMany({
    where: {
      funcaoId: funcaoExpedienteAdm.id,
      equipe: {
        not: Equipe.SEM_EQUIPE,
      },
    },
    data: {
      equipe: Equipe.SEM_EQUIPE,
    },
  });
  
  console.log(`✅ ${resultado.count} policial(is) atualizado(s) com sucesso!`);
  console.log(`\nTodos os policiais com função "EXPEDIENTE ADM" agora estão com equipe "SEM_EQUIPE".`);
}

main()
  .catch((e) => {
    console.error('Erro ao atualizar equipe dos policiais:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
