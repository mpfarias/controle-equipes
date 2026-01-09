import { PrismaClient, UsuarioStatus } from '@prisma/client';
import * as bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

export async function ensureInitialUser() {
  try {
    // Garantir que os níveis existam
    const nivelAdmin = await prisma.usuarioNivel.upsert({
      where: { nome: 'ADMINISTRADOR' },
      update: {},
      create: {
        nome: 'ADMINISTRADOR',
        descricao: 'Acesso completo ao sistema',
      },
    });

    // Verificar se já existe um usuário
    const usuarioExistente = await prisma.usuario.findFirst({
      where: {
        matricula: '1966901',
      },
    });

    if (usuarioExistente) {
      return; // Usuário já existe, não precisa criar
    }

    // Criar usuário inicial
    const senhaHash = await bcrypt.hash('admin123', 10);

    await prisma.usuario.create({
      data: {
        nome: 'ADMINISTRADOR',
        matricula: '1966901',
        senhaHash,
        equipe: 'A',
        status: UsuarioStatus.ATIVO,
        isAdmin: true,
        nivelId: nivelAdmin.id,
      },
    });

    console.log('✅ Usuário inicial criado automaticamente!');
    console.log('   Matrícula: 1966901');
    console.log('   Senha: admin123');
    console.log('   ⚠️  Altere a senha após o primeiro login!\n');
  } catch (error) {
    // Silenciosamente ignora erros (usuário pode já existir)
    console.log('ℹ️  Verificação de usuário inicial concluída.\n');
  } finally {
    await prisma.$disconnect();
  }
}

