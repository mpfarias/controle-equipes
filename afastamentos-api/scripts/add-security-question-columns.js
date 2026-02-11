"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const client_1 = require("@prisma/client");
const prisma = new client_1.PrismaClient();
async function main() {
    try {
        console.log('Adicionando colunas de pergunta de segurança à tabela Usuario...');
        await prisma.$executeRawUnsafe(`
      ALTER TABLE Usuario 
      ADD COLUMN IF NOT EXISTS perguntaSeguranca VARCHAR(200) NULL
    `).catch(() => {
            return prisma.$executeRawUnsafe(`
        ALTER TABLE Usuario 
        ADD COLUMN perguntaSeguranca VARCHAR(200) NULL
      `);
        });
        await prisma.$executeRawUnsafe(`
      ALTER TABLE Usuario 
      ADD COLUMN IF NOT EXISTS respostaSegurancaHash VARCHAR(255) NULL
    `).catch(() => {
            return prisma.$executeRawUnsafe(`
        ALTER TABLE Usuario 
        ADD COLUMN respostaSegurancaHash VARCHAR(255) NULL
      `);
        });
        console.log('✅ Colunas de pergunta de segurança adicionadas com sucesso!');
    }
    catch (error) {
        if (error instanceof Error && error.message.includes('Duplicate column name')) {
            console.log('ℹ️ Colunas já existem no banco de dados.');
        }
        else {
            console.error('❌ Erro ao adicionar colunas:', error);
            throw error;
        }
    }
    finally {
        await prisma.$disconnect();
    }
}
main()
    .catch((error) => {
    console.error(error);
    process.exit(1);
});
//# sourceMappingURL=add-security-question-columns.js.map