import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('Atualizando equipe para null de policiais com funções específicas...\n');
  
  // Lista de funções que não devem ter equipe
  const funcoesSemEquipe = [
    'EXPEDIENTE ADM',
    'CMT UPM',
    'SUBCMT UPM',
    'MOTORISTA DE DIA',
  ];
  
  console.log('Funções que não devem ter equipe:', funcoesSemEquipe.join(', '));
  console.log('');
  
  // Buscar todas as funções que correspondem
  const funcoes = await prisma.funcao.findMany({
    where: {
      OR: funcoesSemEquipe.map((nome) => ({
        nome: {
          contains: nome,
          mode: 'insensitive',
        },
      })),
    },
  });
  
  if (funcoes.length === 0) {
    console.log('Nenhuma função encontrada.');
    return;
  }
  
  console.log(`Funções encontradas: ${funcoes.map(f => f.nome).join(', ')}\n`);
  
  // Buscar todos os colaboradores com essas funções
  const colaboradores = await prisma.colaborador.findMany({
    where: {
      funcaoId: {
        in: funcoes.map(f => f.id),
      },
    },
    include: {
      funcao: true,
    },
  });
  
  if (colaboradores.length === 0) {
    console.log('Nenhum colaborador encontrado com essas funções.');
    return;
  }
  
  console.log(`Encontrados ${colaboradores.length} colaborador(es) com essas funções.\n`);
  
  // Contar quantos já estão com null
  const jaSemEquipe = colaboradores.filter(c => c.equipe === null).length;
  console.log(`- ${jaSemEquipe} já estão com equipe null/vazia`);
  console.log(`- ${colaboradores.length - jaSemEquipe} precisam ser atualizados\n`);
  
  // Atualizar todos os colaboradores para null
  const resultado = await prisma.colaborador.updateMany({
    where: {
      funcaoId: {
        in: funcoes.map(f => f.id),
      },
      equipe: {
        not: null,
      },
    },
    data: {
      equipe: null,
    },
  });
  
  console.log(`✅ ${resultado.count} colaborador(es) atualizado(s) com sucesso!`);
  console.log(`\nTodos os policiais com as funções especificadas agora estão com equipe null/vazia.`);
  
  // Também atualizar todos os que estão com SEM_EQUIPE para null
  console.log('\nAtualizando registros com SEM_EQUIPE para null...');
  const resultadoSemEquipe = await prisma.colaborador.updateMany({
    where: {
      equipe: 'SEM_EQUIPE',
    },
    data: {
      equipe: null,
    },
  });
  
  console.log(`✅ ${resultadoSemEquipe.count} colaborador(es) atualizado(s) de SEM_EQUIPE para null.`);
}

main()
  .catch((e) => {
    console.error('Erro ao atualizar equipe dos colaboradores:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
