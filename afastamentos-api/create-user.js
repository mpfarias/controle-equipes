const bcrypt = require('bcryptjs');
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function createUser() {
  try {
    // Solicitar dados do usuário
    const nome = process.argv[2] || 'ADMINISTRADOR';
    const matricula = process.argv[3] || 'admin';
    const senha = process.argv[4] || 'admin123';
    const equipe = (process.argv[5] || 'A').toUpperCase();

    // Validar equipe
    const equipesValidas = ['A', 'B', 'C', 'D', 'E'];
    if (!equipesValidas.includes(equipe)) {
      console.error('❌ Erro: Equipe inválida! Use: A, B, C, D ou E');
      process.exit(1);
    }

    // Gerar hash da senha
    const senhaHash = await bcrypt.hash(senha, 10);

    // Criar usuário
    const usuario = await prisma.usuario.create({
      data: {
        nome: nome.toUpperCase(),
        matricula: matricula.toUpperCase(),
        senhaHash,
        equipe: equipe,
        status: 'ATIVO',
      },
    });

    console.log('\n✅ Usuário criado com sucesso!\n');
    console.log('📋 Dados do usuário:');
    console.log(`   Nome: ${usuario.nome}`);
    console.log(`   Matrícula: ${usuario.matricula}`);
    console.log(`   Equipe: ${usuario.equipe}`);
    console.log(`   Status: ${usuario.status}\n`);
    console.log('🔑 Credenciais para login:');
    console.log(`   Matrícula: ${usuario.matricula}`);
    console.log(`   Senha: ${senha}`);
    console.log('\n⚠️  ANOTE A SENHA! Ela não será exibida novamente.\n');
  } catch (error) {
    if (error.code === 'P2002') {
      console.error('❌ Erro: Matrícula já cadastrada!');
      console.error('   Tente usar uma matrícula diferente.\n');
    } else {
      console.error('❌ Erro ao criar usuário:', error.message);
      if (error.message.includes('connect')) {
        console.error('\n💡 Dica: Verifique se o banco de dados está rodando!');
        console.error('   - Docker: docker-compose up -d');
        console.error('   - MySQL: Verifique se o serviço está iniciado\n');
      }
    }
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

// Verificar se o Prisma Client foi gerado
try {
  createUser();
} catch (error) {
  if (error.message.includes('PrismaClient')) {
    console.error('❌ Erro: Prisma Client não foi gerado!');
    console.error('   Execute: npx prisma generate\n');
  } else {
    console.error('❌ Erro:', error.message);
  }
  process.exit(1);
}

