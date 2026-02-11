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
require("dotenv/config");
const client_1 = require("@prisma/client");
const pg_1 = require("pg");
const adapter_pg_1 = require("@prisma/adapter-pg");
const bcrypt = __importStar(require("bcryptjs"));
const pool = new pg_1.Pool({ connectionString: process.env.DATABASE_URL });
const prisma = new client_1.PrismaClient({
    adapter: new adapter_pg_1.PrismaPg(pool),
});
async function main() {
    console.log('🌱 Iniciando seed do banco de dados...\n');
    console.log('📋 Criando níveis de usuário...');
    const nivelAdministrador = await prisma.usuarioNivel.upsert({
        where: { nome: 'ADMINISTRADOR' },
        update: {},
        create: {
            nome: 'ADMINISTRADOR',
            descricao: 'Acesso completo ao sistema',
        },
    });
    const nivelSad = await prisma.usuarioNivel.upsert({
        where: { nome: 'SAD' },
        update: {},
        create: {
            nome: 'SAD',
            descricao: 'Acesso ao Sistema de Apoio à Decisão',
        },
    });
    const nivelComando = await prisma.usuarioNivel.upsert({
        where: { nome: 'COMANDO' },
        update: {},
        create: {
            nome: 'COMANDO',
            descricao: 'Acesso de comando',
        },
    });
    const nivelOperacoes = await prisma.usuarioNivel.upsert({
        where: { nome: 'OPERAÇÕES' },
        update: {},
        create: {
            nome: 'OPERAÇÕES',
            descricao: 'Acesso de operações',
        },
    });
    console.log('✅ Níveis de usuário criados/verificados!\n');
    console.log('📋 Criando equipes padrão...');
    const equipes = [
        { nome: 'A', descricao: 'Equipe A' },
        { nome: 'B', descricao: 'Equipe B' },
        { nome: 'C', descricao: 'Equipe C' },
        { nome: 'D', descricao: 'Equipe D' },
        { nome: 'E', descricao: 'Equipe E' },
        { nome: 'SEM_EQUIPE', descricao: 'Sem Equipe' },
    ];
    for (const equipeData of equipes) {
        await prisma.equipeOption.upsert({
            where: { nome: equipeData.nome },
            update: { descricao: equipeData.descricao },
            create: equipeData,
        });
    }
    console.log('✅ Equipes padrão criadas/verificadas!\n');
    console.log('📋 Criando perguntas de segurança...');
    const perguntas = [
        'Qual o nome da sua mãe?',
        'Qual o nome do seu pai?',
        'Qual o nome do seu primeiro animal de estimação?',
        'Qual o nome da cidade onde você nasceu?',
        'Qual o nome da sua escola primária?',
        'Qual o nome do seu melhor amigo de infância?',
        'Qual o nome do seu primeiro professor?',
        'Qual o apelido que você tinha na infância?',
        'Qual o nome da sua primeira rua?',
        'Qual o nome do seu primeiro emprego?',
    ];
    for (const texto of perguntas) {
        await prisma.perguntaSeguranca.upsert({
            where: { texto },
            update: {},
            create: { texto },
        });
    }
    console.log('✅ Perguntas de segurança criadas/verificadas!\n');
    console.log('📋 Criando funções...');
    console.log('✅ Funções verificadas (funções em UPPERCASE são mantidas).\n');
    console.log('📋 Criando motivos de afastamento...');
    const motivos = [
        { nome: 'Férias', descricao: 'Período de descanso anual' },
        { nome: 'Abono', descricao: 'Dispensa de serviço remunerada' },
        { nome: 'Dispensa recompensa', descricao: 'Dispensa por mérito' },
        { nome: 'LTSP', descricao: 'Licença para Tratamento de Saúde da Pessoa' },
        { nome: 'Aniversário', descricao: 'Dispensa no dia do aniversário' },
        { nome: 'Prisão', descricao: 'Afastamento por prisão' },
        { nome: 'Licença Casamento', descricao: 'Licença por casamento' },
        { nome: 'Dispensa Luto', descricao: 'Dispensa por falecimento de familiar' },
        { nome: 'Licença Maternidade', descricao: 'Licença para mãe após o nascimento do filho' },
        { nome: 'Licença Paternidade', descricao: 'Licença para pai após o nascimento do filho' },
        { nome: 'LTSPF', descricao: 'Licença para Tratamento de Saúde da Pessoa Dependente' },
        { nome: 'Outro', descricao: 'Outros motivos não listados' },
    ];
    for (const motivoData of motivos) {
        await prisma.motivoAfastamento.upsert({
            where: { nome: motivoData.nome },
            update: {},
            create: motivoData,
        });
    }
    console.log('✅ Motivos de afastamento criados/verificados!\n');
    console.log('📋 Criando restrições médicas...');
    const restricoes = [
        { nome: 'Restrição médica' },
        { nome: 'Porte de arma suspenso' },
    ];
    for (const restricaoData of restricoes) {
        await prisma.restricaoMedica.upsert({
            where: { nome: restricaoData.nome },
            update: {},
            create: restricaoData,
        });
    }
    console.log('✅ Restrições médicas criadas/verificadas!\n');
    const usuarioExistente = await prisma.usuario.findFirst({
        where: {
            matricula: '1966901',
        },
    });
    if (usuarioExistente) {
        console.log('✅ Usuário inicial já existe no banco de dados.');
        console.log(`   Matrícula: ${usuarioExistente.matricula}`);
        console.log(`   Nome: ${usuarioExistente.nome}\n`);
        return;
    }
    const senhaHash = await bcrypt.hash('admin123', 10);
    const usuario = await prisma.usuario.create({
        data: {
            nome: 'ADMINISTRADOR',
            matricula: '1966901',
            senhaHash,
            equipe: 'A',
            status: client_1.UsuarioStatus.ATIVO,
            isAdmin: true,
            nivelId: nivelAdministrador.id,
        },
    });
    console.log('✅ Usuário inicial criado com sucesso!\n');
    console.log('📋 Dados do usuário:');
    console.log(`   Nome: ${usuario.nome}`);
    console.log(`   Matrícula: ${usuario.matricula}`);
    console.log(`   Equipe: ${usuario.equipe}`);
    console.log(`   Status: ${usuario.status}\n`);
    console.log('🔑 Credenciais para login:');
    console.log('   Matrícula: 1966901');
    console.log('   Senha: admin123\n');
    console.log('⚠️  IMPORTANTE: Altere a senha após o primeiro login!\n');
}
main()
    .catch((e) => {
    console.error('❌ Erro ao executar seed:', e);
    process.exit(1);
})
    .finally(async () => {
    await prisma.$disconnect();
});
//# sourceMappingURL=seed.js.map