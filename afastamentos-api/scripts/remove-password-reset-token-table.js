"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const client_1 = require("@prisma/client");
const prisma = new client_1.PrismaClient();
async function main() {
    console.log('Removendo tabela PasswordResetToken...');
    await prisma.$executeRawUnsafe(`
    DROP TABLE IF EXISTS PasswordResetToken;
  `);
    console.log('Tabela PasswordResetToken removida com sucesso!');
}
main()
    .catch((e) => {
    console.error('Erro ao remover tabela PasswordResetToken:', e);
    process.exit(1);
})
    .finally(async () => {
    await prisma.$disconnect();
});
//# sourceMappingURL=remove-password-reset-token-table.js.map