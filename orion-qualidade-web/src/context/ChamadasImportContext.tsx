import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { api, getToken } from '../api';
import type { ChamadaXlsxRow } from '../types/chamadasXlsx';
import { formatarNomeTitulo } from '../utils/formatNomeTitulo';

export type EquipesSadResolucao = 'idle' | 'loading' | 'ok' | 'error' | 'skipped';

export type ChamadasImportContextValue = {
  chamadasRows: ChamadaXlsxRow[];
  arquivoNome: string | null;
  abaNome: string | null;
  importarChamadas: (payload: { rows: ChamadaXlsxRow[]; arquivoNome: string; abaNome: string }) => void;
  limparChamadasImportadas: () => void;
  /** Chave = nome do atendente como na agregação/tabela (`formatarNomeTitulo`). Valor = equipe no cadastro SAD ou null. */
  equipePorNomeAtendente: Record<string, string | null>;
  /** Se houve policial com aquele nome normalizado no cadastro. */
  encontradoSadPorNomeAtendente: Record<string, boolean>;
  equipesResolucao: EquipesSadResolucao;
  equipesResolucaoErro: string | null;
};

const ChamadasImportContext = createContext<ChamadasImportContextValue | null>(null);

export function ChamadasImportProvider({ children }: { children: ReactNode }) {
  const [chamadasRows, setChamadasRows] = useState<ChamadaXlsxRow[]>([]);
  const [arquivoNome, setArquivoNome] = useState<string | null>(null);
  const [abaNome, setAbaNome] = useState<string | null>(null);
  const [equipePorNomeAtendente, setEquipePorNomeAtendente] = useState<Record<string, string | null>>({});
  const [encontradoSadPorNomeAtendente, setEncontradoSadPorNomeAtendente] = useState<Record<string, boolean>>(
    {},
  );
  const [equipesResolucao, setEquipesResolucao] = useState<EquipesSadResolucao>('idle');
  const [equipesResolucaoErro, setEquipesResolucaoErro] = useState<string | null>(null);

  const importarChamadas = useCallback((payload: { rows: ChamadaXlsxRow[]; arquivoNome: string; abaNome: string }) => {
    setChamadasRows(payload.rows);
    setArquivoNome(payload.arquivoNome);
    setAbaNome(payload.abaNome);
  }, []);

  const limparChamadasImportadas = useCallback(() => {
    setChamadasRows([]);
    setArquivoNome(null);
    setAbaNome(null);
    setEquipePorNomeAtendente({});
    setEncontradoSadPorNomeAtendente({});
    setEquipesResolucao('idle');
    setEquipesResolucaoErro(null);
  }, []);

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
      arquivoNome,
      abaNome,
      importarChamadas,
      limparChamadasImportadas,
      equipePorNomeAtendente,
      encontradoSadPorNomeAtendente,
      equipesResolucao,
      equipesResolucaoErro,
    }),
    [
      chamadasRows,
      arquivoNome,
      abaNome,
      importarChamadas,
      limparChamadasImportadas,
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
