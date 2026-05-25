/**
 * Valida que `computeDashboardStats` aplica o intervalo (totais coerentes).
 * Uso: na pasta `sistema`, com `DATABASE_URL` em `.env`: `npx tsx scripts/test-dashboard-range.ts`
 */
import "dotenv/config";
import { computeDashboardStats } from "../src/server/services/dashboard.service";

async function main() {
  const all = await computeDashboardStats(undefined);
  const y = new Date().getFullYear();
  const from = new Date(y, 0, 1, 0, 0, 0, 0);
  const to = new Date(y, 11, 31, 23, 59, 59, 999);
  const year = await computeDashboardStats({ from, to });
  const narrow = await computeDashboardStats({
    from: new Date(y, 3, 1, 0, 0, 0, 0),
    to: new Date(y, 3, 7, 23, 59, 59, 999),
  });

  const out = {
    totalGlobal: all.total,
    totalAnoCorrente: year.total,
    totalUmaSemanaAbril: narrow.total,
    coerenteGlobal: all.meta.coerente,
    somaMesesVsTotal: { soma: all.meta.somaPorMes, total: all.meta.total },
  };
  console.log(JSON.stringify(out, null, 2));

  if (narrow.total > all.total) {
    console.error("Falha: intervalo estreito não pode ter mais registos que o global.");
    process.exit(1);
  }
  if (year.total > all.total) {
    console.error("Falha: total anual não pode exceder o global.");
    process.exit(1);
  }
  if (!all.meta.coerente) {
    console.warn("Aviso: soma dos meses ≠ total (verificar dados ou SQL).");
  }
  console.log("OK");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
