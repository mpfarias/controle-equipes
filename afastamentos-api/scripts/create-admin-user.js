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
const bcrypt = __importStar(require("bcryptjs"));
const prisma = new client_1.PrismaClient();
async function main() {
    console.log('Criando usuário administrador...');
    const adminMatricula = 'ADMIN';
    const adminNome = 'Administrador';
    const adminSenha = process.env.ADMIN_PASSWORD || 'admin123';
    const existingAdmin = await prisma.usuario.findFirst({
        where: { isAdmin: true },
    });
    if (existingAdmin) {
        console.log('Já existe um usuário administrador no sistema.');
        console.log(`Matrícula: ${existingAdmin.matricula}`);
        console.log('Para alterar a senha do administrador, use o script update-admin-password.ts');
        return;
    }
    const existingUser = await prisma.usuario.findUnique({
        where: { matricula: adminMatricula },
    });
    if (existingUser) {
        console.log(`A matrícula ${adminMatricula} já está em uso.`);
        console.log('Para tornar este usuário administrador, atualize-o manualmente no banco de dados.');
        return;
    }
    const senhaHash = await bcrypt.hash(adminSenha, 10);
    const admin = await prisma.usuario.create({
        data: {
            nome: adminNome,
            matricula: adminMatricula,
            senhaHash,
            equipe: 'A',
            status: client_1.UsuarioStatus.ATIVO,
            isAdmin: true,
        },
    });
    console.log('Usuário administrador criado com sucesso!');
    console.log(`ID: ${admin.id}`);
    console.log(`Nome: ${admin.nome}`);
    console.log(`Matrícula: ${admin.matricula}`);
    console.log(`Senha inicial: ${adminSenha}`);
    console.log('\n⚠️  IMPORTANTE: Altere a senha padrão após o primeiro login!');
}
main()
    .catch((e) => {
    console.error('Erro ao criar usuário administrador:', e);
    process.exit(1);
})
    .finally(async () => {
    await prisma.$disconnect();
});
//# sourceMappingURL=create-admin-user.js.map