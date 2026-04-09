import { useCallback, useEffect, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControl,
  InputLabel,
  MenuItem,
  Select,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Typography,
} from '@mui/material';
import { Add, Delete, Edit } from '@mui/icons-material';
import { api } from '../api';
import type { PatrimonioBem, PatrimonioBemSituacao } from '../types';

const SITUACAO_LABEL: Record<PatrimonioBemSituacao, string> = {
  EM_USO: 'Em uso',
  GUARDADO: 'Guardado',
  MANUTENCAO: 'Manutenção',
  EMPRESTADO: 'Emprestado',
  BAIXADO: 'Baixado',
};

const SITUACOES: PatrimonioBemSituacao[] = [
  'EM_USO',
  'GUARDADO',
  'MANUTENCAO',
  'EMPRESTADO',
  'BAIXADO',
];

function ymdFromApi(d: string | null): string {
  if (!d) return '';
  return d.slice(0, 10);
}

type FormState = {
  tombamento: string;
  descricao: string;
  categoria: string;
  marca: string;
  modelo: string;
  numeroSerie: string;
  localizacaoSetor: string;
  situacao: PatrimonioBemSituacao;
  observacoes: string;
  dataAquisicao: string;
  valorAquisicao: string;
};

const emptyForm: FormState = {
  tombamento: '',
  descricao: '',
  categoria: '',
  marca: '',
  modelo: '',
  numeroSerie: '',
  localizacaoSetor: '',
  situacao: 'EM_USO',
  observacoes: '',
  dataAquisicao: '',
  valorAquisicao: '',
};

function bemToForm(b: PatrimonioBem): FormState {
  return {
    tombamento: b.tombamento,
    descricao: b.descricao,
    categoria: b.categoria ?? '',
    marca: b.marca ?? '',
    modelo: b.modelo ?? '',
    numeroSerie: b.numeroSerie ?? '',
    localizacaoSetor: b.localizacaoSetor ?? '',
    situacao: b.situacao,
    observacoes: b.observacoes ?? '',
    dataAquisicao: ymdFromApi(b.dataAquisicao),
    valorAquisicao: b.valorAquisicao != null ? String(b.valorAquisicao) : '',
  };
}

export function PatrimonioBensSection() {
  const [itens, setItens] = useState<PatrimonioBem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [submitting, setSubmitting] = useState(false);
  const [deleteId, setDeleteId] = useState<number | null>(null);

  const carregar = useCallback(async () => {
    setError(null);
    setLoading(true);
    try {
      const data = await api.listarBens();
      setItens(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Não foi possível carregar os bens.');
      setItens([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void carregar();
  }, [carregar]);

  const abrirNovo = () => {
    setError(null);
    setEditingId(null);
    setForm(emptyForm);
    setDialogOpen(true);
  };

  const abrirEditar = (b: PatrimonioBem) => {
    setError(null);
    setEditingId(b.id);
    setForm(bemToForm(b));
    setDialogOpen(true);
  };

  const fecharDialog = () => {
    if (submitting) return;
    setDialogOpen(false);
    setEditingId(null);
    setForm(emptyForm);
  };

  const salvar = async () => {
    if (!form.descricao.trim()) {
      setError('Descrição é obrigatória.');
      return;
    }
    if (editingId == null && !form.tombamento.trim()) {
      setError('Tombamento é obrigatório.');
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const valorNum =
        form.valorAquisicao.trim() === '' ? undefined : Number(form.valorAquisicao.replace(',', '.'));
      if (form.valorAquisicao.trim() !== '' && (Number.isNaN(valorNum!) || valorNum! < 0)) {
        throw new Error('Valor de aquisição inválido.');
      }
      if (editingId == null) {
        await api.criarBem({
          tombamento: form.tombamento.trim(),
          descricao: form.descricao.trim(),
          categoria: form.categoria.trim() || undefined,
          marca: form.marca.trim() || undefined,
          modelo: form.modelo.trim() || undefined,
          numeroSerie: form.numeroSerie.trim() || undefined,
          localizacaoSetor: form.localizacaoSetor.trim() || undefined,
          situacao: form.situacao,
          observacoes: form.observacoes.trim() || undefined,
          dataAquisicao: form.dataAquisicao.trim() || undefined,
          valorAquisicao: valorNum,
        });
      } else {
        await api.atualizarBem(editingId, {
          descricao: form.descricao.trim(),
          categoria: form.categoria.trim() || null,
          marca: form.marca.trim() || null,
          modelo: form.modelo.trim() || null,
          numeroSerie: form.numeroSerie.trim() || null,
          localizacaoSetor: form.localizacaoSetor.trim() || null,
          situacao: form.situacao,
          observacoes: form.observacoes.trim() || null,
          dataAquisicao: form.dataAquisicao.trim() || null,
          valorAquisicao: form.valorAquisicao.trim() === '' ? null : valorNum!,
        });
      }
      fecharDialog();
      await carregar();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Falha ao salvar.');
    } finally {
      setSubmitting(false);
    }
  };

  const confirmarExcluir = async () => {
    if (deleteId == null) return;
    setSubmitting(true);
    setError(null);
    try {
      await api.excluirBem(deleteId);
      setDeleteId(null);
      await carregar();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Falha ao excluir.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Box>
      <Stack direction="row" alignItems="center" justifyContent="space-between" flexWrap="wrap" gap={2} sx={{ mb: 2 }}>
        <Typography variant="h6" sx={{ fontWeight: 700, color: 'var(--patrimonio-text)' }}>
          Bens patrimoniais
        </Typography>
        <Button variant="contained" startIcon={<Add />} onClick={abrirNovo} sx={{ bgcolor: 'var(--patrimonio-accent)' }}>
          Novo bem
        </Button>
      </Stack>

      {error && !dialogOpen && deleteId == null ? (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>
          {error}
        </Alert>
      ) : null}

      <TableContainer
        sx={{
          borderRadius: 2,
          border: '1px solid var(--patrimonio-border)',
          bgcolor: 'rgba(15, 23, 42, 0.5)',
        }}
      >
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>Tombamento</TableCell>
              <TableCell>Descrição</TableCell>
              <TableCell>Setor</TableCell>
              <TableCell>Situação</TableCell>
              <TableCell align="right">Ações</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={5}>Carregando…</TableCell>
              </TableRow>
            ) : itens.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5}>
                  Nenhum bem cadastrado. Use &quot;Novo bem&quot; para incluir o primeiro registro.
                </TableCell>
              </TableRow>
            ) : (
              itens.map((b) => (
                <TableRow key={b.id} hover>
                  <TableCell sx={{ fontFamily: 'Roboto Mono, monospace' }}>{b.tombamento}</TableCell>
                  <TableCell>{b.descricao}</TableCell>
                  <TableCell>{b.localizacaoSetor ?? '—'}</TableCell>
                  <TableCell>
                    <Chip size="small" label={SITUACAO_LABEL[b.situacao]} variant="outlined" />
                  </TableCell>
                  <TableCell align="right">
                    <Button size="small" startIcon={<Edit />} onClick={() => abrirEditar(b)}>
                      Editar
                    </Button>
                    <Button size="small" color="error" startIcon={<Delete />} onClick={() => setDeleteId(b.id)}>
                      Excluir
                    </Button>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </TableContainer>

      <Dialog open={dialogOpen} onClose={fecharDialog} maxWidth="sm" fullWidth>
        <DialogTitle>{editingId == null ? 'Novo bem' : 'Editar bem'}</DialogTitle>
        <DialogContent>
          {error && dialogOpen ? (
            <Alert severity="error" sx={{ mb: 2 }}>
              {error}
            </Alert>
          ) : null}
          <Stack spacing={2} sx={{ pt: 1 }}>
            <TextField
              label="Tombamento"
              value={form.tombamento}
              onChange={(e) => setForm((f) => ({ ...f, tombamento: e.target.value }))}
              disabled={editingId != null}
              required
              fullWidth
              size="small"
            />
            <TextField
              label="Descrição"
              value={form.descricao}
              onChange={(e) => setForm((f) => ({ ...f, descricao: e.target.value }))}
              required
              fullWidth
              size="small"
            />
            <TextField
              label="Categoria"
              value={form.categoria}
              onChange={(e) => setForm((f) => ({ ...f, categoria: e.target.value }))}
              fullWidth
              size="small"
            />
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
              <TextField
                label="Marca"
                value={form.marca}
                onChange={(e) => setForm((f) => ({ ...f, marca: e.target.value }))}
                fullWidth
                size="small"
              />
              <TextField
                label="Modelo"
                value={form.modelo}
                onChange={(e) => setForm((f) => ({ ...f, modelo: e.target.value }))}
                fullWidth
                size="small"
              />
            </Stack>
            <TextField
              label="Número de série"
              value={form.numeroSerie}
              onChange={(e) => setForm((f) => ({ ...f, numeroSerie: e.target.value }))}
              fullWidth
              size="small"
            />
            <TextField
              label="Localização / setor"
              value={form.localizacaoSetor}
              onChange={(e) => setForm((f) => ({ ...f, localizacaoSetor: e.target.value }))}
              fullWidth
              size="small"
            />
            <FormControl fullWidth size="small">
              <InputLabel>Situação</InputLabel>
              <Select
                label="Situação"
                value={form.situacao}
                onChange={(e) =>
                  setForm((f) => ({ ...f, situacao: e.target.value as PatrimonioBemSituacao }))
                }
              >
                {SITUACOES.map((s) => (
                  <MenuItem key={s} value={s}>
                    {SITUACAO_LABEL[s]}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
            <TextField
              label="Observações"
              value={form.observacoes}
              onChange={(e) => setForm((f) => ({ ...f, observacoes: e.target.value }))}
              fullWidth
              multiline
              minRows={2}
              size="small"
            />
            <TextField
              label="Data de aquisição"
              type="date"
              value={form.dataAquisicao}
              onChange={(e) => setForm((f) => ({ ...f, dataAquisicao: e.target.value }))}
              fullWidth
              size="small"
              InputLabelProps={{ shrink: true }}
            />
            <TextField
              label="Valor de aquisição (R$)"
              value={form.valorAquisicao}
              onChange={(e) => setForm((f) => ({ ...f, valorAquisicao: e.target.value }))}
              fullWidth
              size="small"
              inputMode="decimal"
            />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={fecharDialog} disabled={submitting}>
            Cancelar
          </Button>
          <Button variant="contained" onClick={() => void salvar()} disabled={submitting}>
            {submitting ? 'Salvando…' : 'Salvar'}
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={deleteId != null} onClose={() => !submitting && setDeleteId(null)}>
        <DialogTitle>Excluir bem</DialogTitle>
        <DialogContent>
          <Typography>Confirma a exclusão definitiva deste registro? Esta ação não pode ser desfeita.</Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteId(null)} disabled={submitting}>
            Cancelar
          </Button>
          <Button color="error" variant="contained" onClick={() => void confirmarExcluir()} disabled={submitting}>
            Excluir
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
