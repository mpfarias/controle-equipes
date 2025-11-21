import { PrismaClient, UsuarioStatus } from '@prisma/client';
import * as bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Iniciando seed do banco de dados...\n');

  // Verificar se já existe um usuário
  const usuarioExistente = await prisma.usuario.findFirst({
    where: {
      matricula: 'ADMIN',
    },
  });

  if (usuarioExistente) {
    console.log('✅ Usuário inicial já existe no banco de dados.');
    console.log(`   Matrícula: ${usuarioExistente.matricula}`);
    console.log(`   Nome: ${usuarioExistente.nome}\n`);
    return;
  }

  // Criar usuário inicial
  const senhaHash = await bcrypt.hash('admin123', 10);

  const usuario = await prisma.usuario.create({
    data: {
      nome: 'ADMINISTRADOR',
      matricula: 'ADMIN',
      senhaHash,
      equipe: 'A',
      status: UsuarioStatus.ATIVO,
    },
  });

  console.log('✅ Usuário inicial criado com sucesso!\n');
  console.log('📋 Dados do usuário:');
  console.log(`   Nome: ${usuario.nome}`);
  console.log(`   Matrícula: ${usuario.matricula}`);
  console.log(`   Equipe: ${usuario.equipe}`);
  console.log(`   Status: ${usuario.status}\n`);
  console.log('🔑 Credenciais para login:');
  console.log('   Matrícula: ADMIN');
  console.log('   Senha: admin123\n');
  console.log('⚠️  IMPORTANTE: Altere a senha após o primeiro login!\n');
}

main()
  .catch((e) => {
    console.error('❌ Erro ao executar seed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

