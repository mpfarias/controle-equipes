import 'dotenv/config';
import { PrismaClient, UsuarioStatus } from '@prisma/client';
import { Pool } from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';
import * as bcrypt from 'bcryptjs';
import { buildPgPoolConfig } from '../src/pg-pool-config';

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  throw new Error('DATABASE_URL não está definida. Verifique o arquivo .env');
}

const poolConfig = buildPgPoolConfig(databaseUrl);
if (!poolConfig.ssl) {
  console.warn(
    '⚠️  Postgres TLS: modo estrito (padrão). Se falhar com "self-signed certificate", defina no pod/secret: DATABASE_SSL_REJECT_UNAUTHORIZED=false ou DATABASE_PG_TLS_INSECURE=true\n',
  );
}

const pool = new Pool(poolConfig);
const prisma = new PrismaClient({
  adapter: new PrismaPg(pool),
});

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

  // Criar equipes padrão
  console.log('📋 Criando equipes padrão...');
  const equipes = [
    { nome: 'A', descricao: 'Equipe A' },
    { nome: 'B', descricao: 'Equipe B' },
    { nome: 'C', descricao: 'Equipe C' },
    { nome: 'D', descricao: 'Equipe D' },
    { nome: 'E', descricao: 'Equipe E' },
    { nome: 'SEM_EQUIPE', descricao: 'Sem Equipe' },
  ];
  for (const equipeData of equipes) {
    await prisma.equipeOption.upsert({
      where: { nome: equipeData.nome },
      update: { descricao: equipeData.descricao },
      create: equipeData,
    });
  }
  console.log('✅ Equipes padrão criadas/verificadas!\n');

  // Criar perguntas de segurança
  console.log('📋 Criando perguntas de segurança...');
  const perguntas = [
    'Qual o nome da sua mãe?',
    'Qual o nome do seu pai?',
    'Qual o nome do seu primeiro animal de estimação?',
    'Qual o nome da cidade onde você nasceu?',
    'Qual o nome da sua escola primária?',
    'Qual o nome do seu melhor amigo de infância?',
    'Qual o nome do seu primeiro professor?',
    'Qual o apelido que você tinha na infância?',
    'Qual o nome da sua primeira rua?',
    'Qual o nome do seu primeiro emprego?',
  ];
  for (const texto of perguntas) {
    await prisma.perguntaSeguranca.upsert({
      where: { texto },
      update: {},
      create: { texto },
    });
  }
  console.log('✅ Perguntas de segurança criadas/verificadas!\n');

  // Criar funções (apenas funções em UPPERCASE)
  console.log('📋 Criando funções...');
  // Nota: Funções em lowercase foram removidas. Apenas funções em UPPERCASE são mantidas.
  // As funções são criadas dinamicamente durante o processamento de arquivos ou manualmente no banco.
  console.log('✅ Funções verificadas (funções em UPPERCASE são mantidas).\n');

  // Criar motivos de afastamento
  console.log('📋 Criando motivos de afastamento...');
  // Renomear LTSP para Dispensa Médica se existir (não criar nova opção)
  const ltspExistente = await prisma.motivoAfastamento.findUnique({ where: { nome: 'LTSP' } });
  if (ltspExistente) {
    await prisma.motivoAfastamento.update({
      where: { id: ltspExistente.id },
      data: { nome: 'Dispensa Médica', descricao: 'Licença para Tratamento de Saúde da Pessoa' },
    });
  }
  const motivos = [
    { nome: 'Férias', descricao: 'Período de descanso anual' },
    { nome: 'Abono', descricao: 'Dispensa de serviço remunerada' },
    { nome: 'Dispensa recompensa', descricao: 'Dispensa por mérito' },
    { nome: 'Dispensa Médica', descricao: 'Licença para Tratamento de Saúde da Pessoa' },
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
      sistemasPermitidos: ['SAD'],
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

