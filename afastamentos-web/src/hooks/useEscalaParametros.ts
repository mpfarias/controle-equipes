import { useCallback, useEffect, useMemo, useState } from 'react';
import { api } from '../api';
import type { EscalaParametros } from '../types';
import { parseEscalaParametros } from '../utils/escalaParametros';

const ESCALA_PARAMETROS_ATUALIZADOS = 'escala-parametros-atualizados';

export function dispatchEscalaParametrosAtualizados(): void {
  window.dispatchEvent(new Event(ESCALA_PARAMETROS_ATUALIZADOS));
}

export function useEscalaParametros() {
  const [parametros, setParametros] = useState<EscalaParametros | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await api.getEscalaParametros();
      setParametros(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Falha ao carregar parâmetros da escala.');
      setParametros(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    const handler = () => {
      void load();
    };
    window.addEventListener(ESCALA_PARAMETROS_ATUALIZADOS, handler);
    return () => window.removeEventListener(ESCALA_PARAMETROS_ATUALIZADOS, handler);
  }, [load]);

  const parsed = useMemo(() => parseEscalaParametros(parametros), [parametros]);

  return { parametros, parsed, loading, error, refetch: load };
}
