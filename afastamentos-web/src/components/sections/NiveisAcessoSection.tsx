import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Box,
  Button,
  Chip,
  Checkbox,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
  Tooltip,
  Typography,
} from '@mui/material';
import BlockIcon from '@mui/icons-material/Block';
import CloseIcon from '@mui/icons-material/Close';
import DeleteIcon from '@mui/icons-material/Delete';
import EditIcon from '@mui/icons-material/Edit';
import SaveIcon from '@mui/icons-material/Save';
import VpnKeyIcon from '@mui/icons-material/VpnKey';
import { api } from '../../api';
import { TABS, type TabKey } from '../../constants';
import type { PermissaoAcao, Usuario, UsuarioNivelOption, UsuarioNivelPermissao } from '../../types';
import { formatNome } from '../../utils/dateUtils';
import { createNormalizedInputHandler, handleKeyDownNormalized } from '../../utils/inputUtils';
import type { PermissoesPorTela } from '../../utils/permissions';
import { canEdit, canExcluir, canDesativar } from '../../utils/permissions';

interface NiveisAcessoSectionProps {
  currentUser: Usuario;
  embedded?: boolean;
  permissoes?: PermissoesPorTela | null;
}

export function NiveisAcessoSection({ currentUser, embedded = false, permissoes }: NiveisAcessoSectionProps) {
  const [niveis, setNiveis] = useState<UsuarioNivelOption[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sucesso, setSucesso] = useState<string | null>(null);
  const [nomeNovo, setNomeNovo] = useState('');
  const [descricaoNova, setDescricaoNova] = useState('');
  const [editandoId, setEditandoId] = useState<number | null>(null);
  const [nomeEdicao, setNomeEdicao] = useState('');
  const [descricaoEdicao, setDescricaoEdicao] = useState('');
  const [permissoesModalAberto, setPermissoesModalAberto] = useState(false);
  const [nivelPermissoes, setNivelPermissoes] = useState<UsuarioNivelOption | null>(null);
  const [permissoesCarregando, setPermissoesCarregando] = useState(false);
  const [confirmacaoAberta, setConfirmacaoAberta] = useState(false);
  const [confirmacaoCriarAberta, setConfirmacaoCriarAberta] = useState(false);
  const [confirmacaoDesativarAberta, setConfirmacaoDesativarAberta] = useState(false);
  const [confirmacaoExcluirAberta, setConfirmacaoExcluirAberta] = useState(false);
  const [nivelSelecionado, setNivelSelecionado] = useState<UsuarioNivelOption | null>(null);

  const PERMISSOES_ACOES = ['VISUALIZAR', 'EDITAR', 'DESATIVAR', 'EXCLUIR'] as const satisfies PermissaoAcao[];
  const PERMISSOES_LABELS: Record<PermissaoAcao, string> = {
    VISUALIZAR: 'Visualizar',
    EDITAR: 'Editar',
    DESATIVAR: 'Desativar',
    EXCLUIR: 'Excluir',
  };
  const telas = useMemo(() => TABS.map((tab) => ({ key: tab.key, label: tab.label })), []);
  
  // Telas que têm apenas permissão de visualizar (sem editar, desativar ou excluir)
  const TELAS_SOMENTE_VISUALIZAR: TabKey[] = [
    'dashboard',
    'calendario',
    'afastamentos-mes',
    'relatorios',
    'relatorios-sistema',
    'relatorios-servico',
  ];

  const criarPermissoesVazias = useCallback(() => {
    const initial: Record<PermissaoAcao, Record<TabKey, boolean>> = {
      VISUALIZAR: {} as Record<TabKey, boolean>,
      EDITAR: {} as Record<TabKey, boolean>,
      DESATIVAR: {} as Record<TabKey, boolean>,
      EXCLUIR: {} as Record<TabKey, boolean>,
    };
    // Incluir todas as telas de TABS
    TABS.forEach((tela) => {
      (Object.keys(initial) as PermissaoAcao[]).forEach((acao) => {
        initial[acao][tela.key] = false;
      });
    });
    // Incluir também relatorios-sistema e relatorios-servico (não estão no TABS mas são usados para permissões)
    (Object.keys(initial) as PermissaoAcao[]).forEach((acao) => {
      initial[acao]['relatorios-sistema'] = false;
      initial[acao]['relatorios-servico'] = false;
    });
    return initial;
  }, []);

  const [permissoesModal, setPermissoesModal] = useState<Record<PermissaoAcao, Record<TabKey, boolean>>>(() =>
    criarPermissoesVazias(),
  );

  const carregarNiveis = useCallback(async () => {
    try {
      setLoading(true);
      const data = await api.listUsuarioNiveis();
      setNiveis(data);
      setError(null);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Não foi possível carregar os níveis de acesso.',
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void carregarNiveis();
  }, [carregarNiveis]);

  const iniciarEdicao = useCallback((nivel: UsuarioNivelOption) => {
    setEditandoId(nivel.id);
    setNomeEdicao(nivel.nome);
    setDescricaoEdicao(nivel.descricao ?? '');
  }, []);

  const abrirPermissoes = useCallback(async (nivel: UsuarioNivelOption) => {
    setNivelPermissoes(nivel);
    setPermissoesModalAberto(true);
    setPermissoesCarregando(true);
    setSucesso(null);
    try {
      const base = criarPermissoesVazias();
      const data = await api.listUsuarioNivelPermissoes(nivel.id);
      data.forEach((item) => {
        const telaKey = item.telaKey as TabKey;
        // Verificar se esta ação é permitida para esta tela
        const telaPermiteAcao = item.acao === 'VISUALIZAR' || !TELAS_SOMENTE_VISUALIZAR.includes(telaKey);
        
        if (base[item.acao] && telaKey in base[item.acao] && telaPermiteAcao) {
          base[item.acao][telaKey] = true;
        }
      });
      setPermissoesModal(base);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Não foi possível carregar as permissões.',
      );
    } finally {
      setPermissoesCarregando(false);
    }
  }, [criarPermissoesVazias]);

  const fecharPermissoes = useCallback(() => {
    setPermissoesModalAberto(false);
    setNivelPermissoes(null);
  }, []);

  const abrirConfirmacao = useCallback(() => {
    setConfirmacaoAberta(true);
  }, []);

  const fecharConfirmacao = useCallback(() => {
    setConfirmacaoAberta(false);
  }, []);

  const abrirConfirmacaoCriar = useCallback(() => {
    setConfirmacaoCriarAberta(true);
  }, []);

  const fecharConfirmacaoCriar = useCallback(() => {
    setConfirmacaoCriarAberta(false);
  }, []);

  const abrirConfirmacaoDesativar = useCallback((nivel: UsuarioNivelOption) => {
    setNivelSelecionado(nivel);
    setConfirmacaoDesativarAberta(true);
  }, []);

  const fecharConfirmacaoDesativar = useCallback(() => {
    setConfirmacaoDesativarAberta(false);
    setNivelSelecionado(null);
  }, []);

  const abrirConfirmacaoExcluir = useCallback((nivel: UsuarioNivelOption) => {
    setNivelSelecionado(nivel);
    setConfirmacaoExcluirAberta(true);
  }, []);

  const fecharConfirmacaoExcluir = useCallback(() => {
    setConfirmacaoExcluirAberta(false);
    setNivelSelecionado(null);
  }, []);

  const togglePermissao = useCallback(
    (acao: PermissaoAcao, tela: TabKey) => {
      // Verificar se esta ação é permitida para esta tela
      const telaPermiteAcao = acao === 'VISUALIZAR' || !TELAS_SOMENTE_VISUALIZAR.includes(tela);
      
      if (!telaPermiteAcao) {
        return; // Não permitir alterar ações não permitidas
      }
      
      setPermissoesModal((prev) => {
        const next = { ...prev, [acao]: { ...prev[acao] } } as Record<PermissaoAcao, Record<TabKey, boolean>>;
        const novoValor = !prev[acao][tela];
        next[acao][tela] = novoValor;

        if (acao === 'VISUALIZAR' && !novoValor) {
          ['EDITAR', 'DESATIVAR', 'EXCLUIR'].forEach((outraAcao) => {
            next[outraAcao as PermissaoAcao] = { ...next[outraAcao as PermissaoAcao], [tela]: false };
          });
        }

        return next;
      });
    },
    [],
  );

  const salvarPermissoes = useCallback(async () => {
    if (!nivelPermissoes) {
      return;
    }
    const itens: UsuarioNivelPermissao[] = [];
    (Object.keys(permissoesModal) as PermissaoAcao[]).forEach((acao) => {
      Object.entries(permissoesModal[acao]).forEach(([telaKey, permitido]) => {
        // Não salvar ações que não são permitidas para telas somente visualizar
        const telaKeyTyped = telaKey as TabKey;
        const acaoPermitida = acao === 'VISUALIZAR' || !TELAS_SOMENTE_VISUALIZAR.includes(telaKeyTyped);
        
        if (permitido && acaoPermitida) {
          itens.push({ telaKey: telaKeyTyped, acao });
        }
      });
    });
    try {
      await api.setUsuarioNivelPermissoes(nivelPermissoes.id, itens);
      window.dispatchEvent(
        new CustomEvent('nivel-permissoes-atualizadas', {
          detail: { nivelId: nivelPermissoes.id },
        }),
      );
      setError(null);
      setSucesso('Permissões salvas com sucesso.');
      setPermissoesModalAberto(false);
      setNivelPermissoes(null);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Não foi possível salvar as permissões.',
      );
      setSucesso(null);
    }
  }, [nivelPermissoes, permissoesModal]);

  const confirmarSalvarPermissoes = useCallback(async () => {
    setConfirmacaoAberta(false);
    await salvarPermissoes();
  }, [salvarPermissoes]);

  const cancelarEdicao = useCallback(() => {
    setEditandoId(null);
    setNomeEdicao('');
    setDescricaoEdicao('');
  }, []);

  const salvarEdicao = useCallback(async () => {
    if (!editandoId) {
      return;
    }
    if (!nomeEdicao.trim()) {
      setError('Informe o nome do nível de acesso.');
      return;
    }
    try {
      await api.updateUsuarioNivel(editandoId, {
        nome: nomeEdicao.trim(),
        descricao: descricaoEdicao.trim() || null,
      });
      cancelarEdicao();
      await carregarNiveis();
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Não foi possível atualizar o nível de acesso.',
      );
    }
  }, [editandoId, nomeEdicao, descricaoEdicao, cancelarEdicao, carregarNiveis]);

  const criarNivel = useCallback(async () => {
    if (!nomeNovo.trim()) {
      setError('Informe o nome do nível de acesso.');
      return;
    }
    try {
      await api.createUsuarioNivel({
        nome: nomeNovo.trim(),
        descricao: descricaoNova.trim() || undefined,
      });
      setNomeNovo('');
      setDescricaoNova('');
      await carregarNiveis();
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Não foi possível criar o nível de acesso.',
      );
    }
  }, [nomeNovo, descricaoNova, carregarNiveis]);

  const confirmarCriacaoNivel = useCallback(async () => {
    setConfirmacaoCriarAberta(false);
    await criarNivel();
  }, [criarNivel]);

  const confirmarDesativacaoNivel = useCallback(async () => {
    if (!nivelSelecionado) {
      return;
    }
    try {
      await api.disableUsuarioNivel(nivelSelecionado.id);
      setSucesso(`Nível ${formatNome(nivelSelecionado.nome)} desativado com sucesso.`);
      setError(null);
      await carregarNiveis();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Não foi possível desativar o nível de acesso.',
      );
    } finally {
      setConfirmacaoDesativarAberta(false);
      setNivelSelecionado(null);
    }
  }, [nivelSelecionado, carregarNiveis]);

  const confirmarExclusaoNivel = useCallback(async () => {
    if (!nivelSelecionado) {
      return;
    }
    try {
      await api.deleteUsuarioNivel(nivelSelecionado.id);
      setSucesso(`Nível ${formatNome(nivelSelecionado.nome)} excluído com sucesso.`);
      setError(null);
      await carregarNiveis();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Não foi possível excluir o nível de acesso.',
      );
    } finally {
      setConfirmacaoExcluirAberta(false);
      setNivelSelecionado(null);
    }
  }, [nivelSelecionado, carregarNiveis]);

  const niveisOrdenados = useMemo(
    () => [...niveis].sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR')),
    [niveis],
  );

  if (!embedded) {
    return null;
  }

  return (
    <div className="niveis-acesso-embedded">
      <div className="section-header">
        <div>
          <h3>Níveis de acesso</h3>
          <p className="subtitle">
            Crie ou ajuste os níveis de acesso disponíveis no sistema.
          </p>
        </div>
        <div style={{ fontSize: '0.9rem', color: 'var(--text-secondary)' }}>
          Usuário: {currentUser.nome}
        </div>
      </div>

      {error && (
        <div className="feedback error">
          {error}
          <button
            type="button"
            className="feedback-close"
            onClick={() => setError(null)}
            aria-label="Fechar"
          >
            ×
          </button>
        </div>
      )}
      {sucesso && (
        <div className="feedback success">
          {sucesso}
          <button
            type="button"
            className="feedback-close"
            onClick={() => setSucesso(null)}
            aria-label="Fechar"
          >
            ×
          </button>
        </div>
      )}

      <div className="niveis-acesso-form">
        <h3>Novo nível</h3>
        <div className="grid two-columns">
          <label>
            Nome
            <input
              value={nomeNovo}
              onChange={createNormalizedInputHandler(setNomeNovo)}
              onKeyDown={handleKeyDownNormalized}
              placeholder="Ex: Administrador"
            />
          </label>
          <label>
            Descrição
            <input
              value={descricaoNova}
              onChange={createNormalizedInputHandler(setDescricaoNova)}
              onKeyDown={handleKeyDownNormalized}
              placeholder="Descrição opcional"
            />
          </label>
        </div>
        <button type="button" className="primary" onClick={abrirConfirmacaoCriar}>
          Criar nível
        </button>
      </div>

      <div>
        <h3>Níveis existentes</h3>
        {loading ? (
          <p className="empty-state">Carregando níveis...</p>
        ) : niveisOrdenados.length === 0 ? (
          <p className="empty-state">Nenhum nível de acesso encontrado.</p>
        ) : (
          <table className="table">
            <thead>
              <tr>
                <th>Nome</th>
                <th>Descrição</th>
                <th>Ações</th>
              </tr>
            </thead>
            <tbody>
              {niveisOrdenados.map((nivel) => {
                const emEdicao = editandoId === nivel.id;
                return (
                  <tr key={nivel.id}>
                    <td>
                      {emEdicao ? (
                        <input
                          value={nomeEdicao}
                          onChange={createNormalizedInputHandler(setNomeEdicao)}
                          onKeyDown={handleKeyDownNormalized}
                        />
                      ) : (
                        formatNome(nivel.nome)
                      )}
                    </td>
                    <td>
                      {emEdicao ? (
                        <input
                          value={descricaoEdicao}
                          onChange={createNormalizedInputHandler(setDescricaoEdicao)}
                          onKeyDown={handleKeyDownNormalized}
                          placeholder="Descrição"
                        />
                      ) : (
                        nivel.descricao || '—'
                      )}
                    </td>
                    <td>
                      {emEdicao ? (
                        <div className="table-actions">
                          <Tooltip title="Salvar" arrow>
                            <IconButton
                              aria-label="Salvar"
                              color="primary"
                              onClick={() => void salvarEdicao()}
                            >
                              <SaveIcon fontSize="small" />
                            </IconButton>
                          </Tooltip>
                          <Tooltip title="Cancelar" arrow>
                            <IconButton aria-label="Cancelar" onClick={cancelarEdicao}>
                              <CloseIcon fontSize="small" />
                            </IconButton>
                          </Tooltip>
                        </div>
                      ) : (
                        <div className="table-actions">
                          <Tooltip title="Definir permissões" arrow>
                            <IconButton
                              aria-label="Definir permissões"
                              onClick={() => abrirPermissoes(nivel)}
                            >
                              <VpnKeyIcon fontSize="small" />
                            </IconButton>
                          </Tooltip>
                          {canDesativar(permissoes, 'gestao-sistema') && (
                            <Tooltip title="Desativar" arrow>
                              <span>
                                <IconButton
                                  aria-label="Desativar"
                                  onClick={() => abrirConfirmacaoDesativar(nivel)}
                                  disabled={nivel.ativo === false}
                                >
                                  <BlockIcon fontSize="small" />
                                </IconButton>
                              </span>
                            </Tooltip>
                          )}
                          {canExcluir(permissoes, 'gestao-sistema') && (
                            <Tooltip title="Excluir" arrow>
                              <IconButton
                                aria-label="Excluir"
                                color="error"
                                onClick={() => abrirConfirmacaoExcluir(nivel)}
                              >
                                <DeleteIcon fontSize="small" />
                              </IconButton>
                            </Tooltip>
                          )}
                          {canEdit(permissoes, 'gestao-sistema') && (
                            <Tooltip title="Editar" arrow>
                              <IconButton
                                aria-label="Editar"
                                onClick={() => iniciarEdicao(nivel)}
                              >
                                <EditIcon fontSize="small" />
                              </IconButton>
                            </Tooltip>
                          )}
                        </div>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      <Dialog
        open={permissoesModalAberto}
        onClose={fecharPermissoes}
        fullWidth
        maxWidth={false}
        PaperProps={{
          sx: {
            width: '98vw',
            maxWidth: 1600,
            borderRadius: 3,
          },
        }}
      >
      <DialogTitle component="div">
        <Typography component="div" variant="h6" fontWeight={600}>
            Definir permissões
          </Typography>
        <Typography component="div" variant="body2" color="text.secondary">
            Nível: {nivelPermissoes?.nome ? formatNome(nivelPermissoes.nome) : '—'}
          </Typography>
        </DialogTitle>

        <DialogContent>
          {(() => {
            const rowHeight = 40;
            // Verificar se "Relatórios" está marcado para incluir as colunas extras
            const relatoriosMarcado = permissoesModal.VISUALIZAR['relatorios'] || false;
            
            // Criar lista de colunas: telas normais + colunas de relatórios se marcado
            const colunasParaExibir = [
              ...telas,
              ...(relatoriosMarcado
                ? [
                    { key: 'relatorios-sistema' as TabKey, label: 'Relatórios de Auditoria' },
                    { key: 'relatorios-servico' as TabKey, label: 'Relatórios de Serviço' },
                  ]
                : []),
            ];
            
            const gridColumns = `repeat(${colunasParaExibir.length}, minmax(140px, 1fr))`;

            return (
              <Box display="grid" gridTemplateColumns="180px 1fr" gap={2} alignItems="start">
                <Box display="grid" gap={1} gridAutoRows={`${rowHeight}px`}>
                  <Typography
                    variant="subtitle2"
                    color="text.secondary"
                    sx={{ display: 'flex', alignItems: 'center' }}
                  >
                    Ações
                  </Typography>
                  {PERMISSOES_ACOES.map((acao) => (
                    <Typography
                      key={acao}
                      fontWeight={600}
                      sx={{ display: 'flex', alignItems: 'center' }}
                    >
                      {PERMISSOES_LABELS[acao]}
                    </Typography>
                  ))}
                </Box>

                <Box sx={{ overflowX: 'auto' }}>
                  <Box display="grid" gap={1} minWidth="max-content">
                    {/* Cabeçalho das colunas */}
                    <Box
                      display="grid"
                      gridTemplateColumns={gridColumns}
                      gap={1}
                      sx={{ minHeight: rowHeight, alignItems: 'center' }}
                    >
                      {colunasParaExibir.map((tela) => (
                        <Chip key={tela.key} label={tela.label} />
                      ))}
                    </Box>

                    {/* Linhas de ações */}
                    {PERMISSOES_ACOES.map((acao) => (
                      <Box
                        key={acao}
                        display="grid"
                        gridTemplateColumns={gridColumns}
                        gap={1}
                        sx={{ minHeight: rowHeight, alignItems: 'center' }}
                      >
                        {colunasParaExibir.map((tela) => {
                          // Verificar se esta tela permite esta ação
                          const telaPermiteAcao = acao === 'VISUALIZAR' || !TELAS_SOMENTE_VISUALIZAR.includes(tela.key);
                          
                          // Para as colunas de relatórios, só mostrar checkbox se for VISUALIZAR
                          const ehColunaRelatorios = tela.key === 'relatorios-sistema' || tela.key === 'relatorios-servico';
                          const mostrarCheckbox = telaPermiteAcao && 
                            (acao === 'VISUALIZAR' || permissoesModal.VISUALIZAR[tela.key]) &&
                            (!ehColunaRelatorios || acao === 'VISUALIZAR');
                          
                          return (
                            <Box
                              key={`${acao}-${tela.key}`}
                              sx={{
                                height: 36,
                                borderRadius: 1,
                                border: '1px dashed var(--border-soft)',
                                bgcolor: 'rgba(0,0,0,0.1)',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                              }}
                            >
                              {mostrarCheckbox ? (
                                <Checkbox
                                  size="small"
                                  checked={permissoesModal[acao][tela.key] || false}
                                  onChange={() => togglePermissao(acao, tela.key)}
                                  disabled={permissoesCarregando}
                                />
                              ) : (
                                <span />
                              )}
                            </Box>
                          );
                        })}
                      </Box>
                    ))}
                  </Box>
                </Box>
              </Box>
            );
          })()}
        </DialogContent>

        <DialogActions>
          <Button variant="outlined" onClick={fecharPermissoes}>
            Fechar
          </Button>
          <Button
            variant="contained"
            onClick={abrirConfirmacao}
            disabled={permissoesCarregando}
          >
            Salvar permissões
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog
        open={confirmacaoAberta}
        onClose={fecharConfirmacao}
        fullWidth
        maxWidth="xs"
      >
        <DialogTitle component="div">
          <Typography component="div" variant="h6" fontWeight={600}>
            Confirmar permissões
          </Typography>
        </DialogTitle>
        <DialogContent>
          <Typography component="div" variant="body2" color="text.secondary">
            Deseja salvar as permissões para o nível {nivelPermissoes?.nome ? formatNome(nivelPermissoes.nome) : 'selecionado'}?
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button variant="outlined" onClick={fecharConfirmacao}>
            Cancelar
          </Button>
          <Button
            variant="contained"
            onClick={() => void confirmarSalvarPermissoes()}
            disabled={permissoesCarregando}
          >
            Confirmar
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog
        open={confirmacaoCriarAberta}
        onClose={fecharConfirmacaoCriar}
        fullWidth
        maxWidth="xs"
      >
        <DialogTitle component="div">
          <Typography component="div" variant="h6" fontWeight={600}>
            Confirmar criação de nível
          </Typography>
        </DialogTitle>
        <DialogContent>
          <Typography component="div" variant="body2" color="text.secondary">
            Deseja criar o nível {nomeNovo.trim() ? formatNome(nomeNovo.trim()) : 'informado'}?
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button variant="outlined" onClick={fecharConfirmacaoCriar}>
            Cancelar
          </Button>
          <Button variant="contained" onClick={() => void confirmarCriacaoNivel()}>
            Confirmar
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog
        open={confirmacaoDesativarAberta}
        onClose={fecharConfirmacaoDesativar}
        fullWidth
        maxWidth="xs"
      >
        <DialogTitle component="div">
          <Typography component="div" variant="h6" fontWeight={600}>
            Confirmar desativação
          </Typography>
        </DialogTitle>
        <DialogContent>
          <Typography component="div" variant="body2" color="text.secondary">
            Deseja desativar o nível {nivelSelecionado?.nome ? formatNome(nivelSelecionado.nome) : 'selecionado'}?
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button variant="outlined" onClick={fecharConfirmacaoDesativar}>
            Cancelar
          </Button>
          <Button variant="contained" onClick={() => void confirmarDesativacaoNivel()}>
            Confirmar
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog
        open={confirmacaoExcluirAberta}
        onClose={fecharConfirmacaoExcluir}
        fullWidth
        maxWidth="xs"
      >
        <DialogTitle component="div">
          <Typography component="div" variant="h6" fontWeight={600}>
            Confirmar exclusão
          </Typography>
        </DialogTitle>
        <DialogContent>
          <Typography component="div" variant="body2" color="text.secondary">
            Deseja excluir o nível {nivelSelecionado?.nome ? formatNome(nivelSelecionado.nome) : 'selecionado'}?
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button variant="outlined" onClick={fecharConfirmacaoExcluir}>
            Cancelar
          </Button>
          <Button variant="contained" color="error" onClick={() => void confirmarExclusaoNivel()}>
            Confirmar
          </Button>
        </DialogActions>
      </Dialog>
    </div>
  );
}
