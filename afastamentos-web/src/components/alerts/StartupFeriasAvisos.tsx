import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Checkbox,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControlLabel,
  Typography,
} from '@mui/material';
import { api } from '../../api';
import type { Policial, Usuario } from '../../types';
import type { TabKey } from '../../constants';

/** Só fecha pelo fluxo explícito dos botões; bloqueia backdrop e Escape. */
function onCloseDialogIgnorarFora(
  _event: object,
  reason: 'backdropClick' | 'escapeKeyDown',
) {
  if (reason === 'backdropClick' || reason === 'escapeKeyDown') {
    return;
  }
}

const mesesDisponiveis = [
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
] as const;

type Props = {
  currentUser: Usuario;
  enabled: boolean;
  /** Se true, o texto orienta pelo Dashboard; se false, mostra atalho “Abrir Afastamentos”. */
  podeAbrirDashboard: boolean;
  onIrPara: (tab: TabKey) => void;
  refreshKeyPoliciais: number;
  refreshKeyAfastamentos: number;
};

/**
 * Ao entrar no SAD, mostra em sequência avisos curtos sobre férias (mesmo texto dos alerts do dashboard),
 * sem listar policiais. A lista detalhada continua só no Dashboard.
 */
export function StartupFeriasAvisos({
  currentUser,
  enabled,
  podeAbrirDashboard,
  onIrPara,
  refreshKeyPoliciais,
  refreshKeyAfastamentos,
}: Props) {
  const usuarioPodeVerTodos = useMemo(() => {
    const nivelNome = currentUser.nivel?.nome;
    return (
      nivelNome === 'ADMINISTRADOR' ||
      nivelNome === 'COMANDO' ||
      nivelNome === 'SAD' ||
      currentUser.isAdmin === true
    );
  }, [currentUser]);

  const [listaProg, setListaProg] = useState<Policial[] | null>(null);
  const [listaAtras, setListaAtras] = useState<Policial[] | null>(null);
  const [openProg, setOpenProg] = useState(false);
  const [openAtras, setOpenAtras] = useState(false);
  const [entendiProg, setEntendiProg] = useState(false);
  const [entendiAtras, setEntendiAtras] = useState(false);
  const sequenciaIniciadaRef = useRef(false);

  useEffect(() => {
    if (openProg) setEntendiProg(false);
  }, [openProg]);

  useEffect(() => {
    if (openAtras) setEntendiAtras(false);
  }, [openAtras]);

  useEffect(() => {
    if (!enabled) {
      return;
    }
    let cancelled = false;
    const carregar = async () => {
      try {
        const equipe = !usuarioPodeVerTodos && currentUser.equipe ? currentUser.equipe : undefined;
        const [prog, atras] = await Promise.all([
          api.getPoliciaisComFeriasProgramadasSemAfastamento(equipe),
          api.getPoliciaisComFeriasAtrasadasSemAfastamento(equipe),
        ]);
        if (!cancelled) {
          setListaProg(prog);
          setListaAtras(atras);
        }
      } catch {
        if (!cancelled) {
          setListaProg([]);
          setListaAtras([]);
        }
      }
    };
    void carregar();
    return () => {
      cancelled = true;
    };
  }, [enabled, currentUser.equipe, usuarioPodeVerTodos, refreshKeyPoliciais, refreshKeyAfastamentos]);

  useEffect(() => {
    if (!enabled || listaProg === null || listaAtras === null) return;
    if (sequenciaIniciadaRef.current) return;
    sequenciaIniciadaRef.current = true;
    const id = window.setTimeout(() => {
      if (listaProg.length > 0) {
        setOpenProg(true);
      } else if (listaAtras.length > 0) {
        setOpenAtras(true);
      }
    }, 450);
    return () => window.clearTimeout(id);
  }, [enabled, listaProg, listaAtras]);

  const fecharProg = () => {
    setOpenProg(false);
    window.setTimeout(() => {
      if (listaAtras && listaAtras.length > 0) {
        setOpenAtras(true);
      }
    }, 0);
  };

  const fecharAtras = () => {
    setOpenAtras(false);
  };

  const now = new Date();
  const mesAtualNum = now.getMonth() + 1;
  const proximoMesNum = mesAtualNum === 12 ? 1 : mesAtualNum + 1;
  const anoAtual = now.getFullYear();
  const anoProximo = mesAtualNum === 12 ? anoAtual + 1 : anoAtual;
  const nomeMesAtual = mesesDisponiveis[mesAtualNum - 1]?.nome ?? '';
  const nomeProximoMes = mesesDisponiveis[proximoMesNum - 1]?.nome ?? '';

  const resumoProg = useMemo(() => {
    if (!listaProg || listaProg.length === 0) return null;
    const qtdMesAtual = listaProg.filter(
      (p) => p.anoPrevisaoFerias === anoAtual && p.mesPrevisaoFerias === mesAtualNum,
    ).length;
    const qtdProximoMes = listaProg.filter(
      (p) => p.anoPrevisaoFerias === anoProximo && p.mesPrevisaoFerias === proximoMesNum,
    ).length;
    return { qtdMesAtual, qtdProximoMes, total: listaProg.length };
  }, [listaProg, anoAtual, mesAtualNum, anoProximo, proximoMesNum]);

  const resumoAtras = useMemo(() => {
    if (!listaAtras || listaAtras.length === 0) return null;
    const mesesUnicos = Array.from(
      new Set(
        listaAtras
          .filter((p) => p.mesPrevisaoFerias != null && p.anoPrevisaoFerias != null)
          .map((p) => `${p.anoPrevisaoFerias!}-${String(p.mesPrevisaoFerias!).padStart(2, '0')}`),
      ),
    )
      .sort()
      .reverse()
      .map((key) => {
        const [ano, mes] = key.split('-').map(Number);
        return { ano, mes, nome: mesesDisponiveis[mes - 1]?.nome ?? String(mes) };
      });
    const textoMeses =
      mesesUnicos.length === 0 ? '' : mesesUnicos.map((m) => `${m.nome}/${m.ano}`).join(', ');
    return { textoMeses, total: listaAtras.length };
  }, [listaAtras]);

  return (
    <>
      {openProg && resumoProg ? (
        <Dialog
          open
          onClose={onCloseDialogIgnorarFora}
          disableEscapeKeyDown
          maxWidth="sm"
          fullWidth
          disableRestoreFocus
        >
          <DialogTitle>Aviso — férias programadas</DialogTitle>
          <DialogContent>
            <Alert severity="warning" sx={{ mb: 2 }}>
              Existem policiais com férias programadas para os meses de {nomeMesAtual} e {nomeProximoMes}, mas não
              estão marcados.
            </Alert>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
              {podeAbrirDashboard ? (
                <>
                  Confira no <strong>Dashboard</strong> a lista completa e use <strong>Ver policiais</strong> para marcar
                  afastamento de Férias (com exercício da previsão quando aplicável).
                </>
              ) : (
                <>
                  Cadastre os afastamentos de <strong>Férias</strong> em <strong>Afastamentos</strong> → Gerenciar
                  afastamentos, informando o policial, o motivo e o exercício da previsão quando aplicável.
                </>
              )}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Resumo: {nomeMesAtual}: {resumoProg.qtdMesAtual} policial(is) · {nomeProximoMes}:{' '}
              {resumoProg.qtdProximoMes} policial(is) · total {resumoProg.total} sem cadastro de férias nesta previsão.
            </Typography>
            <Box sx={{ mt: 2 }}>
              <FormControlLabel
                control={
                  <Checkbox
                    checked={entendiProg}
                    onChange={(_, checked) => setEntendiProg(checked)}
                    color="primary"
                  />
                }
                label="Entendi"
              />
            </Box>
          </DialogContent>
          <DialogActions sx={{ px: 3, py: 2, gap: 1, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
            {!podeAbrirDashboard ? (
              <Button
                variant="outlined"
                onClick={() => {
                  onIrPara('afastamentos');
                  fecharProg();
                }}
              >
                Abrir Afastamentos
              </Button>
            ) : null}
            {entendiProg ? (
              <Button onClick={fecharProg} variant="contained">
                Fechar
              </Button>
            ) : null}
          </DialogActions>
        </Dialog>
      ) : null}

      {openAtras && resumoAtras ? (
        <Dialog
          open
          onClose={onCloseDialogIgnorarFora}
          disableEscapeKeyDown
          maxWidth="sm"
          fullWidth
          disableRestoreFocus
        >
          <DialogTitle>Aviso — férias atrasadas</DialogTitle>
          <DialogContent>
            <Alert severity="info" sx={{ mb: 2 }}>
              Existem policiais com férias programadas em {resumoAtras.textoMeses || 'meses anteriores'}, mas não foram
              marcadas.
            </Alert>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
              {podeAbrirDashboard ? (
                <>
                  No <strong>Dashboard</strong>, use <strong>Ver policiais</strong> no alerta correspondente para cadastrar
                  o afastamento com as datas reais de gozo.
                </>
              ) : (
                <>
                  Em <strong>Afastamentos</strong> → Gerenciar afastamentos, cadastre o afastamento de Férias com as
                  datas reais de gozo e o exercício da previsão quando aplicável.
                </>
              )}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Total: {resumoAtras.total} policial(is) com previsão em meses já passados e sem afastamento de Férias.
            </Typography>
            <Box sx={{ mt: 2 }}>
              <FormControlLabel
                control={
                  <Checkbox
                    checked={entendiAtras}
                    onChange={(_, checked) => setEntendiAtras(checked)}
                    color="primary"
                  />
                }
                label="Entendi"
              />
            </Box>
          </DialogContent>
          <DialogActions sx={{ px: 3, py: 2, gap: 1, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
            {!podeAbrirDashboard ? (
              <Button
                variant="outlined"
                onClick={() => {
                  onIrPara('afastamentos');
                  fecharAtras();
                }}
              >
                Abrir Afastamentos
              </Button>
            ) : null}
            {entendiAtras ? (
              <Button onClick={fecharAtras} variant="contained">
                Fechar
              </Button>
            ) : null}
          </DialogActions>
        </Dialog>
      ) : null}
    </>
  );
}
