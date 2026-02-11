"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
const client_1 = require("@prisma/client");
const pg_1 = require("pg");
const adapter_pg_1 = require("@prisma/adapter-pg");
const dotenv = __importStar(require("dotenv"));
dotenv.config();
const pool = new pg_1.Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new adapter_pg_1.PrismaPg(pool);
const prisma = new client_1.PrismaClient({
    adapter,
    log: ['error'],
});
async function main() {
    console.log('=== Padronizando equipe: SEM_EQUIPE -> NULL ===\n');
    console.log('1. Atualizando policiais com equipe SEM_EQUIPE para NULL...');
    const resultadoPoliciais = await prisma.policial.updateMany({
        where: { equipe: 'SEM_EQUIPE' },
        data: { equipe: null },
    });
    console.log(`   ✅ ${resultadoPoliciais.count} policiais atualizados\n`);
    console.log('2. Alterando constraint da coluna equipe para permitir NULL...');
    try {
        await prisma.$executeRaw `ALTER TABLE "Usuario" ALTER COLUMN equipe DROP NOT NULL`;
        await prisma.$executeRaw `ALTER TABLE "Usuario" ALTER COLUMN equipe DROP DEFAULT`;
        console.log('   ✅ Constraint alterada com sucesso\n');
    }
    catch (error) {
        if (error.message?.includes('does not exist') || error.message?.includes('não existe')) {
            console.log('   ⚠️  Constraint já removida ou não existe\n');
        }
        else {
            throw error;
        }
    }
    console.log('3. Atualizando usuários com equipe SEM_EQUIPE para NULL...');
    const resultadoUsuariosRaw = await prisma.$executeRaw `
    UPDATE "Usuario" 
    SET equipe = NULL 
    WHERE equipe = 'SEM_EQUIPE'
  `;
    console.log(`   ✅ ${resultadoUsuariosRaw} usuários atualizados\n`);
    console.log('3. Verificando resultado...');
    const countPoliciaisSemEquipe = await prisma.policial.count({
        where: { equipe: 'SEM_EQUIPE' },
    });
    const countUsuariosSemEquipe = await prisma.$queryRaw `
    SELECT COUNT(*)::int as count FROM "Usuario" WHERE equipe = 'SEM_EQUIPE'
  `;
    const countPoliciaisNull = await prisma.policial.count({
        where: { equipe: null },
    });
    const countUsuariosNull = await prisma.$queryRaw `
    SELECT COUNT(*)::int as count FROM "Usuario" WHERE equipe IS NULL
  `;
    console.log(`   Policiais com equipe SEM_EQUIPE: ${countPoliciaisSemEquipe}`);
    console.log(`   Policiais com equipe NULL: ${countPoliciaisNull}`);
    console.log(`   Usuários com equipe SEM_EQUIPE: ${Number(countUsuariosSemEquipe[0].count)}`);
    console.log(`   Usuários com equipe NULL: ${Number(countUsuariosNull[0].count)}\n`);
    console.log('✅ Padronização concluída!');
}
main()
    .catch((e) => {
    console.error('Erro:', e);
    process.exit(1);
})
    .finally(async () => {
    await prisma.$disconnect();
});
//# sourceMappingURL=padronizar-equipe-null.js.map