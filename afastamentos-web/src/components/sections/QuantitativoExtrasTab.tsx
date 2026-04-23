import { useCallback, useEffect, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
  Paper,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Tooltip,
  Typography,
} from '@mui/material';
import { DeleteOutline, Refresh } from '@mui/icons-material';
import { api } from '../../api';
import type { QuantitativoExtraPolicialItem } from '../../types';
import { formatEquipeLabel } from '../../constants';
import { formatMatricula } from '../../utils/dateUtils';
import type { PermissoesPorTela } from '../../utils/permissions';
import { canExcluir } from '../../utils/permissions';

interface QuantitativoExtrasTabProps {
  permissoes?: PermissoesPorTela | null;
}

export function QuantitativoExtrasTab({ permissoes }: QuantitativoExtrasTabProps) {
  const [itens, setItens] = useState<QuantitativoExtraPolicialItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [excluirRow, setExcluirRow] = useState<QuantitativoExtraPolicialItem | null>(null);
  const [excluirSaving, setExcluirSaving] = useState(false);
  const [excluirError, setExcluirError] = useState<string | null>(null);

  const podeExcluirContagem = canExcluir(permissoes, 'escalas-consultar');

  const carregar = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await api.listQuantitativoExtrasPoliciais();
      setItens(data);
    } catch (e) {
      setItens([]);
      setError(e instanceof Error ? e.message : 'Não foi possível carregar o quantitativo.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void carregar();
  }, [carregar]);

  const confirmarExclusao = async () => {
    if (!excluirRow) return;
    setExcluirSaving(true);
    setExcluirError(null);
    try {
      await api.deleteQuantitativoExtraPolicial(excluirRow.policialId);
      setExcluirRow(null);
      await carregar();
    } catch (e) {
      setExcluirError(e instanceof Error ? e.message : 'Falha ao excluir o registro.');
    } finally {
      setExcluirSaving(false);
    }
  };

  return (
    <Stack spacing={2}>
      <Typography variant="body2" color="text.secondary" sx={{ maxWidth: 720, lineHeight: 1.6 }}>
        Contagem de quantas vezes cada policial entrou em uma <strong>escala extraordinária gravada</strong> no sistema
        (após <strong>Gerar escala definitiva</strong> e <strong>Salvar</strong> na janela de impressão). Cada gravação
        conta <strong>uma vez</strong> por policial presente na escala (mesmo policial em mais de uma linha na mesma
        gravação conta uma vez). Ordenação: maior número de escalas extras para o menor.
        {podeExcluirContagem && (
          <>
            {' '}
            Com permissão de <strong>Excluir</strong> em Escalas – Consultar, você pode remover o registro de contagem
            de um policial (ele some da lista; novas gravações de extra voltam a contar a partir de zero para ele).
          </>
        )}
      </Typography>

      <Box sx={{ display: 'flex', justifyContent: 'flex-end' }}>
        <Button
          variant="outlined"
          size="small"
          startIcon={loading ? <CircularProgress size={16} color="inherit" /> : <Refresh />}
          onClick={() => void carregar()}
          disabled={loading}
        >
          Atualizar
        </Button>
      </Box>

      {error && (
        <Alert severity="error" onClose={() => setError(null)}>
          {error}
        </Alert>
      )}

      <TableContainer component={Paper} variant="outlined" sx={{ maxWidth: 960 }}>
        <Table size="small" stickyHeader>
          <TableHead>
            <TableRow>
              <TableCell width={56}>#</TableCell>
              <TableCell>Policial</TableCell>
              <TableCell width={120}>Matrícula</TableCell>
              <TableCell width={100}>Equipe</TableCell>
              <TableCell align="right" width={120}>
                Vezes na extra
              </TableCell>
              {podeExcluirContagem ? <TableCell align="right" width={72} /> : null}
            </TableRow>
          </TableHead>
          <TableBody>
            {loading && itens.length === 0 ? (
              <TableRow>
                <TableCell colSpan={podeExcluirContagem ? 6 : 5} align="center" sx={{ py: 4 }}>
                  <CircularProgress size={28} />
                </TableCell>
              </TableRow>
            ) : itens.length === 0 ? (
              <TableRow>
                <TableCell colSpan={podeExcluirContagem ? 6 : 5} sx={{ py: 3 }}>
                  <Typography variant="body2" color="text.secondary">
                    Ainda não há registros. Salve uma escala extraordinária (aba «Gerar Escala Extra») para alimentar
                    este painel.
                  </Typography>
                </TableCell>
              </TableRow>
            ) : (
              itens.map((row, i) => (
                <TableRow key={row.policialId} hover>
                  <TableCell>{i + 1}</TableCell>
                  <TableCell>{row.nome}</TableCell>
                  <TableCell>{formatMatricula(row.matricula)}</TableCell>
                  <TableCell>{formatEquipeLabel(row.equipe)}</TableCell>
                  <TableCell align="right">
                    <strong>{row.vezesEscaladoExtra}</strong>
                  </TableCell>
                  {podeExcluirContagem ? (
                    <TableCell align="right" sx={{ pr: 1 }}>
                      <Tooltip title="Excluir registro da contagem">
                        <IconButton
                          size="small"
                          color="error"
                          aria-label={`Excluir contagem de ${row.nome}`}
                          onClick={() => {
                            setExcluirError(null);
                            setExcluirRow(row);
                          }}
                        >
                          <DeleteOutline fontSize="small" />
                        </IconButton>
                      </Tooltip>
                    </TableCell>
                  ) : null}
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </TableContainer>

      <Dialog open={excluirRow !== null} onClose={() => !excluirSaving && setExcluirRow(null)} maxWidth="xs" fullWidth>
        <DialogTitle>Excluir registro da contagem?</DialogTitle>
        <DialogContent>
          {excluirRow && (
            <Typography variant="body2">
              Será removido o acumulado de <strong>{excluirRow.vezesEscaladoExtra}</strong> escala(s) extra para{' '}
              <strong>{excluirRow.nome}</strong> ({formatMatricula(excluirRow.matricula)}). O policial deixa de
              aparecer nesta lista até voltar a entrar em uma escala extra salva.
            </Typography>
          )}
          {excluirError && (
            <Alert severity="error" sx={{ mt: 2 }} onClose={() => setExcluirError(null)}>
              {excluirError}
            </Alert>
          )}
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setExcluirRow(null)} disabled={excluirSaving}>
            Cancelar
          </Button>
          <Button color="error" variant="contained" onClick={() => void confirmarExclusao()} disabled={excluirSaving}>
            {excluirSaving ? <CircularProgress size={22} color="inherit" /> : 'Excluir'}
          </Button>
        </DialogActions>
      </Dialog>
    </Stack>
  );
}
