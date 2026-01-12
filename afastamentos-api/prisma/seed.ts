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

  // Criar motivos de afastamento
  console.log('📋 Criando motivos de afastamento...');
  const motivos = [
    { nome: 'Férias', descricao: 'Período de descanso anual' },
    { nome: 'Abono', descricao: 'Dispensa de serviço remunerada' },
    { nome: 'Dispensa recompensa', descricao: 'Dispensa por mérito' },
    { nome: 'LTSP', descricao: 'Licença para Tratamento de Saúde da Pessoa' },
    { nome: 'Aniversário', descricao: 'Dispensa no dia do aniversário' },
    { nome: 'Prisão', descricao: 'Afastamento por prisão' },
    { nome: 'Licença Casamento', descricao: 'Licença por casamento' },
    { nome: 'Dispensa Luto', descricao: 'Dispensa por falecimento de familiar' },
    { nome: 'Outro', descricao: 'Outros motivos não listados' },
  ];

  for (const motivoData of motivos) {
    await prisma.motivoAfastamento.upsert({
      where: { nome: motivoData.nome },
      update: {},
      create: motivoData,
    });
  }
  console.log('✅ Motivos de afastamento criados/verificados!\n');

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

