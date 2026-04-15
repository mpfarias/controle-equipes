import { PrismaClient, UsuarioStatus } from '@prisma/client';
import * as bcrypt from 'bcryptjs';
import * as dotenv from 'dotenv';
import { config } from 'dotenv';
import { Pool } from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';
import { buildPgPoolConfig } from './pg-pool-config.js';

// Carregar variáveis de ambiente explicitamente
config();

// Garantir que DATABASE_URL está disponível
const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  console.error('⚠️  DATABASE_URL não está definida. Verifique o arquivo .env');
  throw new Error('DATABASE_URL não está definida');
}

// No Prisma 7, para conexão direta ao PostgreSQL, usamos PrismaPg adapter
const pool = new Pool(buildPgPoolConfig(databaseUrl));
const adapter = new PrismaPg(pool);

const prisma = new PrismaClient({
  adapter,
  log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
});

export async function ensureInitialUser() {
  try {
    const isProduction = process.env.NODE_ENV === 'production';
    if (isProduction && (!process.env.ADMIN_MATRICULA || !process.env.ADMIN_SENHA)) {
      throw new Error(
        'ADMIN_MATRICULA e ADMIN_SENHA devem ser configurados em produção.',
      );
    }

    // Garantir que os níveis existam
    const nivelAdmin = await prisma.usuarioNivel.upsert({
      where: { nome: 'ADMINISTRADOR' },
      update: {},
      create: {
        nome: 'ADMINISTRADOR',
        descricao: 'Acesso completo ao sistema',
      },
    });

    // Obter credenciais do admin inicial de variáveis de ambiente
    const adminMatricula = process.env.ADMIN_MATRICULA || '1966901';
    const adminSenha = process.env.ADMIN_SENHA || 'admin123';

    // Verificar se já existe um usuário com a matrícula configurada
    const usuarioExistente = await prisma.usuario.findFirst({
      where: {
        matricula: adminMatricula,
      },
    });

    if (usuarioExistente) {
      return; // Usuário já existe, não precisa criar
    }

    // Criar usuário inicial
    const senhaHash = await bcrypt.hash(adminSenha, 10);

    await prisma.usuario.create({
      data: {
        nome: 'ADMINISTRADOR',
        matricula: adminMatricula,
        senhaHash,
        equipe: 'A',
        status: UsuarioStatus.ATIVO,
        isAdmin: true,
        nivelId: nivelAdmin.id,
        sistemasPermitidos: ['SAD', 'ORION_QUALIDADE', 'ORION_PATRIMONIO'],
      },
    });

    console.log('✅ Usuário inicial criado automaticamente!');
    console.log(`   Matrícula: ${adminMatricula}`);
    console.log('   ⚠️  Altere a senha após o primeiro login!');
    if (!process.env.ADMIN_SENHA) {
      console.log('   ⚠️  Configure ADMIN_SENHA no .env para produção!\n');
    } else {
      console.log('');
    }
  } catch (error) {
    // Silenciosamente ignora erros (usuário pode já existir)
    console.log('ℹ️  Verificação de usuário inicial concluída.\n');
  } finally {
    await prisma.$disconnect();
  }
}
