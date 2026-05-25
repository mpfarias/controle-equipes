import { headers } from "next/headers";
import { SimuladorCelularClient } from "./simulador-celular-client";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Simulador — app vítima (browser)",
  description: "Emulador web de telemóvel para testar cadastro e pânico da vítima no browser.",
  robots: "noindex, nofollow",
};

/** Moldura de smartphone + iframe com /mobile-vitima (cadastro e pânico reais na central). */
export default async function SimuladorCelularPage() {
  const h = await headers();
  const host = h.get("x-forwarded-host")?.split(",")[0]?.trim() || h.get("host") || "localhost:3001";
  const proto = h.get("x-forwarded-proto")?.split(",")[0]?.trim() || "http";
  const defaultOrigin = `${proto}://${host}`;

  return <SimuladorCelularClient defaultOrigin={defaultOrigin} />;
}
