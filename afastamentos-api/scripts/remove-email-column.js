"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const client_1 = require("@prisma/client");
const prisma = new client_1.PrismaClient();
async function main() {
    console.log('Removendo coluna email da tabela Usuario...');
    await prisma.$executeRawUnsafe(`
    ALTER TABLE Usuario DROP COLUMN email;
  `);
    console.log('Coluna email removida com sucesso!');
}
main()
    .catch((e) => {
    console.error('Erro ao remover coluna email:', e);
    process.exit(1);
})
    .finally(async () => {
    await prisma.$disconnect();
});
//# sourceMappingURL=remove-email-column.js.map