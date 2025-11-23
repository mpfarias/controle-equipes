import { PrismaClient, UsuarioStatus } from '@prisma/client';
import * as bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

export async function ensureInitialUser() {
  try {
    // Verificar se já existe um usuário
    const usuarioExistente = await prisma.usuario.findFirst({
      where: {
        matricula: 'ADMIN',
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
        matricula: 'ADMIN',
        senhaHash,
        equipe: 'A',
        status: UsuarioStatus.ATIVO,
      },
    });

    console.log('✅ Usuário inicial criado automaticamente!');
    console.log('   Matrícula: ADMIN');
    console.log('   Senha: admin123');
    console.log('   ⚠️  Altere a senha após o primeiro login!\n');
  } catch (error) {
    // Silenciosamente ignora erros (usuário pode já existir)
    console.log('ℹ️  Verificação de usuário inicial concluída.\n');
  } finally {
    await prisma.$disconnect();
  }
}

