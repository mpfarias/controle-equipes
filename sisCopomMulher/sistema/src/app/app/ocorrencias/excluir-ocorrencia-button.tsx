"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export function ExcluirOcorrenciaButton({ id, compact }: { id: string; compact?: boolean }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function onClick() {
    if (!window.confirm("Excluir esta ocorrência permanentemente?")) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/ocorrencias/${id}`, { method: "DELETE", credentials: "include" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        window.alert(typeof data.error === "string" ? data.error : "Não foi possível excluir.");
        return;
      }
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  const cls = compact
    ? "inline-flex shrink-0 items-center justify-center rounded border border-rose-300 bg-white px-2 py-1 text-center text-[10px] font-bold text-rose-700 transition hover:bg-rose-50 disabled:opacity-50"
    : "inline-flex w-full items-center justify-center rounded-lg border border-rose-200 bg-white px-3 py-1.5 text-center text-xs font-semibold text-rose-700 shadow-sm transition hover:bg-rose-50 disabled:opacity-50 sm:w-auto";

  return (
    <button type="button" disabled={busy} onClick={() => void onClick()} className={cls}>
      {busy ? "…" : compact ? "Exc." : "Excluir"}
    </button>
  );
}
