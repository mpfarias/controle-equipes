import { PrismaClient, UsuarioStatus } from '@prisma/client';
import * as bcrypt from 'bcryptjs';
import { config } from 'dotenv';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';
import { buildPgPoolConfig } from './pg-pool-config';

config();

const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  throw new Error('DATABASE_URL não está definida');
}

const pool = new Pool(buildPgPoolConfig(databaseUrl));
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

export async function ensureInitialUser() {
  try {
    const nivelAdmin = await prisma.usuarioNivel.upsert({
      where: { nome: 'ADMINISTRADOR' },
      update: {},
      create: {
        nome: 'ADMINISTRADOR',
        descricao: 'Acesso completo ao sistema',
      },
    });

    const adminMatricula = process.env.ADMIN_MATRICULA || '1966901';
    const adminSenha = process.env.ADMIN_SENHA || 'admin123';

    const usuarioExistente = await prisma.usuario.findFirst({
      where: { matricula: adminMatricula },
    });

    if (usuarioExistente) return;

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

    console.log('✅ Usuário inicial criado');
  } catch (error) {
    console.log('ℹ️ Usuário inicial já existe ou erro ignorado');
  } finally {
    await prisma.$disconnect();
  }
}