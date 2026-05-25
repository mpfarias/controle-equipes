import { NextResponse } from "next/server";

/** Probes de balanceador / Docker; sem cookies nem base de dados. */
export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json({ ok: true, t: new Date().toISOString() });
}
