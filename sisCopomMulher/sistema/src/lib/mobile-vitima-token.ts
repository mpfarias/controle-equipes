import { createHash, randomBytes } from "node:crypto";

function pepper(): string {
  return process.env.MOBILE_TOKEN_PEPPER || process.env.AUTH_SECRET || "defina-MOBILE_TOKEN_PEPPER-ou-AUTH_SECRET";
}

/** Hash armazenado na base (nunca guardar o token em claro). */
export function hashMobileActivationToken(plain: string): string {
  return createHash("sha256").update(`${plain}:${pepper()}`, "utf8").digest("hex");
}

/** Token opaco para a vítima colar no app (≈32 bytes em base64url). */
export function generateMobileActivationToken(): string {
  return randomBytes(32).toString("base64url");
}
