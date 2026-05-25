import type { Metadata } from "next";
import { Suspense } from "react";
import { MobileVitimaForm } from "./vitima-mobile-form";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "COPOM Mulher — canal vítima",
  description: "Cadastro e localização enviados à central pelo telefone; pânico registra alerta para encaminhamento.",
  robots: "noindex, nofollow",
};

export default function MobileVitimaPage() {
  return (
    <Suspense fallback={null}>
      <MobileVitimaForm />
    </Suspense>
  );
}
