const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  console.log('📋 Verificando usuários no banco de dados...\n');
  
  const usuarios = await prisma.usuario.findMany({
    orderBy: { id: 'asc' },
    select: {
      id: true,
      nome: true,
      matricula: true,
      equipe: true,
      isAdmin: true,
      nivelId: true,
      status: true,
    },
  });

  console.log(`Total de usuários: ${usuarios.length}\n`);
  usuarios.forEach((u) => {
    console.log(`ID: ${u.id}`);
    console.log(`  Nome: ${u.nome}`);
    console.log(`  Matrícula: ${u.matricula}`);
    console.log(`  Equipe: ${u.equipe}`);
    console.log(`  isAdmin: ${u.isAdmin}`);
    console.log(`  nivelId: ${u.nivelId}`);
    console.log(`  Status: ${u.status}`);
    console.log('');
  });

  // Verificar se há duplicatas de matrícula
  const matriculas = usuarios.map((u) => u.matricula);
  const duplicatas = matriculas.filter(
    (mat, index) => matriculas.indexOf(mat) !== index,
  );
  if (duplicatas.length > 0) {
    console.log('⚠️  ATENÇÃO: Matrículas duplicadas encontradas:', duplicatas);
  }

  // Verificar usuários com nome ADMINISTRADOR
  const admins = usuarios.filter((u) =>
    u.nome.toUpperCase().includes('ADMINISTRADOR'),
  );
  if (admins.length > 1) {
    console.log('\n⚠️  ATENÇÃO: Múltiplos usuários com nome ADMINISTRADOR:');
    admins.forEach((u) => {
      console.log(`  - ID: ${u.id}, Matrícula: ${u.matricula}, isAdmin: ${u.isAdmin}`);
    });
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
