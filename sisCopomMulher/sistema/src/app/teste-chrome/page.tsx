import { notFound } from "next/navigation";
import { TesteChromeClient } from "./teste-chrome-client";

export const metadata = {
  title: "Teste — 2 janelas Chrome (servidor + vítima)",
  robots: "noindex, nofollow",
};

/**
 * Só em desenvolvimento. Duas origens (127.0.0.1 vs localhost) = cookies do operador
 * não interferem; a vítima pode usar a API que combina com o sítio onde abriu.
 */
export default function TesteChromePage() {
  if (process.env.NODE_ENV === "production") {
    notFound();
  }
  return <TesteChromeClient />;
}
