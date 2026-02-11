"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const client_1 = require("@prisma/client");
const prisma = new client_1.PrismaClient();
async function main() {
    try {
        console.log('Adicionando coluna email à tabela Usuario...');
        await prisma.$executeRawUnsafe(`
      ALTER TABLE Usuario 
      ADD COLUMN IF NOT EXISTS email VARCHAR(255) NULL
    `);
        console.log('✅ Coluna email adicionada com sucesso!');
    }
    catch (error) {
        try {
            await prisma.$executeRawUnsafe(`
        ALTER TABLE Usuario 
        ADD COLUMN email VARCHAR(255) NULL
      `);
            console.log('✅ Coluna email adicionada com sucesso!');
        }
        catch (err) {
            if (err instanceof Error && err.message.includes('Duplicate column name')) {
                console.log('ℹ️ Coluna email já existe no banco de dados.');
            }
            else {
                console.error('❌ Erro ao adicionar coluna:', err);
                throw err;
            }
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
//# sourceMappingURL=add-email-column.js.map