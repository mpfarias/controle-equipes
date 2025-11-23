import { PrismaClient, UsuarioStatus } from '@prisma/client';
import * as bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('Criando usuário administrador...');
  
  // Você pode alterar estes valores conforme necessário
  const adminMatricula = 'ADMIN';
  const adminNome = 'Administrador';
  const adminSenha = process.env.ADMIN_PASSWORD || 'admin123'; // Altere esta senha!
  
  // Verificar se já existe um admin
  const existingAdmin = await prisma.usuario.findFirst({
    where: { isAdmin: true },
  });
  
  if (existingAdmin) {
    console.log('Já existe um usuário administrador no sistema.');
    console.log(`Matrícula: ${existingAdmin.matricula}`);
    console.log('Para alterar a senha do administrador, use o script update-admin-password.ts');
    return;
  }
  
  // Verificar se a matrícula já existe
  const existingUser = await prisma.usuario.findUnique({
    where: { matricula: adminMatricula },
  });
  
  if (existingUser) {
    console.log(`A matrícula ${adminMatricula} já está em uso.`);
    console.log('Para tornar este usuário administrador, atualize-o manualmente no banco de dados.');
    return;
  }
  
  // Gerar hash da senha
  const senhaHash = await bcrypt.hash(adminSenha, 10);
  
  // Criar usuário administrador
  const admin = await prisma.usuario.create({
    data: {
      nome: adminNome,
      matricula: adminMatricula,
      senhaHash,
      equipe: 'A',
      status: UsuarioStatus.ATIVO,
      isAdmin: true,
    },
  });
  
  console.log('Usuário administrador criado com sucesso!');
  console.log(`ID: ${admin.id}`);
  console.log(`Nome: ${admin.nome}`);
  console.log(`Matrícula: ${admin.matricula}`);
  console.log(`Senha inicial: ${adminSenha}`);
  console.log('\n⚠️  IMPORTANTE: Altere a senha padrão após o primeiro login!');
}

main()
  .catch((e) => {
    console.error('Erro ao criar usuário administrador:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

