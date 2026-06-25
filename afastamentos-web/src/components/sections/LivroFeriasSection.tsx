import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Box,
  Button,
  FormControl,
  InputLabel,
  MenuItem,
  Pagination,
  Select,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Typography,
} from '@mui/material';
import ArrowDownward from '@mui/icons-material/ArrowDownward';
import ArrowUpward from '@mui/icons-material/ArrowUpward';
import SwapVert from '@mui/icons-material/SwapVert';
import { api, type PolicialListOrderBy } from '../../api';
import { formatEquipeLabel } from '../../constants';
import { theme } from '../../constants/theme';
import type { Policial, Usuario } from '../../types';
import { formatDate, formatMatricula } from '../../utils/dateUtils';
import { sortPoliciaisListaOrdenacao } from '../../utils/sortPoliciais';

interface LivroFeriasSectionProps {
  currentUser: Usuario;
}

const MESES = [
  { valor: 1, nome: 'Janeiro' },
  { valor: 2, nome: 'Fevereiro' },
  { valor: 3, nome: 'Março' },
  { valor: 4, nome: 'Abril' },
  { valor: 5, nome: 'Maio' },
  { valor: 6, nome: 'Junho' },
  { valor: 7, nome: 'Julho' },
  { valor: 8, nome: 'Agosto' },
  { valor: 9, nome: 'Setembro' },
  { valor: 10, nome: 'Outubro' },
  { valor: 11, nome: 'Novembro' },
  { valor: 12, nome: 'Dezembro' },
];

const formFieldSx = {
  '& .MuiOutlinedInput-root': {
    backgroundColor: theme.cardBg,
    borderRadius: '8px',
    fontSize: '0.95rem',
    color: theme.textPrimary,
    '& fieldset': { borderColor: 'var(--border-soft)' },
    '&:hover fieldset': { borderColor: 'var(--border-soft)' },
    '&.Mui-focused fieldset': {
      borderColor: 'var(--accent-primary)',
    },
  },
  '& .MuiInputLabel-root': { color: theme.textSecondary },
};

function nomeMes(mes: number): string {
  return MESES.find((m) => m.valor === mes)?.nome ?? String(mes);
}

const sortButtonSx = {
  background: 'none',
  border: 'none',
  padding: 0,
  font: 'inherit',
  cursor: 'pointer',
  textAlign: 'left' as const,
  width: '100%',
  display: 'inline-flex',
  alignItems: 'center',
  gap: 0.5,
  color: theme.textPrimary,
  whiteSpace: 'nowrap' as const,
};

function SortableHeader({
  label,
  campo,
  ordenacao,
  onSort,
}: {
  label: string;
  campo: PolicialListOrderBy;
  ordenacao: { campo: PolicialListOrderBy; direcao: 'asc' | 'desc' } | null;
  onSort: (campo: PolicialListOrderBy) => void;
}) {
  const ativo = ordenacao?.campo === campo;
  const title = ativo
    ? `Ordenar por ${label.toLowerCase()} (${ordenacao.direcao === 'asc' ? 'ascendente' : 'descendente'}) - clique para inverter`
    : `Ordenar por ${label.toLowerCase()}`;

  return (
    <button type="button" onClick={() => onSort(campo)} style={sortButtonSx} title={title}>
      <Typography
        component="span"
        variant="body2"
        sx={{ fontWeight: ativo ? 'bold' : 'normal', color: theme.textPrimary }}
      >
        {label}
      </Typography>
      {ativo ? (
        ordenacao.direcao === 'asc' ? (
          <ArrowUpward sx={{ fontSize: 18, color: theme.textPrimary }} />
        ) : (
          <ArrowDownward sx={{ fontSize: 18, color: theme.textPrimary }} />
        )
      ) : (
        <SwapVert sx={{ fontSize: 18, color: theme.textPrimary, opacity: 0.8 }} />
      )}
    </button>
  );
}

export function LivroFeriasSection({ currentUser }: LivroFeriasSectionProps) {
  const hoje = new Date();
  const [mesFiltro, setMesFiltro] = useState(hoje.getMonth() + 1);
  const [anoFiltro, setAnoFiltro] = useState(hoje.getFullYear());
  const [searchTerm, setSearchTerm] = useState('');
  const [paginaAtual, setPaginaAtual] = useState(1);
  const [itensPorPagina, setItensPorPagina] = useState(50);
  const [policiaisBrutos, setPoliciaisBrutos] = useState<Policial[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ordenacao, setOrdenacao] = useState<{
    campo: PolicialListOrderBy;
    direcao: 'asc' | 'desc';
  } | null>(null);

  const anosSelect = useMemo(() => {
    const civil = new Date().getFullYear();
    const anos: number[] = [];
    for (let y = civil - 1; y <= civil + 1; y += 1) {
      anos.push(y);
    }
    return anos;
  }, []);

  const usuarioPodeVerTodos = useMemo(() => {
    const nivelNome = currentUser.nivel?.nome;
    return (
      nivelNome === 'ADMINISTRADOR' ||
      nivelNome === 'SAD' ||
      nivelNome === 'COMANDO' ||
      currentUser.isAdmin === true
    );
  }, [currentUser]);

  const carregarLista = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const params: Parameters<typeof api.listLivroFerias>[0] = {
        mes: mesFiltro,
        ano: anoFiltro,
        page: 1,
        pageSize: 10000,
      };
      const busca = searchTerm.trim();
      if (busca) params.search = busca;
      if (!usuarioPodeVerTodos && currentUser.equipe) {
        params.equipe = currentUser.equipe;
      }
      const data = await api.listLivroFerias(params);
      setPoliciaisBrutos(data.Policiales);
    } catch (err) {
      console.error('Erro ao carregar Livro de Férias:', err);
      setError('Não foi possível carregar a lista de férias.');
      setPoliciaisBrutos([]);
    } finally {
      setLoading(false);
    }
  }, [
    mesFiltro,
    anoFiltro,
    searchTerm,
    usuarioPodeVerTodos,
    currentUser.equipe,
  ]);

  useEffect(() => {
    void carregarLista();
  }, [carregarLista]);

  const policiaisOrdenados = useMemo(
    () => sortPoliciaisListaOrdenacao(policiaisBrutos, ordenacao),
    [policiaisBrutos, ordenacao],
  );

  const total = policiaisOrdenados.length;
  const totalPaginas = Math.max(1, Math.ceil(total / itensPorPagina));

  const policiais = useMemo(() => {
    const inicio = (paginaAtual - 1) * itensPorPagina;
    return policiaisOrdenados.slice(inicio, inicio + itensPorPagina);
  }, [policiaisOrdenados, paginaAtual, itensPorPagina]);

  useEffect(() => {
    if (paginaAtual > totalPaginas && totalPaginas > 0) {
      setPaginaAtual(totalPaginas);
    }
  }, [paginaAtual, totalPaginas]);

  useEffect(() => {
    setPaginaAtual(1);
  }, [ordenacao, mesFiltro, anoFiltro, searchTerm, itensPorPagina]);

  const handleOrdenacao = (campo: PolicialListOrderBy) => {
    setOrdenacao((prev) => {
      if (prev?.campo === campo) {
        if (prev.direcao === 'asc') return { campo, direcao: 'desc' };
        return null;
      }
      return { campo, direcao: 'asc' };
    });
  };

  const handleAssinar = (_policial: Policial) => {
    // TODO: implementar assinatura do livro de férias
  };

  const tituloPeriodo = `${nomeMes(mesFiltro)} de ${anoFiltro}`;

  return (
    <Box>
      <Typography variant="h6" sx={{ mb: 0.5 }}>
        Livro de Férias
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
        Policiais com férias previstas ou gozo cadastrado para <strong>iniciar</strong> em{' '}
        {tituloPeriodo}. Quem já iniciou férias em meses anteriores não aparece nesta lista.
      </Typography>

      <Box
        sx={{
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          gap: 2,
          mb: 2,
        }}
      >
        <TextField
          size="small"
          placeholder="Pesquisar por nome ou matrícula"
          value={searchTerm}
          onChange={(e) => {
            setSearchTerm(e.target.value.toUpperCase());
            setPaginaAtual(1);
          }}
          sx={{ minWidth: 240, ...formFieldSx }}
        />
        <FormControl size="small" sx={{ minWidth: 160, ...formFieldSx }}>
          <InputLabel id="livro-ferias-mes-label">Mês</InputLabel>
          <Select
            labelId="livro-ferias-mes-label"
            label="Mês"
            value={mesFiltro}
            onChange={(e) => {
              setMesFiltro(Number(e.target.value));
              setPaginaAtual(1);
            }}
            MenuProps={{
              PaperProps: {
                sx: {
                  bgcolor: theme.cardBg,
                  border: `1px solid ${theme.borderSoft}`,
                  '& .MuiMenuItem-root': { color: theme.textPrimary },
                },
              },
            }}
          >
            {MESES.map((m) => (
              <MenuItem key={m.valor} value={m.valor}>
                {m.nome}
              </MenuItem>
            ))}
          </Select>
        </FormControl>
        <TextField
          select
          size="small"
          label="Ano"
          value={String(anoFiltro)}
          onChange={(e) => {
            setAnoFiltro(Number(e.target.value));
            setPaginaAtual(1);
          }}
          SelectProps={{ native: true }}
          InputLabelProps={{ shrink: true }}
          sx={{ minWidth: 110, ...formFieldSx }}
        >
          {anosSelect.map((y) => (
            <option key={y} value={y}>
              {y}
            </option>
          ))}
        </TextField>
        <FormControl size="small" sx={{ minWidth: 120, ...formFieldSx }}>
          <InputLabel id="livro-ferias-itens-label">Itens por página</InputLabel>
          <Select
            labelId="livro-ferias-itens-label"
            label="Itens por página"
            value={itensPorPagina}
            onChange={(e) => {
              setItensPorPagina(Number(e.target.value));
              setPaginaAtual(1);
            }}
            MenuProps={{
              PaperProps: {
                sx: {
                  bgcolor: theme.cardBg,
                  border: `1px solid ${theme.borderSoft}`,
                  '& .MuiMenuItem-root': { color: theme.textPrimary },
                },
              },
            }}
          >
            <MenuItem value={20}>20</MenuItem>
            <MenuItem value={50}>50</MenuItem>
            <MenuItem value={100}>100</MenuItem>
          </Select>
        </FormControl>
      </Box>

      {error && (
        <Typography variant="body2" color="error" sx={{ mb: 2 }}>
          {error}
        </Typography>
      )}

      <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
        {loading ? 'Carregando...' : `${total} policial(is) com início previsto em ${tituloPeriodo}`}
      </Typography>

      <TableContainer sx={{ border: `1px solid ${theme.borderSoft}`, borderRadius: 1 }}>
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>
                <SortableHeader
                  label="Posto"
                  campo="postoGraduacao"
                  ordenacao={ordenacao}
                  onSort={handleOrdenacao}
                />
              </TableCell>
              <TableCell>
                <SortableHeader
                  label="Nome"
                  campo="nome"
                  ordenacao={ordenacao}
                  onSort={handleOrdenacao}
                />
              </TableCell>
              <TableCell>
                <SortableHeader
                  label="Matrícula"
                  campo="matricula"
                  ordenacao={ordenacao}
                  onSort={handleOrdenacao}
                />
              </TableCell>
              <TableCell>
                <SortableHeader
                  label="Equipe"
                  campo="equipe"
                  ordenacao={ordenacao}
                  onSort={handleOrdenacao}
                />
              </TableCell>
              <TableCell>
                <SortableHeader
                  label="Função"
                  campo="funcao"
                  ordenacao={ordenacao}
                  onSort={handleOrdenacao}
                />
              </TableCell>
              <TableCell>Início previsto</TableCell>
              <TableCell>Término previsto</TableCell>
              <TableCell>Ação</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {!loading && policiais.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} align="center" sx={{ py: 4, color: 'text.secondary' }}>
                  Nenhum policial com férias iniciando em {tituloPeriodo}.
                </TableCell>
              </TableRow>
            ) : (
              policiais.map((policial) => (
                <TableRow key={policial.id} hover>
                  <TableCell>{policial.postoGraduacao?.sigla ?? '—'}</TableCell>
                  <TableCell>{policial.nome}</TableCell>
                  <TableCell>{formatMatricula(policial.matricula)}</TableCell>
                  <TableCell>{formatEquipeLabel(policial.equipe)}</TableCell>
                  <TableCell>{policial.funcao?.nome ?? '—'}</TableCell>
                  <TableCell>
                    {policial.dataInicioPrevisaoFerias
                      ? formatDate(policial.dataInicioPrevisaoFerias)
                      : '—'}
                  </TableCell>
                  <TableCell>
                    {policial.dataFimPrevisaoFerias
                      ? formatDate(policial.dataFimPrevisaoFerias)
                      : '—'}
                  </TableCell>
                  <TableCell>
                    <Button
                      type="button"
                      variant="outlined"
                      size="small"
                      sx={{ textTransform: 'none', fontSize: '0.8rem' }}
                      onClick={() => handleAssinar(policial)}
                    >
                      Assinar
                    </Button>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </TableContainer>

      {totalPaginas > 1 && (
        <Box sx={{ display: 'flex', justifyContent: 'center', mt: 2 }}>
          <Pagination
            count={totalPaginas}
            page={paginaAtual}
            onChange={(_, page) => setPaginaAtual(page)}
            color="primary"
            shape="rounded"
          />
        </Box>
      )}
    </Box>
  );
}
