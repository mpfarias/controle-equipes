import { PrismaClient, UserRole } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

/** E-mail na base; no login pode escrever só `rafael` (ver rota /api/auth/login). */
const MASTER_EMAIL = "rafael@copom-mulher.df";
const MASTER_SENHA = "123";

async function seedDemoOccurrences() {
  const n = await prisma.occurrence.count();
  if (n > 0) return;

  await prisma.occurrence.createMany({
    data: [
      {
        origem: "SISTEMA",
        faseAtual: 3,
        concluida: true,
        nomeVitima: "Maria Silva (demonstração)",
        nomeAgressor: "José Santos",
        regiaoAdministrativa: "Plano Piloto",
        tipoAmeacaAgressao: "Ameaça",
        historicoOcorrencia: "Registro de exemplo — banco vazio após seed.",
        desfecho: "Encaminhamento",
        dataHoraOcorrencia: new Date(),
        numeroOcorrenciaCad: "CAD-DEMO-SEED-01",
      },
      {
        origem: "SISTEMA",
        faseAtual: 2,
        concluida: false,
        nomeVitima: "Ana Costa (demonstração)",
        nomeAgressor: "Pedro Lima",
        regiaoAdministrativa: "Taguatinga",
        tipoAmeacaAgressao: "Violência psicológica",
        historicoOcorrencia: "Segundo registro de exemplo.",
        dataHoraOcorrencia: new Date(),
      },
      {
        origem: "SISTEMA",
        faseAtual: 1,
        concluida: false,
        nomeVitima: "Carla Mendes (demonstração)",
        nomeAgressor: "Lucas Oliveira",
        regiaoAdministrativa: "Ceilândia",
        tipoAmeacaAgressao: "Constrangimento",
        dataHoraOcorrencia: new Date(),
      },
    ],
  });
  console.log("Seed: 3 ocorrências de demonstração inseridas (PostgreSQL apenas).");
}

async function main() {
  await prisma.user.deleteMany({});

  const senhaHash = await bcrypt.hash(MASTER_SENHA, 10);
  await prisma.user.create({
    data: {
      nomeCompleto: "Rafael",
      email: MASTER_EMAIL.toLowerCase(),
      cpf: null,
      telefone: null,
      matricula: null,
      lotacao: "COPOM Mulher / PMDF",
      cargo: "Administrador Master",
      role: UserRole.ADMINISTRADOR,
      ativo: true,
      mustChangePassword: false,
      senhaHash,
    },
  });

  console.log("Seed: administrador master criado — login: rafael | e-mail:", MASTER_EMAIL, "| senha:", MASTER_SENHA);

  const totalOcc = await prisma.occurrence.count();
  if (totalOcc === 0) {
    await seedDemoOccurrences();
    console.log("Seed: importação Excel não corre automaticamente — use o menu Importar Excel ou npm run import:excel:refresh.");
  } else {
    console.log(`Seed: mantidas ${totalOcc} ocorrência(s) já existentes (para reimportar: npm run import:excel:refresh).`);
  }
}

main()
  .then(() => console.log("Seed concluído."))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
