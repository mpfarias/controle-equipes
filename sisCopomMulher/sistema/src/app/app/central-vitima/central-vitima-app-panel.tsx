"use client";

import { useCallback, useEffect, useState } from "react";

export type VitimaCadastroRow = {
  id: string;
  createdAt: string;
  telefoneDigits: string;
  nomeVitima: string | null;
  idade: string | null;
  cpf: string | null;
  identidade: string | null;
  medidaProtetiva: string | null;
  enderecoResidencia: string | null;
  latitude: number | null;
  longitude: number | null;
  accuracyM: number | null;
  nomeAgressor: string | null;
  enderecoAgressor: string | null;
  fotoVitimaNome: string | null;
  fotoAgressorNome: string | null;
};

export type VitimaPanicRow = {
  id: string;
  createdAt: string;
  telefoneDigits: string;
  latitude: number;
  longitude: number;
  accuracyM: number | null;
  encaminhamento: string | null;
  finalizacao: string | null;
  acknowledgedAt: string | null;
  cadastro: { id: string; nomeVitima: string | null; telefoneDigits: string } | null;
};

const ENC_OPTS = [
  { value: "", label: "— Encaminhamento —" },
  { value: "VIATURA_DESPACHADA", label: "Viatura despachada" },
  { value: "CONTATO_TELEFONE", label: "Contato via telefone" },
  { value: "ALERTA_FALSO", label: "Alerta falso" },
  { value: "DADOS_INCOMPATIVEIS", label: "Dados incompatíveis" },
  { value: "LOCALIZACAO_NAO_ENCONTRADA", label: "Localização não encontrada" },
] as const;

const FIN_OPTS = [
  { value: "", label: "— Finalização —" },
  { value: "RESOLVIDO_NO_LOCAL", label: "Resolvido no local" },
  { value: "ENCAMINHADA_DELEGACIA", label: "Encaminhada à delegacia de polícia" },
  { value: "AVERIGUADA_NADA_CONSTATADO", label: "Averiguada e nada constatado" },
  { value: "TCO_NO_LOCAL", label: "TCO no local" },
  { value: "ORIENTACAO_PARTES", label: "Orientação das partes" },
] as const;

function mapsUrl(lat: number, lng: number) {
  return `https://www.google.com/maps?q=${lat},${lng}`;
}

function formatPhoneDisplay(digits: string) {
  const d = digits.replace(/\D/g, "");
  if (d.length === 11) return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
  if (d.length === 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  return digits;
}

function onlyDigits(v: string) {
  return v.replace(/\D/g, "");
}

function formatCpf(value: string) {
  const digits = onlyDigits(value).slice(0, 11);
  return digits
    .replace(/^(\d{3})(\d)/, "$1.$2")
    .replace(/^(\d{3})\.(\d{3})(\d)/, "$1.$2.$3")
    .replace(/\.(\d{3})(\d)/, ".$1-$2");
}

type Props = {
  initialCadastros: VitimaCadastroRow[];
  initialPanics: VitimaPanicRow[];
  /** Erro ao listar na base (ex.: tabelas não migradas). */
  listaErro?: string | null;
};

type EditDraft = {
  nomeVitima: string;
  idade: string;
  cpf: string;
  identidade: string;
  medidaProtetiva: "sim" | "nao" | "nao_informado";
  enderecoResidencia: string;
  latStr: string;
  lngStr: string;
  accStr: string;
  nomeAgressor: string;
  enderecoAgressor: string;
  fotoVitimaNome: string;
  fotoAgressorNome: string;
};

function rowToDraft(c: VitimaCadastroRow): EditDraft {
  const mp = c.medidaProtetiva;
  const medida: "sim" | "nao" | "nao_informado" =
    mp === "sim" || mp === "nao" || mp === "nao_informado" ? mp : "nao_informado";
  return {
    nomeVitima: c.nomeVitima ?? "",
    idade: c.idade ?? "",
    cpf: c.cpf ?? "",
    identidade: c.identidade ?? "",
    medidaProtetiva: medida,
    enderecoResidencia: c.enderecoResidencia ?? "",
    latStr: c.latitude != null ? String(c.latitude) : "",
    lngStr: c.longitude != null ? String(c.longitude) : "",
    accStr: c.accuracyM != null ? String(c.accuracyM) : "",
    nomeAgressor: c.nomeAgressor ?? "",
    enderecoAgressor: c.enderecoAgressor ?? "",
    fotoVitimaNome: c.fotoVitimaNome ?? "",
    fotoAgressorNome: c.fotoAgressorNome ?? "",
  };
}

function parseOptionalFinite(s: string): number | null {
  const t = s.trim();
  if (!t) return null;
  const n = Number(t);
  return Number.isFinite(n) ? n : null;
}

export function CentralVitimaAppPanel({ initialCadastros, initialPanics, listaErro }: Props) {
  const [cadastros, setCadastros] = useState<VitimaCadastroRow[]>(initialCadastros);
  const [panics, setPanics] = useState<VitimaPanicRow[]>(initialPanics);
  const [draftEnc, setDraftEnc] = useState<Record<string, string>>({});
  const [draftFin, setDraftFin] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [editing, setEditing] = useState<VitimaCadastroRow | null>(null);
  const [editDraft, setEditDraft] = useState<EditDraft | null>(null);
  const [editSaving, setEditSaving] = useState(false);

  useEffect(() => {
    const enc: Record<string, string> = {};
    const fin: Record<string, string> = {};
    for (const p of initialPanics) {
      enc[p.id] = p.encaminhamento ?? "";
      fin[p.id] = p.finalizacao ?? "";
    }
    setDraftEnc(enc);
    setDraftFin(fin);
  }, [initialPanics]);

  const refresh = useCallback(async () => {
    setLoading(true);
    setMsg(null);
    try {
      const [cRes, pRes] = await Promise.all([
        fetch(`/api/central/vitima-cadastros?limit=120`, { credentials: "include" }),
        fetch(`/api/central/vitima-panicos?limit=120`, { credentials: "include" }),
      ]);
      const cData = await cRes.json().catch(() => ({}));
      const pData = await pRes.json().catch(() => ({}));
      if (!cRes.ok) throw new Error(cData.error || "Falha ao carregar cadastros.");
      if (!pRes.ok) throw new Error(pData.error || "Falha ao carregar pânicos.");
      setCadastros(Array.isArray(cData.cadastros) ? cData.cadastros : []);
      const nextPanics: VitimaPanicRow[] = Array.isArray(pData.panics) ? pData.panics : [];
      setPanics(nextPanics);
      const enc: Record<string, string> = {};
      const fin: Record<string, string> = {};
      for (const p of nextPanics) {
        enc[p.id] = p.encaminhamento ?? "";
        fin[p.id] = p.finalizacao ?? "";
      }
      setDraftEnc(enc);
      setDraftFin(fin);
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "Erro.");
    } finally {
      setLoading(false);
    }
  }, []);

  function openEdit(c: VitimaCadastroRow) {
    setMsg(null);
    setEditing(c);
    setEditDraft(rowToDraft(c));
  }

  function closeEdit() {
    setEditing(null);
    setEditDraft(null);
  }

  async function saveCadastroCentral() {
    if (!editing || !editDraft) return;
    setEditSaving(true);
    setMsg(null);
    const lat = parseOptionalFinite(editDraft.latStr);
    const lng = parseOptionalFinite(editDraft.lngStr);
    const acc = parseOptionalFinite(editDraft.accStr);
    if (
      (editDraft.latStr.trim() !== "" || editDraft.lngStr.trim() !== "") &&
      (lat == null || lng == null)
    ) {
      setMsg("Latitude e longitude devem ser números válidos ou ficar vazios os dois.");
      setEditSaving(false);
      return;
    }
    try {
      const res = await fetch(`/api/central/vitima-cadastros/${editing.id}`, {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          nomeVitima: editDraft.nomeVitima.trim(),
          idade: editDraft.idade.trim() || null,
          cpf: editDraft.cpf.trim() || null,
          identidade: editDraft.identidade.trim() || null,
          medidaProtetiva: editDraft.medidaProtetiva,
          enderecoResidencia: editDraft.enderecoResidencia.trim(),
          latitude: lat,
          longitude: lng,
          accuracyM: acc,
          nomeAgressor: editDraft.nomeAgressor.trim(),
          enderecoAgressor: editDraft.enderecoAgressor.trim(),
          fotoVitimaNome: editDraft.fotoVitimaNome.trim() || null,
          fotoAgressorNome: editDraft.fotoAgressorNome.trim() || null,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Falha ao salvar cadastro.");
      const row = data.cadastro as VitimaCadastroRow | undefined;
      if (row) {
        setCadastros((prev) => prev.map((x) => (x.id === row.id ? row : x)));
      }
      closeEdit();
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "Erro.");
    } finally {
      setEditSaving(false);
    }
  }

  async function deleteCadastroCentral(c: VitimaCadastroRow) {
    const ok = window.confirm(
      `Excluir o cadastro do telefone ${formatPhoneDisplay(c.telefoneDigits)}?\n` +
        "Todos os alertas de pânico deste telefone na central também serão excluídos. Esta ação não pode ser desfeita.",
    );
    if (!ok) return;
    setMsg(null);
    setLoading(true);
    try {
      const res = await fetch(`/api/central/vitima-cadastros/${c.id}`, {
        method: "DELETE",
        credentials: "include",
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Falha ao excluir.");
      setCadastros((prev) => prev.filter((x) => x.id !== c.id));
      setPanics((prev) => prev.filter((p) => p.telefoneDigits !== c.telefoneDigits));
      if (editing?.id === c.id) closeEdit();
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "Erro.");
    } finally {
      setLoading(false);
    }
  }

  async function savePanicDisposition(id: string) {
    setMsg(null);
    const enc = draftEnc[id] === "" ? null : draftEnc[id] || null;
    const fin = draftFin[id] === "" ? null : draftFin[id] || null;
    try {
      const res = await fetch(`/api/central/vitima-panicos/${id}`, {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          encaminhamento: enc,
          finalizacao: fin,
          acknowledged: true,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Falha ao salvar.");
      const p = data.panic as VitimaPanicRow | undefined;
      if (p) {
        setPanics((prev) => prev.map((x) => (x.id === p.id ? { ...x, ...p } : x)));
        setDraftEnc((d) => ({ ...d, [id]: p.encaminhamento ?? "" }));
        setDraftFin((d) => ({ ...d, [id]: p.finalizacao ?? "" }));
      }
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "Erro.");
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-lg font-semibold text-slate-900">Cadastros pelo aplicativo (telefone)</h2>
        <button
          type="button"
          disabled={loading}
          onClick={() => void refresh()}
          className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm font-semibold text-slate-800 shadow-sm hover:bg-slate-50 disabled:opacity-50"
        >
          {loading ? "Atualizando…" : "Atualizar cadastros e pânicos"}
        </button>
      </div>
      <p className="text-sm text-slate-600">
        Cadastros com a <strong>chave telefone</strong> enviados pelo app da vítima. Operadores autorizados podem{" "}
        <strong>alterar</strong> dados ou <strong>excluir</strong> o registo; o telefone do cadastro não é alterado por aqui.
      </p>
      {listaErro ? (
        <div className="rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-950">{listaErro}</div>
      ) : null}
      {msg ? <p className="text-sm text-red-600">{msg}</p> : null}

      <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white/90 shadow-sm">
        <table className="min-w-full text-left text-sm">
          <thead className="border-b border-slate-200 bg-slate-50 text-xs font-bold uppercase text-slate-600">
            <tr>
              <th className="px-3 py-2">Quando</th>
              <th className="px-3 py-2">Telefone</th>
              <th className="px-3 py-2">Vítima</th>
              <th className="px-3 py-2">Localização</th>
              <th className="px-3 py-2">Agressor</th>
              <th className="px-3 py-2 text-right">Ações</th>
            </tr>
          </thead>
          <tbody>
            {cadastros.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-3 py-8 text-center text-slate-500">
                  Nenhum cadastro recebido do app ainda.
                </td>
              </tr>
            ) : (
              cadastros.map((c) => (
                <tr key={c.id} className="border-b border-slate-100 hover:bg-fuchsia-50/40">
                  <td className="whitespace-nowrap px-3 py-2 font-mono text-xs text-slate-700">
                    {new Date(c.createdAt).toLocaleString("pt-BR")}
                  </td>
                  <td className="px-3 py-2 font-mono text-xs">{formatPhoneDisplay(c.telefoneDigits)}</td>
                  <td className="px-3 py-2 text-slate-800">
                    <div className="whitespace-nowrap font-medium">{c.nomeVitima || "—"}</div>
                    <div className="whitespace-nowrap text-xs text-slate-500">Idade: {c.idade || "—"}</div>
                  </td>
                  <td className="px-3 py-2 text-xs">
                    {c.latitude != null && c.longitude != null ? (
                      <a href={mapsUrl(c.latitude, c.longitude)} target="_blank" rel="noreferrer" className="text-brand-700 underline">
                        {c.latitude.toFixed(5)}, {c.longitude.toFixed(5)}
                      </a>
                    ) : (
                      "—"
                    )}
                  </td>
                  <td className="max-w-[12rem] px-3 py-2 text-xs text-slate-700">{c.nomeAgressor || "—"}</td>
                  <td className="whitespace-nowrap px-3 py-2 text-right text-xs">
                    <button
                      type="button"
                      onClick={() => openEdit(c)}
                      className="mr-1 rounded-lg bg-fuchsia-700 px-2 py-1 font-semibold text-white hover:bg-fuchsia-800"
                    >
                      Alterar
                    </button>
                    <button
                      type="button"
                      disabled={loading}
                      onClick={() => void deleteCadastroCentral(c)}
                      className="rounded-lg border border-red-300 bg-red-50 px-2 py-1 font-semibold text-red-800 hover:bg-red-100 disabled:opacity-50"
                    >
                      Excluir
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {editing && editDraft ? (
        <div
          className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/50 p-4 py-10"
          onClick={() => {
            if (!editSaving) closeEdit();
          }}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="edit-cadastro-title"
            className="w-full max-w-lg rounded-2xl border border-slate-200 bg-white p-5 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 id="edit-cadastro-title" className="text-base font-semibold text-slate-900">
              Alterar cadastro (app)
            </h3>
            <p className="mt-1 text-xs text-slate-500">
              Telefone: <span className="font-mono font-semibold">{formatPhoneDisplay(editing.telefoneDigits)}</span> — não pode ser
              alterado neste ecrã.
            </p>
            <div className="mt-4 max-h-[70vh] space-y-3 overflow-y-auto pr-1 text-sm">
              <label className="block">
                <span className="text-xs font-semibold text-slate-600">Nome da vítima</span>
                <input
                  className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2"
                  value={editDraft.nomeVitima}
                  onChange={(e) => setEditDraft((d) => (d ? { ...d, nomeVitima: e.target.value } : d))}
                />
              </label>
              <label className="block">
                <span className="text-xs font-semibold text-slate-600">Idade</span>
                <input
                  className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2"
                  value={editDraft.idade}
                  onChange={(e) => setEditDraft((d) => (d ? { ...d, idade: e.target.value } : d))}
                />
              </label>
              <label className="block">
                <span className="text-xs font-semibold text-slate-600">CPF</span>
                <input
                  className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2"
                  value={editDraft.cpf}
                  onChange={(e) => setEditDraft((d) => (d ? { ...d, cpf: formatCpf(e.target.value) } : d))}
                />
              </label>
              <label className="block">
                <span className="text-xs font-semibold text-slate-600">Identidade (RG)</span>
                <input
                  className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2"
                  value={editDraft.identidade}
                  onChange={(e) => setEditDraft((d) => (d ? { ...d, identidade: e.target.value } : d))}
                />
              </label>
              <label className="block">
                <span className="text-xs font-semibold text-slate-600">Medida protetiva</span>
                <select
                  className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2"
                  value={editDraft.medidaProtetiva}
                  onChange={(e) =>
                    setEditDraft((d) =>
                      d
                        ? {
                            ...d,
                            medidaProtetiva: e.target.value as "sim" | "nao" | "nao_informado",
                          }
                        : d,
                    )
                  }
                >
                  <option value="nao_informado">Não informado</option>
                  <option value="sim">Sim</option>
                  <option value="nao">Não</option>
                </select>
              </label>
              <label className="block">
                <span className="text-xs font-semibold text-slate-600">Endereço da residência</span>
                <textarea
                  className="mt-1 min-h-[4rem] w-full rounded-lg border border-slate-300 px-3 py-2"
                  value={editDraft.enderecoResidencia}
                  onChange={(e) => setEditDraft((d) => (d ? { ...d, enderecoResidencia: e.target.value } : d))}
                />
              </label>
              <div className="grid grid-cols-3 gap-2">
                <label className="block">
                  <span className="text-xs font-semibold text-slate-600">Latitude</span>
                  <input
                    className="mt-1 w-full rounded-lg border border-slate-300 px-2 py-1.5 font-mono text-xs"
                    value={editDraft.latStr}
                    onChange={(e) => setEditDraft((d) => (d ? { ...d, latStr: e.target.value } : d))}
                    placeholder="—"
                  />
                </label>
                <label className="block">
                  <span className="text-xs font-semibold text-slate-600">Longitude</span>
                  <input
                    className="mt-1 w-full rounded-lg border border-slate-300 px-2 py-1.5 font-mono text-xs"
                    value={editDraft.lngStr}
                    onChange={(e) => setEditDraft((d) => (d ? { ...d, lngStr: e.target.value } : d))}
                    placeholder="—"
                  />
                </label>
                <label className="block">
                  <span className="text-xs font-semibold text-slate-600">Precisão (m)</span>
                  <input
                    className="mt-1 w-full rounded-lg border border-slate-300 px-2 py-1.5 font-mono text-xs"
                    value={editDraft.accStr}
                    onChange={(e) => setEditDraft((d) => (d ? { ...d, accStr: e.target.value } : d))}
                    placeholder="—"
                  />
                </label>
              </div>
              <label className="block">
                <span className="text-xs font-semibold text-slate-600">Nome do agressor</span>
                <input
                  className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2"
                  value={editDraft.nomeAgressor}
                  onChange={(e) => setEditDraft((d) => (d ? { ...d, nomeAgressor: e.target.value } : d))}
                />
              </label>
              <label className="block">
                <span className="text-xs font-semibold text-slate-600">Endereço do agressor</span>
                <textarea
                  className="mt-1 min-h-[4rem] w-full rounded-lg border border-slate-300 px-3 py-2"
                  value={editDraft.enderecoAgressor}
                  onChange={(e) => setEditDraft((d) => (d ? { ...d, enderecoAgressor: e.target.value } : d))}
                />
              </label>
              <label className="block">
                <span className="text-xs font-semibold text-slate-600">Nome arquivo foto vítima (referência)</span>
                <input
                  className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 font-mono text-xs"
                  value={editDraft.fotoVitimaNome}
                  onChange={(e) => setEditDraft((d) => (d ? { ...d, fotoVitimaNome: e.target.value } : d))}
                />
              </label>
              <label className="block">
                <span className="text-xs font-semibold text-slate-600">Nome arquivo foto agressor (referência)</span>
                <input
                  className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 font-mono text-xs"
                  value={editDraft.fotoAgressorNome}
                  onChange={(e) => setEditDraft((d) => (d ? { ...d, fotoAgressorNome: e.target.value } : d))}
                />
              </label>
            </div>
            <div className="mt-5 flex flex-wrap justify-end gap-2 border-t border-slate-100 pt-4">
              <button
                type="button"
                disabled={editSaving}
                onClick={closeEdit}
                className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-800 hover:bg-slate-50 disabled:opacity-50"
              >
                Cancelar
              </button>
              <button
                type="button"
                disabled={editSaving}
                onClick={() => void saveCadastroCentral()}
                className="rounded-lg bg-fuchsia-700 px-4 py-2 text-sm font-semibold text-white hover:bg-fuchsia-800 disabled:opacity-50"
              >
                {editSaving ? "A guardar…" : "Guardar alterações"}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      <div className="border-b border-slate-200 pb-3">
        <h2 className="text-lg font-semibold text-slate-900">Acionamentos de pânico (app)</h2>
        <p className="mt-1 text-sm text-slate-600">
          Registre o <strong>encaminhamento</strong> e a <strong>finalização</strong> de cada alerta. A tabela faz scroll horizontal
          em ecrãs estreitos; nomes, telefones e coordenadas mantêm-se numa linha para leitura rápida.
        </p>
      </div>

      <div className="overflow-x-auto rounded-xl border border-rose-200/60 bg-gradient-to-b from-white to-rose-50/20 shadow-sm ring-1 ring-rose-100/80">
        <table className="min-w-[1020px] w-full border-collapse text-left text-sm">
          <thead className="border-b-2 border-rose-200/80 bg-gradient-to-r from-slate-100 to-rose-50/90">
            <tr className="text-[10px] font-bold uppercase tracking-wider text-slate-600">
              <th className="whitespace-nowrap px-3 py-2.5">Quando</th>
              <th className="whitespace-nowrap px-3 py-2.5">Telefone alerta</th>
              <th className="whitespace-nowrap px-3 py-2.5">Vítima (cadastro)</th>
              <th className="whitespace-nowrap px-3 py-2.5">Coordenadas</th>
              <th className="whitespace-nowrap px-3 py-2.5">Situação</th>
              <th className="whitespace-nowrap px-3 py-2.5">Encaminhamento</th>
              <th className="whitespace-nowrap px-3 py-2.5">Finalização</th>
              <th className="whitespace-nowrap px-3 py-2.5 text-right">Ação</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 bg-white/95">
            {panics.length === 0 ? (
              <tr>
                <td colSpan={8} className="px-3 py-10 text-center text-slate-500">
                  Nenhum pânico registrado pelo app ainda.
                </td>
              </tr>
            ) : (
              panics.map((p, idx) => (
                <tr
                  key={p.id}
                  className={
                    idx % 2 === 0
                      ? "bg-white hover:bg-rose-50/50"
                      : "bg-slate-50/70 hover:bg-rose-50/50"
                  }
                >
                  <td className="whitespace-nowrap px-3 py-2.5 font-mono text-xs tabular-nums text-slate-700">
                    {new Date(p.createdAt).toLocaleString("pt-BR")}
                  </td>
                  <td className="whitespace-nowrap px-3 py-2.5 font-mono text-xs tabular-nums tracking-tight text-slate-900">
                    {formatPhoneDisplay(p.telefoneDigits)}
                  </td>
                  <td className="whitespace-nowrap px-3 py-2.5 text-xs">
                    <span className="font-semibold text-slate-900">{p.cadastro?.nomeVitima || "—"}</span>
                    {p.cadastro && p.cadastro.telefoneDigits !== p.telefoneDigits ? (
                      <span className="ml-2 font-mono text-[10px] font-normal text-slate-500">
                        ({formatPhoneDisplay(p.cadastro.telefoneDigits)})
                      </span>
                    ) : null}
                  </td>
                  <td className="whitespace-nowrap px-3 py-2.5 font-mono text-xs tabular-nums text-slate-800">
                    <a
                      href={mapsUrl(p.latitude, p.longitude)}
                      target="_blank"
                      rel="noreferrer"
                      className="text-brand-700 decoration-brand-500/50 underline-offset-2 hover:text-brand-900 hover:underline"
                      title="Abrir no mapa"
                    >
                      {p.latitude.toFixed(5)} · {p.longitude.toFixed(5)}
                    </a>
                    {p.accuracyM != null ? (
                      <span className="ml-2 text-slate-500">±{Math.round(p.accuracyM)} m</span>
                    ) : null}
                  </td>
                  <td className="whitespace-nowrap px-2 py-2.5">
                    {p.acknowledgedAt ? (
                      <span className="inline-flex rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-emerald-800 ring-1 ring-emerald-200/80">
                        Visto
                      </span>
                    ) : (
                      <span className="inline-flex rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-amber-900 ring-1 ring-amber-200/80">
                        Novo
                      </span>
                    )}
                  </td>
                  <td className="whitespace-nowrap px-2 py-2 align-middle">
                    <select
                      className="min-w-[12.5rem] rounded-lg border border-slate-300 bg-white py-1.5 pl-2 pr-6 text-xs font-medium text-slate-800 shadow-sm focus:border-fuchsia-500 focus:outline-none focus:ring-1 focus:ring-fuchsia-300"
                      value={draftEnc[p.id] ?? ""}
                      onChange={(e) => setDraftEnc((d) => ({ ...d, [p.id]: e.target.value }))}
                    >
                      {ENC_OPTS.map((o) => (
                        <option key={o.value || "empty"} value={o.value}>
                          {o.label}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td className="whitespace-nowrap px-2 py-2 align-middle">
                    <select
                      className="min-w-[12.5rem] rounded-lg border border-slate-300 bg-white py-1.5 pl-2 pr-6 text-xs font-medium text-slate-800 shadow-sm focus:border-fuchsia-500 focus:outline-none focus:ring-1 focus:ring-fuchsia-300"
                      value={draftFin[p.id] ?? ""}
                      onChange={(e) => setDraftFin((d) => ({ ...d, [p.id]: e.target.value }))}
                    >
                      {FIN_OPTS.map((o) => (
                        <option key={o.value || "empty"} value={o.value}>
                          {o.label}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td className="whitespace-nowrap px-3 py-2 text-right">
                    <button
                      type="button"
                      onClick={() => void savePanicDisposition(p.id)}
                      className="rounded-lg bg-fuchsia-700 px-3 py-1.5 text-xs font-semibold text-white shadow-sm hover:bg-fuchsia-800"
                    >
                      Salvar
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
