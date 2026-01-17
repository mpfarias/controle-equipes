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

  const nivelSad = await prisma.usuarioNivel.upsert({
    where: { nome: 'SAD' },
    update: {},
    create: {
      nome: 'SAD',
      descricao: 'Acesso ao Sistema de Apoio à Decisão',
    },
  });

  const nivelComando = await prisma.usuarioNivel.upsert({
    where: { nome: 'COMANDO' },
    update: {},
    create: {
      nome: 'COMANDO',
      descricao: 'Acesso de comando',
    },
  });

  const nivelOperacoes = await prisma.usuarioNivel.upsert({
    where: { nome: 'OPERAÇÕES' },
    update: {},
    create: {
      nome: 'OPERAÇÕES',
      descricao: 'Acesso de operações',
    },
  });

  console.log('✅ Níveis de usuário criados/verificados!\n');

  // Criar funções (apenas funções em UPPERCASE)
  console.log('📋 Criando funções...');
  // Nota: Funções em lowercase foram removidas. Apenas funções em UPPERCASE são mantidas.
  // As funções são criadas dinamicamente durante o processamento de arquivos ou manualmente no banco.
  console.log('✅ Funções verificadas (funções em UPPERCASE são mantidas).\n');

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
    { nome: 'Licença Maternidade', descricao: 'Licença para mãe após o nascimento do filho' },
    { nome: 'Licença Paternidade', descricao: 'Licença para pai após o nascimento do filho' },
    { nome: 'LTSPF', descricao: 'Licença para Tratamento de Saúde da Pessoa Dependente' },
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

  // Criar restrições médicas
  console.log('📋 Criando restrições médicas...');
  const restricoes = [
    { nome: 'Restrição médica' },
    { nome: 'Porte de arma suspenso' },
  ];

  for (const restricaoData of restricoes) {
    await prisma.restricaoMedica.upsert({
      where: { nome: restricaoData.nome },
      update: {},
      create: restricaoData,
    });
  }
  console.log('✅ Restrições médicas criadas/verificadas!\n');

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

