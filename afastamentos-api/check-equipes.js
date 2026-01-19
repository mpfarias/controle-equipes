const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function checkEquipes() {
  try {
    console.log('=== Verificando dados das equipes ===\n');
    
    const equipes = ['A', 'B', 'C', 'D', 'E'];
    
    for (const equipe of equipes) {
      const count = await prisma.policial.count({
        where: {
          equipe: equipe,
          status: 'ATIVO',
        },
      });
      
      const policiais = await prisma.policial.findMany({
        where: {
          equipe: equipe,
          status: 'ATIVO',
        },
        select: {
          id: true,
          nome: true,
          matricula: true,
          equipe: true,
          status: true,
        },
        orderBy: {
          nome: 'asc',
        },
      });
      
      console.log(`\nEquipe ${equipe}:`);
      console.log(`  Total: ${count}`);
      console.log(`  Policiais:`);
      policiais.forEach((p) => {
        console.log(`    - ${p.nome} (${p.matricula}) - ID: ${p.id} - Equipe: ${p.equipe}`);
      });
    }
    
    // Verificar policiais sem equipe
    const semEquipe = await prisma.policial.count({
      where: {
        equipe: null,
        status: 'ATIVO',
      },
    });
    
    console.log(`\nPoliciais sem equipe: ${semEquipe}`);
    
    // Verificar o policial específico mencionado nos afastamentos
    const policialFranca = await prisma.policial.findFirst({
      where: {
        matricula: '219045',
      },
      select: {
        id: true,
        nome: true,
        matricula: true,
        equipe: true,
        status: true,
      },
    });
    
    if (policialFranca) {
      console.log(`\n=== Policial A. FRANCA (219045) ===`);
      console.log(`ID: ${policialFranca.id}`);
      console.log(`Nome: ${policialFranca.nome}`);
      console.log(`Matrícula: ${policialFranca.matricula}`);
      console.log(`Equipe Atual: ${policialFranca.equipe || 'NULL'}`);
      console.log(`Status: ${policialFranca.status}`);
    } else {
      console.log(`\nPolicial com matrícula 219045 não encontrado!`);
    }
    
    // Verificar afastamentos do mês atual
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth();
    const primeiroDia = new Date(year, month, 1);
    const ultimoDia = new Date(year, month + 1, 0);
    ultimoDia.setHours(23, 59, 59, 999);
    
    const afastamentos = await prisma.afastamento.findMany({
      where: {
        status: 'ATIVO',
        AND: [
          {
            OR: [
              { dataFim: null },
              { dataFim: { gte: primeiroDia } },
            ],
          },
          {
            dataInicio: { lte: ultimoDia },
          },
        ],
      },
      include: {
        policial: {
          select: {
            id: true,
            nome: true,
            matricula: true,
            equipe: true,
          },
        },
        motivo: {
          select: {
            id: true,
            nome: true,
          },
        },
      },
    });
    
    console.log(`\n=== Afastamentos do mês (${month + 1}/${year}) ===`);
    console.log(`Total de afastamentos: ${afastamentos.length}`);
    
    const afastadosPorEquipe = {};
    afastamentos.forEach((af) => {
      const equipe = af.policial.equipe || 'SEM_EQUIPE';
      if (!afastadosPorEquipe[equipe]) {
        afastadosPorEquipe[equipe] = [];
      }
      afastadosPorEquipe[equipe].push({
        id: af.policial.id,
        nome: af.policial.nome,
        matricula: af.policial.matricula,
        motivo: af.motivo.nome,
      });
    });
    
    console.log('\nAfastados por equipe:');
    Object.entries(afastadosPorEquipe).forEach(([equipe, policiais]) => {
      console.log(`\n${equipe}:`);
      policiais.forEach((p) => {
        console.log(`  - ${p.nome} (${p.matricula}) - ${p.motivo}`);
      });
    });
    
  } catch (error) {
    console.error('Erro:', error);
  } finally {
    await prisma.$disconnect();
  }
}

checkEquipes();
