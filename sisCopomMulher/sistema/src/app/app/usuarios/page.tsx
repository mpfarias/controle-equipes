"use client";

import { useEffect, useMemo, useState } from "react";

type Role = "ADMINISTRADOR" | "ATENDENTE" | "CONSULTA";

type UserRow = {
  id: string;
  nomeCompleto: string;
  email: string;
  role: Role;
  ativo: boolean;
  cpf: string | null;
  telefone: string | null;
  matricula: string | null;
  lotacao: string | null;
  cargo: string | null;
};

type UserForm = {
  nomeCompleto: string;
  email: string;
  senha: string;
  role: Role;
  cpf: string;
  telefone: string;
  matricula: string;
  lotacao: string;
  cargo: string;
  ativo: boolean;
};

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

function emptyForm(): UserForm {
  return {
    nomeCompleto: "",
    email: "",
    senha: "",
    role: "ATENDENTE",
    cpf: "",
    telefone: "",
    matricula: "",
    lotacao: "",
    cargo: "",
    ativo: true,
  };
}

function fromUserToForm(u: UserRow): UserForm {
  return {
    nomeCompleto: u.nomeCompleto,
    email: u.email,
    senha: "",
    role: u.role,
    cpf: u.cpf ?? "",
    telefone: u.telefone ?? "",
    matricula: u.matricula ?? "",
    lotacao: u.lotacao ?? "",
    cargo: u.cargo ?? "",
    ativo: u.ativo,
  };
}

export default function UsuariosPage() {
  const [me, setMe] = useState<{ role: Role } | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [loadingList, setLoadingList] = useState(false);
  const [users, setUsers] = useState<UserRow[]>([]);
  const [qInput, setQInput] = useState("");
  const [qDebounced, setQDebounced] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [modalCreate, setModalCreate] = useState(false);
  const [editingUserId, setEditingUserId] = useState<string | null>(null);

  const [form, setForm] = useState<UserForm>(emptyForm);

  useEffect(() => {
    const t = window.setTimeout(() => setQDebounced(qInput), 250);
    return () => window.clearTimeout(t);
  }, [qInput]);

  const qs = useMemo(() => {
    const q = qDebounced.trim();
    return q ? `?q=${encodeURIComponent(q)}` : "";
  }, [qDebounced]);

  async function fetchUsers(signal?: AbortSignal) {
    const res = await fetch(`/api/usuarios${qs}`, { credentials: "include", signal });
    const data = await res.json().catch(() => ({}));
    const cr = data.callerRole as Role | undefined;
    if (res.status === 401) setMe(null);
    else if (cr) setMe({ role: cr });
    if (!res.ok) {
      setErro(data.error || "Sem permissao.");
      setUsers([]);
      return false;
    }
    setErro(null);
    setUsers((data.users as UserRow[]) ?? []);
    return true;
  }

  async function refresh() {
    setLoadingList(true);
    try {
      await fetchUsers();
    } finally {
      setLoadingList(false);
    }
  }

  useEffect(() => {
    const ctrl = new AbortController();
    let ok = true;
    setLoadingList(true);
    (async () => {
      try {
        await fetchUsers(ctrl.signal);
      } catch {
        if (ok) setErro("Falha de comunicacao ao carregar utilizadores.");
      } finally {
        if (ok) {
          setLoaded(true);
          setLoadingList(false);
        }
      }
    })();
    return () => {
      ok = false;
      ctrl.abort();
    };
  }, [qs]);

  async function criar() {
    setErro(null);
    const res = await fetch("/api/usuarios", {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      setErro(data.error || "Falha ao criar.");
      return;
    }
    setModalCreate(false);
    setForm(emptyForm());
    await refresh();
  }

  async function salvarEdicao() {
    if (!editingUserId) return;
    setErro(null);
    const res = await fetch(`/api/usuarios/${editingUserId}`, {
      method: "PATCH",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      setErro(data.error || "Falha ao atualizar.");
      return;
    }
    setEditingUserId(null);
    setForm(emptyForm());
    await refresh();
  }

  async function toggleAtivo(u: UserRow) {
    setErro(null);
    const res = await fetch(`/api/usuarios/${u.id}`, {
      method: "PATCH",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ativo: !u.ativo }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      setErro(data.error || "Falha ao atualizar.");
      return;
    }
    await refresh();
  }

  async function excluir(u: UserRow) {
    if (!window.confirm(`Excluir utilizador "${u.nomeCompleto}"? Esta a??o n?o pode ser desfeita.`)) return;
    setErro(null);
    const res = await fetch(`/api/usuarios/${u.id}`, {
      method: "DELETE",
      credentials: "include",
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      setErro(data.error || "Falha ao excluir.");
      return;
    }
    await refresh();
  }

  if (!loaded) {
    return <p className="text-sm text-slate-600">Carregando...</p>;
  }

  if (me == null) {
    return <p className="text-sm text-slate-700">Sessao invalida ou expirada. Faca login novamente.</p>;
  }

  if (me.role !== "ADMINISTRADOR") {
    return <p className="text-sm text-slate-700">Somente administradores podem acessar esta tela.</p>;
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Cadastro de utilizadores</h1>
          <p className="mt-1 text-sm text-slate-600">
            Administracao de contas: tres perfis (administrador, atendente, consulta), dados pessoais e lotacao.
          </p>
        </div>
        <button
          type="button"
          onClick={() => {
            setModalCreate(true);
            setEditingUserId(null);
            setForm(emptyForm());
          }}
          className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700"
        >
          Novo usuario
        </button>
      </div>

      <div className="max-w-xl">
        <label className="block text-sm font-medium text-slate-700">Buscar</label>
        <input
          className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
          value={qInput}
          onChange={(e) => setQInput(e.target.value)}
          placeholder="Nome, e-mail ou matricula"
        />
      </div>

      {erro ? <p className="text-sm text-red-600">{erro}</p> : null}
      {loadingList ? <p className="text-xs text-slate-500">Atualizando lista...</p> : null}

      <div className="overflow-hidden rounded-2xl border border-white/70 bg-white/80 shadow-lg shadow-slate-900/5 backdrop-blur-md ring-1 ring-white/45">
        <table className="min-w-full text-sm">
          <thead className="bg-slate-50 text-left text-xs font-semibold uppercase text-slate-600">
            <tr>
              <th className="px-4 py-3">Nome</th>
              <th className="px-4 py-3">E-mail</th>
              <th className="px-4 py-3">Perfil</th>
              <th className="px-4 py-3">Matricula</th>
              <th className="px-4 py-3">Ativo</th>
              <th className="px-4 py-3 text-right">Acoes</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {users.map((u) => (
              <tr key={u.id} className="hover:bg-slate-50">
                <td className="px-4 py-3">{u.nomeCompleto}</td>
                <td className="px-4 py-3">{u.email}</td>
                <td className="px-4 py-3 font-mono text-xs">{u.role}</td>
                <td className="px-4 py-3">{u.matricula || "-"}</td>
                <td className="px-4 py-3">{u.ativo ? "sim" : "nao"}</td>
                <td className="px-4 py-3 text-right">
                  <div className="inline-flex gap-3">
                    <button
                      type="button"
                      className="font-semibold text-brand-700 hover:underline"
                      onClick={() => {
                        setEditingUserId(u.id);
                        setModalCreate(false);
                        setForm(fromUserToForm(u));
                      }}
                    >
                      Editar
                    </button>
                    <button type="button" className="font-semibold text-brand-700 hover:underline" onClick={() => toggleAtivo(u)}>
                      {u.ativo ? "Desativar" : "Ativar"}
                    </button>
                    <button type="button" className="font-semibold text-rose-700 hover:underline" onClick={() => excluir(u)}>
                      Excluir
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {modalCreate || editingUserId ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/45 p-4 backdrop-blur-md">
          <div className="shine-border-wrap w-full max-w-lg">
            <div className="relative overflow-hidden rounded-[22px] border border-white/15 bg-white/90 p-5 shadow-2xl backdrop-blur-xl">
              <div className="text-lg font-semibold text-slate-900">{editingUserId ? "Editar utilizador" : "Novo usuario"}</div>
              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                <label className="sm:col-span-2 block text-sm">
                  <span className="font-medium text-slate-700">Nome completo</span>
                  <input
                    className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                    value={form.nomeCompleto}
                    onChange={(e) => setForm({ ...form, nomeCompleto: e.target.value })}
                  />
                </label>
                <label className="block text-sm">
                  <span className="font-medium text-slate-700">E-mail</span>
                  <input
                    className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                    value={form.email}
                    onChange={(e) => setForm({ ...form, email: e.target.value })}
                  />
                </label>
                <label className="block text-sm">
                  <span className="font-medium text-slate-700">{editingUserId ? "Nova senha (opcional)" : "Senha inicial"}</span>
                  <input
                    className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                    type="password"
                    value={form.senha}
                    onChange={(e) => setForm({ ...form, senha: e.target.value })}
                  />
                </label>
                <label className="block text-sm">
                  <span className="font-medium text-slate-700">Perfil</span>
                  <select
                    className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                    value={form.role}
                    onChange={(e) => setForm({ ...form, role: e.target.value as Role })}
                  >
                    <option value="ADMINISTRADOR">Administrador</option>
                    <option value="ATENDENTE">Atendente</option>
                    <option value="CONSULTA">Consulta</option>
                  </select>
                </label>
                <label className="block text-sm">
                  <span className="font-medium text-slate-700">CPF</span>
                  <input
                    className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                    value={form.cpf}
                    onChange={(e) => setForm({ ...form, cpf: formatCpf(e.target.value) })}
                  />
                </label>
                <label className="block text-sm">
                  <span className="font-medium text-slate-700">Telefone</span>
                  <input
                    className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                    value={form.telefone}
                    onChange={(e) => setForm({ ...form, telefone: formatPhoneBr(e.target.value) })}
                  />
                </label>
                <label className="block text-sm">
                  <span className="font-medium text-slate-700">Matricula</span>
                  <input
                    className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                    value={form.matricula}
                    onChange={(e) => setForm({ ...form, matricula: e.target.value })}
                  />
                </label>
                <label className="block text-sm">
                  <span className="font-medium text-slate-700">Lotacao</span>
                  <input
                    className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                    value={form.lotacao}
                    onChange={(e) => setForm({ ...form, lotacao: e.target.value })}
                  />
                </label>
                <label className="sm:col-span-2 block text-sm">
                  <span className="font-medium text-slate-700">Cargo</span>
                  <input
                    className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                    value={form.cargo}
                    onChange={(e) => setForm({ ...form, cargo: e.target.value })}
                  />
                </label>
              </div>
              <div className="mt-5 flex justify-end gap-2">
                <button
                  type="button"
                  className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold"
                  onClick={() => {
                    setModalCreate(false);
                    setEditingUserId(null);
                    setForm(emptyForm());
                  }}
                >
                  Cancelar
                </button>
                <button type="button" className="btn-aurora px-5 py-2" onClick={editingUserId ? salvarEdicao : criar}>
                  Salvar
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
