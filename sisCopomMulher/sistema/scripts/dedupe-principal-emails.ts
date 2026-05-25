import "dotenv/config";
import { PrismaClient, UserRole } from "@prisma/client";

const prisma = new PrismaClient();

type Principal = {
  nomeCompleto: string;
  email: string;
  cpf?: string;
  telefone?: string;
  matricula?: string;
};

const PRINCIPAIS: Principal[] = [
  { nomeCompleto: "Maria Suely de Oliveira", email: "mariasuely.oliveira@hotmail.com", cpf: "20980353149", telefone: "6199730841", matricula: "08.3402" },
  { nomeCompleto: "Elaine Lucas de Paiva", email: "lucaselaine1004@gmail.com", cpf: "45497486134", matricula: "17664/8" },
  { nomeCompleto: "Jos\u00e9 Antonio do Nascimento Rodrigues", email: "jose.anrodrigues@hotmail.com", cpf: "37582356187", telefone: "61999461005", matricula: "15.563/2" },
  { nomeCompleto: "Carlos Ferreira dos Santos", email: "carllinhosantos@hotmail.com", cpf: "48308374115", telefone: "61984049448", matricula: "18.433-0" },
  { nomeCompleto: "Margarete de Souza", email: "msrssouza@gmail.com.br", cpf: "31711685100", telefone: "61992206886", matricula: "17269/3" },
  { nomeCompleto: "Dulce Feitosa Soares", email: "dulcefs17@gmail.com", cpf: "38501830178", telefone: "61998719105", matricula: "17,320" },
  { nomeCompleto: "Joana Darc Rodrigues da Silva Freitas", email: "joana.rsf2010@gmail.com", cpf: "39332713120", telefone: "61992946189", matricula: "17343-6" },
  { nomeCompleto: "Cl\u00e1udia Aparecida Oliveira Silva", email: "claudia.silva0468@gmail.com", cpf: "52351262115", telefone: "61992651370", matricula: "15.767/8" },
  { nomeCompleto: "Ju\u00e9d de Menezes Lima", email: "jued2001@gmail.com", cpf: "51681293153", telefone: "61996040787", matricula: "18.741/0" },
  { nomeCompleto: "Rosilenir Santos de Andrade", email: "rosilenirsantos@gmail.com", cpf: "44458223100", telefone: "61991756711", matricula: "21.149/4" },
  { nomeCompleto: "V\u00e9sio Ribeiro Marinho", email: "vesio.rm@gmail.com", cpf: "01177075113", telefone: "61982381715", matricula: "735567/X" },
  { nomeCompleto: "Rachid Gon\u00e7alves Pereira", email: "rachidgp@hotmail.com", cpf: "39726762120", telefone: "61984551361", matricula: "17.747/4" },
  { nomeCompleto: "Sirlei de F\u00e1tima Teixeira Maia", email: "sirleimaia2010@gmail.com", cpf: "44316771191", telefone: "61984588444", matricula: "17.303/7" },
];

const aliasesByPrincipalEmail: Record<string, string[]> = {
  "mariasuely.oliveira@hotmail.com": ["st suely"],
  "lucaselaine1004@gmail.com": ["sgt elaine"],
  "jose.anrodrigues@hotmail.com": ["sgt rodrigues"],
  "msrssouza@gmail.com.br": ["st margarete"],
  "dulcefs17@gmail.com": ["sgt dulce"],
  "joana.rsf2010@gmail.com": ["sgt joana"],
  "jued2001@gmail.com": ["sgt jued"],
  "rosilenirsantos@gmail.com": ["sgt rosileni"],
  "vesio.rm@gmail.com": ["cb r.marinho"],
  "rachidgp@hotmail.com": ["sgt rachid", "sgt rashid"],
  "sirleimaia2010@gmail.com": ["sgt sirlei"],
  "claudia.silva0468@gmail.com": ["st claudia"],
};

function normText(v: string) {
  return v
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function digits(v?: string | null) {
  if (!v) return null;
  const d = String(v).replace(/\D/g, "");
  return d.length ? d : null;
}

async function main() {
  let removed = 0;
  let updated = 0;

  for (const p of PRINCIPAIS) {
    const email = p.email.toLowerCase();
    const main = await prisma.user.findUnique({ where: { email } });
    if (!main) {
      console.log(`Principal nao encontrado, ignorado: ${email}`);
      continue;
    }

    await prisma.user.update({
      where: { id: main.id },
      data: {
        nomeCompleto: p.nomeCompleto,
        cpf: digits(p.cpf),
        telefone: digits(p.telefone),
        matricula: p.matricula ?? null,
        role: UserRole.ATENDENTE,
        ativo: true,
      },
    });
    updated++;

    const aliases = aliasesByPrincipalEmail[email] ?? [];
    const mainNorm = normText(p.nomeCompleto);
    const mainMat = p.matricula?.trim() || null;

    const allCopom = await prisma.user.findMany({
      where: {
        id: { not: main.id },
        role: UserRole.ATENDENTE,
        email: { endsWith: "@copom-mulher.df" },
      },
      select: { id: true, nomeCompleto: true, email: true, matricula: true },
    });

    for (const cand of allCopom) {
      const candNorm = normText(cand.nomeCompleto);
      const aliasMatch = aliases.some((a) => candNorm.includes(normText(a)) || normText(a).includes(candNorm));
      const nameMatch = candNorm === mainNorm;
      const matMatch = !!mainMat && !!cand.matricula && cand.matricula.trim() === mainMat;
      if (!aliasMatch && !nameMatch && !matMatch) continue;

      await prisma.user.delete({ where: { id: cand.id } });
      removed++;
      console.log(`Removido duplicado @copom: ${cand.nomeCompleto} <${cand.email}> => principal ${email}`);
    }
  }

  // Remove quaisquer contas @copom restantes de atendente criadas por provisao automatica.
  const leftovers = await prisma.user.findMany({
    where: { role: UserRole.ATENDENTE, email: { endsWith: "@copom-mulher.df" } },
    select: { id: true, nomeCompleto: true, email: true },
  });
  for (const x of leftovers) {
    await prisma.user.delete({ where: { id: x.id } });
    removed++;
    console.log(`Removido @copom remanescente: ${x.nomeCompleto} <${x.email}>`);
  }

  console.log("\nResumo");
  console.log(`Principais atualizados: ${updated}`);
  console.log(`Duplicados removidos: ${removed}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
