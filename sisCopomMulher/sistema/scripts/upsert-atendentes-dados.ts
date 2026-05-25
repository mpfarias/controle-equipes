import "dotenv/config";
import { PrismaClient, UserRole } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();
const SENHA_PADRAO = "123456";

type InputUser = {
  nomeCompleto: string;
  email: string;
  cpf?: string;
  telefone?: string;
  matricula?: string;
};

const INPUT: InputUser[] = [
  { nomeCompleto: "Maria Suely de Oliveira", cpf: "209.803.531-49", matricula: "08.3402", email: "mariasuely.oliveira@hotmail.com", telefone: "61 9973-0841" },
  { nomeCompleto: "Elaine Lucas de Paiva", cpf: "454.974.861-34", matricula: "17664/8", email: "lucaselaine1004@gmail.com" },
  { nomeCompleto: "José Antonio do Nascimento Rodrigues", cpf: "375.823.561/87", matricula: "15.563/2", email: "jose.anrodrigues@hotmail.com", telefone: "(61)999461005" },
  { nomeCompleto: "Carlos Ferreira dos Santos", cpf: "48308374115", matricula: "18.433-0", email: "carllinhosantos@hotmail.com", telefone: "61-984049448" },
  { nomeCompleto: "Margarete de Souza", cpf: "31711685100", matricula: "17269/3", email: "msrssouza@gmail.com.br", telefone: "61992206886" },
  { nomeCompleto: "DULCE FEITOSA SOARES", cpf: "385,018,301-78", matricula: "17,320", email: "DULCEFS17@GMAIL.COM", telefone: "61 998719105" },
  { nomeCompleto: "Joana Darc Rodrigues da Silva Freitas", cpf: "393327131-20", matricula: "17343-6", email: "Joana.rsf2010@gmail.com", telefone: "61 992946189" },
  { nomeCompleto: "Cláudia Aparecida Oliveira Silva", cpf: "523.512.621-15", matricula: "15.767/8", email: "claudia.silva0468@gmail.com", telefone: "61992651370" },
  { nomeCompleto: "Juéd de Menezes Lima", cpf: "516.812.931-53", matricula: "18.741/0", email: "jued2001@gmail.com", telefone: "(61) 996040787" },
  { nomeCompleto: "Rosilenir Santos de Andrade", cpf: "444.582.231-00", matricula: "21.149/4", email: "rosilenirsantos@gmail.com", telefone: "61 991756711" },
  { nomeCompleto: "Vésio Ribeiro Marinho", cpf: "011770751-13", matricula: "735567/X", email: "vesio.rm@gmail.com", telefone: "(61) 982381715" },
  { nomeCompleto: "Rachid Gonçalves Pereira", cpf: "397.267.621-20", matricula: "17.747/4", email: "rachidgp@hotmail.com", telefone: "61984551361" },
  { nomeCompleto: "Sirlei de Fátima Teixeira Maia", cpf: "443.167.711-91", matricula: "17.303/7", email: "Sirleimaia2010@gmail.com", telefone: "61-984588444" },
];

function digits(v?: string) {
  if (!v) return null;
  const d = v.replace(/\D/g, "");
  return d.length ? d : null;
}

async function main() {
  const senhaHash = await bcrypt.hash(SENHA_PADRAO, 10);
  let created = 0;
  let updated = 0;

  for (const raw of INPUT) {
    const email = raw.email.replace(/\s+/g, "").toLowerCase();
    const nomeCompleto = raw.nomeCompleto.trim().replace(/\s+/g, " ");
    const cpf = digits(raw.cpf);
    const telefone = digits(raw.telefone);
    const matricula = raw.matricula?.trim() || null;

    const exists = await prisma.user.findUnique({ where: { email }, select: { id: true } });
    if (exists) {
      await prisma.user.update({
        where: { email },
        data: {
          nomeCompleto,
          cpf,
          telefone,
          matricula,
          role: UserRole.ATENDENTE,
          ativo: true,
        },
      });
      updated++;
      console.log(`Atualizado: ${nomeCompleto} (${email})`);
      continue;
    }

    await prisma.user.create({
      data: {
        nomeCompleto,
        email,
        cpf,
        telefone,
        matricula,
        role: UserRole.ATENDENTE,
        ativo: true,
        senhaHash,
        mustChangePassword: true,
      },
    });
    created++;
    console.log(`Criado: ${nomeCompleto} (${email})`);
  }

  console.log("\nResumo:");
  console.log(`Criados: ${created}`);
  console.log(`Atualizados: ${updated}`);
  console.log(`Senha padrao para novos: ${SENHA_PADRAO}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
