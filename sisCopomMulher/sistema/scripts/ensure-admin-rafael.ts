import "dotenv/config";
import { PrismaClient, UserRole } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

/** No login, sem @ vira este domínio (ver `api/auth/login`). */
const EMAIL = "rafael@copom-mulher.df";
const SENHA = "123";

async function main() {
  const senhaHash = await bcrypt.hash(SENHA, 10);
  const user = await prisma.user.upsert({
    where: { email: EMAIL },
    create: {
      nomeCompleto: "Rafael",
      email: EMAIL,
      senhaHash,
      role: UserRole.ADMINISTRADOR,
      ativo: true,
      mustChangePassword: false,
      lotacao: "COPOM Mulher / PMDF",
      cargo: "Administrador Master",
    },
    update: {
      nomeCompleto: "Rafael",
      senhaHash,
      role: UserRole.ADMINISTRADOR,
      ativo: true,
      mustChangePassword: false,
      lotacao: "COPOM Mulher / PMDF",
      cargo: "Administrador Master",
    },
  });
  console.log("OK — administrador master:", user.email, "| nome:", user.nomeCompleto, "| cargo:", user.cargo);
  console.log("Login: rafael (ou e-mail completo) | Senha: 123");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
