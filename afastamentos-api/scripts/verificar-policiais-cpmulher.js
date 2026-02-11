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
const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
    console.error('⚠️  DATABASE_URL não está definida. Verifique o arquivo .env');
    throw new Error('DATABASE_URL não está definida');
}
const pool = new pg_1.Pool({ connectionString: databaseUrl });
const adapter = new adapter_pg_1.PrismaPg(pool);
const prisma = new client_1.PrismaClient({
    adapter,
    log: ['error'],
});
async function main() {
    console.log('=== VERIFICAÇÃO: Por que Cpmulher vê apenas 3 policiais ===\n');
    console.log('1. Informações do usuário Cpmulher:');
    console.log('─'.repeat(80));
    const usuario = await prisma.usuario.findFirst({
        where: {
            OR: [
                { nome: { contains: 'cpmulher', mode: 'insensitive' } },
                { matricula: { contains: '1966905' } },
            ],
        },
        include: {
            nivel: true,
            funcao: true,
        },
    });
    if (usuario) {
        console.log(`ID: ${usuario.id}`);
        console.log(`Nome: ${usuario.nome}`);
        console.log(`Matrícula: ${usuario.matricula}`);
        console.log(`Equipe: ${usuario.equipe}`);
        console.log(`Nível: ${usuario.nivel?.nome || 'N/A'}`);
        console.log(`Função: ${usuario.funcao?.nome || 'N/A'}`);
        console.log(`Status: ${usuario.status}`);
    }
    else {
        console.log('Usuário não encontrado!');
    }
    console.log('\n');
    console.log('2. Os 3 policiais específicos:');
    console.log('─'.repeat(80));
    const policiais = await prisma.policial.findMany({
        where: {
            OR: [
                { matricula: '2150522' },
                { matricula: '00159980' },
                { matricula: '00213209' },
                { nome: { contains: 'HENRIQUE TORRES', mode: 'insensitive' } },
                { nome: { contains: 'MASSILON', mode: 'insensitive' } },
                { nome: { contains: 'LUCIANO GOMES', mode: 'insensitive' } },
            ],
        },
        include: {
            status: true,
            funcao: true,
        },
        orderBy: { nome: 'asc' },
    });
    if (policiais.length > 0) {
        policiais.forEach((p) => {
            console.log(`\nNome: ${p.nome}`);
            console.log(`Matrícula: ${p.matricula}`);
            console.log(`Equipe: ${p.equipe || 'N/A'}`);
            console.log(`Status: ${p.status?.nome || 'N/A'}`);
            console.log(`Função: ${p.funcao?.nome || 'N/A'}`);
        });
    }
    else {
        console.log('Nenhum policial encontrado!');
    }
    console.log('\n');
    console.log('3. Análise do que têm em comum:');
    console.log('─'.repeat(80));
    if (policiais.length > 0 && usuario) {
        const equipes = [...new Set(policiais.map((p) => p.equipe).filter(Boolean))];
        const funcoes = [...new Set(policiais.map((p) => p.funcao?.nome).filter(Boolean))];
        const status = [...new Set(policiais.map((p) => p.status?.nome).filter(Boolean))];
        console.log(`Equipes dos policiais: ${equipes.join(', ') || 'N/A'}`);
        console.log(`Equipe do usuário: ${usuario.equipe}`);
        console.log(`Funções dos policiais: ${funcoes.join(', ') || 'N/A'}`);
        console.log(`Função do usuário: ${usuario.funcao?.nome || 'N/A'}`);
        console.log(`Status dos policiais: ${status.join(', ') || 'N/A'}`);
        console.log('\n✅ CONCLUSÃO:');
        if (equipes.length === 1 && equipes[0] === usuario.equipe) {
            console.log(`   - Todos os 3 policiais estão na mesma equipe do usuário: ${equipes[0]}`);
        }
        if (funcoes.length === 1) {
            console.log(`   - Todos os 3 policiais têm a mesma função: ${funcoes[0]}`);
        }
    }
    console.log('\n');
    console.log('4. Policiais com função "EXPEDIENTE ADM" por equipe:');
    console.log('─'.repeat(80));
    const funcaoExpediente = await prisma.funcao.findFirst({
        where: {
            nome: { contains: 'EXPEDIENTE ADM', mode: 'insensitive' },
        },
    });
    if (funcaoExpediente) {
        const policiaisExpediente = await prisma.policial.findMany({
            where: {
                funcaoId: funcaoExpediente.id,
                status: {
                    nome: { not: 'DESATIVADO' },
                },
            },
            include: {
                status: true,
                funcao: true,
            },
            orderBy: [{ equipe: 'asc' }, { nome: 'asc' }],
        });
        const porEquipe = policiaisExpediente.reduce((acc, p) => {
            const equipe = p.equipe || 'SEM_EQUIPE';
            if (!acc[equipe]) {
                acc[equipe] = [];
            }
            acc[equipe].push(p);
            return acc;
        }, {});
        Object.entries(porEquipe).forEach(([equipe, lista]) => {
            console.log(`\nEquipe ${equipe}: ${lista.length} policiais`);
            lista.forEach((p) => {
                console.log(`  - ${p.nome} (${p.matricula}) - Status: ${p.status?.nome}`);
            });
        });
    }
    else {
        console.log('Função "EXPEDIENTE ADM" não encontrada!');
    }
    console.log('\n');
    if (usuario?.equipe) {
        console.log(`5. Todos os policiais da equipe ${usuario.equipe} (equipe do usuário):`);
        console.log('─'.repeat(80));
        const todosPoliciaisEquipe = await prisma.policial.findMany({
            where: {
                equipe: usuario.equipe,
                status: {
                    nome: { not: 'DESATIVADO' },
                },
            },
            include: {
                status: true,
                funcao: true,
            },
            orderBy: { nome: 'asc' },
        });
        console.log(`Total: ${todosPoliciaisEquipe.length} policiais\n`);
        todosPoliciaisEquipe.forEach((p) => {
            console.log(`  - ${p.nome} (${p.matricula}) - Função: ${p.funcao?.nome || 'N/A'} - Status: ${p.status?.nome}`);
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
//# sourceMappingURL=verificar-policiais-cpmulher.js.map