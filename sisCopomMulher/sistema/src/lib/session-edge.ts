/** Mesmos valores que `UserRole` no Prisma — definido aqui para não puxar `@prisma/client` para o bundle Edge do middleware. */
export type SessionRole = "ADMINISTRADOR" | "ATENDENTE" | "CONSULTA";

/** Verificação HS256 só com Web Crypto (compatível com Edge), alinhada ao `SignJWT` do `jose` no login. */

function base64UrlToBytes(b64url: string): Uint8Array {
  let s = b64url.replace(/-/g, "+").replace(/_/g, "/");
  const pad = s.length % 4;
  if (pad) s += "=".repeat(4 - pad);
  const binary = atob(s);
  const out = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) out[i] = binary.charCodeAt(i);
  return out;
}

function bytesToBase64Url(bytes: Uint8Array): string {
  let bin = "";
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]!);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function timingSafeEqualUrl(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let r = 0;
  for (let i = 0; i < a.length; i++) r |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return r === 0;
}

async function verifyHs256Signature(token: string, secret: string): Promise<Record<string, unknown>> {
  const parts = token.split(".");
  if (parts.length !== 3) throw new Error("invalid_token");
  const [h, p, sig] = parts;
  if (!h || !p || !sig) throw new Error("invalid_token");

  const signingInput = `${h}.${p}`;
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const mac = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(signingInput));
  const expected = bytesToBase64Url(new Uint8Array(mac));
  if (!timingSafeEqualUrl(expected, sig)) throw new Error("invalid_signature");

  const payloadJson = new TextDecoder().decode(base64UrlToBytes(p));
  const payload = JSON.parse(payloadJson) as Record<string, unknown>;
  const exp = payload.exp;
  if (typeof exp === "number" && exp < Date.now() / 1000) throw new Error("expired");
  return payload;
}

export async function readSessionFromToken(token: string) {
  const secret = process.env.AUTH_SECRET;
  if (!secret || secret.length < 16) {
    throw new Error("AUTH_SECRET inválido");
  }
  const payload = await verifyHs256Signature(token, secret);
  const sub = String(payload.sub ?? "");
  const email = String(payload.email ?? "");
  const role = payload.role as SessionRole;
  const nome = String(payload.nome ?? "");
  if (!sub || !email || !role) throw new Error("invalid_payload");
  const mustChangePassword = payload.mustChangePassword === true;
  return { sub, email, role, nome, mustChangePassword };
}
