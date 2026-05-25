"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

const TIPO_AMEACA_OPCOES = ["Física", "Moral", "Psicológica", "Sexual", "Patrimonial", "Outros"] as const;

const REGIAO_ADMINISTRATIVA_OPCOES = [
  "Água Quente",
  "Arapoanga",
  "Águas Claras",
  "Arniqueira",
  "Brazlândia",
  "Candangolândia",
  "Ceilândia",
  "Cruzeiro",
  "Fercal",
  "Gama",
  "Guará",
  "Itapoã",
  "Jardim Botânico",
  "Lago Norte",
  "Lago Sul",
  "Núcleo Bandeirante",
  "Paranoá",
  "Park Way",
  "Planaltina",
  "Plano Piloto",
  "Recanto das Emas",
  "Riacho Fundo",
  "Riacho Fundo II",
  "Samambaia",
  "Santa Maria",
  "São Sebastião",
  "SCIA/Estrutural",
  "SIA",
  "Sobradinho",
  "Sobradinho II",
  "Sol Nascente e Pôr do Sol",
  "Sudoeste/Octogonal",
  "Taguatinga",
  "Varjão",
  "Vicente Pires",
] as const;

const IDADE_AGRESSOR_OPCOES = ["16 a 24", "25 a 34", "35 a 44", "45 a 49", "mais 50 anos"] as const;

const AGRESSOR_ENVOLVIMENTO_OPCOES = [
  "Agressão Física",
  "Ameaça",
  "Drogas",
  "Porte de Arma",
  "Desacato",
  "Homicídio",
  "Roubo/Furto",
  "Estelionato",
  "Crime de Trânsito",
  "Outros",
] as const;

const PARENTESCO_OPCOES = [
  "Companheiro",
  "Ex Companheiro",
  "Marido",
  "Ex Marido",
  "Namorado",
  "Ex Namorado",
  "Pai",
  "Irmão",
  "Filho",
  "Tio",
  "Primo",
  "Vizinho",
  "Outros",
] as const;

const DESFECHO_OPCOES = [
  "Primeira Denuncia",
  "Nova Denuncia da mesma pessoa",
  "Nova Denuncia de outra pessoa",
  "Acompanhando",
  "Finalizada",
] as const;

type FormState = Record<string, string>;

function toIsoDateTime(local: string) {
  if (!local) return undefined;
  const d = new Date(local);
  return Number.isNaN(d.getTime()) ? undefined : d.toISOString();
}

function toIsoDateOnly(date: string) {
  if (!date) return undefined;
  const d = new Date(`${date}T12:00:00`);
  return Number.isNaN(d.getTime()) ? undefined : d.toISOString();
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

function formatPhoneBr(value: string) {
  const digits = onlyDigits(value).slice(0, 11);
  if (digits.length <= 2) return digits;
  if (digits.length <= 6) return `(${digits.slice(0, 2)}) ${digits.slice(2)}`;
  if (digits.length <= 10) return `(${digits.slice(0, 2)}) ${digits.slice(2, 6)}-${digits.slice(6)}`;
  return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
}

function Field({
  label,
  value,
  onChange,
  textarea,
  type = "text",
  disabled,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  textarea?: boolean;
  type?: string;
  disabled?: boolean;
}) {
  const common =
    "mt-1 w-full rounded-xl border border-white/80 bg-white/70 px-3 py-2 text-sm text-slate-900 shadow-sm backdrop-blur-sm outline-none transition focus:border-fuchsia-400/70 focus:ring-2 focus:ring-fuchsia-200/80 disabled:cursor-not-allowed disabled:opacity-60";
  const shouldOpenPicker = type === "date" || type === "datetime-local";
  return (
    <label className="block">
      <span className="text-xs font-semibold uppercase tracking-wide text-slate-600">{label}</span>
      {textarea ? (
        <textarea
          className={`${common} min-h-[96px]`}
          value={value}
          disabled={disabled}
          onChange={(e) => onChange(e.target.value)}
        />
      ) : (
        <input
          className={common}
          type={type}
          value={value}
          disabled={disabled}
          onChange={(e) => onChange(e.target.value)}
          onFocus={(e) => {
            if (shouldOpenPicker && "showPicker" in e.currentTarget) {
              try {
                e.currentTarget.showPicker();
              } catch {
                /* navegador sem permissão para abrir picker programaticamente */
              }
            }
          }}
        />
      )}
    </label>
  );
}

const selectClass =
  "mt-1 w-full rounded-xl border border-white/80 bg-white/70 px-3 py-2 text-sm text-slate-900 shadow-sm outline-none transition focus:border-fuchsia-400/70 focus:ring-2 focus:ring-fuchsia-200/80 disabled:cursor-not-allowed disabled:opacity-60";

function SelectPresetField({
  label,
  value,
  onChange,
  options,
  disabled,
  placeholder = "Selecione…",
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: readonly string[];
  disabled?: boolean;
  placeholder?: string;
}) {
  const normalized = value.trim();
  const merged = (() => {
    const set = new Set<string>(options);
    if (normalized) set.add(normalized);
    return Array.from(set);
  })();
  const selectValue = normalized && merged.includes(normalized) ? normalized : "";

  return (
    <label className="block">
      <span className="text-xs font-semibold uppercase tracking-wide text-slate-600">{label}</span>
      <select className={selectClass} value={selectValue} disabled={disabled} onChange={(e) => onChange(e.target.value)}>
        <option value="">{placeholder}</option>
        {merged.map((o) => (
          <option key={o} value={o}>
            {o.length > 120 ? `${o.slice(0, 118)}…` : o}
          </option>
        ))}
      </select>
    </label>
  );
}

function RegistrouBoSelectField({
  label,
  value,
  onChange,
  optionsFromDb,
  loading,
  disabled,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  optionsFromDb: string[];
  loading: boolean;
  disabled?: boolean;
}) {
  const merged = (() => {
    const set = new Set<string>();
    for (const o of optionsFromDb) {
      const t = o.trim();
      if (t) set.add(t);
    }
    const v = value.trim();
    if (v) set.add(v);
    return Array.from(set).sort((a, b) => a.localeCompare(b, "pt-BR"));
  })();

  const normalized = value.trim();
  const selectValue = normalized && merged.includes(normalized) ? normalized : "";

  return (
    <label className="block">
      <span className="text-xs font-semibold uppercase tracking-wide text-slate-600">{label}</span>
      <select
        className={selectClass}
        value={selectValue}
        disabled={disabled || loading}
        onChange={(e) => onChange(e.target.value)}
      >
        <option value="">{loading ? "Carregando opções…" : "Selecione…"}</option>
        {merged.map((o) => (
          <option key={o} value={o}>
            {o.length > 120 ? `${o.slice(0, 118)}…` : o}
          </option>
        ))}
      </select>
      <p className="mt-1 text-xs text-slate-500">
        Itens listados: valores distintos já presentes no banco (importação e cadastros anteriores).
      </p>
    </label>
  );
}

function buildPayload(form: FormState) {
  return {
    carimboDataHora: toIsoDateTime(form.carimboDataHora),
    nomeVitima: form.nomeVitima || undefined,
    enderecoVitima: form.enderecoVitima || undefined,
    telefoneVitima: form.telefoneVitima || undefined,
    telefoneVitimaSecundario: form.telefoneVitimaSecundario || undefined,
    cpfVitima: form.cpfVitima || undefined,
    dataNascimentoVitima: toIsoDateOnly(form.dataNascimentoVitima),
    genitoraVitima: form.genitoraVitima || undefined,
    pontoReferencia: form.pontoReferencia || undefined,
    dataHoraOcorrencia: toIsoDateTime(form.dataHoraOcorrencia),
    regiaoAdministrativa: form.regiaoAdministrativa || undefined,
    historicoOcorrencia: form.historicoOcorrencia || undefined,
    nomeAgressor: form.nomeAgressor || undefined,
    enderecoAgressor: form.enderecoAgressor || undefined,
    parentescoAgressorVitima: form.parentescoAgressorVitima || undefined,
    tipoAmeacaAgressao: form.tipoAmeacaAgressao || undefined,
    agressorEnvolvimento: form.agressorEnvolvimento || undefined,
    idadeAgressor: form.idadeAgressor || undefined,
    nomeDenunciante: form.nomeDenunciante || undefined,
    enderecoDenunciante: form.enderecoDenunciante || undefined,
    telefoneDenunciante: form.telefoneDenunciante || undefined,
    comandanteViatura: form.comandanteViatura || undefined,
    responsavelAtendimento: form.responsavelAtendimento || undefined,
    encaminhamentoDetalhes: form.encaminhamentoDetalhes || undefined,
    desfecho: form.desfecho || undefined,
    registrouBoDp: form.registrouBoDp || undefined,
    numeroOcorrenciaCad: form.numeroOcorrenciaCad || undefined,
  };
}

function fromServerOccurrence(o: Record<string, unknown>) {
  const fmt = (d: unknown) => {
    if (!d) return "";
    const dt = new Date(String(d));
    if (Number.isNaN(dt.getTime())) return "";
    const pad = (n: number) => String(n).padStart(2, "0");
    return `${dt.getFullYear()}-${pad(dt.getMonth() + 1)}-${pad(dt.getDate())}T${pad(dt.getHours())}:${pad(
      dt.getMinutes(),
    )}`;
  };
  const fmtDate = (d: unknown) => {
    if (!d) return "";
    const dt = new Date(String(d));
    if (Number.isNaN(dt.getTime())) return "";
    const pad = (n: number) => String(n).padStart(2, "0");
    return `${dt.getFullYear()}-${pad(dt.getMonth() + 1)}-${pad(dt.getDate())}`;
  };

  const s = (v: unknown) => (v == null ? "" : String(v));
  return {
    carimboDataHora: fmt(o.carimboDataHora),
    nomeVitima: s(o.nomeVitima),
    enderecoVitima: s(o.enderecoVitima),
    telefoneVitima: s(o.telefoneVitima),
    telefoneVitimaSecundario: s(o.telefoneVitimaSecundario),
    cpfVitima: s(o.cpfVitima),
    dataNascimentoVitima: fmtDate(o.dataNascimentoVitima),
    genitoraVitima: s(o.genitoraVitima),
    pontoReferencia: s(o.pontoReferencia),
    dataHoraOcorrencia: fmt(o.dataHoraOcorrencia),
    regiaoAdministrativa: s(o.regiaoAdministrativa),
    historicoOcorrencia: s(o.historicoOcorrencia),
    nomeAgressor: s(o.nomeAgressor),
    enderecoAgressor: s(o.enderecoAgressor),
    parentescoAgressorVitima: s(o.parentescoAgressorVitima),
    tipoAmeacaAgressao: s(o.tipoAmeacaAgressao),
    agressorEnvolvimento: s(o.agressorEnvolvimento),
    idadeAgressor: s(o.idadeAgressor),
    nomeDenunciante: s(o.nomeDenunciante),
    enderecoDenunciante: s(o.enderecoDenunciante),
    telefoneDenunciante: s(o.telefoneDenunciante),
    comandanteViatura: s(o.comandanteViatura),
    responsavelAtendimento: s(o.responsavelAtendimento),
    encaminhamentoDetalhes: s(o.encaminhamentoDetalhes),
    desfecho: s(o.desfecho),
    registrouBoDp: s(o.registrouBoDp).trim(),
    numeroOcorrenciaCad: s(o.numeroOcorrenciaCad),
  } satisfies FormState;
}

export function OcorrenciaWizard({
  occurrenceId,
  sessionIsAdmin = false,
}: {
  occurrenceId?: string;
  /** Definido no servidor (evita pedido extra a /api/auth/me). */
  sessionIsAdmin?: boolean;
}) {
  const router = useRouter();
  const [tab, setTab] = useState<1 | 2 | 3>(1);
  const [id, setId] = useState<string | undefined>(occurrenceId);
  const [msg, setMsg] = useState<string | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [salvando, setSalvando] = useState(false);
  const [registrouBoOpcoesDb, setRegistrouBoOpcoesDb] = useState<string[]>([]);
  const [registrouBoOpcoesCarregando, setRegistrouBoOpcoesCarregando] = useState(true);
  const readOnly = Boolean(occurrenceId) && !sessionIsAdmin;

  const empty = useMemo(
    () =>
      ({
        carimboDataHora: "",
        nomeVitima: "",
        enderecoVitima: "",
        telefoneVitima: "",
        telefoneVitimaSecundario: "",
        cpfVitima: "",
        dataNascimentoVitima: "",
        genitoraVitima: "",
        pontoReferencia: "",
        dataHoraOcorrencia: "",
        regiaoAdministrativa: "",
        historicoOcorrencia: "",
        nomeAgressor: "",
        enderecoAgressor: "",
        parentescoAgressorVitima: "",
        tipoAmeacaAgressao: "",
        agressorEnvolvimento: "",
        idadeAgressor: "",
        nomeDenunciante: "",
        enderecoDenunciante: "",
        telefoneDenunciante: "",
        comandanteViatura: "",
        responsavelAtendimento: "",
        encaminhamentoDetalhes: "",
        desfecho: "",
        registrouBoDp: "",
        numeroOcorrenciaCad: "",
      }) satisfies FormState,
    [],
  );

  const [form, setForm] = useState<FormState>(empty);

  useEffect(() => {
    let ok = true;
    (async () => {
      try {
        const res = await fetch("/api/ocorrencias/registrou-bo-opcoes", { credentials: "include" });
        const data = await res.json().catch(() => ({}));
        if (!ok) return;
        if (res.ok && Array.isArray(data.options)) {
          setRegistrouBoOpcoesDb(data.options);
        } else {
          setRegistrouBoOpcoesDb([]);
        }
      } catch {
        if (ok) setRegistrouBoOpcoesDb([]);
        if (ok) setRegistrouBoOpcoesCarregando(false);
        return;
      }
      if (ok) setRegistrouBoOpcoesCarregando(false);
    })();
    return () => {
      ok = false;
    };
  }, []);

  useEffect(() => {
    if (!occurrenceId) return;
    let ok = true;
    (async () => {
      const res = await fetch(`/api/ocorrencias/${occurrenceId}`, { credentials: "include" });
      const data = await res.json().catch(() => ({}));
      if (!ok) return;
      if (!res.ok) {
        setErro(data.error || "Não foi possível carregar a ocorrência.");
        return;
      }
      setForm({ ...empty, ...fromServerOccurrence(data.occurrence as Record<string, unknown>) });
      setTab((data.occurrence.faseAtual as 1 | 2 | 3) ?? 1);
    })();
    return () => {
      ok = false;
    };
  }, [occurrenceId, empty]);

  function set<K extends keyof FormState>(k: K, v: string) {
    setForm((p) => ({ ...p, [k]: v }));
  }

  async function salvarFase1() {
    if (readOnly) return;
    setErro(null);
    setMsg(null);
    setSalvando(true);
    try {
      const payload = { ...buildPayload(form), faseAtual: 1, concluida: false };
      if (id) {
        const res = await fetch(`/api/ocorrencias/${id}`, {
          method: "PATCH",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data.error || "Falha ao salvar.");
        setMsg("Fase 1 salva.");
        setTab(2);
        return;
      }
      const res = await fetch("/api/ocorrencias", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Falha ao criar.");
      setId(data.occurrence.id);
      setMsg("Registro criado. Avance para a fase 2.");
      setTab(2);
      router.replace(`/app/ocorrencias/${data.occurrence.id}`);
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Erro.");
    } finally {
      setSalvando(false);
    }
  }

  async function salvarFase2() {
    if (readOnly) return;
    if (!id) {
      setErro("Salve a fase 1 antes.");
      return;
    }
    setErro(null);
    setMsg(null);
    setSalvando(true);
    try {
      const res = await fetch(`/api/ocorrencias/${id}`, {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...buildPayload(form), faseAtual: 2, concluida: false }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Falha ao salvar.");
      setMsg("Fase 2 salva.");
      setTab(3);
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Erro.");
    } finally {
      setSalvando(false);
    }
  }

  async function salvarFase3() {
    if (readOnly) return;
    if (!id) {
      setErro("Salve a fase 1 antes.");
      return;
    }
    setErro(null);
    setMsg(null);
    setSalvando(true);
    try {
      const res = await fetch(`/api/ocorrencias/${id}`, {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...buildPayload(form), faseAtual: 3, concluida: true }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Falha ao salvar.");
      setMsg("Ocorrência concluída (desfecho final registrado).");
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Erro.");
    } finally {
      setSalvando(false);
    }
  }

  const tabs = (
    <div className="flex flex-wrap gap-2">
      {(
        [
          [1, "1) Atendimento inicial"],
          [2, "2) Encaminhamento"],
          [3, "3) Desfecho final"],
        ] as const
      ).map(([n, label]) => (
        <button
          key={n}
          type="button"
          onClick={() => setTab(n)}
          className={`rounded-full px-3 py-1 text-sm font-semibold ${
            tab === n
              ? "bg-gradient-to-r from-fuchsia-600 to-violet-600 text-white shadow-md shadow-fuchsia-500/25 ring-1 ring-white/25"
              : "border border-white/60 bg-white/50 text-slate-800 shadow-sm backdrop-blur-sm hover:border-fuchsia-200/80 hover:bg-white/80"
          }`}
        >
          {label}
        </button>
      ))}
    </div>
  );

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        {tabs}
        {id ? <div className="text-xs text-slate-500">ID interno: {id}</div> : null}
      </div>

      {readOnly ? (
        <p className="rounded-xl border border-amber-200/80 bg-amber-50/90 px-4 py-3 text-sm text-amber-950">
          Visualização apenas. Alteração de ocorrências existentes é restrita ao perfil <strong>administrador</strong>.
        </p>
      ) : null}
      {msg ? <p className="text-sm text-emerald-700">{msg}</p> : null}
      {erro ? <p className="text-sm text-red-600">{erro}</p> : null}

      {tab === 1 ? (
        <div className="grid gap-4 rounded-2xl border border-white/70 bg-white/80 p-4 shadow-lg shadow-slate-900/5 backdrop-blur-md ring-1 ring-white/45 lg:grid-cols-2">
          <div className="lg:col-span-2 text-sm font-semibold text-slate-900">
            Fase 1 — Atendimento inicial (espelha o formulário Excel)
          </div>
          <Field disabled={readOnly} label="Data/Hora da ocorrência" type="datetime-local" value={form.dataHoraOcorrencia} onChange={(v) => set("dataHoraOcorrencia", v)} />
          <Field disabled={readOnly} label="Nome da vítima" value={form.nomeVitima} onChange={(v) => set("nomeVitima", v)} />
          <Field disabled={readOnly} label="CPF da vítima" value={form.cpfVitima} onChange={(v) => set("cpfVitima", formatCpf(v))} />
          <Field disabled={readOnly} label="Data de nascimento da vítima" type="date" value={form.dataNascimentoVitima} onChange={(v) => set("dataNascimentoVitima", v)} />
          <Field disabled={readOnly} label="Genitora da vítima" value={form.genitoraVitima} onChange={(v) => set("genitoraVitima", v)} />
          <Field disabled={readOnly} label="Endereço da vítima" value={form.enderecoVitima} onChange={(v) => set("enderecoVitima", v)} />
          <Field
            disabled={readOnly}
            label="Telefone da vítima"
            value={form.telefoneVitima}
            onChange={(v) => set("telefoneVitima", formatPhoneBr(v))}
          />
          <Field
            disabled={readOnly}
            label="Telefone da vítima (secundário)"
            value={form.telefoneVitimaSecundario}
            onChange={(v) => set("telefoneVitimaSecundario", formatPhoneBr(v))}
          />
          <Field disabled={readOnly} label="Ponto de referência" value={form.pontoReferencia} onChange={(v) => set("pontoReferencia", v)} />
          <SelectPresetField
            disabled={readOnly}
            label="Região administrativa da ocorrência"
            value={form.regiaoAdministrativa}
            onChange={(v) => set("regiaoAdministrativa", v)}
            options={REGIAO_ADMINISTRATIVA_OPCOES}
          />
          <div className="lg:col-span-2">
            <Field disabled={readOnly} label="Histórico da ocorrência" textarea value={form.historicoOcorrencia} onChange={(v) => set("historicoOcorrencia", v)} />
          </div>
          <Field disabled={readOnly} label="Nome do agressor" value={form.nomeAgressor} onChange={(v) => set("nomeAgressor", v)} />
          <Field disabled={readOnly} label="Endereço do agressor" value={form.enderecoAgressor} onChange={(v) => set("enderecoAgressor", v)} />
          <SelectPresetField
            disabled={readOnly}
            label="Parentesco do agressor com a vítima"
            value={form.parentescoAgressorVitima}
            onChange={(v) => set("parentescoAgressorVitima", v)}
            options={PARENTESCO_OPCOES}
          />
          <SelectPresetField
            disabled={readOnly}
            label="Tipo de ameaça ou agressão"
            value={form.tipoAmeacaAgressao}
            onChange={(v) => set("tipoAmeacaAgressao", v)}
            options={TIPO_AMEACA_OPCOES}
          />
          <SelectPresetField
            disabled={readOnly}
            label="Agressor possui algum envolvimento com"
            value={form.agressorEnvolvimento}
            onChange={(v) => set("agressorEnvolvimento", v)}
            options={AGRESSOR_ENVOLVIMENTO_OPCOES}
          />
          <SelectPresetField
            disabled={readOnly}
            label="Idade do agressor"
            value={form.idadeAgressor}
            onChange={(v) => set("idadeAgressor", v)}
            options={IDADE_AGRESSOR_OPCOES}
          />
          <Field disabled={readOnly} label="Nome do denunciante" value={form.nomeDenunciante} onChange={(v) => set("nomeDenunciante", v)} />
          <Field disabled={readOnly} label="Endereço do denunciante" value={form.enderecoDenunciante} onChange={(v) => set("enderecoDenunciante", v)} />
          <Field
            disabled={readOnly}
            label="Telefone do denunciante"
            value={form.telefoneDenunciante}
            onChange={(v) => set("telefoneDenunciante", formatPhoneBr(v))}
          />
          <div className="lg:col-span-2 flex justify-end">
            <button
              type="button"
              disabled={salvando || readOnly}
              onClick={salvarFase1}
              className="btn-aurora px-5 py-2.5 disabled:opacity-60"
            >
              {salvando ? "Salvando…" : "Salvar fase 1"}
            </button>
          </div>
        </div>
      ) : null}

      {tab === 2 ? (
        <div className="grid gap-4 rounded-2xl border border-white/70 bg-white/80 p-4 shadow-lg shadow-slate-900/5 backdrop-blur-md ring-1 ring-white/45 lg:grid-cols-2">
          <div className="lg:col-span-2 text-sm font-semibold text-slate-900">Fase 2 — Encaminhamento</div>
          <Field disabled={readOnly} label="Comandante / viatura do atendimento" value={form.comandanteViatura} onChange={(v) => set("comandanteViatura", v)} />
          <Field disabled={readOnly} label="Responsável pelo atendimento" value={form.responsavelAtendimento} onChange={(v) => set("responsavelAtendimento", v)} />
          <div className="lg:col-span-2">
            <Field disabled={readOnly} label="Detalhes do encaminhamento" textarea value={form.encaminhamentoDetalhes} onChange={(v) => set("encaminhamentoDetalhes", v)} />
          </div>
          <div className="lg:col-span-2 flex justify-end gap-2">
            <button type="button" onClick={() => setTab(1)} className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold">
              Voltar
            </button>
            <button
              type="button"
              disabled={salvando || readOnly}
              onClick={salvarFase2}
              className="btn-aurora px-5 py-2.5 disabled:opacity-60"
            >
              {salvando ? "Salvando…" : "Salvar fase 2"}
            </button>
          </div>
        </div>
      ) : null}

      {tab === 3 ? (
        <div className="grid gap-4 rounded-2xl border border-white/70 bg-white/80 p-4 shadow-lg shadow-slate-900/5 backdrop-blur-md ring-1 ring-white/45 lg:grid-cols-2">
          <div className="lg:col-span-2 text-sm font-semibold text-slate-900">Fase 3 — Desfecho final</div>
          <SelectPresetField
            disabled={readOnly}
            label="Desfecho"
            value={form.desfecho}
            onChange={(v) => set("desfecho", v)}
            options={DESFECHO_OPCOES}
          />
          <RegistrouBoSelectField
            disabled={readOnly}
            label="Registrou BO na DP?"
            value={form.registrouBoDp}
            onChange={(v) => set("registrouBoDp", v)}
            optionsFromDb={registrouBoOpcoesDb}
            loading={registrouBoOpcoesCarregando}
          />
          <Field
            disabled={readOnly}
            label="Número ocorrência CAD COPOM PMDF"
            value={form.numeroOcorrenciaCad}
            onChange={(v) => set("numeroOcorrenciaCad", v)}
          />
          <div className="lg:col-span-2 flex justify-end gap-2">
            <button type="button" onClick={() => setTab(2)} className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold">
              Voltar
            </button>
            <button
              type="button"
              disabled={salvando || readOnly}
              onClick={salvarFase3}
              className="btn-aurora px-5 py-2.5 disabled:opacity-60"
            >
              {salvando ? "Salvando…" : "Concluir cadastro"}
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
