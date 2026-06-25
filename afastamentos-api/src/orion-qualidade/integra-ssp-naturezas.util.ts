import type { IntegraSspPoolService } from './integra-ssp-pool.service';

export type NaturezaCatalogoRow = {
  codigo: string;
  descricao: string | null;
  confianca: 'alta' | 'media' | 'baixa';
  totalOcorrencias: number;
  amostrasAnalisadas: number;
};

type NarrativaAmostraRow = {
  codigo?: string | null;
  narrativa?: string | null;
};

type TotalCodigoRow = {
  codigo?: string | null;
  total?: number | string | null;
};

/** Extrai o nome legível da natureza a partir do texto padrão HEFESTO na narrativa. */
export function extrairNomeNaturezaDaNarrativa(narrativa: string, codigo: string): string | null {
  const n = String(narrativa ?? '').replace(/\r\n/g, '\n');
  if (!n.trim()) return null;

  const patterns = [
    /Natureza:\s*([^\n|]+?)\s*\|\s*Descrição:/i,
    /Natureza:\s*([^\n|]+?)\s*\n\s*Descrição:/i,
    /Natureza:\s*([^\n|]+)/i,
  ];

  for (const re of patterns) {
    const m = re.exec(n);
    if (!m) continue;
    const nome = m[1].trim();
    if (!nome) continue;
    if (/^NAT-\d+$/i.test(nome)) continue;
    if (nome.toUpperCase() === codigo.toUpperCase()) continue;
    if (nome.length > 180) continue;
    return nome;
  }

  return null;
}

function modaNomes(candidatos: string[]): string | null {
  if (candidatos.length === 0) return null;
  const freq = new Map<string, number>();
  for (const c of candidatos) {
    const k = c.trim();
    if (!k) continue;
    freq.set(k, (freq.get(k) ?? 0) + 1);
  }
  let melhor: { nome: string; q: number } | null = null;
  for (const [nome, q] of freq) {
    if (!melhor || q > melhor.q || (q === melhor.q && nome.localeCompare(melhor.nome, 'pt-BR') < 0)) {
      melhor = { nome, q };
    }
  }
  return melhor?.nome ?? null;
}

function confiancaDe(amostras: number, votosModa: number, temDescricao: boolean): NaturezaCatalogoRow['confianca'] {
  if (!temDescricao) return 'baixa';
  if (votosModa >= 3 || (amostras >= 5 && votosModa >= 2)) return 'alta';
  return 'media';
}

/**
 * Monta catálogo código NAT-* → descrição legível.
 * Não há tabela de domínio no Integra SSP; nomes vêm da linha "Natureza:" na narrativa.
 */
export async function listarCatalogoNaturezasIntegra(
  pool: IntegraSspPoolService,
): Promise<NaturezaCatalogoRow[]> {
  const driver = pool.getDriver();

  const totaisSql =
    driver === 'postgres'
      ? `
        SELECT natureza AS codigo, COUNT(*)::int AS total
        FROM "PRD_STG_HEFESTO"."OCORRENCIA"
        WHERE natureza LIKE 'NAT-%'
        GROUP BY natureza
        ORDER BY natureza
      `
      : `
        SELECT natureza AS codigo, COUNT(*) AS total
        FROM PRD_STG_HEFESTO.OCORRENCIA
        WHERE natureza LIKE 'NAT-%'
        GROUP BY natureza
        ORDER BY natureza
      `;

  const amostrasSql =
    driver === 'postgres'
      ? `
        WITH ranked AS (
          SELECT
            o.natureza AS codigo,
            o.narrativa,
            ROW_NUMBER() OVER (PARTITION BY o.natureza ORDER BY o."Id" DESC) AS rn
          FROM "PRD_STG_HEFESTO"."OCORRENCIA" o
          WHERE o.natureza LIKE 'NAT-%'
            AND o.narrativa LIKE '%Natureza:%'
        )
        SELECT codigo, narrativa
        FROM ranked
        WHERE rn <= 20
        ORDER BY codigo, rn
      `
      : `
        WITH ranked AS (
          SELECT
            o.natureza AS codigo,
            o.narrativa,
            ROW_NUMBER() OVER (PARTITION BY o.natureza ORDER BY o.Id DESC) AS rn
          FROM PRD_STG_HEFESTO.OCORRENCIA o
          WHERE o.natureza LIKE 'NAT-%'
            AND o.narrativa LIKE '%Natureza:%'
        )
        SELECT codigo, narrativa
        FROM ranked
        WHERE rn <= 20
        ORDER BY codigo, rn
      `;

  const [totaisRows, amostrasRows] = await Promise.all([
    pool.queryRows<TotalCodigoRow>(totaisSql),
    pool.queryRows<NarrativaAmostraRow>(amostrasSql),
  ]);

  const totalPorCodigo = new Map<string, number>();
  for (const row of totaisRows) {
    const codigo = String(row.codigo ?? '').trim();
    if (!codigo) continue;
    const totalRaw = row.total ?? 0;
    const total = typeof totalRaw === 'number' ? totalRaw : Number.parseInt(String(totalRaw), 10) || 0;
    totalPorCodigo.set(codigo, total);
  }

  const candidatosPorCodigo = new Map<string, string[]>();
  for (const row of amostrasRows) {
    const codigo = String(row.codigo ?? '').trim();
    if (!codigo) continue;
    const nome = extrairNomeNaturezaDaNarrativa(String(row.narrativa ?? ''), codigo);
    if (!nome) continue;
    const arr = candidatosPorCodigo.get(codigo) ?? [];
    arr.push(nome);
    candidatosPorCodigo.set(codigo, arr);
  }

  const catalogo: NaturezaCatalogoRow[] = [];
  for (const [codigo, totalOcorrencias] of totalPorCodigo) {
    const candidatos = candidatosPorCodigo.get(codigo) ?? [];
    const freq = new Map<string, number>();
    for (const c of candidatos) freq.set(c, (freq.get(c) ?? 0) + 1);
    let votosModa = 0;
    const descricao = modaNomes(candidatos);
    if (descricao) votosModa = freq.get(descricao) ?? 0;

    catalogo.push({
      codigo,
      descricao,
      confianca: confiancaDe(candidatos.length, votosModa, descricao != null),
      totalOcorrencias,
      amostrasAnalisadas: candidatos.length,
    });
  }

  catalogo.sort((a, b) => a.codigo.localeCompare(b.codigo, 'pt-BR'));
  return catalogo;
}
