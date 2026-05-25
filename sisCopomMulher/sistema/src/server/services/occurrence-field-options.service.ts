import { prisma } from "@/lib/prisma";

/** Valores distintos não vazios de `registrouBoDp` já usados no banco (p.ex. importação Excel). */
export async function listDistinctRegistrouBoDp(): Promise<string[]> {
  // Sem `distinct` do Prisma (pode variar com driver/versão); deduplicamos em memória.
  const rows = await prisma.occurrence.findMany({
    select: { registrouBoDp: true },
    where: { registrouBoDp: { not: null } },
  });
  const out = new Set<string>();
  for (const r of rows) {
    const v = r.registrouBoDp?.trim();
    if (v) out.add(v);
  }
  return Array.from(out).sort((a, b) => a.localeCompare(b, "pt-BR"));
}
