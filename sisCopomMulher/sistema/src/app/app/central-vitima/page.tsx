import { redirect } from "next/navigation";
import { getSessionFromCookies } from "@/lib/auth";
import { podeVerCentralVitimaMobile } from "@/lib/roles";
import { prisma } from "@/lib/prisma";
import { listCentralMobileEvents } from "@/server/services/mobile-vitima.service";
import { CentralVitimaClient, type CentralEventRow } from "./central-vitima-client";
import { CentralVitimaAppPanel, type VitimaCadastroRow, type VitimaPanicRow } from "./central-vitima-app-panel";
import { listVictimCadastrosForCentral, listVictimPanicsForCentral } from "@/server/services/victim-app.service";

export const dynamic = "force-dynamic";

export default async function CentralVitimaPage() {
  const session = await getSessionFromCookies();
  if (!session) redirect(`/login?next=${encodeURIComponent("/app/central-vitima")}`);
  if (!podeVerCentralVitimaMobile(session.role)) redirect("/app/dashboard");

  const raw = await listCentralMobileEvents(prisma, { limit: 120, panicOnly: false });

  let cadRows: Awaited<ReturnType<typeof listVictimCadastrosForCentral>> = [];
  let panicRows: Awaited<ReturnType<typeof listVictimPanicsForCentral>> = [];
  let appListaErro: string | null = null;
  try {
    [cadRows, panicRows] = await Promise.all([
      listVictimCadastrosForCentral(prisma, 120),
      listVictimPanicsForCentral(prisma, 120),
    ]);
  } catch (err) {
    const code = typeof err === "object" && err !== null && "code" in err ? String((err as { code?: string }).code) : "";
    const msg = err instanceof Error ? err.message : String(err);
    /** Cliente Prisma desatualizado ou DLL bloqueada — não exibir texto técnico ao utilizador. */
    const isPrismaDelegateMissing =
      /Cannot read properties of undefined/i.test(msg) && /findMany/i.test(msg);
    if (isPrismaDelegateMissing) {
      appListaErro = null;
    } else if (code === "P2021" || /does not exist|não existe|Unknown table/i.test(msg)) {
      appListaErro =
        "Tabelas do app vítima ainda não existem na base. Na pasta sistema, execute: npx prisma db push (e reinicie o servidor Next).";
    } else {
      appListaErro = `${msg}${code ? ` (${code})` : ""}`;
    }
  }

  const initialEvents: CentralEventRow[] = raw.map((e) => ({
    id: e.id,
    kind: e.kind,
    latitude: e.latitude,
    longitude: e.longitude,
    accuracyM: e.accuracyM,
    createdAt: e.createdAt.toISOString(),
    acknowledgedAt: e.acknowledgedAt?.toISOString() ?? null,
    deviceInfo: e.deviceInfo,
    link: {
      id: e.link.id,
      label: e.link.label,
      occurrenceId: e.link.occurrence.id,
      nomeVitima: e.link.occurrence.nomeVitima,
      nomeAgressor: e.link.occurrence.nomeAgressor,
      numeroOcorrenciaCad: e.link.occurrence.numeroOcorrenciaCad,
      telefoneVitima: e.link.occurrence.telefoneVitima,
    },
  }));

  const initialCadastros: VitimaCadastroRow[] = cadRows.map((c) => ({
    id: c.id,
    createdAt: c.createdAt.toISOString(),
    telefoneDigits: c.telefoneDigits,
    nomeVitima: c.nomeVitima,
    idade: c.idade,
    cpf: c.cpf,
    identidade: c.identidade,
    medidaProtetiva: c.medidaProtetiva,
    enderecoResidencia: c.enderecoResidencia,
    latitude: c.latitude,
    longitude: c.longitude,
    accuracyM: c.accuracyM,
    nomeAgressor: c.nomeAgressor,
    enderecoAgressor: c.enderecoAgressor,
    fotoVitimaNome: c.fotoVitimaNome,
    fotoAgressorNome: c.fotoAgressorNome,
  }));

  const initialPanics: VitimaPanicRow[] = panicRows.map((p) => ({
    id: p.id,
    createdAt: p.createdAt.toISOString(),
    telefoneDigits: p.telefoneDigits,
    latitude: p.latitude,
    longitude: p.longitude,
    accuracyM: p.accuracyM,
    encaminhamento: p.encaminhamento,
    finalizacao: p.finalizacao,
    acknowledgedAt: p.acknowledgedAt?.toISOString() ?? null,
    cadastro: p.cadastro,
  }));

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold text-slate-900">Central COPOM Mulher — app vítima</h1>
        <p className="mt-1 text-sm text-slate-600">
          <strong>Cadastros e pânicos</strong> enviados pelo aplicativo da vítima, identificados pelo <strong>telefone</strong>. A
          central regista <strong>encaminhamento</strong> e <strong>finalização</strong> de cada acionamento de pânico.
        </p>
      </div>

      <CentralVitimaAppPanel
        initialCadastros={initialCadastros}
        initialPanics={initialPanics}
        listaErro={appListaErro}
      />

      <div className="border-t border-slate-200 pt-6">
        <h2 className="text-lg font-semibold text-slate-900">Telemetria legada (histórico)</h2>
        <p className="mb-3 text-sm text-slate-600">
          Lista antiga de eventos por link — o fluxo atual é <strong>telefone + app</strong> (cadastros e pânicos acima).
        </p>
        <CentralVitimaClient initialEvents={initialEvents} />
      </div>
    </div>
  );
}
