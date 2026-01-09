import { PrismaClient, UsuarioStatus } from '@prisma/client';
import * as bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Iniciando seed do banco de dados...\n');

  // Criar níveis de usuário
  console.log('📋 Criando níveis de usuário...');
  const nivelAdministrador = await prisma.usuarioNivel.upsert({
    where: { nome: 'ADMINISTRADOR' },
    update: {},
    create: {
      nome: 'ADMINISTRADOR',
      descricao: 'Acesso completo ao sistema',
    },
  });

  const nivelGestor = await prisma.usuarioNivel.upsert({
    where: { nome: 'GESTOR' },
    update: {},
    create: {
      nome: 'GESTOR',
      descricao: 'Acesso para gestão de dados',
    },
  });

  const nivelConsultas = await prisma.usuarioNivel.upsert({
    where: { nome: 'CONSULTAS' },
    update: {},
    create: {
      nome: 'CONSULTAS',
      descricao: 'Acesso apenas para consultas',
    },
  });

  console.log('✅ Níveis de usuário criados/verificados!\n');

  // Criar funções
  console.log('📋 Criando funções...');
  const funcoes = [
    { nome: 'Oficial de Operações', descricao: null },
    { nome: 'Atendente', descricao: null },
    { nome: 'Despachante', descricao: null },
    { nome: 'Supervisor de Atendimento', descricao: null },
    { nome: 'Copom Mulher', descricao: null },
    { nome: 'Adjunto do Oficial de Operações', descricao: null },
  ];

  for (const funcaoData of funcoes) {
    await prisma.funcao.upsert({
      where: { nome: funcaoData.nome },
      update: {},
      create: funcaoData,
    });
  }
  console.log('✅ Funções criadas/verificadas!\n');

  // Verificar se já existe um usuário
  const usuarioExistente = await prisma.usuario.findFirst({
    where: {
      matricula: '1966901',
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
      matricula: '1966901',
      senhaHash,
      equipe: 'A',
      status: UsuarioStatus.ATIVO,
      isAdmin: true,
      nivelId: nivelAdministrador.id,
    },
  });

  console.log('✅ Usuário inicial criado com sucesso!\n');
  console.log('📋 Dados do usuário:');
  console.log(`   Nome: ${usuario.nome}`);
  console.log(`   Matrícula: ${usuario.matricula}`);
  console.log(`   Equipe: ${usuario.equipe}`);
  console.log(`   Status: ${usuario.status}\n`);
  console.log('🔑 Credenciais para login:');
  console.log('   Matrícula: 1966901');
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

