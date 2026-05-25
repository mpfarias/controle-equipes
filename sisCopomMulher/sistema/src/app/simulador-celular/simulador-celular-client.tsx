"use client";

import { useEffect, useMemo, useState } from "react";

type Props = { defaultOrigin: string };

export function SimuladorCelularClient({ defaultOrigin }: Props) {
  const [origin, setOrigin] = useState(defaultOrigin);

  useEffect(() => {
    if (typeof window === "undefined") return;
    setOrigin(window.location.origin);
  }, []);

  useEffect(() => {
    const prevHtmlOverflow = document.documentElement.style.overflow;
    const prevBodyOverflow = document.body.style.overflow;
    document.documentElement.style.overflow = "hidden";
    document.body.style.overflow = "hidden";
    return () => {
      document.documentElement.style.overflow = prevHtmlOverflow;
      document.body.style.overflow = prevBodyOverflow;
    };
  }, []);

  const mobileHref = useMemo(() => {
    try {
      const url = new URL("/mobile-vitima", origin.endsWith("/") ? origin : `${origin}/`);
      url.searchParams.set("embed", "iphone");
      return url.toString();
    } catch {
      return "";
    }
  }, [origin]);

  return (
    <div className="simulador-celular-page flex min-h-dvh items-center justify-center bg-gradient-to-b from-slate-950 via-[#0a0a0c] to-slate-950 p-4">
      <div className="iphone-pro-max">
        <span className="iphone-pro-max__btn iphone-pro-max__btn--silent" aria-hidden />
        <span className="iphone-pro-max__btn iphone-pro-max__btn--vol-up" aria-hidden />
        <span className="iphone-pro-max__btn iphone-pro-max__btn--vol-down" aria-hidden />
        <span className="iphone-pro-max__btn iphone-pro-max__btn--power" aria-hidden />

        <div className="iphone-pro-max__screen">
          {mobileHref ? (
            <iframe title="App vítima — iPhone 15 Pro Max" src={mobileHref} allow="geolocation *; fullscreen" referrerPolicy="same-origin" />
          ) : (
            <div className="flex h-full items-center justify-center p-4 text-center text-sm text-slate-400">
              Não foi possível carregar /mobile-vitima
            </div>
          )}

          <div className="iphone-pro-max__island" aria-hidden>
            <span className="iphone-pro-max__island-lens" />
          </div>
          <span className="iphone-pro-max__glare" aria-hidden />
          <span className="iphone-pro-max__home-bar" aria-hidden />
        </div>
      </div>
    </div>
  );
}
