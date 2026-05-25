import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { LinearGradient } from "expo-linear-gradient";
import * as Location from "expo-location";
import { StatusBar } from "expo-status-bar";
import { useSafeAreaInsets } from "react-native-safe-area-context";

const LAST_PHONE_KEY = "copom-vitima-ultimo-telefone";

function defaultApiBase(): string {
  if (process.env.EXPO_PUBLIC_API_BASE_URL) return process.env.EXPO_PUBLIC_API_BASE_URL;
  if (Platform.OS === "android") return "http://10.0.2.2:3002";
  return "http://127.0.0.1:3002";
}

async function fetchJson(url: string, init?: RequestInit): Promise<Response> {
  try {
    return await fetch(url, init);
  } catch (e) {
    const hint =
      Platform.OS === "android"
        ? " Verifique: servidor na porta 3002 (afastamentos-api), HTTP, ou adb reverse tcp:3002 tcp:3002."
        : "";
    throw new Error(`${e instanceof Error ? e.message : "Falha de rede"}${hint}`);
  }
}

function onlyDigits(v: string) {
  return v.replace(/\D/g, "");
}

type CadastroDto = {
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

export default function App() {
  const insets = useSafeAreaInsets();
  const [apiBase, setApiBase] = useState(() => defaultApiBase());
  const [telefone, setTelefone] = useState("");
  const [cadastroId, setCadastroId] = useState<string | null>(null);
  const [nomeVitima, setNomeVitima] = useState("");
  const [idade, setIdade] = useState("");
  const [cpf, setCpf] = useState("");
  const [identidade, setIdentidade] = useState("");
  const [medida, setMedida] = useState<"sim" | "nao" | "nao_informado">("nao_informado");
  const [endVitima, setEndVitima] = useState("");
  const [nomeAgressor, setNomeAgressor] = useState("");
  const [endAgressor, setEndAgressor] = useState("");
  const [lat, setLat] = useState<number | null>(null);
  const [lng, setLng] = useState<number | null>(null);
  const [acc, setAcc] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [sync, setSync] = useState(false);

  const base = apiBase.replace(/\/$/, "");

  const carregarDaCentral = useCallback(
    async (silent?: boolean) => {
      const d = onlyDigits(telefone);
      if (d.length !== 10 && d.length !== 11) {
        if (!silent) Alert.alert("Telefone", "Indique o telefone com DDD (10 ou 11 dígitos).");
        return;
      }
      setSync(true);
      try {
        await AsyncStorage.setItem(LAST_PHONE_KEY, d);
        const res = await fetchJson(`${base}/orion-mulher/v1/vitima-app/cadastro/carregar`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ telefone: d }),
        });
        const data = (await res.json().catch(() => ({}))) as { cadastro?: CadastroDto | null; error?: string };
        if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
        if (!data.cadastro) {
          setCadastroId(null);
          if (!silent) {
            Alert.alert("Cadastro", "Não há registo na central para este telefone. Preencha e guarde um novo cadastro.");
          }
          return;
        }
        const c = data.cadastro;
        setCadastroId(c.id);
        setNomeVitima(c.nomeVitima ?? "");
        setIdade(c.idade ?? "");
        setCpf(c.cpf ?? "");
        setIdentidade(c.identidade ?? "");
        const mp = c.medidaProtetiva;
        if (mp === "sim" || mp === "nao" || mp === "nao_informado") setMedida(mp);
        else setMedida("nao_informado");
        setEndVitima(c.enderecoResidencia ?? "");
        setNomeAgressor(c.nomeAgressor ?? "");
        setEndAgressor(c.enderecoAgressor ?? "");
        setLat(c.latitude);
        setLng(c.longitude);
        setAcc(c.accuracyM ?? null);
        if (!silent) {
          Alert.alert("Sucesso", "Cadastro completo carregado da central. Pode alterar, excluir ou acionar o pânico.");
        }
      } catch (e) {
        if (!silent) Alert.alert("Erro", e instanceof Error ? e.message : String(e));
      } finally {
        setSync(false);
      }
    },
    [base, telefone],
  );

  useEffect(() => {
    void (async () => {
      const last = await AsyncStorage.getItem(LAST_PHONE_KEY);
      if (last && onlyDigits(last).length >= 10) setTelefone(last);
    })();
  }, []);

  useEffect(() => {
    const d = onlyDigits(telefone);
    if (d.length !== 10 && d.length !== 11) return;
    const t = setTimeout(() => {
      void carregarDaCentral(true);
    }, 600);
    return () => clearTimeout(t);
  }, [telefone, carregarDaCentral]);

  const obterGps = useCallback(async () => {
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== "granted") {
      Alert.alert("Localização", "Permita a localização para o cadastro e o pânico.");
      return;
    }
    const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Highest });
    setLat(pos.coords.latitude);
    setLng(pos.coords.longitude);
    setAcc(pos.coords.accuracy ?? null);
    Alert.alert("GPS", "Localização actualizada.");
  }, []);

  const corpoCadastro = useCallback(() => {
    const d = onlyDigits(telefone);
    return {
      telefone: d,
      nomeVitima: nomeVitima.trim(),
      idade: idade.trim() || null,
      cpf: cpf.trim() || null,
      identidade: identidade.trim() || null,
      medidaProtetiva: medida,
      enderecoResidencia: endVitima.trim(),
      latitude: lat,
      longitude: lng,
      accuracyM: acc,
      nomeAgressor: nomeAgressor.trim(),
      enderecoAgressor: endAgressor.trim(),
      fotoVitimaNome: null,
      fotoAgressorNome: null,
    };
  }, [telefone, nomeVitima, idade, cpf, identidade, medida, endVitima, nomeAgressor, endAgressor, lat, lng, acc]);

  const salvarOuAlterar = useCallback(async () => {
    const d = onlyDigits(telefone);
    if (d.length !== 10 && d.length !== 11) {
      Alert.alert("Telefone", "Telefone inválido.");
      return;
    }
    if (!nomeVitima.trim() || !endVitima.trim() || !nomeAgressor.trim() || !endAgressor.trim()) {
      Alert.alert("Campos", "Preencha nome da vítima, endereços e nome do agressor.");
      return;
    }
    setSaving(true);
    try {
      await AsyncStorage.setItem(LAST_PHONE_KEY, d);
      const body = corpoCadastro();
      const url = cadastroId
        ? `${base}/orion-mulher/v1/vitima-app/cadastro/${cadastroId}`
        : `${base}/orion-mulher/v1/vitima-app/cadastro`;
      const res = await fetchJson(url, {
        method: cadastroId ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = (await res.json().catch(() => ({}))) as { id?: string; message?: string; error?: string };
      if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
      if (data.id) setCadastroId(data.id);
      Alert.alert(
        "Sucesso",
        data.message ?? (cadastroId ? "Alteração guardada com sucesso!" : "Cadastro realizado com sucesso!"),
      );
    } catch (e) {
      Alert.alert("Erro", e instanceof Error ? e.message : String(e));
    } finally {
      setSaving(false);
    }
  }, [base, cadastroId, corpoCadastro, nomeVitima, endVitima, nomeAgressor, endAgressor, telefone]);

  const excluir = useCallback(async () => {
    if (!cadastroId) {
      Alert.alert("Excluir", "Não há cadastro na central para excluir.");
      return;
    }
    const d = onlyDigits(telefone);
    if (d.length !== 10 && d.length !== 11) {
      Alert.alert("Telefone", "Confirme o telefone.");
      return;
    }
    Alert.alert(
      "Excluir cadastro",
      "Confirma a exclusão na central? Todos os alertas de pânico deste telefone também serão removidos.",
      [
        { text: "Cancelar", style: "cancel" },
        {
          text: "Excluir",
          style: "destructive",
          onPress: async () => {
            setSaving(true);
            try {
              const res = await fetchJson(`${base}/orion-mulher/v1/vitima-app/cadastro/${cadastroId}`, {
                method: "DELETE",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ telefone: d }),
              });
              const data = (await res.json().catch(() => ({}))) as { message?: string; error?: string };
              if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
              setCadastroId(null);
              setNomeVitima("");
              setIdade("");
              setCpf("");
              setIdentidade("");
              setMedida("nao_informado");
              setEndVitima("");
              setNomeAgressor("");
              setEndAgressor("");
              setLat(null);
              setLng(null);
              setAcc(null);
              Alert.alert("Sucesso", data.message ?? "Cadastro excluído com sucesso.");
            } catch (e) {
              Alert.alert("Erro", e instanceof Error ? e.message : String(e));
            } finally {
              setSaving(false);
            }
          },
        },
      ],
    );
  }, [base, cadastroId, telefone]);

  /** GPS/coordenadas no ecrã primeiro; se faltarem, último cadastro na central (mesmo telefone). */
  const resolverCoordsPanico = useCallback(async (): Promise<
    { lat: number; lng: number; acc: number | null; origem: "app" | "central" } | null
  > => {
    const d = onlyDigits(telefone);
    if (d.length !== 10 && d.length !== 11) return null;
    if (lat != null && lng != null) {
      return { lat, lng, acc: acc, origem: "app" };
    }
    try {
      const res = await fetchJson(`${base}/orion-mulher/v1/vitima-app/cadastro/carregar`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ telefone: d }),
      });
      const data = (await res.json().catch(() => ({}))) as { cadastro?: CadastroDto | null };
      if (!res.ok) return null;
      const c = data.cadastro;
      if (c?.latitude != null && c?.longitude != null) {
        return { lat: c.latitude, lng: c.longitude, acc: c.accuracyM ?? null, origem: "central" };
      }
    } catch {
      return null;
    }
    return null;
  }, [base, telefone, lat, lng, acc]);

  const panico = useCallback(async () => {
    const d = onlyDigits(telefone);
    if (d.length !== 10 && d.length !== 11) {
      Alert.alert("Pânico", "Indique o telefone.");
      return;
    }
    const resolved = await resolverCoordsPanico();
    if (!resolved) {
      Alert.alert(
        "Pânico",
        "Sem coordenadas. Actualize o GPS ou guarde o cadastro com localização na central para poder alertar mesmo com GPS indisponível.",
      );
      return;
    }
    const { lat: plat, lng: plng, acc: pacc, origem } = resolved;
    const avisoOrigem =
      origem === "central"
        ? "Será usada a localização do cadastro na central (GPS não disponível ou não actualizado).\n\n"
        : "";
    Alert.alert("Pânico — COPOM Mulher", `${avisoOrigem}Enviar alerta de PÂNICO à central com esta localização?`, [
      { text: "Cancelar", style: "cancel" },
      {
        text: "Enviar",
        style: "destructive",
        onPress: async () => {
          setSaving(true);
          try {
            const res = await fetchJson(`${base}/orion-mulher/v1/vitima-app/panico`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                telefone: d,
                latitude: plat,
                longitude: plng,
                accuracyM: pacc,
              }),
            });
            const data = (await res.json().catch(() => ({}))) as { error?: string };
            if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
            const extra =
              origem === "central"
                ? " Foi usada a localização do cadastro na central."
                : "";
            Alert.alert("Enviado", `Pânico registado. A central receberá o alerta.${extra}`);
          } catch (e) {
            Alert.alert("Erro", e instanceof Error ? e.message : String(e));
          } finally {
            setSaving(false);
          }
        },
      },
    ]);
  }, [base, telefone, resolverCoordsPanico]);

  useEffect(() => {
    void Location.requestForegroundPermissionsAsync();
  }, []);

  return (
    <LinearGradient colors={["#0f0720", "#1e1b4b", "#312e81"]} style={s.gradient}>
      <StatusBar style="light" />
      <ScrollView
        contentContainerStyle={[
          s.scroll,
          { paddingTop: Math.max(16, insets.top + 8), paddingBottom: Math.max(24, insets.bottom + 16) },
        ]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View style={s.badge}>
          <Text style={s.badgeText}>PMDF</Text>
        </View>
        <Text style={s.title}>COPOM Mulher</Text>
        <Text style={s.subtitle}>Cadastro da vítima — telefone como chave</Text>
        <Text style={s.note}>
          Ao abrir, o app tenta <Text style={s.noteBold}>carregar o cadastro completo da central</Text> para o último telefone
          guardado. Pode <Text style={s.noteBold}>alterar</Text>, <Text style={s.noteBold}>excluir</Text> e acionar o{" "}
          <Text style={s.noteBold}>pânico</Text>. Se o GPS falhar, o pânico pode usar a{" "}
          <Text style={s.noteBold}>localização guardada no cadastro</Text> na central.
        </Text>

        <View style={s.block}>
          <Text style={s.label}>Endereço do sistema (API)</Text>
          <TextInput
            style={s.input}
            value={apiBase}
            onChangeText={setApiBase}
            autoCapitalize="none"
            autoCorrect={false}
            placeholder="http://…:3002"
            placeholderTextColor="#94a3b8"
          />
        </View>

        <View style={s.block}>
          <Text style={s.label}>Telefone (só dígitos ou com DDD)</Text>
          <TextInput style={s.input} value={telefone} onChangeText={setTelefone} keyboardType="phone-pad" placeholderTextColor="#94a3b8" />
          {sync ? <ActivityIndicator color="#c4b5fd" style={{ marginTop: 8 }} /> : null}
        </View>

        <Pressable style={s.btnGhost} onPress={() => void carregarDaCentral(false)} disabled={sync || saving}>
          <Text style={s.btnGhostText}>Recarregar da central agora</Text>
        </Pressable>

        <View style={s.card}>
          <Text style={s.cardHeader}>Identificação</Text>
          <LabeledInput label="Nome da vítima" value={nomeVitima} onChangeText={setNomeVitima} />
          <LabeledInput label="Idade" value={idade} onChangeText={setIdade} keyboardType="numeric" />
          <LabeledInput label="CPF" value={cpf} onChangeText={setCpf} />
          <LabeledInput label="Identidade (RG)" value={identidade} onChangeText={setIdentidade} />
          <Text style={s.innerLabel}>Medida protetiva</Text>
          <View style={s.row}>
            {(["nao_informado", "sim", "nao"] as const).map((v) => (
              <Pressable key={v} style={[s.chip, medida === v && s.chipOn]} onPress={() => setMedida(v)}>
                <Text style={[s.chipText, medida === v && s.chipTextOn]}>
                  {v === "nao_informado" ? "N/D" : v === "sim" ? "Sim" : "Não"}
                </Text>
              </Pressable>
            ))}
          </View>
          <LabeledInput label="Endereço da residência" value={endVitima} onChangeText={setEndVitima} multiline />
        </View>

        <View style={s.card}>
          <Text style={s.cardHeader}>Agressor</Text>
          <LabeledInput label="Nome" value={nomeAgressor} onChangeText={setNomeAgressor} />
          <LabeledInput label="Endereço" value={endAgressor} onChangeText={setEndAgressor} multiline />
        </View>

        <View style={s.card}>
          <Text style={s.cardHeader}>Localização</Text>
          <Text style={s.hint}>
            {lat != null && lng != null
              ? `Coordenadas: ${lat.toFixed(5)}, ${lng.toFixed(5)} (também usadas no pânico se não actualizar o GPS)`
              : "Sem coordenadas no ecrã — use o GPS ou guarde o cadastro com localização; o pânico pode buscar coordenadas na central."}
          </Text>
          <Pressable style={s.btnLoc} onPress={() => void obterGps()} disabled={saving}>
            <Text style={s.btnLocText}>Actualizar GPS</Text>
          </Pressable>
        </View>

        <Pressable style={s.btnPrimary} onPress={() => void salvarOuAlterar()} disabled={saving}>
          {saving ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={s.btnPrimaryText}>{cadastroId ? "Alterar cadastro" : "Salvar cadastro"}</Text>
          )}
        </Pressable>

        {cadastroId ? (
          <Pressable style={s.btnDanger} onPress={() => void excluir()} disabled={saving}>
            <Text style={s.btnDangerText}>Excluir cadastro na central</Text>
          </Pressable>
        ) : null}

        <Pressable style={s.btnPanic} onPress={() => void panico()} disabled={saving}>
          <Text style={s.btnPanicText}>PÂNICO</Text>
          <Text style={s.btnPanicSub}>Alerta imediato à COPOM Mulher</Text>
        </Pressable>

        <Text style={s.footer}>COPOM Mulher · PMDF — fluxo telefone + central.</Text>
      </ScrollView>
    </LinearGradient>
  );
}

function LabeledInput({
  label,
  value,
  onChangeText,
  keyboardType,
  multiline,
}: {
  label: string;
  value: string;
  onChangeText: (t: string) => void;
  keyboardType?: "default" | "numeric" | "phone-pad";
  multiline?: boolean;
}) {
  return (
    <View style={{ marginTop: 10 }}>
      <Text style={s.innerLabel}>{label}</Text>
      <TextInput
        style={[s.inputInner, multiline && { minHeight: 72, textAlignVertical: "top" }]}
        value={value}
        onChangeText={onChangeText}
        placeholderTextColor="#64748b"
        keyboardType={keyboardType}
        multiline={multiline}
      />
    </View>
  );
}

const s = StyleSheet.create({
  gradient: { flex: 1 },
  scroll: { paddingHorizontal: 20 },
  badge: {
    alignSelf: "flex-start",
    backgroundColor: "rgba(196, 181, 253, 0.25)",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
    marginBottom: 8,
  },
  badgeText: { color: "#e9d5ff", fontSize: 10, fontWeight: "800", letterSpacing: 2 },
  title: { fontSize: 26, fontWeight: "900", color: "#fff" },
  subtitle: { marginTop: 6, fontSize: 14, color: "#c4b5fd" },
  note: { marginTop: 12, fontSize: 12, color: "#a5b4fc", lineHeight: 18 },
  noteBold: { color: "#e0e7ff", fontWeight: "700" },
  block: { marginTop: 14 },
  label: { fontSize: 11, fontWeight: "800", color: "#e9d5ff", marginBottom: 6, textTransform: "uppercase" },
  input: {
    backgroundColor: "rgba(255,255,255,0.97)",
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    color: "#0f172a",
  },
  inputInner: {
    marginTop: 4,
    backgroundColor: "#fff",
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 15,
    color: "#0f172a",
  },
  innerLabel: { fontSize: 10, fontWeight: "800", color: "#6b21a8", textTransform: "uppercase" },
  hint: { fontSize: 11, color: "#4c1d95", marginBottom: 8 },
  card: {
    marginTop: 16,
    backgroundColor: "rgba(255,255,255,0.96)",
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: "rgba(196, 181, 253, 0.5)",
  },
  cardHeader: { fontSize: 12, fontWeight: "900", color: "#4c1d95", marginBottom: 4, textTransform: "uppercase" },
  row: { flexDirection: "row", gap: 8, marginTop: 8, flexWrap: "wrap" },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: "#ede9fe",
  },
  chipOn: { backgroundColor: "#7c3aed" },
  chipText: { fontSize: 12, fontWeight: "700", color: "#5b21b6" },
  chipTextOn: { color: "#fff" },
  btnGhost: {
    marginTop: 10,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "rgba(196,181,253,0.6)",
    paddingVertical: 12,
    alignItems: "center",
  },
  btnGhostText: { color: "#e9d5ff", fontWeight: "800", fontSize: 13 },
  btnPrimary: {
    marginTop: 16,
    backgroundColor: "#7c3aed",
    borderRadius: 16,
    paddingVertical: 16,
    alignItems: "center",
  },
  btnPrimaryText: { color: "#fff", fontWeight: "900", fontSize: 16 },
  btnDanger: {
    marginTop: 12,
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: "center",
    backgroundColor: "rgba(127,29,29,0.35)",
    borderWidth: 1,
    borderColor: "rgba(254,202,202,0.5)",
  },
  btnDangerText: { color: "#fecaca", fontWeight: "800", fontSize: 15 },
  btnLoc: {
    marginTop: 8,
    backgroundColor: "#5b21b6",
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: "center",
  },
  btnLocText: { color: "#fff", fontWeight: "800" },
  btnPanic: {
    marginTop: 18,
    backgroundColor: "#b91c1c",
    borderRadius: 16,
    paddingVertical: 18,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "rgba(254, 202, 202, 0.5)",
  },
  btnPanicText: { color: "#fff", fontWeight: "900", fontSize: 18, letterSpacing: 2 },
  btnPanicSub: { color: "#fecaca", fontSize: 11, marginTop: 2, fontWeight: "600" },
  footer: { marginTop: 24, fontSize: 10, color: "#818cf8", textAlign: "center" },
});
