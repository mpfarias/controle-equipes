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
    console.log('=== Verificando equipes cadastradas ===\n');
    const equipes = await prisma.equipeOption.findMany({
        orderBy: { nome: 'asc' },
    });
    console.log('Equipes cadastradas:');
    equipes.forEach(e => {
        console.log(`  - ${e.nome} (ativo: ${e.ativo})`);
    });
    const semEquipe = await prisma.equipeOption.findFirst({
        where: { nome: 'SEM_EQUIPE' },
    });
    console.log('\nSEM_EQUIPE encontrada:', semEquipe ? `Sim (ativo: ${semEquipe.ativo})` : 'Não');
    const countSemEquipe = await prisma.policial.count({
        where: { equipe: 'SEM_EQUIPE' },
    });
    console.log(`\nTotal de policiais com equipe SEM_EQUIPE: ${countSemEquipe}`);
    const funcaoExpediente = await prisma.funcao.findFirst({
        where: { nome: { contains: 'EXPEDIENTE ADM', mode: 'insensitive' } },
    });
    if (funcaoExpediente) {
        const policiais = await prisma.policial.findMany({
            where: {
                funcaoId: funcaoExpediente.id,
                status: { nome: { not: 'DESATIVADO' } },
            },
            select: { id: true, nome: true, matricula: true, equipe: true },
        });
        console.log(`\nTotal de policiais EXPEDIENTE ADM: ${policiais.length}`);
        const porEquipe = policiais.reduce((acc, p) => {
            const eq = p.equipe || 'NULL';
            acc[eq] = (acc[eq] || 0) + 1;
            return acc;
        }, {});
        console.log('Por equipe:', porEquipe);
        const tresPoliciais = policiais.filter(p => p.matricula === '2150522' ||
            p.matricula === '00159980' ||
            p.matricula === '00213209');
        console.log('\nOs 3 policiais específicos:');
        tresPoliciais.forEach(p => {
            console.log(`  - ${p.nome} (${p.matricula}) - Equipe: ${p.equipe || 'NULL'}`);
        });
    }
}
main()
    .catch((e) => {
    console.error('Erro:', e);
    process.exit(1);
})
    .finally(async () => {
    await prisma.$disconnect();
});
//# sourceMappingURL=verificar-equipes.js.map