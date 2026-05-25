"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";

const LAST_PHONE_KEY = "copom-vitima-ultimo-telefone";

type ServerCadastroDto = {
  id: string;
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

type PayloadLocal = {
  centralId?: string;
  vitima: {
    nome: string;
    telefone: string;
    idade: string;
    cpf: string;
    identidade: string;
    medidaProtetiva: "sim" | "nao" | "nao_informado";
    enderecoResidencia: string;
    fotoVitima: string | null;
  };
  agressor: { nome: string; endereco: string; fotoAgressor: string | null };
  localizacao: { latitude: number | null; longitude: number | null; accuracyM: number | null };
  savedAt: string;
};

type GeoState = {
  latitude: number | null;
  longitude: number | null;
  accuracyM: number | null;
  status: "idle" | "loading" | "ready" | "error";
  message: string | null;
};

const initialGeoState: GeoState = {
  latitude: null,
  longitude: null,
  accuracyM: null,
  status: "idle",
  message: null,
};

function onlyDigits(value: string) {
  return value.replace(/\D/g, "");
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

function isValidCpf(value: string) {
  const cpf = onlyDigits(value);
  if (cpf.length !== 11) return false;
  if (/^(\d)\1{10}$/.test(cpf)) return false;

  const calcDigit = (base: string, factor: number) => {
    let total = 0;
    for (let i = 0; i < base.length; i += 1) {
      total += Number(base[i]) * (factor - i);
    }
    const remainder = (total * 10) % 11;
    return remainder === 10 ? 0 : remainder;
  };

  const d1 = calcDigit(cpf.slice(0, 9), 10);
  const d2 = calcDigit(cpf.slice(0, 10), 11);
  return d1 === Number(cpf[9]) && d2 === Number(cpf[10]);
}

function isValidPhoneBr(value: string) {
  const digits = onlyDigits(value);
  return digits.length === 10 || digits.length === 11;
}

function storageKeyForPhone(telefoneValue: string) {
  const digits = onlyDigits(telefoneValue);
  return `copom-vitima-cadastro-${digits}`;
}

/** Coordenadas guardadas neste aparelho (último payload), para pânico quando o GPS falha. */
function readLocalPayloadCoords(telefoneValue: string): {
  latitude: number;
  longitude: number;
  accuracyM: number | null;
} | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(storageKeyForPhone(telefoneValue));
    if (!raw) return null;
    const p = JSON.parse(raw) as PayloadLocal;
    const la = p.localizacao?.latitude;
    const lo = p.localizacao?.longitude;
    if (typeof la === "number" && typeof lo === "number" && Number.isFinite(la) && Number.isFinite(lo)) {
      return { latitude: la, longitude: lo, accuracyM: p.localizacao?.accuracyM ?? null };
    }
  } catch {
    return null;
  }
  return null;
}

export function MobileVitimaForm() {
  const searchParams = useSearchParams();
  const embeddedIphone = searchParams.get("embed") === "iphone";

  useEffect(() => {
    if (!embeddedIphone) return;
    document.documentElement.classList.add("mobile-vitima-iphone-embed");
    document.body.classList.add("mobile-vitima-iphone-embed");
    return () => {
      document.documentElement.classList.remove("mobile-vitima-iphone-embed");
      document.body.classList.remove("mobile-vitima-iphone-embed");
    };
  }, [embeddedIphone]);

  const [cadastroCentralId, setCadastroCentralId] = useState<string | null>(null);
  const [persistFotoVitimaNome, setPersistFotoVitimaNome] = useState<string | null>(null);
  const [persistFotoAgressorNome, setPersistFotoAgressorNome] = useState<string | null>(null);

  const [nomeVitima, setNomeVitima] = useState("");
  const [telefone, setTelefone] = useState("");
  const [idade, setIdade] = useState("");
  const [cpf, setCpf] = useState("");
  const [identidade, setIdentidade] = useState("");
  const [temMedidaProtetiva, setTemMedidaProtetiva] = useState<"sim" | "nao" | "nao_informado">("nao_informado");
  const [enderecoResidencia, setEnderecoResidencia] = useState("");
  const [nomeAgressor, setNomeAgressor] = useState("");
  const [enderecoAgressor, setEnderecoAgressor] = useState("");
  const [fotoVitima, setFotoVitima] = useState<File | null>(null);
  const [fotoAgressor, setFotoAgressor] = useState<File | null>(null);
  const [geo, setGeo] = useState<GeoState>(initialGeoState);
  const [cadastroMsg, setCadastroMsg] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [panicMsg, setPanicMsg] = useState<string | null>(null);
  const [sendingPanic, setSendingPanic] = useState(false);
  const [syncCentral, setSyncCentral] = useState(false);
  const [latManual, setLatManual] = useState("");
  const [lngManual, setLngManual] = useState("");

  const fotoVitimaName = useMemo(
    () => fotoVitima?.name ?? persistFotoVitimaNome ?? "Nenhum arquivo selecionado",
    [fotoVitima, persistFotoVitimaNome],
  );
  const fotoAgressorName = useMemo(
    () => fotoAgressor?.name ?? persistFotoAgressorNome ?? "Nenhum arquivo selecionado",
    [fotoAgressor, persistFotoAgressorNome],
  );

  const precisaFotoVitimaObrigatoria = !cadastroCentralId && !persistFotoVitimaNome;

  /** Ao abrir: último telefone usado neste aparelho. */
  useEffect(() => {
    if (typeof window === "undefined") return;
    const raw = localStorage.getItem(LAST_PHONE_KEY);
    if (!raw) return;
    const d = onlyDigits(raw);
    if (d.length !== 10 && d.length !== 11) return;
    setTelefone(formatPhoneBr(d));
  }, []);

  /** Telefone válido: sincroniza com a central (prioridade) e, se não houver registo, com o armazenamento local. */
  useEffect(() => {
    const d = onlyDigits(telefone);
    if (d.length !== 10 && d.length !== 11) {
      return;
    }

    const ac = new AbortController();
    const timer = window.setTimeout(() => {
      void (async () => {
        try {
          localStorage.setItem(LAST_PHONE_KEY, d);
          setSyncCentral(true);
          const r = await fetch("/api/vitima-app/cadastro/carregar", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ telefone: d }),
            signal: ac.signal,
          });
          const data = (await r.json().catch(() => ({}))) as { ok?: boolean; cadastro?: ServerCadastroDto | null };
          if (ac.signal.aborted) return;

          if (r.ok && data.cadastro) {
            const c = data.cadastro;
            setCadastroCentralId(c.id);
            setTelefone(formatPhoneBr(c.telefoneDigits));
            setNomeVitima(c.nomeVitima ?? "");
            setIdade(c.idade ?? "");
            setCpf(c.cpf ? (onlyDigits(c.cpf).length === 11 ? formatCpf(c.cpf) : c.cpf) : "");
            setIdentidade(c.identidade ?? "");
            const mp = c.medidaProtetiva;
            if (mp === "sim" || mp === "nao" || mp === "nao_informado") {
              setTemMedidaProtetiva(mp);
            } else {
              setTemMedidaProtetiva("nao_informado");
            }
            setEnderecoResidencia(c.enderecoResidencia ?? "");
            setNomeAgressor(c.nomeAgressor ?? "");
            setEnderecoAgressor(c.enderecoAgressor ?? "");
            setPersistFotoVitimaNome(c.fotoVitimaNome ?? null);
            setPersistFotoAgressorNome(c.fotoAgressorNome ?? null);
            if (c.latitude != null && c.longitude != null) {
              setGeo({
                latitude: c.latitude,
                longitude: c.longitude,
                accuracyM: c.accuracyM ?? null,
                status: "ready",
                message: "Dados e localização carregados da central.",
              });
            } else {
              setGeo((prev) => ({ ...prev, message: "Cadastro carregado da central. Toque em «Usar localização do celular» para actualizar GPS." }));
            }

            const payload: PayloadLocal = {
              centralId: c.id,
              vitima: {
                nome: c.nomeVitima ?? "",
                telefone: formatPhoneBr(c.telefoneDigits),
                idade: c.idade ?? "",
                cpf: c.cpf ? (onlyDigits(c.cpf).length === 11 ? formatCpf(c.cpf) : c.cpf) : "",
                identidade: c.identidade ?? "",
                medidaProtetiva: mp === "sim" || mp === "nao" || mp === "nao_informado" ? mp : "nao_informado",
                enderecoResidencia: c.enderecoResidencia ?? "",
                fotoVitima: c.fotoVitimaNome ?? null,
              },
              agressor: {
                nome: c.nomeAgressor ?? "",
                endereco: c.enderecoAgressor ?? "",
                fotoAgressor: c.fotoAgressorNome ?? null,
              },
              localizacao: {
                latitude: c.latitude,
                longitude: c.longitude,
                accuracyM: c.accuracyM ?? null,
              },
              savedAt: new Date().toISOString(),
            };
            localStorage.setItem(storageKeyForPhone(formatPhoneBr(d)), JSON.stringify(payload));
            return;
          }
        } catch {
          /* rede / abort — segue para cópia local */
        } finally {
          if (!ac.signal.aborted) setSyncCentral(false);
        }

        if (ac.signal.aborted) return;

        const raw = localStorage.getItem(storageKeyForPhone(formatPhoneBr(d)));
        if (!raw) {
          setCadastroCentralId(null);
          setPersistFotoVitimaNome(null);
          setPersistFotoAgressorNome(null);
          return;
        }
        try {
          const p = JSON.parse(raw) as PayloadLocal;
          setCadastroCentralId(typeof p.centralId === "string" ? p.centralId : null);
          setNomeVitima(p.vitima?.nome ?? "");
          setIdade(p.vitima?.idade ?? "");
          setCpf(p.vitima?.cpf ?? "");
          setIdentidade(p.vitima?.identidade ?? "");
          if (p.vitima?.medidaProtetiva === "sim" || p.vitima?.medidaProtetiva === "nao" || p.vitima?.medidaProtetiva === "nao_informado") {
            setTemMedidaProtetiva(p.vitima.medidaProtetiva);
          }
          setEnderecoResidencia(p.vitima?.enderecoResidencia ?? "");
          setNomeAgressor(p.agressor?.nome ?? "");
          setEnderecoAgressor(p.agressor?.endereco ?? "");
          setPersistFotoVitimaNome(typeof p.vitima?.fotoVitima === "string" ? p.vitima.fotoVitima : null);
          setPersistFotoAgressorNome(typeof p.agressor?.fotoAgressor === "string" ? p.agressor.fotoAgressor : null);
          if (p.localizacao?.latitude != null && p.localizacao?.longitude != null) {
            setGeo({
              latitude: p.localizacao.latitude,
              longitude: p.localizacao.longitude,
              accuracyM: p.localizacao.accuracyM ?? null,
              status: "ready",
              message: "Localização recuperada do último registo neste aparelho.",
            });
          }
        } catch {
          setCadastroCentralId(null);
          setPersistFotoVitimaNome(null);
          setPersistFotoAgressorNome(null);
        }
      })();
    }, 450);

    return () => {
      window.clearTimeout(timer);
      ac.abort();
    };
  }, [telefone]);

  function mensagemErroGeo(code: number) {
    if (code === 1) {
      return embeddedIphone
        ? "Permissão negada no browser. Clique no ícone de cadeado/endereço na barra do browser → Localização → Permitir. Ou use «Localização de teste» abaixo."
        : "Permissão negada. Active a localização para este site nas definições do browser ou telemóvel.";
    }
    if (code === 2) return "Posição indisponível neste momento. Tente de novo ou use a localização de teste.";
    if (code === 3) return "Tempo esgotado ao obter GPS. No PC use Wi‑Fi, aguarde e tente novamente ou use localização de teste.";
    return "Não foi possível capturar a localização.";
  }

  function pedirPosicao(enableHighAccuracy: boolean) {
    return new Promise<GeolocationPosition>((resolve, reject) => {
      navigator.geolocation.getCurrentPosition(resolve, reject, {
        enableHighAccuracy,
        timeout: enableHighAccuracy ? 20000 : 35000,
        maximumAge: 120000,
      });
    });
  }

  function solicitarLocalizacao() {
    if (!navigator.geolocation) {
      setGeo({
        ...initialGeoState,
        status: "error",
        message: "Seu browser não suporta geolocalização. Use a localização de teste ou abra /mobile-vitima em ecrã inteiro.",
      });
      return;
    }

    setGeo((prev) => ({ ...prev, status: "loading", message: "A pedir localização ao browser…" }));
    void (async () => {
      try {
        let pos: GeolocationPosition;
        try {
          pos = await pedirPosicao(false);
        } catch (first) {
          try {
            pos = await pedirPosicao(true);
          } catch (second) {
            throw second instanceof GeolocationPositionError ? second : first;
          }
        }
        setGeo({
          latitude: pos.coords.latitude,
          longitude: pos.coords.longitude,
          accuracyM: pos.coords.accuracy ?? null,
          status: "ready",
          message: "Localização capturada com sucesso.",
        });
      } catch (e) {
        const code =
          typeof e === "object" && e !== null && "code" in e ? Number((e as GeolocationPositionError).code) : 0;
        setGeo((prev) => ({
          ...prev,
          status: "error",
          message: mensagemErroGeo(code),
        }));
      }
    })();
  }

  function usarLocalizacaoTeste() {
    setGeo({
      latitude: -15.7801,
      longitude: -47.9292,
      accuracyM: 500,
      status: "ready",
      message: "Localização de teste (Brasília-DF). Ideal para simulador no PC.",
    });
  }

  function aplicarCoordenadasManuais(latStr: string, lngStr: string) {
    const lat = Number(latStr.replace(",", "."));
    const lng = Number(lngStr.replace(",", "."));
    if (!Number.isFinite(lat) || !Number.isFinite(lng) || lat < -90 || lat > 90 || lng < -180 || lng > 180) {
      setGeo((prev) => ({
        ...prev,
        status: "error",
        message: "Coordenadas inválidas. Ex.: -15.7801 e -47.9292",
      }));
      return;
    }
    setGeo({
      latitude: lat,
      longitude: lng,
      accuracyM: 100,
      status: "ready",
      message: "Coordenadas manuais aplicadas.",
    });
  }

  async function salvarCadastro(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    setCadastroMsg(null);

    try {
      if (!isValidPhoneBr(telefone)) {
        setCadastroMsg("Telefone inválido. Use DDD + número (10 ou 11 dígitos).");
        return;
      }
      if (!isValidCpf(cpf)) {
        setCadastroMsg("CPF inválido. Verifique os números informados.");
        return;
      }

      const digits = onlyDigits(telefone);
      const apiBody = {
        telefone: digits,
        nomeVitima: nomeVitima.trim(),
        idade: idade.trim() || null,
        cpf: formatCpf(cpf) || null,
        identidade: identidade.trim() || null,
        medidaProtetiva: temMedidaProtetiva,
        enderecoResidencia: enderecoResidencia.trim(),
        latitude: geo.latitude,
        longitude: geo.longitude,
        accuracyM: geo.accuracyM,
        nomeAgressor: nomeAgressor.trim(),
        enderecoAgressor: enderecoAgressor.trim(),
        fotoVitimaNome: fotoVitima?.name ?? persistFotoVitimaNome ?? null,
        fotoAgressorNome: fotoAgressor?.name ?? persistFotoAgressorNome ?? null,
      };

      const isUpdate = Boolean(cadastroCentralId);
      const apiRes = await fetch(
        isUpdate ? `/api/vitima-app/cadastro/${cadastroCentralId}` : "/api/vitima-app/cadastro",
        {
          method: isUpdate ? "PATCH" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(apiBody),
        },
      );
      const apiData = (await apiRes.json().catch(() => ({}))) as { error?: string; details?: unknown; id?: string; message?: string };
      if (!apiRes.ok) {
        const hint =
          apiRes.status === 401 || apiRes.status === 403
            ? "Acesso bloqueado pelo servidor (sessão). Recarregue a página ou contacte o suporte."
            : apiRes.status === 400
              ? "Alguns dados foram recusados pelo servidor. Confira telefone, CPF e campos obrigatórios."
              : "Não foi possível enviar o cadastro à central. Tente de novo em instantes.";
        setCadastroMsg(apiData.error ? `${apiData.error} — ${hint}` : hint);
        return;
      }

      const novoId = apiData.id ?? cadastroCentralId ?? undefined;
      if (novoId) setCadastroCentralId(novoId);

      const nomeFotoVitima = fotoVitima?.name ?? persistFotoVitimaNome ?? null;
      const nomeFotoAgr = fotoAgressor?.name ?? persistFotoAgressorNome ?? null;
      setPersistFotoVitimaNome(nomeFotoVitima);
      setPersistFotoAgressorNome(nomeFotoAgr);

      const payload: PayloadLocal = {
        centralId: novoId,
        vitima: {
          nome: nomeVitima.trim(),
          telefone: formatPhoneBr(telefone),
          idade: idade.trim(),
          cpf: formatCpf(cpf),
          identidade: identidade.trim(),
          medidaProtetiva: temMedidaProtetiva,
          enderecoResidencia: enderecoResidencia.trim(),
          fotoVitima: nomeFotoVitima,
        },
        agressor: {
          nome: nomeAgressor.trim(),
          endereco: enderecoAgressor.trim(),
          fotoAgressor: nomeFotoAgr,
        },
        localizacao: {
          latitude: geo.latitude,
          longitude: geo.longitude,
          accuracyM: geo.accuracyM,
        },
        savedAt: new Date().toISOString(),
      };
      localStorage.setItem(storageKeyForPhone(telefone), JSON.stringify(payload));
      localStorage.setItem(LAST_PHONE_KEY, digits);

      const msgOk =
        apiData.message ??
        (isUpdate
          ? "Alteração guardada com sucesso! O cadastro na central foi atualizado."
          : "Cadastro realizado com sucesso! A central já recebeu os seus dados.");
      setCadastroMsg(`${msgOk} O telefone identifica a vítima; pode usar o pânico abaixo quando necessário.`);
    } catch {
      setCadastroMsg("Falha ao salvar. Tente novamente.");
    } finally {
      setSaving(false);
    }
  }

  async function excluirCadastro() {
    setCadastroMsg(null);
    if (!cadastroCentralId) {
      setCadastroMsg("Não há cadastro na central para excluir neste telefone. Guarde um cadastro primeiro.");
      return;
    }
    if (!isValidPhoneBr(telefone)) {
      setCadastroMsg("Telefone inválido. Confirme o número antes de excluir.");
      return;
    }
    if (
      !window.confirm(
        "Deseja excluir este cadastro na central? Todos os alertas de pânico deste telefone também serão removidos. Esta ação não pode ser desfeita.",
      )
    ) {
      return;
    }

    setSaving(true);
    try {
      const res = await fetch(`/api/vitima-app/cadastro/${cadastroCentralId}`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ telefone: onlyDigits(telefone) }),
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string; message?: string };
      if (!res.ok) {
        setCadastroMsg(data.error ?? "Não foi possível excluir o cadastro. Tente novamente.");
        return;
      }

      localStorage.removeItem(storageKeyForPhone(telefone));
      setCadastroCentralId(null);
      setPersistFotoVitimaNome(null);
      setPersistFotoAgressorNome(null);
      setFotoVitima(null);
      setFotoAgressor(null);
      setNomeVitima("");
      setIdade("");
      setCpf("");
      setIdentidade("");
      setTemMedidaProtetiva("nao_informado");
      setEnderecoResidencia("");
      setNomeAgressor("");
      setEnderecoAgressor("");
      setGeo({ ...initialGeoState });
      setCadastroMsg(
        data.message ??
          "Cadastro excluído com sucesso. Os dados foram removidos da central e deste aparelho. Pode criar um novo cadastro quando precisar.",
      );
    } catch {
      setCadastroMsg("Falha ao excluir. Tente novamente.");
    } finally {
      setSaving(false);
    }
  }

  async function enviarPanico() {
    setPanicMsg(null);
    if (!isValidPhoneBr(telefone)) {
      setPanicMsg("Informe um telefone válido (mesmo do cadastro na central).");
      return;
    }

    let latitude = geo.latitude;
    let longitude = geo.longitude;
    let accuracyM = geo.accuracyM;
    let origem: "gps" | "local" | "central" = "gps";

    if (latitude == null || longitude == null) {
      const fromLocal = readLocalPayloadCoords(telefone);
      if (fromLocal) {
        latitude = fromLocal.latitude;
        longitude = fromLocal.longitude;
        accuracyM = fromLocal.accuracyM;
        origem = "local";
      }
    }

    if (latitude == null || longitude == null) {
      const digits = onlyDigits(telefone);
      try {
        const r = await fetch("/api/vitima-app/cadastro/carregar", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ telefone: digits }),
        });
        const data = (await r.json().catch(() => ({}))) as { cadastro?: ServerCadastroDto | null };
        const c = data.cadastro;
        if (c?.latitude != null && c?.longitude != null) {
          latitude = c.latitude;
          longitude = c.longitude;
          accuracyM = c.accuracyM ?? null;
          origem = "central";
        }
      } catch {
        /* segue para mensagem abaixo */
      }
    }

    if (latitude == null || longitude == null) {
      setPanicMsg(
        "Sem coordenadas para o pânico. Use «Usar localização do celular» ou guarde o cadastro com localização na central.",
      );
      return;
    }

    setSendingPanic(true);
    try {
      const res = await fetch("/api/vitima-app/panico", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          telefone: onlyDigits(telefone),
          latitude,
          longitude,
          accuracyM,
        }),
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        throw new Error(data.error ?? "Não foi possível registrar o pânico.");
      }
      const extra =
        origem === "central"
          ? " Foi usada a localização do cadastro na central (GPS indisponível ou não actualizado)."
          : origem === "local"
            ? " Foi usada a localização do último registo neste aparelho."
            : "";
      setPanicMsg(`Pânico registrado. A central receberá o alerta para encaminhamento.${extra}`);
    } catch (e) {
      setPanicMsg(e instanceof Error ? e.message : "Erro ao enviar pânico.");
    } finally {
      setSendingPanic(false);
    }
  }

  return (
    <main
      className={
        embeddedIphone
          ? "mobile-vitima-in-iphone relative flex h-dvh w-full min-w-0 flex-col overflow-hidden bg-slate-950 text-slate-900"
          : "relative h-dvh overflow-y-auto overflow-x-hidden bg-slate-950 px-3 py-4 text-slate-900"
      }
    >
      <div className="aurora-base pointer-events-none" />
      <div className="aurora-mesh pointer-events-none" />
      <div className="aurora-grid pointer-events-none" />
      <div className="aurora-noise pointer-events-none" />
      <div className="aurora-blob aurora-blob--a pointer-events-none" />
      <div className="aurora-blob aurora-blob--b pointer-events-none" />
      <div className="aurora-blob aurora-blob--c pointer-events-none" />

      <div
        className={
          embeddedIphone
            ? "mobile-vitima-in-iphone__scroll relative flex min-h-0 w-full min-w-0 flex-1 flex-col overflow-y-auto overflow-x-hidden pb-2 pt-12"
            : "relative mx-auto w-full max-w-md"
        }
      >
        <header className="glass-panel rounded-2xl p-4 text-center text-white">
          <div className="shine-sweep" aria-hidden />
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-fuchsia-200">COPOM Mulher</p>
          <h1 className="mt-1 text-xl font-bold text-gradient-brand">Cadastro da Vítima</h1>
        </header>

        <form onSubmit={salvarCadastro} className={`mt-3 w-full space-y-3 ${embeddedIphone ? "pb-28" : "pb-4"}`}>
          <section className="glass-panel--soft rounded-2xl p-4">
            <h2 className="text-sm font-semibold text-slate-800">Identificação</h2>
            <div className="mt-3 space-y-3">
              <Input label="Nome da vítima" value={nomeVitima} onChange={setNomeVitima} icon="user" required />
              <Input
                label="Telefone (chave do cadastro no aplicativo)"
                type="tel"
                value={telefone}
                onChange={(v) => setTelefone(formatPhoneBr(v))}
                placeholder="(61) 99999-9999"
                icon="phone"
                required
              />
              <p className="text-xs text-slate-600">
                O telefone é a chave do cadastro: ao abrir, os dados são carregados da central (ou deste aparelho). Pode alterar,
                excluir e usar o pânico abaixo.
              </p>
              {syncCentral ? (
                <p className="text-xs font-medium text-cyan-700">A sincronizar com a central…</p>
              ) : null}
              <Input label="Idade" type="number" value={idade} onChange={setIdade} icon="calendar" required />
              <Input
                label="CPF"
                value={cpf}
                onChange={(v) => setCpf(formatCpf(v))}
                placeholder="000.000.000-00"
                icon="id"
                required
              />
              <Input label="Identidade (RG)" value={identidade} onChange={setIdentidade} icon="doc" required />
            </div>
          </section>

          <section className="glass-panel--soft rounded-2xl p-4">
            <h2 className="text-sm font-semibold text-slate-800">Proteção e residência</h2>
            <div className="mt-3 space-y-3">
              <label className="block text-sm">
                <span className="mb-1 block font-medium text-slate-700">Possui medida protetiva?</span>
                <select
                  className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm outline-none focus:border-fuchsia-500 focus:ring-2 focus:ring-fuchsia-200"
                  value={temMedidaProtetiva}
                  onChange={(e) => setTemMedidaProtetiva(e.target.value as "sim" | "nao" | "nao_informado")}
                >
                  <option value="nao_informado">Não informado</option>
                  <option value="sim">Sim</option>
                  <option value="nao">Não</option>
                </select>
              </label>
              <label className="block text-sm">
                <span className="mb-1 block font-medium text-slate-700">Endereço da residência</span>
                <textarea
                  className="min-h-20 w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm outline-none focus:border-fuchsia-500 focus:ring-2 focus:ring-fuchsia-200"
                  value={enderecoResidencia}
                  onChange={(e) => setEnderecoResidencia(e.target.value)}
                  required
                />
              </label>
              <button type="button" onClick={solicitarLocalizacao} className="btn-aurora w-full rounded-xl px-3 py-2.5 text-sm">
                {geo.status === "loading"
                  ? "Capturando localização..."
                  : embeddedIphone
                    ? "Usar localização do browser (GPS/Wi‑Fi)"
                    : "Usar localização do celular"}
              </button>
              {embeddedIphone ? (
                <>
                  <button
                    type="button"
                    onClick={usarLocalizacaoTeste}
                    className="w-full rounded-xl border border-violet-300/80 bg-violet-50 px-3 py-2.5 text-sm font-medium text-violet-900 transition hover:bg-violet-100"
                  >
                    Localização de teste (Brasília-DF)
                  </button>
                  <div className="grid grid-cols-2 gap-2">
                    <label className="block text-xs">
                      <span className="mb-1 block font-medium text-slate-600">Latitude</span>
                      <input
                        type="text"
                        inputMode="decimal"
                        placeholder="-15.7801"
                        value={latManual}
                        onChange={(e) => setLatManual(e.target.value)}
                        className="w-full rounded-lg border border-slate-300 bg-white px-2 py-2 text-sm outline-none focus:border-fuchsia-500"
                      />
                    </label>
                    <label className="block text-xs">
                      <span className="mb-1 block font-medium text-slate-600">Longitude</span>
                      <input
                        type="text"
                        inputMode="decimal"
                        placeholder="-47.9292"
                        value={lngManual}
                        onChange={(e) => setLngManual(e.target.value)}
                        className="w-full rounded-lg border border-slate-300 bg-white px-2 py-2 text-sm outline-none focus:border-fuchsia-500"
                      />
                    </label>
                  </div>
                  <button
                    type="button"
                    onClick={() => aplicarCoordenadasManuais(latManual, lngManual)}
                    className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-800 transition hover:bg-slate-50"
                  >
                    Aplicar coordenadas manuais
                  </button>
                  <p className="text-[11px] leading-snug text-slate-500">
                    No simulador PC, o browser pode bloquear GPS dentro do iframe. Permita localização no cadeado da barra
                    de endereços ou use teste/manual acima.{" "}
                    <a href="/mobile-vitima" target="_blank" rel="noopener noreferrer" className="text-violet-700 underline">
                      Abrir em ecrã inteiro
                    </a>
                  </p>
                </>
              ) : null}
              <p className="text-xs text-slate-600">
                {geo.message ??
                  "Ao capturar a localização, o sistema grava latitude/longitude da residência para suporte da central."}
              </p>
              {geo.latitude != null && geo.longitude != null ? (
                <p className="rounded-lg bg-emerald-50 px-2 py-1 text-xs text-emerald-700">
                  Latitude: {geo.latitude.toFixed(6)} | Longitude: {geo.longitude.toFixed(6)}
                </p>
              ) : null}
            </div>
          </section>

          <section className="glass-panel--soft rounded-2xl p-4">
            <h2 className="text-sm font-semibold text-slate-800">Agressor</h2>
            <div className="mt-3 space-y-3">
              <Input label="Nome do agressor" value={nomeAgressor} onChange={setNomeAgressor} icon="user" required />
              <label className="block text-sm">
                <span className="mb-1 block font-medium text-slate-700">Endereço do agressor</span>
                <textarea
                  className="min-h-20 w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm outline-none focus:border-fuchsia-500 focus:ring-2 focus:ring-fuchsia-200"
                  value={enderecoAgressor}
                  onChange={(e) => setEnderecoAgressor(e.target.value)}
                  required
                />
              </label>
            </div>
          </section>

          <section className="glass-panel--soft rounded-2xl p-4">
            <h2 className="text-sm font-semibold text-slate-800">Fotos</h2>
            <div className="mt-3 space-y-3">
              <FileField label="Foto da vítima" onChange={setFotoVitima} helper={fotoVitimaName} required={precisaFotoVitimaObrigatoria} />
              <FileField label="Foto do agressor (se houver)" onChange={setFotoAgressor} helper={fotoAgressorName} />
            </div>
          </section>

          <div className="shine-border-wrap rounded-2xl">
            <button
              type="submit"
              disabled={saving}
              className="btn-aurora w-full rounded-2xl px-4 py-3 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-60"
            >
              {saving
                ? cadastroCentralId
                  ? "A atualizar cadastro..."
                  : "A enviar cadastro..."
                : cadastroCentralId
                  ? "Alterar cadastro"
                  : "Salvar cadastro"}
            </button>
          </div>

          {cadastroCentralId ? (
            <button
              type="button"
              disabled={saving}
              onClick={() => void excluirCadastro()}
              className="w-full rounded-2xl border border-red-300/80 bg-red-950/30 px-4 py-3 text-sm font-semibold text-red-100 transition hover:bg-red-950/50 disabled:cursor-not-allowed disabled:opacity-60"
            >
              Excluir cadastro na central
            </button>
          ) : null}

          {cadastroMsg ? (
            <p className="rounded-lg border border-sky-200/70 bg-sky-50/95 px-3 py-2 text-center text-xs text-sky-700">{cadastroMsg}</p>
          ) : null}
        </form>
      </div>

      <div
        className={
          embeddedIphone
            ? "panic-glass-dock absolute inset-x-0 bottom-0 z-20 pb-6"
            : "panic-glass-dock sticky bottom-0 z-20 mt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]"
        }
      >
        <span className="panic-glass-dock__mirror-veil" aria-hidden />
        <span className="panic-glass-dock__mirror-edge" aria-hidden />
        <div className={`relative w-full min-w-0 space-y-2 ${embeddedIphone ? "" : "mx-auto max-w-md"}`}>
          <div className="panic-glass-mirror-wrap">
            <button
              type="button"
              disabled={sendingPanic}
              onClick={() => void enviarPanico()}
              className="panic-glass-mirror"
              aria-label="Pânico — registrar socorro na central"
            >
              <span className="panic-glass-mirror__base" aria-hidden />
              <span className="panic-glass-mirror__glass" aria-hidden />
              <span className="panic-glass-mirror__mirror-sheet" aria-hidden />
              <span className="panic-glass-mirror__specular" aria-hidden />
              <span className="panic-glass-mirror__reflection" aria-hidden />
              <span className="panic-glass-mirror__reflection panic-glass-mirror__reflection--slow" aria-hidden />
              <span className="panic-glass-mirror__label">
                {sendingPanic ? "Enviando socorro..." : "PÂNICO — REGISTRAR SOCORRO NA CENTRAL"}
              </span>
            </button>
          </div>
          {panicMsg ? (
            <p className="rounded-lg bg-red-50/95 px-3 py-2 text-center text-xs font-medium text-red-800">{panicMsg}</p>
          ) : (
            <p className="text-center text-[11px] leading-snug text-slate-300/90">
              Se o GPS falhar, o sistema tenta usar a <strong className="text-white">localização do cadastro</strong> (central ou
              último registo neste aparelho). Use só em emergência real.
            </p>
          )}
        </div>
      </div>
    </main>
  );
}

type InputProps = {
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: "text" | "tel" | "number";
  placeholder?: string;
  required?: boolean;
  icon?: "user" | "phone" | "id" | "calendar" | "doc";
};

function Input({ label, value, onChange, type = "text", placeholder, required = false, icon = "user" }: InputProps) {
  const iconGlyph = icon === "phone" ? "📞" : icon === "id" ? "🪪" : icon === "calendar" ? "📅" : icon === "doc" ? "📄" : "👤";
  return (
    <label className="block text-sm">
      <span className="mb-1 block font-medium text-slate-700">{label}</span>
      <div className="group relative">
        <div className="pointer-events-none absolute inset-0 rounded-xl bg-gradient-to-r from-fuchsia-400/0 via-violet-400/0 to-cyan-400/0 opacity-0 blur-sm transition duration-300 group-focus-within:opacity-100" />
        <span className="pointer-events-none absolute left-3 top-1/2 z-10 -translate-y-1/2 text-sm">{iconGlyph}</span>
        <input
          type={type}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          required={required}
          className="relative z-10 w-full rounded-xl border border-slate-300/80 bg-white/90 py-2.5 pr-3 pl-9 text-sm outline-none transition focus:border-fuchsia-500 focus:ring-2 focus:ring-fuchsia-200"
        />
      </div>
    </label>
  );
}

type FileFieldProps = {
  label: string;
  onChange: (file: File | null) => void;
  helper: string;
  required?: boolean;
};

function FileField({ label, onChange, helper, required = false }: FileFieldProps) {
  return (
    <label className="block text-sm">
      <span className="mb-1 block font-medium text-slate-700">{label}</span>
      <input
        type="file"
        accept="image/*"
        required={required}
        onChange={(e) => onChange(e.target.files?.[0] ?? null)}
        className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700 file:mr-3 file:rounded-lg file:border-0 file:bg-slate-100 file:px-3 file:py-2 file:text-sm file:font-semibold file:text-slate-700 hover:file:bg-slate-200"
      />
      <p className="mt-1 truncate text-xs text-slate-500">{helper}</p>
    </label>
  );
}
