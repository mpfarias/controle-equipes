import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const where = {
    faseAtual: { lt: 2 as const },
    comandanteViatura: { not: null as null | string },
    responsavelAtendimento: { not: null as null | string },
    desfecho: null,
    registrouBoDp: null,
    numeroOcorrenciaCad: null,
  };

  const candidatosAntes = await prisma.occurrence.count({ where });
  const atualizados = await prisma.occurrence.updateMany({
    where,
    data: { faseAtual: 2, concluida: false },
  });
  const restantes = await prisma.occurrence.count({ where });

  console.log(JSON.stringify({ candidatosAntes, atualizados: atualizados.count, restantes }));
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
