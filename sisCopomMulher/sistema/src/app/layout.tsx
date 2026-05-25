import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "COPOM Mulher — PMDF",
  description:
    "Sistema web: login, painel BI, cadastro de utilizadores, auditoria e ocorrências de violência doméstica (três fases).",
};

/** Sem `next/font/google` (evita falhas de rede / build em ambientes restritos). */
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR">
      <body className="h-full min-h-0 font-sans antialiased">
        <div className="h-full min-h-0">{children}</div>
      </body>
    </html>
  );
}
