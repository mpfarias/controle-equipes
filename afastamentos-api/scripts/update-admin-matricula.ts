import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('Atualizando matrícula do usuário administrador...');
  
  // Buscar o usuário administrador
  const admin = await prisma.usuario.findFirst({
    where: { isAdmin: true },
  });
  
  if (!admin) {
    console.log('Nenhum usuário administrador encontrado no sistema.');
    return;
  }
  
  // Nova matrícula: 6 dígitos (você pode alterar este número)
  const novaMatricula = process.env.ADMIN_MATRICULA || '999999';
  
  // Verificar se a matrícula já existe (e não é do próprio admin)
  const matriculaExistente = await prisma.usuario.findUnique({
    where: { matricula: novaMatricula },
  });
  
  if (matriculaExistente && matriculaExistente.id !== admin.id) {
    console.log(`A matrícula ${novaMatricula} já está em uso por outro usuário.`);
    console.log('Defina uma matrícula diferente usando a variável de ambiente ADMIN_MATRICULA');
    return;
  }
  
  // Atualizar matrícula do administrador
  await prisma.usuario.update({
    where: { id: admin.id },
    data: { matricula: novaMatricula },
  });
  
  console.log('Matrícula do administrador atualizada com sucesso!');
  console.log(`ID: ${admin.id}`);
  console.log(`Nome: ${admin.nome}`);
  console.log(`Nova Matrícula: ${novaMatricula}`);
  console.log('\n⚠️  Use esta matrícula para fazer login como administrador!');
}

main()
  .catch((e) => {
    console.error('Erro ao atualizar matrícula do administrador:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

