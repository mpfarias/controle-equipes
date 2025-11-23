import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  try {
    console.log('Criando tabela PasswordResetToken...');
    
    // Verificar se a tabela já existe
    const tables = await prisma.$queryRaw<Array<{ TABLE_NAME: string }>>`
      SELECT TABLE_NAME 
      FROM information_schema.TABLES 
      WHERE TABLE_SCHEMA = DATABASE() 
      AND TABLE_NAME = 'PasswordResetToken'
    `;
    
    if (tables.length > 0) {
      console.log('ℹ️ Tabela PasswordResetToken já existe no banco de dados.');
      return;
    }
    
    // Criar a tabela
    await prisma.$executeRawUnsafe(`
      CREATE TABLE PasswordResetToken (
        id INT AUTO_INCREMENT PRIMARY KEY,
        token VARCHAR(255) UNIQUE NOT NULL,
        usuarioId INT NOT NULL,
        expiresAt DATETIME NOT NULL,
        used BOOLEAN DEFAULT FALSE,
        createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (usuarioId) REFERENCES Usuario(id) ON DELETE CASCADE
      )
    `);
    
    console.log('✅ Tabela PasswordResetToken criada com sucesso!');
  } catch (error) {
    if (error instanceof Error) {
      if (error.message.includes('already exists') || error.message.includes('Duplicate')) {
        console.log('ℹ️ Tabela PasswordResetToken já existe no banco de dados.');
      } else {
        console.error('❌ Erro ao criar tabela:', error.message);
        throw error;
      }
    } else {
      console.error('❌ Erro ao criar tabela:', error);
      throw error;
    }
  } finally {
    await prisma.$disconnect();
  }
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });

