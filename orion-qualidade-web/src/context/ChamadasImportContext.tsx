import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { api, getToken } from '../api';
import type { ChamadaXlsxRow } from '../types/chamadasXlsx';
import type { CoberturaIntegraChamadas } from '../types';
import { filtroPadraoDiaAtualIso } from '../utils/chamadasFiltroBrasilia';
import { filtrarChamadasRamal71 } from '../utils/filtrarChamadasRamal71';
import { formatarNomeTitulo } from '../utils/formatNomeTitulo';

export type EquipesSadResolucao = 'idle' | 'loading' | 'ok' | 'error' | 'skipped';
export type ChamadasCarregamento = 'idle' | 'loading' | 'ok' | 'error' | 'skipped';

export type ChamadasFiltroConsulta = {
  dataInicio: string;
  dataFim: string;
};

export type ChamadasImportContextValue = {
  chamadasRows: ChamadaXlsxRow[];
  chamadasCarregamento: ChamadasCarregamento;
  chamadasErro: string | null;
  coberturaIntegra: CoberturaIntegraChamadas | null;
  filtroAtivo: ChamadasFiltroConsulta | null;
  buscarChamadas: (filtro: ChamadasFiltroConsulta) => void;
  recarregarChamadas: () => void;
  equipePorNomeAtendente: Record<string, string | null>;
  encontradoSadPorNomeAtendente: Record<string, boolean>;
  equipesResolucao: EquipesSadResolucao;
  equipesResolucaoErro: string | null;
};

const ChamadasImportContext = createContext<ChamadasImportContextValue | null>(null);

export function ChamadasImportProvider({ children }: { children: ReactNode }) {
  const [chamadasRows, setChamadasRows] = useState<ChamadaXlsxRow[]>([]);
  const [chamadasCarregamento, setChamadasCarregamento] = useState<ChamadasCarregamento>('idle');
  const [chamadasErro, setChamadasErro] = useState<string | null>(null);
  const [coberturaIntegra, setCoberturaIntegra] = useState<CoberturaIntegraChamadas | null>(null);
  const [filtroAtivo, setFiltroAtivo] = useState<ChamadasFiltroConsulta | null>(null);
  const [equipePorNomeAtendente, setEquipePorNomeAtendente] = useState<Record<string, string | null>>({});
  const [encontradoSadPorNomeAtendente, setEncontradoSadPorNomeAtendente] = useState<Record<string, boolean>>(
    {},
  );
  const [equipesResolucao, setEquipesResolucao] = useState<EquipesSadResolucao>('idle');
  const [equipesResolucaoErro, setEquipesResolucaoErro] = useState<string | null>(null);
  const cargaInicialFeita = useRef(false);
  const buscaAbortRef = useRef<AbortController | null>(null);
  const buscaSeqRef = useRef(0);

  const executarBusca = useCallback((filtro: ChamadasFiltroConsulta) => {
    const token = getToken();
    if (!token) {
      setChamadasRows([]);
      setFiltroAtivo(null);
      setCoberturaIntegra(null);
      setChamadasCarregamento('skipped');
      setChamadasErro(null);
      return;
    }

    buscaAbortRef.current?.abort();
    const abort = new AbortController();
    buscaAbortRef.current = abort;
    const seq = ++buscaSeqRef.current;

    setFiltroAtivo(filtro);
    setChamadasCarregamento('loading');
    setChamadasErro(null);

    void api
      .listarChamadasIntegraSsp(filtro, abort.signal)
      .then((res) => {
        if (abort.signal.aborted || seq !== buscaSeqRef.current) return;
        setChamadasRows(filtrarChamadasRamal71(res.rows));
        setCoberturaIntegra(res.coberturaIntegra ?? null);
        setChamadasCarregamento('ok');
      })
      .catch((e: unknown) => {
        if (abort.signal.aborted || seq !== buscaSeqRef.current) return;
        if (e instanceof DOMException && e.name === 'AbortError') return;
        setChamadasRows([]);
        setCoberturaIntegra(null);
        setChamadasCarregamento('error');
        setChamadasErro(
          e instanceof Error ? e.message : 'Não foi possível carregar as chamadas.',
        );
      });
  }, []);

  const buscarChamadas = useCallback(
    (filtro: ChamadasFiltroConsulta) => {
      executarBusca(filtro);
    },
    [executarBusca],
  );

  const recarregarChamadas = useCallback(() => {
    if (filtroAtivo) {
      executarBusca(filtroAtivo);
      return;
    }
    executarBusca(filtroPadraoDiaAtualIso());
  }, [executarBusca, filtroAtivo]);

  useEffect(() => {
    if (cargaInicialFeita.current) return;
    const token = getToken();
    if (!token) {
      setChamadasCarregamento('skipped');
      return;
    }
    cargaInicialFeita.current = true;
    executarBusca(filtroPadraoDiaAtualIso());
  }, [executarBusca]);

  useEffect(() => {
    if (chamadasRows.length === 0) {
      setEquipePorNomeAtendente({});
      setEncontradoSadPorNomeAtendente({});
      setEquipesResolucao('idle');
      setEquipesResolucaoErro(null);
      return;
    }

    const token = getToken();
    if (!token) {
      setEquipePorNomeAtendente({});
      setEncontradoSadPorNomeAtendente({});
      setEquipesResolucao('skipped');
      setEquipesResolucaoErro(null);
      return;
    }

    const unicos = new Set<string>();
    for (const row of chamadasRows) {
      const t = row.atendente?.trim();
      if (!t) continue;
      const nome = formatarNomeTitulo(t);
      if (nome === '(Não informado)') continue;
      unicos.add(nome);
    }
    const lista = [...unicos];
    if (lista.length === 0) {
      setEquipePorNomeAtendente({});
      setEncontradoSadPorNomeAtendente({});
      setEquipesResolucao('ok');
      setEquipesResolucaoErro(null);
      return;
    }

    let cancelado = false;
    setEquipesResolucao('loading');
    setEquipesResolucaoErro(null);

    void api
      .resolverEquipesPorNome(lista)
      .then((res) => {
        if (cancelado) return;
        const m: Record<string, string | null> = {};
        const f: Record<string, boolean> = {};
        for (const it of res.itens) {
          m[it.nome] = it.equipe;
          f[it.nome] = it.encontrado;
        }
        setEquipePorNomeAtendente(m);
        setEncontradoSadPorNomeAtendente(f);
        setEquipesResolucao('ok');
      })
      .catch((e: unknown) => {
        if (cancelado) return;
        setEquipePorNomeAtendente({});
        setEncontradoSadPorNomeAtendente({});
        setEquipesResolucao('error');
        setEquipesResolucaoErro(e instanceof Error ? e.message : 'Não foi possível consultar equipes no SAD.');
      });

    return () => {
      cancelado = true;
    };
  }, [chamadasRows]);

  const value = useMemo(
    () => ({
      chamadasRows,
      chamadasCarregamento,
      chamadasErro,
      coberturaIntegra,
      filtroAtivo,
      buscarChamadas,
      recarregarChamadas,
      equipePorNomeAtendente,
      encontradoSadPorNomeAtendente,
      equipesResolucao,
      equipesResolucaoErro,
    }),
    [
      chamadasRows,
      chamadasCarregamento,
      chamadasErro,
      coberturaIntegra,
      filtroAtivo,
      buscarChamadas,
      recarregarChamadas,
      equipePorNomeAtendente,
      encontradoSadPorNomeAtendente,
      equipesResolucao,
      equipesResolucaoErro,
    ],
  );

  return <ChamadasImportContext.Provider value={value}>{children}</ChamadasImportContext.Provider>;
}

export function useChamadasImport(): ChamadasImportContextValue {
  const ctx = useContext(ChamadasImportContext);
  if (!ctx) {
    throw new Error('useChamadasImport deve ser usado dentro de ChamadasImportProvider.');
  }
  return ctx;
}
