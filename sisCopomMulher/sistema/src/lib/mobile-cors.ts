import { NextResponse } from "next/server";

const headers: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Authorization, Content-Type, X-Copom-Client",
  "Access-Control-Max-Age": "86400",
};

export function withMobileCors(res: NextResponse) {
  for (const [k, v] of Object.entries(headers)) {
    res.headers.set(k, v);
  }
  return res;
}

export function mobileCorsOptionsResponse() {
  return withMobileCors(new NextResponse(null, { status: 204 }));
}
