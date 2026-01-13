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

