import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { api } from '../../api';
import type { Afastamento, Policial, Equipe, FuncaoOption, PolicialStatus, Usuario, EquipeOption, HorarioSvg } from '../../types';
import { POLICIAL_STATUS_OPTIONS, POLICIAL_STATUS_OPTIONS_FORM, STATUS_LABEL, formatEquipeLabel, funcoesParaSelecao } from '../../constants';
import {
  SVG_INTERVALO_ESCALAS_HORAS,
  SVG_INTERVALO_EXPEDIENTE_HORAS,
  ESCALA_DIA_INICIO,
  ESCALA_DIA_FIM,
  ESCALA_NOITE_INICIO,
  ESCALA_NOITE_FIM,
  getExpedienteHorario,
} from '../../constants/svgRegras';
import type { ConfirmConfig } from '../common/ConfirmDialog';
import { ImageCropper } from '../common/ImageCropper';
import { Card, CardMedia, CardActions, IconButton, Box, Typography, Paper, Divider, Chip, Tabs, Tab, TextField, Button, List, ListItem, ListItemText, Dialog, DialogTitle, DialogContent, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, FormControl, InputLabel, Select, MenuItem, Stack, Alert, Checkbox } from '@mui/material';
import { PhotoCamera, Delete, AddPhotoAlternate, Edit, CheckCircle, Block, Close as CloseIcon, Print, ArrowUpward, ArrowDownward, SwapVert, PictureAsPdf, Search } from '@mui/icons-material';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { formatPeriodo, calcularDiasEntreDatas, formatNome, formatMatricula } from '../../utils/dateUtils';
import { comparePorPatenteENome, sortPorPatenteENome, sortAfastamentosPorPatenteENome } from '../../utils/sortPoliciais';
import type { PermissoesPorTela } from '../../utils/permissions';
import { canEdit, canExcluir, canDesativar } from '../../utils/permissions';
import { theme } from '../../constants/theme';

interface MostrarEquipeSectionProps {
  currentUser: Usuario;
  openConfirm: (config: ConfirmConfig) => void;
  onChanged?: () => void;
  refreshKey?: number;
  permissoes?: PermissoesPorTela | null;
}

export function MostrarEquipeSection({
  currentUser,
  openConfirm,
  onChanged,
  refreshKey,
  permissoes,
}: MostrarEquipeSectionProps) {
  const [policiais, setPoliciais] = useState<Policial[]>([]);
  const [, setTotalPoliciaisGeral] = useState<number>(0);
  const [totalPoliciaisDisponiveis, setTotalPoliciaisDisponiveis] = useState<number>(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [debouncedSearchTerm, setDebouncedSearchTerm] = useState('');
  const [editingPolicial, setEditingPolicial] = useState<Policial | null>(
    null,
  );
  const [viewingPolicial, setViewingPolicial] = useState<Policial | null>(
    null,
  );
  const [viewingAfastamentos, setViewingAfastamentos] = useState<Afastamento[]>([]);
  const [loadingAfastamentos, setLoadingAfastamentos] = useState(false);
  const [restricaoModal, setRestricaoModal] = useState<{
    open: boolean;
    policial: Policial | null;
    restricaoMedicaId: number | null;
    observacao: string;
    loading: boolean;
    error: string | null;
  }>({
    open: false,
    policial: null,
    restricaoMedicaId: null,
    observacao: '',
    loading: false,
    error: null,
  });
  const [restricoesMedicas, setRestricoesMedicas] = useState<Array<{ id: number; nome: string }>>([]);
  const [loadingRestricoes, setLoadingRestricoes] = useState(false);
  const [deleteModal, setDeleteModal] = useState<{
    open: boolean;
    policial: Policial | null;
    senha: string;
    error: string | null;
    loading: boolean;
  }>({
    open: false,
    policial: null,
    senha: '',
    error: null,
    loading: false,
  });
  const [desativarModal, setDesativarModal] = useState<{
    open: boolean;
    policial: Policial | null;
    dataAPartirDe: string;
    observacoes: string;
    error: string | null;
    loading: boolean;
  }>({
    open: false,
    policial: null,
    dataAPartirDe: '',
    observacoes: '',
    error: null,
    loading: false,
  });
  const [removeRestricaoModal, setRemoveRestricaoModal] = useState<{
    open: boolean;
    policial: Policial | null;
    senha: string;
    error: string | null;
    loading: boolean;
  }>({
    open: false,
    policial: null,
    senha: '',
    error: null,
    loading: false,
  });
  const [editForm, setEditForm] = useState({
    nome: '',
    matricula: '',
    status: 'ATIVO' as PolicialStatus,
    matriculaComissionadoGdf: '' as string,
    equipe: undefined as Equipe | undefined,
    funcaoId: undefined as number | undefined,
    fotoUrl: undefined as string | null | undefined,
  });
  const [funcoes, setFuncoes] = useState<FuncaoOption[]>([]);
  const [equipes, setEquipes] = useState<EquipeOption[]>([]);
  const [editSubmitting, setEditSubmitting] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);
  const [showImageCropper, setShowImageCropper] = useState(false);
  const [imageForCrop, setImageForCrop] = useState<string>('');
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [filtrosAberto, setFiltrosAberto] = useState(false);
  const [filtroEquipe, setFiltroEquipe] = useState<Equipe | ''>('');
  const [filtroStatus, setFiltroStatus] = useState<PolicialStatus | ''>('');
  const [filtroFuncao, setFiltroFuncao] = useState<number | ''>('');
  const [excluirMotoristas, setExcluirMotoristas] = useState(true);
  const [excluirDesativados, setExcluirDesativados] = useState(true);
  const [tabAtiva, setTabAtiva] = useState<number>(0);
  const [dataEfetivo, setDataEfetivo] = useState<string>('');
  const [efetivoDisponivel, setEfetivoDisponivel] = useState<Policial[]>([]);
  const [loadingEfetivo, setLoadingEfetivo] = useState(false);
  const [funcaoExpedienteId, setFuncaoExpedienteId] = useState<number | null>(null);
  const [modalEfetivoOpen, setModalEfetivoOpen] = useState(false);
  const [dataSvg, setDataSvg] = useState<string>('');
  const [horarioSvg, setHorarioSvg] = useState<string>('');
  const [horariosSvg, setHorariosSvg] = useState<HorarioSvg[]>([]);
  const [listaSvg, setListaSvg] = useState<Policial[]>([]);
  const [listaSvgCompleta, setListaSvgCompleta] = useState<Array<{ policial: Policial; disponivel: boolean; motivo?: string }>>([]);
  const [buscaSvg, setBuscaSvg] = useState('');
  const [modalListaSvgOpen, setModalListaSvgOpen] = useState(false);
  const [loadingListaSvg, setLoadingListaSvg] = useState(false);
  const [loadingHorariosSvg, setLoadingHorariosSvg] = useState(false);
  const [horaInicioNovo, setHoraInicioNovo] = useState<string>('');
  const [salvandoHorarioSvg, setSalvandoHorarioSvg] = useState(false);

  // Hora fim = hora início + 8 horas (SVG sempre 8h), sempre minuto 00
  const horaFimNovo = useMemo(() => {
    if (!horaInicioNovo) return '';
    const [h, m] = horaInicioNovo.split(':').map(Number);
    const totalMin = (h * 60 + (m || 0)) + 8 * 60;
    const newH = Math.floor(totalMin / 60) % 24;
    return `${String(newH).padStart(2, '0')}:00`;
  }, [horaInicioNovo]);

  const horariosSvgOrdenados = useMemo(
    () => [...horariosSvg].sort((a, b) => a.horaInicio.localeCompare(b.horaInicio)),
    [horariosSvg],
  );

  const listaSvgFiltrada = useMemo(() => {
    const termo = buscaSvg.trim().toLowerCase();
    let resultado;
    if (!termo) {
      resultado = listaSvgCompleta.filter((r) => r.disponivel);
    } else {
      resultado = listaSvgCompleta.filter((r) => {
        const nome = (r.policial.nome ?? '').toLowerCase();
        const matricula = (r.policial.matricula ?? '').toLowerCase();
        const matriculaGdf = (r.policial.matriculaComissionadoGdf ?? '').toLowerCase();
        return nome.includes(termo) || matricula.includes(termo) || matriculaGdf.includes(termo);
      });
    }
    return sortAfastamentosPorPatenteENome(resultado);
  }, [listaSvgCompleta, buscaSvg]);
  
  // Verificar se o usuário é do nível Cpmulher
  const usuarioEhCpmulher = useMemo(() => {
    const nivelNome = currentUser.nivel?.nome;
    return nivelNome === 'CPMULHER' || nivelNome === 'Cpmulher';
  }, [currentUser]);
  
  // IDs das funções permitidas para Cpmulher: "Analista" e "Telefonista 190 - Auxiliar"
  const [funcoesCpmulherIds, setFuncoesCpmulherIds] = useState<number[]>([]);

  // Buscar função do expediente e funções permitidas para Cpmulher
  useEffect(() => {
    const buscarFuncoes = async () => {
      try {
        const funcoes = await api.listFuncoes();
        const funcoesAtivas = funcoes.filter((f) => f.ativo !== false);
        
        // Buscar função do expediente
        const funcaoExpediente = funcoesAtivas.find((f) => 
          f.nome.toUpperCase().includes('EXPEDIENTE ADM')
        );
        if (funcaoExpediente) {
          setFuncaoExpedienteId(funcaoExpediente.id);
        }
        
        // Se for Cpmulher, buscar IDs das funções permitidas
        if (usuarioEhCpmulher) {
          const funcaoAnalista = funcoesAtivas.find((f) => 
            f.nome.toUpperCase() === 'ANALISTA'
          );
          const funcaoTelefonistaAuxiliar = funcoesAtivas.find((f) => 
            f.nome.toUpperCase() === 'TELEFONISTA 190 - AUXILIAR'
          );
          
          const ids: number[] = [];
          if (funcaoAnalista) ids.push(funcaoAnalista.id);
          if (funcaoTelefonistaAuxiliar) ids.push(funcaoTelefonistaAuxiliar.id);
          
          setFuncoesCpmulherIds(ids);
        }
      } catch (error) {
        console.error('Erro ao buscar funções:', error);
      }
    };
    void buscarFuncoes();
  }, [usuarioEhCpmulher]);

  // Carregar horários SVG quando a aba SVG estiver ativa
  useEffect(() => {
    if (tabAtiva !== 2) return;
    let cancelled = false;
    setLoadingHorariosSvg(true);
    api.listHorariosSvg()
      .then((data) => {
        if (!cancelled) setHorariosSvg(data);
      })
      .catch(() => {
        if (!cancelled) setHorariosSvg([]);
      })
      .finally(() => {
        if (!cancelled) setLoadingHorariosSvg(false);
      });
    return () => { cancelled = true; };
  }, [tabAtiva, refreshKey]);

  const handleGravarHorarioSvg = useCallback(async () => {
    if (!horaInicioNovo || !horaFimNovo) return;
    setSalvandoHorarioSvg(true);
    try {
      const criado = await api.createHorarioSvg({
        horaInicio: horaInicioNovo,
        horaFim: horaFimNovo,
      });
      setHorariosSvg((prev) => [...prev, criado]);
      setHoraInicioNovo('');
      setHorarioSvg(String(criado.id));
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Erro ao gravar horário';
      setError(msg);
    } finally {
      setSalvandoHorarioSvg(false);
    }
  }, [horaInicioNovo, horaFimNovo]);

  const handleExcluirHorarioSvg = useCallback(async (id: number) => {
    try {
      await api.deleteHorarioSvg(id);
      setHorariosSvg((prev) => prev.filter((h) => h.id !== id));
      if (horarioSvg === String(id)) setHorarioSvg('');
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Erro ao excluir horário';
      setError(msg);
    }
  }, [horarioSvg]);

  const handleGerarListaSvg = useCallback(async () => {
    if (!dataSvg || !horarioSvg) return;

    const horarioSelecionado = horariosSvg.find((h) => String(h.id) === horarioSvg);
    if (!horarioSelecionado) return;

    const horaInicioSvg = horarioSelecionado.horaInicio;
    const horaFimSvg = horarioSelecionado.horaFim;

    /**
     * Regras SVG (svgRegras.ts):
     * IMPEDIMENTOS: afastamento, restrição médica, DESATIVADO, COMISSIONADO, PTTC
     * INTERVALOS: 6h entre escalas e SVG; 1h entre expediente e SVG
     * Escala dia: 07-19 | Escala noite: 19-07 | Expediente: seg-qui 13-19, sex 07-13
     */

    setLoadingListaSvg(true);
    setError(null);
    setListaSvg([]);

    try {
      const [anoStr, mesStr, diaStr] = dataSvg.split('-');
      const ano = Number(anoStr);
      const mes = Number(mesStr) - 1;
      const dia = Number(diaStr);
      const dataSelecionada = new Date(ano, mes, dia);
      const dataSelecionadaStr = `${anoStr}-${mesStr}-${String(dia).padStart(2, '0')}`;

      const timeToMin = (s: string) => {
        const [h, m] = s.split(':').map(Number);
        return (h ?? 0) * 60 + (m ?? 0);
      };

      const rangesOverlap = (aStart: number, aEnd: number, bStart: number, bEnd: number): boolean => {
        const norm = (s: number, e: number) => {
          if (e >= s) return [[s, e]] as [number, number][];
          return [[s, 24 * 60], [0, e]] as [number, number][];
        };
        const aRanges = norm(aStart, aEnd);
        const bRanges = norm(bStart, bEnd);
        for (const [as, ae] of aRanges) {
          for (const [bs, be] of bRanges) {
            if (as < be && ae > bs) return true;
          }
        }
        return false;
      };

      const svgStart = timeToMin(horaInicioSvg);
      let svgEnd = timeToMin(horaFimSvg);
      if (svgEnd <= svgStart) svgEnd += 24 * 60;

      /**
       * Período proibido = intervalo de descanso obrigatório antes e depois do SVG.
       * Se o turno do policial SOBREPÕE esse período, ele NÃO pode fazer o SVG.
       * - Escalas: 6h antes e 6h depois do SVG
       * - Expediente: 1h antes e 1h depois do SVG
       */

      const data = await api.listPoliciaisPaginated({
        page: 1,
        pageSize: 1000,
        includeAfastamentos: true,
        includeRestricoes: true,
      });
      const todosPoliciais = data.Policiales;

      const afastamentos = await api.listAfastamentos({
        dataInicio: dataSelecionadaStr,
        dataFim: dataSelecionadaStr,
        includePolicialFuncao: false,
      });

      const afastamentoAtivoNaData = (af: Afastamento) => {
        const afInicioStr = typeof af.dataInicio === 'string' ? af.dataInicio.split('T')[0] : new Date(af.dataInicio).toISOString().split('T')[0];
        const [anoAfInicio, mesAfInicio, diaAfInicio] = afInicioStr.split('-').map(Number);
        const afInicioTimestamp = new Date(anoAfInicio, mesAfInicio - 1, diaAfInicio).getTime();
        let afFimTimestamp: number | null = null;
        if (af.dataFim) {
          const afFimStr = typeof af.dataFim === 'string' ? af.dataFim.split('T')[0] : new Date(af.dataFim).toISOString().split('T')[0];
          const [anoAfFim, mesAfFim, diaAfFim] = afFimStr.split('-').map(Number);
          afFimTimestamp = new Date(anoAfFim, mesAfFim - 1, diaAfFim, 23, 59, 59, 999).getTime();
        }
        const dataTimestamp = dataSelecionada.getTime();
        const comecaAntesOuDurante = afInicioTimestamp <= dataTimestamp;
        const terminaDepoisOuDurante = afFimTimestamp === null || afFimTimestamp >= dataTimestamp;
        return comecaAntesOuDurante && terminaDepoisOuDurante;
      };

      const idsAfastados = new Set(afastamentos.filter(afastamentoAtivoNaData).map((af) => af.policialId));

      const eExpediente = (p: Policial) =>
        p.funcaoId === funcaoExpedienteId || (p.funcao?.nome?.toUpperCase().includes('EXPEDIENTE ADM') ?? false);

      const MIN_PER_HOUR = 60;
      const M24 = 24 * MIN_PER_HOUR;
      const intervaloEscalaMin = SVG_INTERVALO_ESCALAS_HORAS * MIN_PER_HOUR;
      const intervaloExpMin = SVG_INTERVALO_EXPEDIENTE_HORAS * MIN_PER_HOUR;

      const expedienteHorario = getExpedienteHorario(dataSelecionada);
      const escalaDiaStart = timeToMin(ESCALA_DIA_INICIO);
      const escalaDiaEnd = timeToMin(ESCALA_DIA_FIM);
      const escalaNoiteStart = timeToMin(ESCALA_NOITE_INICIO);
      const escalaNoiteEnd = timeToMin(ESCALA_NOITE_FIM);

      const forbidExpStart = (svgStart - intervaloExpMin + M24) % M24;
      const forbidExpEnd = (svgEnd + intervaloExpMin) % M24;
      const forbidEscStart = (svgStart - intervaloEscalaMin + M24) % M24;
      const forbidEscEnd = (svgEnd + intervaloEscalaMin) % M24;

      const avaliarPolicialSvg = (p: Policial): { disponivel: boolean; motivo?: string } => {
        if (p.status === 'DESATIVADO') return { disponivel: false, motivo: 'Status desativado' };
        if (p.status === 'COMISSIONADO' || p.status === 'PTTC') return { disponivel: false, motivo: `Status ${p.status} não permite SVG` };
        if (p.restricaoMedicaId != null) return { disponivel: false, motivo: 'Possui restrição médica (inclui porte de arma suspenso)' };
        if (idsAfastados.has(p.id)) return { disponivel: false, motivo: 'Em gozo de afastamento' };

        if (!p.equipe || p.equipe === 'SEM_EQUIPE') {
          if (eExpediente(p)) {
            if (!expedienteHorario) return { disponivel: true };
            const expedienteStart = timeToMin(expedienteHorario.inicio);
            const expedienteEnd = timeToMin(expedienteHorario.fim);
            const overlap = rangesOverlap(expedienteStart, expedienteEnd, forbidExpStart, forbidExpEnd);
            if (overlap) {
              return { disponivel: false, motivo: `Choque de horário: expediente ${expedienteHorario.inicio}-${expedienteHorario.fim}. Requer intervalo de 1h antes e depois do SVG` };
            }
            return { disponivel: true };
          }
          return { disponivel: false, motivo: 'Não é expediente nem escala. Equipe não definida.' };
        }

        if (equipeEstaEmQualquerFolga(p.equipe, dataSelecionada)) return { disponivel: true };

        const equipeDia = calcularEquipeServico(ano, mes, dia, 'dia');
        const equipeNoite = calcularEquipeServico(ano, mes, dia, 'noite');
        const trabalhaDia = equipeDia === p.equipe;
        const trabalhaNoite = equipeNoite === p.equipe;

        if (trabalhaDia) {
          const overlap = rangesOverlap(escalaDiaStart, escalaDiaEnd, forbidEscStart, forbidEscEnd);
          if (overlap) {
            return { disponivel: false, motivo: `Choque de horário: escala dia ${ESCALA_DIA_INICIO}-${ESCALA_DIA_FIM}. Requer intervalo de 6h antes e depois do SVG` };
          }
          return { disponivel: true };
        }
        if (trabalhaNoite) {
          const overlap1 = rangesOverlap(escalaNoiteStart, M24, forbidEscStart, forbidEscEnd);
          const overlap2 = rangesOverlap(0, escalaNoiteEnd, forbidEscStart, forbidEscEnd);
          if (overlap1 || overlap2) {
            return { disponivel: false, motivo: `Choque de horário: escala noite ${ESCALA_NOITE_INICIO}-${ESCALA_NOITE_FIM}. Requer intervalo de 6h antes e depois do SVG` };
          }
          return { disponivel: true };
        }
        return { disponivel: false, motivo: 'Equipe não está em escala no dia' };
      };

      const resultadoCompleto = todosPoliciais.map((p) => {
        const { disponivel, motivo } = avaliarPolicialSvg(p);
        return { policial: p, disponivel, motivo };
      });
      const filtrados = resultadoCompleto.filter((r) => r.disponivel).map((r) => r.policial);

      setListaSvg(filtrados);
      setListaSvgCompleta(resultadoCompleto);
      setBuscaSvg('');
      setModalListaSvgOpen(true);
      setSuccess(`Lista SVG gerada: ${filtrados.length} policiais disponíveis.`);
    } catch (err) {
      console.error('Erro ao gerar lista SVG:', err);
      setError('Erro ao gerar lista SVG. Tente novamente.');
    } finally {
      setLoadingListaSvg(false);
    }
  }, [dataSvg, horarioSvg, horariosSvg, funcaoExpedienteId]);

  // Constantes para cálculo de escalas (mesmas do CalendarioSection)
  const DATA_INICIO_ESCALA = new Date(2026, 0, 20); // 20 de janeiro de 2026
  const SEQUENCIA_EQUIPES: Equipe[] = ['D', 'E', 'B', 'A', 'C'];

  // Calcular qual equipe saiu do serviço noturno em uma data específica (às 07h)
  const calcularEquipeQueSaiuNoturno = (data: Date): Equipe | null => {
    const dataInicio = new Date(DATA_INICIO_ESCALA);
    
    // Se a data for anterior a 1 de janeiro de 2026, retornar null
    const dataMinima = new Date(2026, 0, 1);
    if (data.getTime() < dataMinima.getTime()) {
      return null;
    }

    // A equipe que saiu do serviço noturno às 07h do dia X é a que estava de noite do dia X-1 (19h) até 07h do dia X
    // Então, preciso calcular qual equipe estava de noite no dia anterior
    const diaAnterior = new Date(data);
    diaAnterior.setDate(diaAnterior.getDate() - 1);
    const diffTimeAnterior = diaAnterior.getTime() - dataInicio.getTime();
    const diffDaysAnterior = Math.floor(diffTimeAnterior / (1000 * 60 * 60 * 24));
    
    // Permitir cálculo retroativo para datas anteriores ao início da escala (mas após 1/1/2026)
    // Usar módulo para calcular a posição na sequência circular mesmo para datas anteriores
    // Não retornar null se diffDaysAnterior for negativo, usar módulo mesmo assim

    // Calcular equipe que estava de noite no dia anterior
    const posicaoDiaAnterior = ((diffDaysAnterior % 5) + 5) % 5;
    const posicaoNoiteAnterior = (posicaoDiaAnterior - 1 + 5) % 5;
    const equipe = SEQUENCIA_EQUIPES[posicaoNoiteAnterior];
    
    return equipe;
  };

  // Calcular qual equipe está de serviço em dia/período (para regras SVG)
  const calcularEquipeServico = (ano: number, mes: number, dia: number, periodo: 'dia' | 'noite'): Equipe | null => {
    const dataAtual = new Date(ano, mes, dia);
    const dataMinima = new Date(2026, 0, 1);
    if (dataAtual.getTime() < dataMinima.getTime()) return null;
    const diffTime = dataAtual.getTime() - DATA_INICIO_ESCALA.getTime();
    const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
    const posicaoDia = ((diffDays % 5) + 5) % 5;
    const posicaoNoite = (posicaoDia - 1 + 5) % 5;
    const equipe = periodo === 'dia' ? SEQUENCIA_EQUIPES[posicaoDia] : SEQUENCIA_EQUIPES[posicaoNoite];
    return equipe;
  };

  // Verificar se uma equipe está em folga 1, 2 ou 3 em uma data específica
  const equipeEstaEmQualquerFolga = (equipe: Equipe, data: Date): boolean => {
    // A equipe que sai do serviço noturno às 07h do dia X entra de folga
    // Folga 1: dia X (primeiro dia de folga)
    // Folga 2: dia X+1 (segundo dia de folga) ✓
    // Folga 3: dia X+2 (terceiro dia de folga) ✓
    // Volta ao serviço: dia X+3 (manhã)
    
    // Preciso encontrar quando essa equipe saiu do serviço noturno pela última vez antes ou na data selecionada
    // Vou procurar retroativamente até encontrar quando a equipe saiu do serviço noturno
    // Ampliar o range para garantir que encontre todas as possibilidades
    
    const dataSelecionadaStr = `${data.getFullYear()}-${String(data.getMonth() + 1).padStart(2, '0')}-${String(data.getDate()).padStart(2, '0')}`;
    
    for (let diasAtras = 0; diasAtras <= 15; diasAtras++) {
      const dataVerificacao = new Date(data);
      dataVerificacao.setDate(dataVerificacao.getDate() - diasAtras);
      
      // Verificar se a data está dentro do range válido (após 1/1/2026)
      const dataMinima = new Date(2026, 0, 1);
      if (dataVerificacao.getTime() < dataMinima.getTime()) {
        continue;
      }
      
      const equipeQueSaiu = calcularEquipeQueSaiuNoturno(dataVerificacao);
      
      if (equipeQueSaiu === equipe) {
        // Encontrei quando essa equipe saiu do serviço noturno
        // A data de saída é dataVerificacao
        // Folga 1: dataVerificacao
        // Folga 2: dataVerificacao + 1 dia
        // Folga 3: dataVerificacao + 2 dias
        
        const dataSaida = new Date(dataVerificacao);
        const dataFolga2 = new Date(dataSaida);
        dataFolga2.setDate(dataFolga2.getDate() + 1);
        const dataFolga3 = new Date(dataSaida);
        dataFolga3.setDate(dataFolga3.getDate() + 2);
        
        // Comparar apenas a data (sem hora)
        const dataFolga1Str = `${dataSaida.getFullYear()}-${String(dataSaida.getMonth() + 1).padStart(2, '0')}-${String(dataSaida.getDate()).padStart(2, '0')}`;
        const dataFolga2Str = `${dataFolga2.getFullYear()}-${String(dataFolga2.getMonth() + 1).padStart(2, '0')}-${String(dataFolga2.getDate()).padStart(2, '0')}`;
        const dataFolga3Str = `${dataFolga3.getFullYear()}-${String(dataFolga3.getMonth() + 1).padStart(2, '0')}-${String(dataFolga3.getDate()).padStart(2, '0')}`;
        
        if (dataSelecionadaStr === dataFolga1Str || dataSelecionadaStr === dataFolga2Str || dataSelecionadaStr === dataFolga3Str) {
          return true;
        }
      }
    }
    
    return false;
  };

  const equipeEstaNaSegundaOuTerceiraFolga = (equipe: Equipe, data: Date): boolean => {
    const dataSelecionadaStr = `${data.getFullYear()}-${String(data.getMonth() + 1).padStart(2, '0')}-${String(data.getDate()).padStart(2, '0')}`;
    for (let diasAtras = 0; diasAtras <= 15; diasAtras++) {
      const dataVerificacao = new Date(data);
      dataVerificacao.setDate(dataVerificacao.getDate() - diasAtras);
      const dataMinima = new Date(2026, 0, 1);
      if (dataVerificacao.getTime() < dataMinima.getTime()) continue;
      const equipeQueSaiu = calcularEquipeQueSaiuNoturno(dataVerificacao);
      if (equipeQueSaiu === equipe) {
        const dataSaida = new Date(dataVerificacao);
        const dataFolga2 = new Date(dataSaida);
        dataFolga2.setDate(dataFolga2.getDate() + 1);
        const dataFolga3 = new Date(dataSaida);
        dataFolga3.setDate(dataFolga3.getDate() + 2);
        const dataFolga2Str = `${dataFolga2.getFullYear()}-${String(dataFolga2.getMonth() + 1).padStart(2, '0')}-${String(dataFolga2.getDate()).padStart(2, '0')}`;
        const dataFolga3Str = `${dataFolga3.getFullYear()}-${String(dataFolga3.getMonth() + 1).padStart(2, '0')}-${String(dataFolga3.getDate()).padStart(2, '0')}`;
        if (dataSelecionadaStr === dataFolga2Str || dataSelecionadaStr === dataFolga3Str) return true;
      }
    }
    return false;
  };

  // Função para gerar o efetivo disponível
  const handleGerarEfetivo = async () => {
    if (!dataEfetivo) {
      setError('Por favor, selecione uma data.');
      return;
    }

    if (!funcaoExpedienteId) {
      setError('Função do expediente não encontrada. Aguarde o carregamento.');
      return;
    }

    setLoadingEfetivo(true);
    setError(null);
    setSuccess(null);
    setEfetivoDisponivel([]); // Limpar lista anterior

    try {
      // Buscar todos os policiais
      const params: Parameters<typeof api.listPoliciaisPaginated>[0] = {
        page: 1,
        pageSize: 1000,
        includeAfastamentos: true,
        includeRestricoes: false,
      };

      const data = await api.listPoliciaisPaginated(params);
      const todosPoliciais = data.Policiales;

      // Filtrar policiais conforme os critérios
      // Criar a data corretamente para evitar problemas de timezone
      const [anoStr, mesStr, diaStr] = dataEfetivo.split('-');
      const dataSelecionada = new Date(Number(anoStr), Number(mesStr) - 1, Number(diaStr));
      const dataSelecionadaStr = `${dataSelecionada.getFullYear()}-${String(dataSelecionada.getMonth() + 1).padStart(2, '0')}-${String(dataSelecionada.getDate()).padStart(2, '0')}`;

      // Buscar afastamentos do dia selecionado
      const afastamentosParams: Parameters<typeof api.listAfastamentos>[0] = {
        dataInicio: dataSelecionadaStr,
        dataFim: dataSelecionadaStr,
        includePolicialFuncao: false,
      };
      
      const afastamentos = await api.listAfastamentos(afastamentosParams);
      
      // Função para verificar se um afastamento está ativo na data
      const afastamentoAtivoNaData = (af: Afastamento) => {
        const afInicioStr = typeof af.dataInicio === 'string' ? af.dataInicio.split('T')[0] : new Date(af.dataInicio).toISOString().split('T')[0];
        const [anoAfInicio, mesAfInicio, diaAfInicio] = afInicioStr.split('-').map(Number);
        const afInicioTimestamp = new Date(anoAfInicio, mesAfInicio - 1, diaAfInicio).getTime();
        
        let afFimTimestamp: number | null = null;
        if (af.dataFim) {
          const afFimStr = typeof af.dataFim === 'string' ? af.dataFim.split('T')[0] : new Date(af.dataFim).toISOString().split('T')[0];
          const [anoAfFim, mesAfFim, diaAfFim] = afFimStr.split('-').map(Number);
          afFimTimestamp = new Date(anoAfFim, mesAfFim - 1, diaAfFim, 23, 59, 59, 999).getTime();
        }
        
        const dataTimestamp = new Date(dataSelecionada).getTime();
        const comecaAntesOuDurante = afInicioTimestamp <= dataTimestamp;
        const terminaDepoisOuDurante = afFimTimestamp === null || afFimTimestamp >= dataTimestamp;
        
        return comecaAntesOuDurante && terminaDepoisOuDurante;
      };

      const idsAfastados = new Set(
        afastamentos.filter(afastamentoAtivoNaData).map((af) => af.policialId)
      );

      const efetivoFiltrado = todosPoliciais.filter((policial) => {
        // 1. Status = ATIVO
        if (policial.status !== 'ATIVO') {
          return false;
        }

        // 2. Não ter restrição médica
        if (policial.restricaoMedicaId !== null && policial.restricaoMedicaId !== undefined) {
          return false;
        }

        // 3. Não estar afastado na data
        if (idsAfastados.has(policial.id)) {
          return false;
        }

        // 4. Verificar se atende aos critérios:
        //    a) É do expediente OU
        //    b) É de alguma equipe e está na segunda ou terceira folga
        
        const eDoExpediente = policial.funcaoId === funcaoExpedienteId;
        const temEquipe = !!policial.equipe; // Verifica se tem equipe (não null/undefined)
        const estaNaFolga = temEquipe && policial.equipe ? equipeEstaNaSegundaOuTerceiraFolga(policial.equipe, dataSelecionada) : false;
        
        // Incluir se for do expediente OU se tiver equipe e estiver na folga
        return eDoExpediente || estaNaFolga;
      });

      setEfetivoDisponivel(sortPorPatenteENome(efetivoFiltrado));
      setModalEfetivoOpen(true);
      
      setSuccess(`Efetivo disponível gerado: ${efetivoFiltrado.length} policiais encontrados.`);
    } catch (error) {
      console.error('Erro ao gerar efetivo disponível:', error);
      setError('Erro ao gerar efetivo disponível. Tente novamente.');
    } finally {
      setLoadingEfetivo(false);
    }
  };

  // Aplicar filtros do Dashboard quando o componente montar
  useEffect(() => {
    const dashboardFilters = sessionStorage.getItem('dashboard-filters');
    if (dashboardFilters) {
      try {
        const filters = JSON.parse(dashboardFilters);
        if (filters.equipe) {
          setFiltroEquipe(filters.equipe as Equipe);
          setFiltrosAberto(true);
        }
        if (filters.funcaoId) {
          setFiltroFuncao(filters.funcaoId);
          setFiltrosAberto(true);
        }
        // Limpar filtros após aplicá-los
        sessionStorage.removeItem('dashboard-filters');
      } catch (error) {
        console.error('Erro ao aplicar filtros do Dashboard:', error);
      }
    }
  }, []);
  const [ordenacao, setOrdenacao] = useState<{
    campo: 'nome' | 'matricula' | 'equipe' | 'status' | 'funcao';
    direcao: 'asc' | 'desc';
  } | null>(null);
  const [paginaAtual, setPaginaAtual] = useState(1);
  const [itensPorPagina, setItensPorPagina] = useState(50);
  const [totalPoliciais, setTotalPoliciais] = useState(0);
  const [totalPaginas, setTotalPaginas] = useState(1);
  const [paginacaoNoServidor, setPaginacaoNoServidor] = useState(true);

  const getPolicialStatusClass = (status: PolicialStatus) => {
    switch (status) {
      case 'ATIVO':
        return 'badge policial-status-ativo';
      case 'COMISSIONADO':
        return 'badge policial-status-comissionado';
      case 'DESIGNADO':
        return 'badge policial-status-designado';
      case 'PTTC':
        return 'badge policial-status-pttc';
      case 'DESATIVADO':
        return 'badge policial-status-desativado';
      default:
        return 'badge badge-muted';
    }
  };

  const getPolicialStatusChipSx = (status: PolicialStatus) => {
    switch (status) {
      case 'ATIVO':
        return { backgroundColor: theme.statusAtivoBg, color: theme.statusAtivoText };
      case 'COMISSIONADO':
        return { backgroundColor: theme.statusComissionadoBg, color: theme.statusComissionadoText };
      case 'DESIGNADO':
        return { backgroundColor: theme.statusDesignadoBg, color: theme.statusDesignadoText };
      case 'PTTC':
        return { backgroundColor: theme.statusPttcBg, color: theme.statusPttcText };
      case 'DESATIVADO':
        return { backgroundColor: theme.statusDesativadoBg, color: theme.statusDesativadoText };
      default:
        return { backgroundColor: theme.statusMutedBg, color: theme.statusMutedText };
    }
  };

  // Carregar total geral de policiais (sem filtros)
  const carregarTotalGeral = useCallback(async () => {
    try {
      const nivelNome = currentUser.nivel?.nome;
      const usuarioPodeVerTodos =
        nivelNome === 'ADMINISTRADOR' ||
        nivelNome === 'SAD' ||
        nivelNome === 'COMANDO' ||
        currentUser.isAdmin === true;
      
      // Se for Cpmulher e ainda não temos os IDs das funções, aguardar
      if (usuarioEhCpmulher && funcoesCpmulherIds.length === 0) {
        setTotalPoliciaisGeral(0);
        setTotalPoliciaisDisponiveis(0);
        return;
      }
      
      // Para Cpmulher, precisamos buscar todos e filtrar por função
      const buscarTodosParaTotal = usuarioEhCpmulher && funcoesCpmulherIds.length > 0;
      
      const params: Parameters<typeof api.listPoliciaisPaginated>[0] = {
        page: 1,
        pageSize: buscarTodosParaTotal ? 10000 : 1, // Buscar todos se precisar filtrar por função
        includeAfastamentos: false,
        includeRestricoes: false,
      };
      
      // Para Cpmulher, não aplicar filtro de equipe (precisa ver todos)
      if (!usuarioEhCpmulher) {
        if (!usuarioPodeVerTodos && currentUser.equipe) {
          params.equipe = currentUser.equipe; // Usuário só pode ver sua equipe
        }
      }
      
      const data = await api.listPoliciaisPaginated(params);
      
      // Se for Cpmulher, filtrar por função e contar
      if (buscarTodosParaTotal) {
        const policiaisFiltrados = data.Policiales.filter((p) => 
          p.funcaoId && funcoesCpmulherIds.includes(p.funcaoId)
        );
        setTotalPoliciaisGeral(policiaisFiltrados.length);
        setTotalPoliciaisDisponiveis(
          policiaisFiltrados.filter((p) => p.status !== 'DESATIVADO').length
        );
      } else {
        setTotalPoliciaisGeral(data.total);
        setTotalPoliciaisDisponiveis(data.totalDisponiveis ?? data.total);
      }
    } catch (err) {
      console.error('Erro ao carregar total geral de policiais:', err);
      setTotalPoliciaisGeral(0);
      setTotalPoliciaisDisponiveis(0);
    }
  }, [currentUser, usuarioEhCpmulher, funcoesCpmulherIds]);

  // Debounce da busca para evitar muitas requisições ao digitar (evita ThrottlerException)
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearchTerm(searchTerm), 400);
    return () => clearTimeout(timer);
  }, [searchTerm]);
 
  const carregarPoliciais = useCallback(async (page: number, pageSize: number) => {
    try {
      setLoading(true);
      const nivelNome = currentUser.nivel?.nome;
      const usuarioPodeVerTodos =
        nivelNome === 'ADMINISTRADOR' ||
        nivelNome === 'SAD' ||
        nivelNome === 'COMANDO' ||
        currentUser.isAdmin === true;
      
      // Se for Cpmulher e ainda não temos os IDs das funções, aguardar
      if (usuarioEhCpmulher && funcoesCpmulherIds.length === 0) {
        setPoliciais([]);
        setTotalPoliciais(0);
        setTotalPaginas(1);
        return;
      }
      
      // Para Cpmulher, precisamos buscar TODOS os policiais primeiro para filtrar por função
      // porque o backend não suporta múltiplos funcaoId
      const buscarTodosParaFiltro = usuarioEhCpmulher && funcoesCpmulherIds.length > 0;
      // Para ordenação por patente (nome), precisamos buscar todos e ordenar no cliente,
      // pois a patente está embutida no campo nome e o backend ordena apenas alfabeticamente
      const buscarTodosParaOrdenacaoPorPatente =
        !buscarTodosParaFiltro && (ordenacao === null || ordenacao?.campo === 'nome');
      // Quando excluir motoristas está marcado, precisamos buscar todos para filtrar e contar corretamente
      const buscarTodosParaExcluirMotoristas = excluirMotoristas;
      // Quando excluir desativados está marcado, precisamos buscar todos para filtrar e contar corretamente
      const buscarTodosParaExcluirDesativados = excluirDesativados;
      const buscarTodos = buscarTodosParaFiltro || buscarTodosParaOrdenacaoPorPatente || buscarTodosParaExcluirMotoristas || buscarTodosParaExcluirDesativados;

      const params: Parameters<typeof api.listPoliciaisPaginated>[0] = {
        page: buscarTodos ? 1 : page,
        pageSize: buscarTodos ? 10000 : pageSize,
        includeAfastamentos: false,
        includeRestricoes: true,
      };
      const busca = debouncedSearchTerm.trim();
      if (busca) {
        params.search = busca;
      }
      // Para Cpmulher, não aplicar filtro de equipe (precisa ver todos)
      if (!usuarioEhCpmulher) {
        if (!usuarioPodeVerTodos && currentUser.equipe) {
          params.equipe = currentUser.equipe;
        } else if (filtroEquipe) {
          params.equipe = filtroEquipe;
        }
      } else if (filtroEquipe) {
        // Se for Cpmulher mas tiver filtro manual de equipe, aplicar
        params.equipe = filtroEquipe;
      }
      if (filtroStatus) {
        params.status = filtroStatus;
      }
      // Não aplicar filtroFuncao aqui se for Cpmulher, vamos filtrar depois
      if (filtroFuncao && !buscarTodosParaFiltro) {
        params.funcaoId = filtroFuncao;
      }
      if (ordenacao && !buscarTodos) {
        params.orderBy = ordenacao.campo;
        params.orderDir = ordenacao.direcao;
      }
      
      const data = await api.listPoliciaisPaginated(params);
      let policiaisFiltrados = data.Policiales;
      
      // Se for Cpmulher, filtrar apenas policiais com as funções permitidas
      if (usuarioEhCpmulher && funcoesCpmulherIds.length > 0) {
        policiaisFiltrados = policiaisFiltrados.filter((p) => 
          p.funcaoId && funcoesCpmulherIds.includes(p.funcaoId)
        );
      }
      
      // Se buscamos todos (Cpmulher ou ordenação por patente), armazenar TODOS e paginar no cliente
      if (buscarTodos) {
        setPaginacaoNoServidor(false);
        setPoliciais(policiaisFiltrados);
        setTotalPoliciais(policiaisFiltrados.length);
        setTotalPaginas(Math.max(1, Math.ceil(policiaisFiltrados.length / pageSize)));
      } else {
        setPaginacaoNoServidor(true);
        setPoliciais(policiaisFiltrados);
        const totalPages = Math.max(1, data.totalPages);
        setTotalPoliciais(data.total);
        setTotalPaginas(totalPages);
        if (page > totalPages) {
          setPaginaAtual(totalPages);
        }
      }
      
      setError(null);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Não foi possível carregar os policiais.',
      );
    } finally {
      setLoading(false);
    }
  }, [currentUser, usuarioEhCpmulher, funcoesCpmulherIds, filtroEquipe, filtroFuncao, filtroStatus, ordenacao, debouncedSearchTerm, excluirMotoristas, excluirDesativados]);

  const carregarFuncoes = useCallback(async () => {
    try {
      const data = await api.listFuncoes();
      setFuncoes(data);
    } catch (err) {
      console.error('Erro ao carregar funções:', err);
    }
  }, []);

  const carregarEquipes = useCallback(async () => {
    try {
      const data = await api.listEquipes();
      setEquipes(data);
    } catch (err) {
      console.error('Erro ao carregar equipes:', err);
    }
  }, []);

  const carregarRestricoesMedicas = useCallback(async () => {
    try {
      setLoadingRestricoes(true);
      const restricoes = await api.listRestricoesMedicas();
      setRestricoesMedicas(restricoes);
    } catch (err) {
      console.error('Erro ao carregar restrições médicas:', err);
    } finally {
      setLoadingRestricoes(false);
    }
  }, []);

  // Ordenar funções alfabeticamente (exclui "NÃO INFORMADO")
  const funcoesAtivas = useMemo(() => {
    return funcoesParaSelecao(funcoes).filter((f) => f.ativo !== false);
  }, [funcoes]);

  const funcoesOrdenadas = useMemo(() => {
    let funcoesParaOrdenar = funcoesAtivas;
    
    // Se for Cpmulher, mostrar apenas as funções permitidas
    if (usuarioEhCpmulher && funcoesCpmulherIds.length > 0) {
      funcoesParaOrdenar = funcoesAtivas.filter((f) => funcoesCpmulherIds.includes(f.id));
    }
    
    return [...funcoesParaOrdenar].sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR', { sensitivity: 'base' }));
  }, [funcoesAtivas, usuarioEhCpmulher, funcoesCpmulherIds]);

  const equipesAtivas = useMemo(() => {
    return [...equipes]
      .filter((e) => e.ativo)
      .sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR', { sensitivity: 'base' }));
  }, [equipes]);

  const equipesDisponiveisCadastro = useMemo(() => {
    // Filtrar SEM_EQUIPE se ainda existir no banco (para compatibilidade)
    return equipesAtivas.filter((e) => e.nome !== 'SEM_EQUIPE');
  }, [equipesAtivas]);
 
  useEffect(() => {
    void carregarTotalGeral();
  }, [carregarTotalGeral, refreshKey, funcoesCpmulherIds]);

  useEffect(() => {
    void carregarPoliciais(paginaAtual, itensPorPagina);
  }, [carregarPoliciais, paginaAtual, itensPorPagina, refreshKey, filtroEquipe, filtroStatus, filtroFuncao, debouncedSearchTerm]);

  useEffect(() => {
    void carregarFuncoes();
    void carregarRestricoesMedicas();
    void carregarEquipes();
  }, [carregarFuncoes, carregarRestricoesMedicas, carregarEquipes]);

  const openEditModal = (policial: Policial) => {
    setEditingPolicial(policial);
    // O Prisma retorna funcaoId diretamente quando usa include
    // Precisamos tratar null explicitamente, pois null ?? undefined retorna undefined
    const funcaoId = policial.funcaoId !== null && policial.funcaoId !== undefined
      ? policial.funcaoId
      : policial.funcao?.id ?? undefined;
    setEditForm({
      nome: policial.nome,
      matricula: policial.matricula,
      status: policial.status,
      matriculaComissionadoGdf: policial.matriculaComissionadoGdf ?? '',
      equipe: policial.equipe ?? undefined,
      funcaoId: funcaoId,
      fotoUrl: policial.fotoUrl ?? null,
    });
    setEditError(null);
    setShowImageCropper(false);
  };

  const closeEditModal = () => {
    setEditingPolicial(null);
    setEditError(null);
    setShowImageCropper(false);
    setImageForCrop('');
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      // Validar se é uma imagem
      if (!file.type.startsWith('image/')) {
        setEditError('Por favor, selecione uma imagem válida.');
        return;
      }

      // Validar tamanho (máximo 5MB)
      if (file.size > 5 * 1024 * 1024) {
        setEditError('A imagem deve ter no máximo 5MB.');
        return;
      }

      const reader = new FileReader();
      reader.onload = (e) => {
        const imageSrc = e.target?.result as string;
        setImageForCrop(imageSrc);
        setShowImageCropper(true);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleCropComplete = (croppedImageUrl: string) => {
    setEditForm((prev) => ({
      ...prev,
      fotoUrl: croppedImageUrl,
    }));
    setShowImageCropper(false);
    setImageForCrop('');
  };

  const handleEditSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!editingPolicial || editSubmitting) {
      return;
    }

    const nome = editForm.nome.trim();
    const matricula = editForm.matricula.trim();

    if (!nome || !matricula) {
      setEditError('Informe nome e matrícula.');
      return;
    }
    if (!editForm.funcaoId) {
      setEditError('Selecione uma função.');
      return;
    }

    // Validar se MOTORISTA DE DIA não tem equipe E
    let equipeFinal: string | undefined | null = editForm.equipe;
    if (editForm.funcaoId) {
      const funcaoSelecionada = funcoes.find(f => f.id === editForm.funcaoId);
      if (funcaoSelecionada) {
        const funcaoUpper = funcaoSelecionada.nome.toUpperCase();
        // Funções que não têm equipe: limpar para que o backend salve null
        if (funcaoUpper.includes('EXPEDIENTE ADM') || funcaoUpper.includes('CMT UPM') || funcaoUpper.includes('SUBCMT UPM')) {
          equipeFinal = null;
        } else if (funcaoUpper.includes('MOTORISTA DE DIA') && equipeFinal === 'E') {
          setEditError('A função MOTORISTA DE DIA não pode ter equipe E. Selecione uma equipe de A até D.');
          return;
        }
      }
    }

    const matriculaComissionadoGdf =
      editForm.status === 'COMISSIONADO'
        ? (editForm.matriculaComissionadoGdf?.trim() || null)
        : null;

    const payload = {
      nome,
      matricula,
      status: editForm.status,
      matriculaComissionadoGdf,
      equipe: equipeFinal,
      funcaoId: editForm.funcaoId,
      fotoUrl: editForm.fotoUrl,
    };

    openConfirm({
      title: 'Confirmar edição',
      message: `Deseja salvar as alterações para ${editingPolicial.nome}?`,
      confirmLabel: 'Salvar',
      onConfirm: async () => {
        try {
          setEditSubmitting(true);
          setEditError(null);
          await api.updatePolicial(editingPolicial.id, payload);
          setSuccess('Policial atualizado com sucesso.');
          closeEditModal();
          await carregarPoliciais(paginaAtual, itensPorPagina);
          onChanged?.();
        } catch (err) {
          setEditError(
            err instanceof Error
              ? err.message
              : 'Não foi possível atualizar o policial.',
          );
        } finally {
          setEditSubmitting(false);
        }
      },
    });
  };

  const handleDelete = (policial: Policial) => {
    openConfirm({
      title: 'Desativar policial',
      message: `Deseja desativar ${policial.nome} (matrícula ${policial.matricula})?`,
      confirmLabel: 'Desativar',
      onConfirm: () => {
        setDesativarModal({
          open: true,
          policial,
          dataAPartirDe: '',
          observacoes: '',
          error: null,
          loading: false,
        });
      },
    });
  };

  const handleCloseDesativarModal = () => {
    setDesativarModal({
      open: false,
      policial: null,
      dataAPartirDe: '',
      observacoes: '',
      error: null,
      loading: false,
    });
  };

  const handleConfirmDesativar = async () => {
    if (!desativarModal.policial) return;
    try {
      setDesativarModal((prev) => ({ ...prev, loading: true, error: null }));
      await api.desativarPolicial(desativarModal.policial.id, {
        dataAPartirDe: desativarModal.dataAPartirDe.trim() || undefined,
        observacoes: desativarModal.observacoes.trim() || undefined,
      });
      setSuccess('Policial desativado.');
      handleCloseDesativarModal();
      await carregarPoliciais(paginaAtual, itensPorPagina);
      onChanged?.();
    } catch (err) {
      setDesativarModal((prev) => ({
        ...prev,
        loading: false,
        error:
          err instanceof Error
            ? err.message
            : 'Não foi possível desativar o policial.',
      }));
    }
  };

  const handleActivate = (policial: Policial) => {
    openConfirm({
      title: 'Reativar policial',
      message: `Deseja reativar ${policial.nome} (matrícula ${policial.matricula})?`,
      confirmLabel: 'Reativar',
      onConfirm: async () => {
        try {
          await api.activatePolicial(policial.id);
          setSuccess('Policial reativado com sucesso.');
          await carregarPoliciais(paginaAtual, itensPorPagina);
          onChanged?.();
        } catch (err) {
          setError(
            err instanceof Error
              ? err.message
              : 'Não foi possível reativar o policial.',
          );
        }
      },
    });
  };

  const handleOpenDeleteModal = (policial: Policial) => {
    setDeleteModal({
      open: true,
      policial,
      senha: '',
      error: null,
      loading: false,
    });
  };

  const handleCloseDeleteModal = () => {
    setDeleteModal({
      open: false,
      policial: null,
      senha: '',
      error: null,
      loading: false,
    });
  };

  const handleConfirmDelete = async () => {
    if (!deleteModal.policial) {
      return;
    }

    if (!deleteModal.senha.trim()) {
      setDeleteModal((prev) => ({
        ...prev,
        error: 'Por favor, informe sua senha para confirmar a exclusão.',
      }));
      return;
    }

    try {
      setDeleteModal((prev) => ({ ...prev, loading: true, error: null }));
      await api.deletePolicial(deleteModal.policial.id, deleteModal.senha);
      
      if (editingPolicial?.id === deleteModal.policial.id) {
        closeEditModal();
      }
      
      setSuccess('Policial excluído permanentemente.');
      handleCloseDeleteModal();
      await carregarPoliciais(paginaAtual, itensPorPagina);
      onChanged?.();
    } catch (err) {
      let errorMessage = 'Não foi possível excluir o policial.';
      if (err instanceof Error) {
        errorMessage = err.message;
        // Ajustar mensagens específicas
        if (errorMessage.includes('Senha de administrador')) {
          errorMessage = 'Senha de administrador inválida.';
        } else if (errorMessage.includes('Nenhum administrador encontrado')) {
          errorMessage = 'Nenhum administrador encontrado no sistema.';
        }
      }
      setDeleteModal((prev) => ({
        ...prev,
        error: errorMessage,
        loading: false,
      }));
    }
  };

  const normalizedSearch = searchTerm.trim().toUpperCase();
  const equipeAtual = currentUser.equipe;

  // Verificar se o usuário é ADMINISTRADOR ou SAD (podem ver todos e fazer ações)
  const usuarioPodeVerTodosEAcoes = useMemo(() => {
    const nivelNome = currentUser.nivel?.nome;
    return nivelNome === 'ADMINISTRADOR' || nivelNome === 'SAD' || currentUser.isAdmin === true;
  }, [currentUser]);

  // Verificar se o usuário é ADMINISTRADOR (pode excluir permanentemente)
  const usuarioPodeExcluirPermanentemente = useMemo(() => {
    const nivelNome = currentUser.nivel?.nome;
    return nivelNome === 'ADMINISTRADOR' || currentUser.isAdmin === true;
  }, [currentUser]);

  // Verificar se o usuário é COMANDO (pode ver todos, mas apenas visualizar)
  const usuarioPodeVerTodosSomenteLeitura = useMemo(() => {
    const nivelNome = currentUser.nivel?.nome;
    return nivelNome === 'COMANDO';
  }, [currentUser]);

  // Verificar se o usuário pode ver todos (ADMINISTRADOR, SAD ou COMANDO)
  const usuarioPodeVerTodos = useMemo(() => {
    return usuarioPodeVerTodosEAcoes || usuarioPodeVerTodosSomenteLeitura;
  }, [usuarioPodeVerTodosEAcoes, usuarioPodeVerTodosSomenteLeitura]);

  const policiaisDaEquipe = useMemo(
    () => {
      // Se for ADMINISTRADOR, SAD ou COMANDO, retornar todos os policiais (incluindo desativados)
      if (usuarioPodeVerTodos) {
        return policiais;
      }
      // Se for Cpmulher, retornar todos os policiais (já filtrados por função no carregarPoliciais)
      if (usuarioEhCpmulher) {
        return policiais;
      }
      // Caso contrário (OPERAÇÕES), filtrar apenas pela equipe do usuário (incluindo desativados)
      return policiais.filter(
        (policial) => policial.equipe === equipeAtual,
      );
    },
    [policiais, equipeAtual, usuarioPodeVerTodos, usuarioEhCpmulher],
  );

  const filteredPoliciales = useMemo(() => {
    // Quando a paginação é no servidor, os dados já vêm ordenados do backend (desativados por último).
    // Aplicar a mesma ordenação no cliente para garantir que a página exibida mostre desativados no final.
    if (paginacaoNoServidor) {
      let base = policiaisDaEquipe;
      if (excluirDesativados) {
        base = base.filter((p) => p.status !== 'DESATIVADO');
      }
      return [...base].sort((a, b) => {
        const aDesativado = a.status === 'DESATIVADO';
        const bDesativado = b.status === 'DESATIVADO';
        if (aDesativado && !bDesativado) return 1;
        if (!aDesativado && bDesativado) return -1;
        const campo = ordenacao?.campo ?? 'nome';
        const dir = ordenacao?.direcao ?? 'asc';
        if (campo === 'nome') {
          const cmp = comparePorPatenteENome(a, b);
          return dir === 'asc' ? cmp : -cmp;
        }
        let valorA: string;
        let valorB: string;
        switch (campo) {
          case 'matricula':
            valorA = a.matricula.toUpperCase();
            valorB = b.matricula.toUpperCase();
            break;
          case 'equipe':
            valorA = a.equipe || '';
            valorB = b.equipe || '';
            break;
          case 'status':
            valorA = (a.status ?? '').toUpperCase();
            valorB = (b.status ?? '').toUpperCase();
            break;
          case 'funcao':
            valorA = (a.funcao?.nome ?? '').toUpperCase();
            valorB = (b.funcao?.nome ?? '').toUpperCase();
            break;
          default:
            return comparePorPatenteENome(a, b);
        }
        const cmp = valorA.localeCompare(valorB);
        return dir === 'asc' ? cmp : -cmp;
      });
    }

    // Quando a paginação é no cliente (ex.: Cpmulher), aplicar filtros no cliente
    let resultado = policiaisDaEquipe;

    // Aplicar filtro de busca por nome, matrícula ou função
    if (normalizedSearch) {
      resultado = resultado.filter((policial) => {
        // Buscar por nome
        if (policial.nome.includes(normalizedSearch)) {
          return true;
        }
        // Buscar por matrícula
        if (policial.matricula.toUpperCase().includes(normalizedSearch)) {
          return true;
        }
        // Buscar por função
        if (policial.funcao?.nome && policial.funcao.nome.toUpperCase().includes(normalizedSearch)) {
          return true;
        }
        return false;
      });
    }

    // Aplicar filtro por equipe
    if (filtroEquipe) {
      resultado = resultado.filter((policial) => policial.equipe === filtroEquipe);
    }

    // Aplicar filtro por status/condição
    if (filtroStatus) {
      resultado = resultado.filter((policial) => policial.status === filtroStatus);
    }

    // Aplicar filtro por função
    if (filtroFuncao) {
      resultado = resultado.filter((policial) => policial.funcaoId === filtroFuncao);
    }

    // Excluir motoristas da lista quando checkbox marcado (não afeta contagem total)
    if (excluirMotoristas) {
      resultado = resultado.filter((policial) => {
        const nomeFuncao = policial.funcao?.nome?.toUpperCase() ?? '';
        return !nomeFuncao.includes('MOTORISTA DE DIA');
      });
    }

    // Excluir desativados da lista quando checkbox marcado (mantém fora de qualquer contagem)
    if (excluirDesativados) {
      resultado = resultado.filter((policial) => policial.status !== 'DESATIVADO');
    }

    // Aplicar ordenação (desativados sempre por último)
    if (ordenacao) {
      resultado = [...resultado].sort((a, b) => {
        // Desativados sempre no final da lista
        const aDesativado = a.status === 'DESATIVADO';
        const bDesativado = b.status === 'DESATIVADO';
        if (aDesativado && !bDesativado) return 1;
        if (!aDesativado && bDesativado) return -1;
        if (aDesativado && bDesativado) {
          // Entre dois desativados, ordenar pelo campo selecionado
        }

        let valorA: string | number;
        let valorB: string | number;

        if (ordenacao.campo === 'nome') {
          const cmp = comparePorPatenteENome(a, b);
          return ordenacao.direcao === 'asc' ? cmp : -cmp;
        }
        switch (ordenacao.campo) {
          case 'matricula':
            valorA = a.matricula.toUpperCase();
            valorB = b.matricula.toUpperCase();
            break;
          case 'equipe':
            valorA = a.equipe || '';
            valorB = b.equipe || '';
            break;
          default:
            return 0;
        }

        const comparacao = valorA < valorB ? -1 : valorA > valorB ? 1 : 0;
        return ordenacao.direcao === 'asc' ? comparacao : -comparacao;
      });
    } else {
      // Sem ordenação por coluna: ativos primeiro, desativados por último (por patente e nome)
      resultado = [...resultado].sort((a, b) => {
        const aDesativado = a.status === 'DESATIVADO';
        const bDesativado = b.status === 'DESATIVADO';
        if (aDesativado && !bDesativado) return 1;
        if (!aDesativado && bDesativado) return -1;
        return comparePorPatenteENome(a, b);
      });
    }

    return resultado;
  }, [policiaisDaEquipe, normalizedSearch, filtroEquipe, filtroStatus, filtroFuncao, excluirMotoristas, excluirDesativados, ordenacao, paginacaoNoServidor]);

  // Recalcular total e paginação baseado nos dados filtrados
  const totalPoliciaisFiltrado = useMemo(() => {
    return filteredPoliciales.length;
  }, [filteredPoliciales]);
  
  const totalPaginasFiltrado = useMemo(() => {
    return Math.max(1, Math.ceil(totalPoliciaisFiltrado / itensPorPagina));
  }, [totalPoliciaisFiltrado, itensPorPagina]);
  
  // Quando a paginação é no servidor, usar totais do backend; senão usar os filtrados (ex.: Cpmulher)
  const totalParaExibir = paginacaoNoServidor ? totalPoliciais : totalPoliciaisFiltrado;
  const totalPaginasParaExibir = paginacaoNoServidor ? totalPaginas : totalPaginasFiltrado;
  const registroInicio = totalParaExibir === 0 ? 0 : ((paginaAtual - 1) * itensPorPagina) + 1;
  const registroFim = totalParaExibir === 0 ? 0 : Math.min(paginaAtual * itensPorPagina, totalParaExibir);

  const policiaisPaginados = useMemo(() => {
    // Quando a paginação é no servidor, os dados já vêm paginados do backend
    // Não devemos fazer slice, apenas usar os dados que vieram
    if (paginacaoNoServidor) {
      return filteredPoliciales;
    }
    
    // Quando a paginação é no cliente (ex.: Cpmulher), aplicar slice para paginar
    const inicio = (paginaAtual - 1) * itensPorPagina;
    const fim = inicio + itensPorPagina;
    return filteredPoliciales.slice(inicio, fim);
  }, [filteredPoliciales, paginaAtual, itensPorPagina, paginacaoNoServidor]);
  
  // Ajustar página atual se exceder o total de páginas (tanto servidor quanto cliente)
  useEffect(() => {
    const totalPag = paginacaoNoServidor ? totalPaginas : totalPaginasFiltrado;
    if (paginaAtual > totalPag && totalPag > 0) {
      setPaginaAtual(totalPag);
    }
  }, [paginaAtual, paginacaoNoServidor, totalPaginas, totalPaginasFiltrado]);

  // Ao mudar de página, rolar para o topo para o usuário ver o primeiro registro
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, [paginaAtual]);

  // Calcular totais de dias por tipo de afastamento para a modal de visualização
  const resumoDiasPorTipo = useMemo(() => {
    const totais: Record<string, number> = {};
    viewingAfastamentos.forEach((afastamento) => {
      const motivoNome = afastamento.motivo.nome;
      const dias = calcularDiasEntreDatas(afastamento.dataInicio, afastamento.dataFim);
      totais[motivoNome] = (totais[motivoNome] || 0) + dias;
    });
    return Object.entries(totais).sort((a, b) => a[0].localeCompare(b[0], 'pt-BR'));
  }, [viewingAfastamentos]);

  // Resetar para página 1 quando filtros ou busca mudarem
  useEffect(() => {
    setPaginaAtual(1);
  }, [normalizedSearch, filtroEquipe, filtroStatus, filtroFuncao]);

  const handleOrdenacao = (campo: 'nome' | 'matricula' | 'equipe' | 'status' | 'funcao') => {
    setOrdenacao((prev) => {
      if (prev?.campo === campo) {
        // Mesmo campo: 1º clique = asc, 2º = desc, 3º = remove ordenação (volta ao padrão)
        if (prev.direcao === 'asc') return { campo, direcao: 'desc' };
        return null; // terceiro clique: desfaz a ordenação
      }
      // Coluna diferente ou sem ordenação: começar ascendente
      return { campo, direcao: 'asc' };
    });
  };

  const handleGerarPdf = useCallback(async () => {
    const nivelNome = currentUser.nivel?.nome;
    const usuarioPodeVerTodos =
      nivelNome === 'ADMINISTRADOR' ||
      nivelNome === 'SAD' ||
      nivelNome === 'COMANDO' ||
      currentUser.isAdmin === true;

    const buscarTodosParaFiltro = usuarioEhCpmulher && funcoesCpmulherIds.length > 0;

    const params: Parameters<typeof api.listPoliciaisPaginated>[0] = {
      page: 1,
      pageSize: 50000,
      includeAfastamentos: false,
      includeRestricoes: true,
    };
    const busca = debouncedSearchTerm.trim();
    if (busca) params.search = busca;
    if (!usuarioEhCpmulher) {
      if (!usuarioPodeVerTodos && currentUser.equipe) {
        params.equipe = currentUser.equipe;
      } else if (filtroEquipe) {
        params.equipe = filtroEquipe;
      }
    } else if (filtroEquipe) {
      params.equipe = filtroEquipe;
    }
    if (filtroStatus) params.status = filtroStatus;
    if (filtroFuncao && !buscarTodosParaFiltro) params.funcaoId = filtroFuncao;
    if (ordenacao && !buscarTodosParaFiltro) {
      params.orderBy = ordenacao.campo;
      params.orderDir = ordenacao.direcao;
    }

    const data = await api.listPoliciaisPaginated(params);
    let listaPdf: Policial[] = data.Policiales;
    if (buscarTodosParaFiltro) {
      listaPdf = listaPdf.filter(
        (p) => p.funcaoId && funcoesCpmulherIds.includes(p.funcaoId)
      );
    }
    // Excluir desativados quando checkbox marcado (consistente com a lista na tela)
    if (excluirDesativados) {
      listaPdf = listaPdf.filter((p) => p.status !== 'DESATIVADO');
    }
    // Excluir motoristas quando checkbox marcado (consistente com a lista na tela)
    if (excluirMotoristas) {
      listaPdf = listaPdf.filter((p) => {
        const nomeFuncao = p.funcao?.nome?.toUpperCase() ?? '';
        return !nomeFuncao.includes('MOTORISTA DE DIA');
      });
    }
    const totalRegistros = listaPdf.length;

    const doc = new jsPDF('p', 'mm', 'a4');
    const margin = 14;
    let y = margin;

    doc.setFontSize(16);
    doc.text('Efetivo do COPOM', margin, y);
    y += 10;

    doc.setFontSize(10);
    const temFiltro = !!busca || !!filtroEquipe || !!filtroStatus || !!filtroFuncao;
    doc.text(
      temFiltro
        ? 'Lista de policiais disponíveis com os filtros aplicados'
        : 'Lista de policiais disponíveis.',
      margin,
      y
    );
    y += 8;

    const head = [['Policial', 'Matrícula', 'Status', 'Função', 'Equipe']];
    const body = listaPdf.map((p) => [
      p.nome,
      p.status === 'COMISSIONADO' && (p.matriculaComissionadoGdf ?? '').trim()
        ? p.matriculaComissionadoGdf!.trim()
        : p.matricula,
      POLICIAL_STATUS_OPTIONS.find((o) => o.value === p.status)?.label ?? p.status,
      p.funcao?.nome ? formatNome(p.funcao.nome) : '—',
      formatEquipeLabel(p.equipe) === '—' ? '—' : (p.equipe ?? '—'),
    ]);

    autoTable(doc, {
      head,
      body,
      startY: y,
      margin: { left: margin, right: margin },
      styles: { fontSize: 9 },
      headStyles: { fillColor: [59, 130, 246] },
    });

    const finalY = (doc as unknown as { lastAutoTable?: { finalY?: number } }).lastAutoTable?.finalY ?? y;
    let yPos = finalY + 10;

    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    doc.text(`Total de registros: ${totalRegistros}`, margin, yPos);
    yPos += 12;

    const agora = new Date();
    const dia = String(agora.getDate()).padStart(2, '0');
    const mes = String(agora.getMonth() + 1).padStart(2, '0');
    const ano = agora.getFullYear();
    const horas = String(agora.getHours()).padStart(2, '0');
    const minutos = String(agora.getMinutes()).padStart(2, '0');
    const segundos = String(agora.getSeconds()).padStart(2, '0');
    const dataHora = `${dia}/${mes}/${ano} às ${horas}:${minutos}:${segundos}`;

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.text(`Gerado por: ${currentUser.nome}`, margin, yPos);
    yPos += 5;
    doc.text(`Matrícula: ${currentUser.matricula}`, margin, yPos);
    yPos += 5;
    doc.text(`Data e horário: ${dataHora}`, margin, yPos);

    doc.save(`efetivo-copom-${agora.getTime()}.pdf`);
  }, [
    currentUser.nivel?.nome,
    currentUser.isAdmin,
    currentUser.equipe,
    currentUser.nome,
    currentUser.matricula,
    usuarioEhCpmulher,
    funcoesCpmulherIds,
    debouncedSearchTerm,
    filtroEquipe,
    filtroStatus,
    filtroFuncao,
    excluirMotoristas,
    excluirDesativados,
    ordenacao,
  ]);

  return (
    <section>
      <Box sx={{ borderBottom: 1, borderColor: 'divider', mb: 3 }}>
        <Tabs value={tabAtiva} onChange={(_e, newValue) => setTabAtiva(newValue)}>
          <Tab label="Efetivo do COPOM" />
          <Tab label="Gerar efetivo disponível" />
          <Tab label="Disponibilidade SVG" />
        </Tabs>
      </Box>

      {tabAtiva === 0 && (
        <>
          <div>
            <h2>
              Efetivo do COPOM
            </h2>
            <p>Visualize os policiais cadastrados e execute ações rápidas.</p>
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
      {success && (
        <div className="feedback success">
          {success}
          <button
            type="button"
            className="feedback-close"
            onClick={() => setSuccess(null)}
            aria-label="Fechar"
          >
            ×
          </button>
        </div>
      )}

      <div className="list-controls">
        <input
          className="search-input"
          value={searchTerm}
          onChange={(event) => setSearchTerm(event.target.value.toUpperCase())}
          placeholder="Pesquisar por nome, matrícula ou função"
        />
        <button
          className="ghost"
          type="button"
          onClick={() => setFiltrosAberto(!filtrosAberto)}
        >
          {filtrosAberto ? 'Ocultar filtros' : 'Mostrar filtros'}
        </button>
        <button
          className="ghost"
          type="button"
          onClick={() => void carregarPoliciais(paginaAtual, itensPorPagina)}
        >
          Atualizar lista
        </button>
        <button
          className="ghost"
          type="button"
          onClick={handleGerarPdf}
          style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}
          title="Gerar PDF com a lista exibida na tela"
        >
          <PictureAsPdf sx={{ fontSize: 20, color: 'var(--error)' }} />
          Gerar PDF
        </button>
        <label style={{ display: 'flex', alignItems: 'center', gap: '8px', marginLeft: 'auto' }}>
          <span style={{ fontSize: '0.9rem', color: 'var(--text-secondary)' }}>Itens por página:</span>
          <select
            value={itensPorPagina}
            onChange={(event) => {
              setItensPorPagina(Number(event.target.value));
              setPaginaAtual(1);
            }}
            style={{ padding: '4px 8px', borderRadius: '4px', border: '1px solid var(--border-soft)', backgroundColor: 'var(--card-bg)', color: 'var(--text-primary)' }}
          >
            <option value={10}>10</option>
            <option value={20}>20</option>
            <option value={30}>30</option>
            <option value={50}>50</option>
            <option value={100}>100</option>
          </select>
        </label>
      </div>

      {/* Contador de Registros */}
      <div style={{ 
        marginBottom: '16px', 
        padding: '12px 16px', 
        backgroundColor: 'var(--card-bg)', 
        borderRadius: '8px', 
        border: '1px solid var(--border-soft)',
        display: 'flex',
        flexDirection: 'column',
        gap: '8px'
      }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
          <Typography variant="body2" sx={{ fontWeight: 600, color: 'text.primary' }}>
            Total do efetivo:
          </Typography>
        </Box>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
          <Chip 
            label={totalPoliciaisDisponiveis} 
            size="small" 
            sx={{ fontWeight: 600, backgroundColor: 'var(--accent-muted)', color: 'white' }}
          />
          <Typography variant="body2" sx={{ color: 'text.primary' }}>
            policiais disponíveis.
          </Typography>
        </Box>
        {(searchTerm || filtroEquipe || filtroStatus || filtroFuncao) && (
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Typography variant="body2" sx={{ fontWeight: 600, color: 'text.primary' }}>
              Com filtros aplicados:
            </Typography>
            <Chip 
              label={paginacaoNoServidor ? totalPoliciais : totalPoliciaisFiltrado} 
              size="small" 
              sx={{ fontWeight: 600, backgroundColor: 'var(--alert-success-bg)', color: 'var(--alert-success-text)' }}
            />
          </Box>
        )}
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5, mt: 1, alignItems: 'flex-start' }}>
          <Box
            component="label"
            sx={{
              display: 'flex',
              flexDirection: 'row',
              alignItems: 'center',
              gap: 1,
              cursor: 'pointer',
              width: 'fit-content',
            }}
          >
            <Checkbox
              checked={excluirMotoristas}
              onChange={(event) => setExcluirMotoristas(event.target.checked)}
              size="small"
              sx={{ p: 0.5, flexShrink: 0 }}
            />
            <Typography variant="body2" component="span" sx={{ flexShrink: 0 }}>Excluir motoristas</Typography>
          </Box>
          <Box
            component="label"
            sx={{
              display: 'flex',
              flexDirection: 'row',
              alignItems: 'center',
              gap: 1,
              cursor: 'pointer',
              width: 'fit-content',
            }}
          >
            <Checkbox
              checked={excluirDesativados}
              onChange={(event) => setExcluirDesativados(event.target.checked)}
              size="small"
              sx={{ p: 0.5, flexShrink: 0 }}
            />
            <Typography variant="body2" component="span" sx={{ flexShrink: 0 }}>Excluir desativados</Typography>
          </Box>
        </Box>
      </div>

      {filtrosAberto && (
        <div style={{ marginBottom: '16px', padding: '16px', backgroundColor: 'rgba(0,0,0,0.15)', borderRadius: '8px', border: '1px solid var(--border-soft)' }}>
          <div className="grid two-columns" style={{ gap: '16px' }}>
            <label>
              Por equipe
              <select
                value={filtroEquipe}
                onChange={(event) => setFiltroEquipe(event.target.value ? (event.target.value as Equipe) : '')}
                style={{ width: '100%', marginTop: '8px' }}
              >
                <option value="">Todas as equipes</option>
                {equipesDisponiveisCadastro.map((option) => (
                  <option key={option.id} value={option.nome}>
                    {formatNome(option.nome)}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Por condição
              <select
                value={filtroStatus}
                onChange={(event) => {
                  const novoValor = event.target.value ? (event.target.value as PolicialStatus) : '';
                  setFiltroStatus(novoValor);
                  // Ao selecionar "Desativado", desmarcar o checkbox automaticamente
                  if (novoValor === 'DESATIVADO') {
                    setExcluirDesativados(false);
                  }
                }}
                style={{ width: '100%', marginTop: '8px' }}
              >
                <option value="">Todas as condições</option>
                {POLICIAL_STATUS_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Por função
              <select
                value={filtroFuncao}
                onChange={(event) => {
                  const novoValor = event.target.value ? Number(event.target.value) : '';
                  setFiltroFuncao(novoValor);
                  // Ao selecionar "Motorista de dia", desmarcar o checkbox automaticamente
                  if (novoValor) {
                    const funcaoSelecionada = funcoesOrdenadas.find((f) => f.id === novoValor);
                    if (funcaoSelecionada?.nome?.toUpperCase().includes('MOTORISTA DE DIA')) {
                      setExcluirMotoristas(false);
                    }
                  }
                }}
                style={{ width: '100%', marginTop: '8px' }}
              >
                <option value="">Todas as funções</option>
                {funcoesOrdenadas.map((funcao) => (
                  <option key={funcao.id} value={funcao.id}>
                    {formatNome(funcao.nome)}
                  </option>
                ))}
              </select>
            </label>
          </div>
          {(filtroEquipe || filtroStatus || filtroFuncao) && (
            <button
              type="button"
              className="ghost"
              onClick={() => {
                setFiltroEquipe('');
                setFiltroStatus('');
                setFiltroFuncao('');
              }}
              style={{ marginTop: '12px' }}
            >
              Limpar filtros
            </button>
          )}
        </div>
      )}

      {loading ? (
        <p className="empty-state">Carregando policiais...</p>
      ) : totalPoliciais === 0 ? (
        <p className="empty-state">Nenhum policial cadastrado.</p>
      ) : (
        <>
          <table className="table">
            <thead>
              <tr>
                <th>
                  <button
                    type="button"
                    onClick={() => handleOrdenacao('nome')}
                    style={{
                      background: 'none',
                      border: 'none',
                      padding: 0,
                      font: 'inherit',
                      cursor: 'pointer',
                      textAlign: 'left',
                      width: '100%',
                      fontWeight: ordenacao?.campo === 'nome' ? 'bold' : 'normal',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 4,
                      color: 'var(--text-primary)',
                    }}
                    title={ordenacao?.campo === 'nome' ? `Ordenar por nome (${ordenacao.direcao === 'asc' ? 'ascendente' : 'descendente'}) - clique para inverter` : 'Ordenar por nome'}
                  >
                    Policial
                    {ordenacao?.campo === 'nome' ? (
                      ordenacao.direcao === 'asc' ? (
                        <ArrowUpward sx={{ fontSize: 18, color: 'var(--text-primary)' }} />
                      ) : (
                        <ArrowDownward sx={{ fontSize: 18, color: 'var(--text-primary)' }} />
                      )
                    ) : (
                      <SwapVert sx={{ fontSize: 18, color: 'var(--text-primary)', opacity: 0.8 }} />
                    )}
                  </button>
                </th>
                <th>
                  <button
                    type="button"
                    onClick={() => handleOrdenacao('matricula')}
                    style={{
                      background: 'none',
                      border: 'none',
                      padding: 0,
                      font: 'inherit',
                      cursor: 'pointer',
                      textAlign: 'left',
                      width: '100%',
                      fontWeight: ordenacao?.campo === 'matricula' ? 'bold' : 'normal',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 4,
                      color: 'var(--text-primary)',
                    }}
                    title={ordenacao?.campo === 'matricula' ? `Ordenar por matrícula (${ordenacao.direcao === 'asc' ? 'ascendente' : 'descendente'}) - clique para inverter` : 'Ordenar por matrícula'}
                  >
                    Matrícula
                    {ordenacao?.campo === 'matricula' ? (
                      ordenacao.direcao === 'asc' ? (
                        <ArrowUpward sx={{ fontSize: 18, color: 'var(--text-primary)' }} />
                      ) : (
                        <ArrowDownward sx={{ fontSize: 18, color: 'var(--text-primary)' }} />
                      )
                    ) : (
                      <SwapVert sx={{ fontSize: 18, color: 'var(--text-primary)', opacity: 0.8 }} />
                    )}
                  </button>
                </th>
                <th>
                  <button
                    type="button"
                    onClick={() => handleOrdenacao('status')}
                    style={{
                      background: 'none',
                      border: 'none',
                      padding: 0,
                      font: 'inherit',
                      cursor: 'pointer',
                      textAlign: 'left',
                      width: '100%',
                      fontWeight: ordenacao?.campo === 'status' ? 'bold' : 'normal',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 4,
                      color: 'var(--text-primary)',
                    }}
                    title={ordenacao?.campo === 'status' ? `Ordenar por status (${ordenacao.direcao === 'asc' ? 'ascendente' : 'descendente'}) - clique para inverter` : 'Ordenar por status'}
                  >
                    Status
                    {ordenacao?.campo === 'status' ? (
                      ordenacao.direcao === 'asc' ? (
                        <ArrowUpward sx={{ fontSize: 18, color: 'var(--text-primary)' }} />
                      ) : (
                        <ArrowDownward sx={{ fontSize: 18, color: 'var(--text-primary)' }} />
                      )
                    ) : (
                      <SwapVert sx={{ fontSize: 18, color: 'var(--text-primary)', opacity: 0.8 }} />
                    )}
                  </button>
                </th>
                <th>
                  <button
                    type="button"
                    onClick={() => handleOrdenacao('funcao')}
                    style={{
                      background: 'none',
                      border: 'none',
                      padding: 0,
                      font: 'inherit',
                      cursor: 'pointer',
                      textAlign: 'left',
                      width: '100%',
                      fontWeight: ordenacao?.campo === 'funcao' ? 'bold' : 'normal',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 4,
                      color: 'var(--text-primary)',
                    }}
                    title={ordenacao?.campo === 'funcao' ? `Ordenar por função (${ordenacao.direcao === 'asc' ? 'ascendente' : 'descendente'}) - clique para inverter` : 'Ordenar por função'}
                  >
                    Função
                    {ordenacao?.campo === 'funcao' ? (
                      ordenacao.direcao === 'asc' ? (
                        <ArrowUpward sx={{ fontSize: 18, color: 'var(--text-primary)' }} />
                      ) : (
                        <ArrowDownward sx={{ fontSize: 18, color: 'var(--text-primary)' }} />
                      )
                    ) : (
                      <SwapVert sx={{ fontSize: 18, color: 'var(--text-primary)', opacity: 0.8 }} />
                    )}
                  </button>
                </th>
                <th>
                  <button
                    type="button"
                    onClick={() => handleOrdenacao('equipe')}
                    style={{
                      background: 'none',
                      border: 'none',
                      padding: 0,
                      font: 'inherit',
                      cursor: 'pointer',
                      textAlign: 'left',
                      width: '100%',
                      fontWeight: ordenacao?.campo === 'equipe' ? 'bold' : 'normal',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 4,
                      color: 'var(--text-primary)',
                    }}
                    title={ordenacao?.campo === 'equipe' ? `Ordenar por equipe (${ordenacao.direcao === 'asc' ? 'ascendente' : 'descendente'}) - clique para inverter` : 'Ordenar por equipe'}
                  >
                    Equipe
                    {ordenacao?.campo === 'equipe' ? (
                      ordenacao.direcao === 'asc' ? (
                        <ArrowUpward sx={{ fontSize: 18, color: 'var(--text-primary)' }} />
                      ) : (
                        <ArrowDownward sx={{ fontSize: 18, color: 'var(--text-primary)' }} />
                      )
                    ) : (
                      <SwapVert sx={{ fontSize: 18, color: 'var(--text-primary)', opacity: 0.8 }} />
                    )}
                  </button>
                </th>
                <th style={{ color: 'var(--text-primary)' }}>Ações</th>
              </tr>
            </thead>
            <tbody>
              {policiaisPaginados.map((policial) => (
              <tr
                key={policial.id}
                style={
                  policial.status === 'DESATIVADO'
                    ? { backgroundColor: theme.alertErrorBg }
                    : undefined
                }
              >
                <td>
                  <a
                    href="#"
                    onClick={async (e) => {
                      e.preventDefault();
                      // Carregar dados completos do policial (incluindo restrição médica)
                      try {
                        const policialCompleto = await api.getPolicial(policial.id);
                        setViewingPolicial(policialCompleto);
                      } catch (err) {
                        console.error('Erro ao carregar dados do policial:', err);
                        setViewingPolicial(policial);
                      }
                      
                      // Carregar afastamentos do policial
                      try {
                        setLoadingAfastamentos(true);
                        const afastamentosData = await api.listAfastamentos({
                          policialId: policial.id,
                          includePolicialFuncao: false,
                        });
                        setViewingAfastamentos(afastamentosData);
                      } catch (err) {
                        console.error('Erro ao carregar afastamentos:', err);
                        setViewingAfastamentos([]);
                      } finally {
                        setLoadingAfastamentos(false);
                      }
                    }}
                    style={{
                      color: 'var(--accent-muted)',
                      textDecoration: 'none',
                      cursor: 'pointer',
                      fontWeight: 500,
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.textDecoration = 'underline';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.textDecoration = 'none';
                    }}
                    title="Clique para ver detalhes"
                  >
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                      {policial.restricaoMedica && (
                        <span
                          style={{
                            color: 'var(--error)',
                            fontSize: '1.1rem',
                            fontWeight: 'bold',
                            lineHeight: 1,
                          }}
                          title={`Restrição: ${formatNome(policial.restricaoMedica.nome)}`}
                        >
                          ⚠
                        </span>
                      )}
                      {policial.nome}
                    </span>
                  </a>
                </td>
                <td>
                  {formatMatricula(
                    policial.status === 'COMISSIONADO' && (policial.matriculaComissionadoGdf ?? '').trim()
                      ? policial.matriculaComissionadoGdf!.trim()
                      : policial.matricula
                  )}
                </td>
                <td>
                  <span className={getPolicialStatusClass(policial.status)}>
                    {
                      POLICIAL_STATUS_OPTIONS.find(
                        (option) => option.value === policial.status,
                      )?.label ?? policial.status
                    }
                  </span>
                </td>
                <td>
                  {policial.funcao?.nome ? (
                    formatNome(policial.funcao.nome)
                  ) : (
                    <span style={{ color: 'var(--text-secondary)', fontStyle: 'italic' }}>-</span>
                  )}
                </td>
                <td>
                  {formatEquipeLabel(policial.equipe) === '—' ? (
                    <span style={{ color: 'var(--text-secondary)', fontStyle: 'italic' }}>—</span>
                  ) : (
                    policial.equipe
                  )}
                </td>
                <td className="actions">
                  {usuarioPodeVerTodosEAcoes ? (
                    <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                      {canEdit(permissoes, 'equipe') && (
                        <IconButton
                          onClick={() => openEditModal(policial)}
                          title="Editar"
                          size="small"
                          sx={{
                            color: 'var(--accent-muted)',
                            '&:hover': {
                              backgroundColor: theme.alertInfoBg,
                            },
                          }}
                        >
                          <Edit fontSize="small" />
                        </IconButton>
                      )}
                      {policial.status === 'DESATIVADO' ? (
                        canDesativar(permissoes, 'equipe') && (
                          <IconButton
                            onClick={() => handleActivate(policial)}
                            title="Reativar"
                            size="small"
                            sx={{
                              color: theme.statusAtivoText,
                              '&:hover': {
                                backgroundColor: theme.alertSuccessBg,
                              },
                            }}
                          >
                            <CheckCircle fontSize="small" />
                          </IconButton>
                        )
                      ) : (
                        canDesativar(permissoes, 'equipe') && (
                          <IconButton
                            onClick={() => handleDelete(policial)}
                            title="Desativar"
                            size="small"
                            sx={{
                              color: theme.statusComissionadoText,
                              '&:hover': {
                                backgroundColor: theme.alertErrorBg,
                              },
                            }}
                          >
                            <Block fontSize="small" />
                          </IconButton>
                        )
                      )}
                      {usuarioPodeExcluirPermanentemente && canExcluir(permissoes, 'equipe') && (
                        <IconButton
                          onClick={() => handleOpenDeleteModal(policial)}
                          title="Excluir permanentemente"
                          size="small"
                            sx={{
                              color: theme.statusComissionadoText,
                              '&:hover': {
                                backgroundColor: theme.alertErrorBg,
                              },
                            }}
                        >
                          <Delete fontSize="small" />
                        </IconButton>
                      )}
                    </div>
                  ) : (
                    <span style={{ color: 'var(--text-secondary)', fontStyle: 'italic' }}>
                      Somente visualização
                    </span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {/* Controles de Paginação */}
        {/* Mostrar sempre que houver registros (mesmo com 1 página) */}
        {totalParaExibir > 0 && (
          <div style={{ 
            display: 'flex', 
            justifyContent: 'space-between', 
            alignItems: 'center', 
            marginTop: '16px',
            padding: '12px',
            backgroundColor: 'rgba(0,0,0,0.15)',
            borderRadius: '8px',
            border: '1px solid var(--border-soft)'
          }}>
            <div style={{ fontSize: '0.9rem', color: 'var(--text-secondary)' }}>
              Mostrando {registroInicio} a {registroFim} de {totalParaExibir} registro(s)
            </div>
            <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
              <button
                type="button"
                className="ghost"
                onClick={() => setPaginaAtual(1)}
                disabled={paginaAtual === 1}
                style={{ padding: '6px 12px' }}
              >
                ««
              </button>
              <button
                type="button"
                className="ghost"
                onClick={() => setPaginaAtual((prev) => Math.max(1, prev - 1))}
                disabled={paginaAtual === 1}
                style={{ padding: '6px 12px' }}
              >
                ‹ Anterior
              </button>
              <span style={{ padding: '0 12px', fontSize: '0.9rem', color: 'var(--text-secondary)' }}>
                Página {paginaAtual} de {totalPaginasParaExibir}
              </span>
              <button
                type="button"
                className="ghost"
                onClick={() => setPaginaAtual((prev) => Math.min(totalPaginasParaExibir, prev + 1))}
                disabled={paginaAtual === totalPaginasParaExibir}
                style={{ padding: '6px 12px' }}
              >
                Próxima ›
              </button>
              <button
                type="button"
                className="ghost"
                onClick={() => setPaginaAtual(totalPaginasParaExibir)}
                disabled={paginaAtual === totalPaginasParaExibir}
                style={{ padding: '6px 12px' }}
              >
                »»
              </button>
            </div>
          </div>
        )}
        </>
      )}

      {editingPolicial && (
        <div className="modal-backdrop" role="dialog" aria-modal="true">
          <div className="modal" style={{ maxWidth: showImageCropper ? '800px' : '500px' }}>
            <h3>Editar policial</h3>
            {editError && (
              <Alert severity="error" sx={{ mb: 2 }} onClose={() => setEditError(null)}>
                {editError}
              </Alert>
            )}
            
            {showImageCropper ? (
              <ImageCropper
                imageSrc={imageForCrop}
                onCropComplete={handleCropComplete}
                onCancel={() => {
                  setShowImageCropper(false);
                  setImageForCrop('');
                  if (fileInputRef.current) {
                    fileInputRef.current.value = '';
                  }
                }}
              />
            ) : (
            <>
              {/* Foto do policial no topo */}
              <Box sx={{ display: 'flex', justifyContent: 'center', marginBottom: '24px' }}>
                <Card 
                  sx={{ 
                    position: 'relative',
                    width: 180,
                    height: 240, // Proporção 3x4 (180/240 = 0.75)
                    borderRadius: 2,
                    boxShadow: 3,
                  }}
                >
                  {editForm.fotoUrl ? (
                    <>
                      <CardMedia
                        component="img"
                        image={editForm.fotoUrl}
                        alt="Foto do policial"
                        sx={{
                          width: '100%',
                          height: '100%',
                          objectFit: 'cover',
                        }}
                      />
                      <CardActions 
                        sx={{ 
                          position: 'absolute',
                          bottom: 0,
                          left: 0,
                          right: 0,
                          background: 'linear-gradient(to top, rgba(0,0,0,0.7) 0%, rgba(0,0,0,0) 100%)',
                          justifyContent: 'center',
                          padding: '8px',
                        }}
                      >
                        <IconButton
                          size="small"
                          onClick={() => fileInputRef.current?.click()}
                          sx={{
                            color: 'white',
                            backgroundColor: 'rgba(255,255,255,0.2)',
                            '&:hover': {
                              backgroundColor: 'rgba(255,255,255,0.3)',
                            },
                            marginRight: 1,
                          }}
                          title="Alterar foto"
                        >
                          <PhotoCamera fontSize="small" />
                        </IconButton>
                        <IconButton
                          size="small"
                          onClick={() => {
                            setEditForm((prev) => ({ ...prev, fotoUrl: null }));
                            if (fileInputRef.current) {
                              fileInputRef.current.value = '';
                            }
                          }}
                          sx={{
                            color: 'white',
                            backgroundColor: 'rgba(255,255,255,0.2)',
                            '&:hover': {
                              backgroundColor: 'rgba(239, 68, 68, 0.8)',
                            },
                          }}
                          title="Remover foto"
                        >
                          <Delete fontSize="small" />
                        </IconButton>
                      </CardActions>
                    </>
                  ) : (
                    <Box
                      sx={{
                        width: '100%',
                        height: '100%',
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        justifyContent: 'center',
                        backgroundColor: 'rgba(0,0,0,0.15)',
                        cursor: 'pointer',
                        '&:hover': {
                          backgroundColor: 'rgba(0,0,0,0.25)',
                        },
                      }}
                      onClick={() => fileInputRef.current?.click()}
                    >
                      <AddPhotoAlternate sx={{ fontSize: 48, color: 'var(--text-secondary)', marginBottom: 1 }} />
                      <Typography variant="caption" color="text.secondary">
                        Adicionar foto
                      </Typography>
                    </Box>
                  )}
                </Card>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleFileSelect}
                  style={{ display: 'none' }}
                />
              </Box>
              
              <form onSubmit={handleEditSubmit}>
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                <TextField
                  label="NOME"
                  value={editForm.nome}
                  onChange={(event) =>
                    setEditForm((prev) => ({ ...prev, nome: event.target.value.toUpperCase() }))
                  }
                  required
                  fullWidth
                  variant="outlined"
                  size="small"
                  inputProps={{ style: { textTransform: 'uppercase' } }}
                />
                <TextField
                  label="MATRÍCULA"
                  value={editForm.matricula}
                  onChange={(event) =>
                    setEditForm((prev) => ({
                      ...prev,
                      matricula: event.target.value.replace(/[^0-9xX]/g, '').toUpperCase(),
                    }))
                  }
                  required
                  fullWidth
                  variant="outlined"
                  size="small"
                  inputProps={{ style: { textTransform: 'uppercase' } }}
                />
                <FormControl fullWidth variant="outlined" size="small" required>
                  <InputLabel>STATUS</InputLabel>
                  <Select
                    MenuProps={{ sx: { zIndex: 1500 } }}
                    value={editForm.status}
                    onChange={(event) =>
                      setEditForm((prev) => ({
                        ...prev,
                        status: event.target.value as PolicialStatus,
                      }))
                    }
                    label="STATUS"
                  >
                    {POLICIAL_STATUS_OPTIONS_FORM.map((option) => (
                      <MenuItem key={option.value} value={option.value}>
                        {option.label}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
                {editForm.status === 'COMISSIONADO' && (
                  <TextField
                    label="MATRÍCULA COMISSIONADO"
                    value={editForm.matriculaComissionadoGdf}
                    onChange={(event) =>
                      setEditForm((prev) => ({
                        ...prev,
                        matriculaComissionadoGdf: event.target.value
                          .replace(/[^0-9xX]/g, '')
                          .toUpperCase(),
                      }))
                    }
                    fullWidth
                    variant="outlined"
                    size="small"
                    inputProps={{ style: { textTransform: 'uppercase' } }}
                  />
                )}
                <FormControl fullWidth variant="outlined" size="small" required>
                  <InputLabel>FUNÇÃO</InputLabel>
                  <Select
                    MenuProps={{ sx: { zIndex: 1500 } }}
                    value={editForm.funcaoId ? String(editForm.funcaoId) : ''}
                    label="FUNÇÃO"
                    onChange={(event) => {
                    const novoFuncaoId = event.target.value ? Number(event.target.value) : undefined;
                    const funcaoSelecionada = novoFuncaoId ? funcoes.find(f => f.id === novoFuncaoId) : null;
                    
                    // Se a função selecionada não permite equipe, limpar o campo de equipe
                    // Se for MOTORISTA DE DIA e a equipe for E, limpar também
                    if (funcaoSelecionada) {
                      const funcaoUpper = funcaoSelecionada.nome.toUpperCase();
                      const naoMostraEquipe = 
                        funcaoUpper.includes('EXPEDIENTE ADM') || 
                        funcaoUpper.includes('CMT UPM') || 
                        funcaoUpper.includes('SUBCMT UPM');
                      
                      const isMotoristaDia = funcaoUpper.includes('MOTORISTA DE DIA');
                      
                      setEditForm((prev) => ({
                        ...prev,
                        funcaoId: novoFuncaoId,
                        equipe: naoMostraEquipe ? undefined : (isMotoristaDia && prev.equipe === 'E' ? undefined : prev.equipe),
                      }));
                    } else {
                      setEditForm((prev) => ({
                        ...prev,
                        funcaoId: novoFuncaoId,
                      }));
                    }
                  }}
                  >
                    <MenuItem value="">Selecione uma função</MenuItem>
                    {funcoesOrdenadas.map((funcao) => (
                      <MenuItem key={funcao.id} value={funcao.id}>
                        {formatNome(funcao.nome)}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              
              {/* Campo Equipe - Mostrar apenas se a função selecionada permitir */}
              {(() => {
                const funcaoSelecionada = editForm.funcaoId ? funcoes.find(f => f.id === editForm.funcaoId) : null;
                const mostrarEquipe = funcaoSelecionada ? (() => {
                  const funcaoUpper = funcaoSelecionada.nome.toUpperCase();
                  return !(
                    funcaoUpper.includes('EXPEDIENTE ADM') || 
                    funcaoUpper.includes('CMT UPM') || 
                    funcaoUpper.includes('SUBCMT UPM')
                  );
                })() : false;
                
                const isMotoristaDia = funcaoSelecionada?.nome.toUpperCase().includes('MOTORISTA DE DIA') || false;
                
                // Filtrar equipes: MOTORISTA DE DIA não pode ter equipe E
                const equipesDisponiveis = (() => {
                  let equipesFiltradas =
                    currentUser.nivel?.nome === 'OPERAÇÕES' && currentUser.equipe
                      ? equipesDisponiveisCadastro.filter((option) => option.nome === currentUser.equipe)
                      : equipesDisponiveisCadastro;

                  if (isMotoristaDia) {
                    equipesFiltradas = equipesFiltradas.filter((option) => option.nome !== 'E');
                  }

                  return equipesFiltradas;
                })();
                
                return mostrarEquipe ? (
                  <FormControl fullWidth variant="outlined" size="small" required>
                    <InputLabel>EQUIPE</InputLabel>
                    <Select
                      MenuProps={{ sx: { zIndex: 1500 } }}
                      value={editForm.equipe || ''}
                      onChange={(event) =>
                        setEditForm((prev) => ({
                          ...prev,
                          equipe: event.target.value ? (event.target.value as Equipe) : undefined,
                        }))
                      }
                      label="EQUIPE"
                    >
                      <MenuItem value="">Selecione uma equipe</MenuItem>
                      {equipesDisponiveis.map((option) => (
                        <MenuItem key={option.id} value={option.nome}>
                          {formatNome(option.nome)}
                        </MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                ) : null;
              })()}
              
              </Box>
              <Box sx={{ display: 'flex', gap: 2, justifyContent: 'flex-end', mt: 2 }}>
                <Button
                  type="button"
                  variant="outlined"
                  onClick={closeEditModal}
                  disabled={editSubmitting}
                >
                  Cancelar
                </Button>
                <Button
                  type="submit"
                  variant="contained"
                  disabled={editSubmitting}
                >
                  {editSubmitting ? 'Salvando...' : 'Salvar alterações'}
                </Button>
              </Box>
            </form>
            </>
            )}
          </div>
        </div>
      )}

      {/* Modal de Visualização (Somente Leitura) */}
      {viewingPolicial && (
        <div className="modal-backdrop" role="dialog" aria-modal="true" onClick={() => {
            setViewingPolicial(null);
            setViewingAfastamentos([]);
          }}>
            <Box
              component="div"
              onClick={(e) => e.stopPropagation()}
              sx={{
                position: 'relative',
                width: '90%',
                maxWidth: '1400px',
                maxHeight: '85vh',
                backgroundColor: 'var(--card-bg)',
                borderRadius: 2,
                boxShadow: 24,
                display: 'flex',
                flexDirection: 'column',
                overflow: 'hidden',
              }}
            >
              {/* Header */}
              <Box sx={{ p: 3, borderBottom: 1, borderColor: 'divider' }}>
                <Typography variant="h5" component="h2" sx={{ fontWeight: 600, color: 'text.primary' }}>
                  Informações do Policial
                </Typography>
                {viewingPolicial.restricaoMedica && (
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mt: 1 }}>
                    <Typography variant="body1" sx={{ color: 'error.main', fontWeight: 500 }}>
                      Policial com restrição: {formatNome(viewingPolicial.restricaoMedica.nome)}
                    </Typography>
                    {viewingPolicial.restricaoMedicaObservacao && (
                      <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                        Observação: {viewingPolicial.restricaoMedicaObservacao}
                      </Typography>
                    )}
                    <button
                      type="button"
                      onClick={() => {
                        setRemoveRestricaoModal({
                          open: true,
                          policial: viewingPolicial,
                          senha: '',
                          error: null,
                          loading: false,
                        });
                      }}
                      className="danger-delete"
                      style={{
                        padding: '6px 12px',
                        fontSize: '0.875rem',
                        fontWeight: 500,
                      }}
                    >
                      Retirar restrição
                    </button>
                  </Box>
                )}
              </Box>

              {/* Content - Layout de três colunas */}
              <Box sx={{ flex: 1, overflow: 'auto', p: 2 }}>
                <Box sx={{ display: 'flex', gap: 2, flexDirection: { xs: 'column', lg: 'row' } }}>
                  {/* Coluna Esquerda - Dados do Policial */}
                  <Box sx={{ flex: { xs: '1 1 100%', lg: '0 0 22%' }, minWidth: 0 }}>
                  <Paper elevation={2} sx={{ p: 2, height: '100%' }}>
                    {/* Foto do policial */}
                    {viewingPolicial.fotoUrl && (
                      <Box sx={{ display: 'flex', justifyContent: 'center', marginBottom: 3 }}>
                        <Card 
                          sx={{ 
                            position: 'relative',
                            width: 200,
                            height: 266,
                            borderRadius: 2,
                            boxShadow: 4,
                          }}
                        >
                          <CardMedia
                            component="img"
                            image={viewingPolicial.fotoUrl}
                            alt="Foto do policial"
                            sx={{
                              width: '100%',
                              height: '100%',
                              objectFit: 'cover',
                            }}
                          />
                        </Card>
                      </Box>
                    )}

                    <Divider sx={{ my: 2 }} />

                    {/* Informações do Policial */}
                    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2.5 }}>
                      <Box>
                        <Typography variant="caption" sx={{ color: 'text.primary', fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.5 }}>
                          Nome
                        </Typography>
                        <Typography variant="body1" sx={{ mt: 0.5, fontWeight: 500 }}>
                          {viewingPolicial.nome}
                        </Typography>
                      </Box>

                      <Divider />

                      <Box>
                        <Typography variant="caption" sx={{ color: 'text.primary', fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.5 }}>
                          Matrícula
                        </Typography>
                        <Typography variant="body1" sx={{ mt: 0.5 }}>
                          {formatMatricula(
                            viewingPolicial.status === 'COMISSIONADO' && (viewingPolicial.matriculaComissionadoGdf ?? '').trim()
                              ? viewingPolicial.matriculaComissionadoGdf!.trim()
                              : viewingPolicial.matricula
                          )}
                        </Typography>
                      </Box>

                      <Divider />

                      <Box>
                        <Typography variant="caption" sx={{ color: 'text.primary', fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.5 }}>
                          Status
                        </Typography>
                        <Box sx={{ mt: 0.5 }}>
                          <Chip
                            label={
                              POLICIAL_STATUS_OPTIONS.find(
                                (option) => option.value === viewingPolicial.status,
                              )?.label ?? viewingPolicial.status
                            }
                            size="small"
                            color="default"
                            sx={{ fontWeight: 500, ...getPolicialStatusChipSx(viewingPolicial.status) }}
                          />
                        </Box>
                      </Box>

                      {viewingPolicial.funcao && (
                        <>
                          <Divider />
                          <Box>
                            <Typography variant="caption" sx={{ color: 'text.primary', fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.5 }}>
                              Função
                            </Typography>
                            <Typography variant="body1" sx={{ mt: 0.5 }}>
                              {formatNome(viewingPolicial.funcao.nome)}
                            </Typography>
                          </Box>
                        </>
                      )}

                      <>
                        <Divider />
                        <Box>
                          <Typography variant="caption" sx={{ color: 'text.primary', fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.5 }}>
                            Equipe
                          </Typography>
                          <Typography variant="body1" sx={{ mt: 0.5 }}>
                            {formatEquipeLabel(viewingPolicial.equipe)}
                          </Typography>
                        </Box>
                      </>

                      {(viewingPolicial.dataDesativacaoAPartirDe || viewingPolicial.observacoesDesativacao || viewingPolicial.desativadoPorNome || viewingPolicial.desativadoEm) && (
                        <>
                          <Divider />
                          <Box sx={{ p: 1.5, backgroundColor: theme.alertErrorBg, borderRadius: 1, border: '1px solid rgba(214,69,69,0.4)' }}>
                            <Typography variant="caption" sx={{ color: 'text.primary', fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.5, mb: 1, display: 'block' }}>
                              Desativação
                            </Typography>
                            {viewingPolicial.dataDesativacaoAPartirDe && (
                              <Typography variant="body2" sx={{ mb: 0.5 }}>
                                <strong>A partir de:</strong> {new Date(viewingPolicial.dataDesativacaoAPartirDe).toLocaleDateString('pt-BR')}
                              </Typography>
                            )}
                            {viewingPolicial.observacoesDesativacao && (
                              <Typography variant="body2" sx={{ mb: 0.5 }}>
                                <strong>Observações:</strong> {viewingPolicial.observacoesDesativacao}
                              </Typography>
                            )}
                            {viewingPolicial.desativadoPorNome && (
                              <Typography variant="caption" sx={{ color: 'text.secondary', fontSize: '0.75rem', display: 'block' }}>
                                Desativado por: {viewingPolicial.desativadoPorNome}
                              </Typography>
                            )}
                            {viewingPolicial.desativadoEm && (
                              <Typography variant="caption" sx={{ color: 'text.secondary', fontSize: '0.75rem', display: 'block' }}>
                                Em: {new Date(viewingPolicial.desativadoEm).toLocaleString('pt-BR')}
                              </Typography>
                            )}
                          </Box>
                        </>
                      )}

                      {(viewingPolicial.restricaoMedica || (viewingPolicial.restricoesMedicasHistorico && viewingPolicial.restricoesMedicasHistorico.length > 0)) && (
                        <>
                          <Divider />
                          <Box>
                            <Typography variant="caption" sx={{ color: 'text.primary', fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.5, mb: 1, display: 'block' }}>
                              Restrições Médicas
                            </Typography>
                            
                            {/* Restrição Ativa */}
                            {viewingPolicial.restricaoMedica && (
                              <Box sx={{ mb: 2, p: 1.5, backgroundColor: theme.alertErrorBg, borderRadius: 1, border: '1px solid rgba(214,69,69,0.4)' }}>
                                <Typography variant="body2" sx={{ fontWeight: 600, color: 'error.main', mb: 0.5 }}>
                                  Ativa: {viewingPolicial.restricaoMedica.nome}
                                </Typography>
                                {viewingPolicial.updatedAt && (
                                  <Typography variant="caption" sx={{ color: 'text.secondary', fontSize: '0.75rem' }}>
                                    Adicionada em: {new Date(viewingPolicial.updatedAt).toLocaleDateString('pt-BR')}
                                  </Typography>
                                )}
                              </Box>
                            )}

                            {/* Histórico de Restrições Removidas */}
                            {viewingPolicial.restricoesMedicasHistorico && viewingPolicial.restricoesMedicasHistorico.length > 0 && (
                              <Box sx={{ mt: 2 }}>
                                <Typography variant="body2" sx={{ fontWeight: 600, color: 'text.primary', mb: 1.5 }}>
                                  Histórico de Restrições
                                </Typography>
                                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
                                  {viewingPolicial.restricoesMedicasHistorico.map((historico) => (
                                    <Box 
                                      key={historico.id}
                                      sx={{ p: 1.5, backgroundColor: 'rgba(0,0,0,0.15)', borderRadius: 1, border: '1px solid var(--border-soft)' }}
                                    >
                                      <Typography variant="body2" sx={{ fontSize: '0.875rem', color: 'text.secondary', mb: 0.75, fontWeight: 500 }}>
                                        {formatNome(historico.restricaoMedica.nome)}
                                      </Typography>
                                      <Typography variant="caption" sx={{ color: 'text.secondary', fontSize: '0.75rem', display: 'block' }}>
                                        Colocada em: {new Date(historico.dataInicio).toLocaleDateString('pt-BR')}
                                      </Typography>
                                      <Typography variant="caption" sx={{ color: 'text.secondary', fontSize: '0.75rem', display: 'block' }}>
                                        Removida em: {new Date(historico.dataFim).toLocaleDateString('pt-BR')}
                                      </Typography>
                                      {historico.removidoPorNome && (
                                        <Typography variant="caption" sx={{ color: 'text.secondary', fontSize: '0.75rem', display: 'block' }}>
                                          Removida por: {historico.removidoPorNome}
                                        </Typography>
                                      )}
                                    </Box>
                                  ))}
                                </Box>
                              </Box>
                            )}
                          </Box>
                        </>
                      )}
                    </Box>
                  </Paper>
                  </Box>

                  {/* Coluna Central - Lista de Afastamentos */}
                  <Box sx={{ flex: { xs: '1 1 100%', lg: '0 0 35%' }, minWidth: 0 }}>
                    <Paper elevation={2} sx={{ p: 2, height: '100%', display: 'flex', flexDirection: 'column' }}>
                      <Typography variant="h6" sx={{ mb: 1.5, fontWeight: 600, color: 'text.primary', fontSize: '1.1rem' }}>
                        Afastamentos
                      </Typography>

                    <Box sx={{ flex: 1, overflow: 'auto', maxHeight: 'calc(85vh - 200px)' }}>
                      {loadingAfastamentos ? (
                        <Typography variant="body2" sx={{ color: 'text.secondary', fontStyle: 'italic' }}>
                          Carregando afastamentos...
                        </Typography>
                      ) : viewingAfastamentos.length === 0 ? (
                        <Typography variant="body2" sx={{ color: 'text.secondary', fontStyle: 'italic' }}>
                          Nenhum afastamento registrado para este policial.
                        </Typography>
                      ) : (
                        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
                          {viewingAfastamentos.map((afastamento) => (
                            <Card
                              key={afastamento.id}
                              elevation={1}
                              sx={{
                                p: 1.5,
                                backgroundColor: 'background.paper',
                                border: 1,
                                borderColor: 'divider',
                                '&:hover': {
                                  boxShadow: 2,
                                },
                              }}
                            >
                              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 0.5 }}>
                                <Box sx={{ flex: 1 }}>
                                  <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 0.25, fontSize: '0.9rem' }}>
                                    {formatNome(afastamento.motivo.nome)}
                                  </Typography>
                                  {afastamento.descricao && (
                                    <Typography variant="body2" sx={{ color: 'text.secondary', mb: 0.5, fontSize: '0.8rem' }}>
                                      {afastamento.descricao}
                                    </Typography>
                                  )}
                                </Box>
                                <Chip
                                  label={STATUS_LABEL[afastamento.status]}
                                  size="small"
                                  color={afastamento.status === 'ATIVO' ? 'success' : 'default'}
                                  sx={{ ml: 1, fontSize: '0.7rem', height: '24px' }}
                                />
                              </Box>
                              <Typography variant="caption" sx={{ color: 'text.secondary', fontSize: '0.75rem' }}>
                                {formatPeriodo(afastamento.dataInicio, afastamento.dataFim)}
                              </Typography>
                            </Card>
                          ))}
                        </Box>
                      )}
                    </Box>
                  </Paper>
                  </Box>

                  {/* Coluna Direita - Resumo de Dias por Tipo */}
                  <Box sx={{ flex: { xs: '1 1 100%', lg: '0 0 28%' }, minWidth: 0 }}>
                    <Paper elevation={2} sx={{ p: 2, height: '100%', display: 'flex', flexDirection: 'column' }}>
                      <Typography variant="h6" sx={{ mb: 1.5, fontWeight: 600, color: 'text.primary', fontSize: '1.1rem' }}>
                        Resumo de Afastamentos
                      </Typography>
                      
                      <Box sx={{ flex: 1, overflow: 'auto', maxHeight: 'calc(85vh - 200px)' }}>
                        {loadingAfastamentos ? (
                          <Typography variant="body2" sx={{ color: 'text.secondary', fontStyle: 'italic', fontSize: '0.85rem' }}>
                            Carregando...
                          </Typography>
                        ) : resumoDiasPorTipo.length === 0 ? (
                          <Typography variant="body2" sx={{ color: 'text.secondary', fontStyle: 'italic', fontSize: '0.85rem' }}>
                            Nenhum afastamento registrado.
                          </Typography>
                        ) : (
                          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                            {resumoDiasPorTipo.map(([motivo, totalDias]) => (
                              <Box
                                key={motivo}
                                sx={{
                                  p: 1.5,
                                  backgroundColor: 'background.default',
                                  borderRadius: 1,
                                  border: 1,
                                  borderColor: 'divider',
                                }}
                              >
                                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                  <Typography variant="body2" sx={{ fontWeight: 500, fontSize: '0.85rem' }}>
                                    {motivo}
                                  </Typography>
                                  <Typography variant="body2" sx={{ fontWeight: 600, color: 'text.primary', fontSize: '0.85rem' }}>
                                    {totalDias} {totalDias === 1 ? 'dia' : 'dias'}
                                  </Typography>
                                </Box>
                              </Box>
                            ))}
                          </Box>
                        )}
                      </Box>
                    </Paper>
                  </Box>
                </Box>
              </Box>

              {/* Footer - Botões */}
            <Box sx={{ p: 2, borderTop: 1, borderColor: 'divider', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 2 }}>
              <Box sx={{ display: 'flex', gap: 2 }}>
                <button
                  type="button"
                  className="secondary"
                  style={{
                    padding: '8px 16px',
                    fontSize: '0.9rem',
                    fontWeight: 500,
                  }}
                  onClick={() => {
                    if (!viewingPolicial) return;

                    setRestricaoModal({
                      open: true,
                      policial: viewingPolicial,
                      restricaoMedicaId: viewingPolicial.restricaoMedicaId ?? null,
                      observacao: viewingPolicial.restricaoMedicaObservacao ?? '',
                      loading: false,
                      error: null,
                    });
                  }}
                >
                  Inserir restrição
                </button>
              </Box>
              <Box sx={{ display: 'flex', gap: 2 }}>
                <button
                  type="button"
                  className="primary"
                  onClick={() => {
                    setViewingPolicial(null);
                    setViewingAfastamentos([]);
                  }}
                >
                  Fechar
                </button>
                {usuarioPodeVerTodosEAcoes && (
                  <button
                    type="button"
                    className="secondary"
                    onClick={() => {
                      setViewingPolicial(null);
                      setViewingAfastamentos([]);
                      openEditModal(viewingPolicial);
                    }}
                  >
                    Editar
                  </button>
                )}
              </Box>
            </Box>
          </Box>
        </div>
      )}

      {/* Modal de Inserir Restrição Médica */}
      {restricaoModal.open && restricaoModal.policial && (
        <div className="modal-backdrop" role="dialog" aria-modal="true" onClick={() => {
          setRestricaoModal({ open: false, policial: null, restricaoMedicaId: null, observacao: '', loading: false, error: null });
        }}>
          <Box
            component="div"
            onClick={(e) => e.stopPropagation()}
            sx={{
              position: 'relative',
              width: '90%',
              maxWidth: '500px',
              backgroundColor: 'var(--card-bg)',
              borderRadius: 2,
              boxShadow: 24,
              display: 'flex',
              flexDirection: 'column',
              overflow: 'hidden',
            }}
          >
            <Box sx={{ p: 3, borderBottom: 1, borderColor: 'divider' }}>
              <Typography variant="h5" component="h2" sx={{ fontWeight: 600, color: 'text.primary' }}>
                Inserir Restrição
              </Typography>
              <Typography variant="body2" sx={{ mt: 1, color: 'text.secondary' }}>
                {restricaoModal.policial.nome}
              </Typography>
            </Box>

            <Box sx={{ p: 3 }}>
              {restricaoModal.error && (
                <Box sx={{ mb: 2, p: 2, backgroundColor: theme.alertErrorBg, borderRadius: 1, color: theme.error }}>
                  {restricaoModal.error}
                </Box>
              )}

              <label style={{ display: 'block', marginBottom: '16px' }}>
                <span style={{ display: 'block', marginBottom: '8px', fontWeight: 500 }}>Restrição</span>
                {loadingRestricoes ? (
                  <Typography variant="body2" sx={{ color: 'text.secondary', fontStyle: 'italic' }}>
                    Carregando restrições...
                  </Typography>
                ) : (
                  <select
                    value={restricaoModal.restricaoMedicaId ?? ''}
                    onChange={(e) => {
                      const value = e.target.value;
                      setRestricaoModal((prev) => ({
                        ...prev,
                        restricaoMedicaId: value === '' ? null : parseInt(value, 10),
                        observacao: value === '' ? '' : prev.observacao,
                      }));
                    }}
                    disabled={restricaoModal.loading || loadingRestricoes}
                    style={{
                      width: '100%',
                      padding: '8px 12px',
                      fontSize: '1rem',
                      border: '1px solid var(--border-soft)',
                      borderRadius: '8px',
                      backgroundColor: 'var(--card-bg)',
                      color: 'var(--text-primary)',
                    }}
                  >
                    <option value="">Nenhuma restrição</option>
                    {restricoesMedicas.map((restricao) => (
                      <option key={restricao.id} value={restricao.id}>
                        {formatNome(restricao.nome)}
                      </option>
                    ))}
                  </select>
                )}
              </label>
              {restricaoModal.restricaoMedicaId !== null && (
                <label style={{ display: 'block', marginBottom: '16px' }}>
                  <span style={{ display: 'block', marginBottom: '8px', fontWeight: 500 }}>Observação</span>
                  <textarea
                    value={restricaoModal.observacao}
                    onChange={(e) => setRestricaoModal((prev) => ({ ...prev, observacao: e.target.value }))}
                    disabled={restricaoModal.loading}
                    rows={3}
                    style={{
                      width: '100%',
                      padding: '8px 12px',
                      fontSize: '1rem',
                      border: '1px solid var(--border-soft)',
                      borderRadius: '8px',
                      backgroundColor: 'var(--card-bg)',
                      resize: 'vertical',
                      minHeight: '80px',
                    }}
                    placeholder="Descreva a observação da restrição (opcional)"
                  />
                </label>
              )}
            </Box>

            <Box sx={{ p: 2, borderTop: 1, borderColor: 'divider', display: 'flex', justifyContent: 'flex-end', gap: 2 }}>
              <button
                type="button"
                className="secondary"
                onClick={() => {
                  setRestricaoModal({ open: false, policial: null, restricaoMedicaId: null, observacao: '', loading: false, error: null });
                }}
                disabled={restricaoModal.loading}
              >
                Cancelar
              </button>
              <button
                type="button"
                className="primary"
                disabled={restricaoModal.loading}
                onClick={async () => {
                  if (!restricaoModal.policial) return;

                  try {
                    setRestricaoModal((prev) => ({ ...prev, loading: true, error: null }));
                    const updatedPolicial = await api.updateRestricaoMedicaPolicial(
                      restricaoModal.policial.id,
                      restricaoModal.restricaoMedicaId,
                      restricaoModal.restricaoMedicaId === null
                        ? null
                        : (restricaoModal.observacao?.trim() ? restricaoModal.observacao.trim() : null),
                    );

                    // Atualizar o policial na visualização
                    setViewingPolicial(updatedPolicial);
                    
                    // Recarregar lista de policiais
                    await carregarPoliciais(paginaAtual, itensPorPagina);

                    setRestricaoModal({ open: false, policial: null, restricaoMedicaId: null, observacao: '', loading: false, error: null });
                  } catch (err) {
                    setRestricaoModal((prev) => ({
                      ...prev,
                      loading: false,
                      error: err instanceof Error ? err.message : 'Erro ao salvar restrição',
                    }));
                  }
                }}
              >
                {restricaoModal.loading ? 'Salvando...' : 'Salvar'}
              </button>
            </Box>
          </Box>
        </div>
      )}

      {/* Modal de Remover Restrição Médica */}
      {removeRestricaoModal.open && removeRestricaoModal.policial && (
        <div className="modal-backdrop" role="dialog" aria-modal="true" onClick={() => {
          setRemoveRestricaoModal({ open: false, policial: null, senha: '', error: null, loading: false });
        }}>
          <Box
            component="div"
            onClick={(e) => e.stopPropagation()}
            sx={{
              position: 'relative',
              width: '90%',
              maxWidth: '500px',
              backgroundColor: 'var(--card-bg)',
              borderRadius: 2,
              boxShadow: 24,
              display: 'flex',
              flexDirection: 'column',
              overflow: 'hidden',
            }}
          >
            <Box sx={{ p: 3, borderBottom: 1, borderColor: 'divider' }}>
              <Typography variant="h5" component="h2" sx={{ fontWeight: 600, color: 'text.primary' }}>
                Retirar Restrição
              </Typography>
              <Typography variant="body2" sx={{ mt: 1, color: 'text.secondary' }}>
                {removeRestricaoModal.policial.nome}
              </Typography>
            </Box>

            <Box sx={{ p: 3 }}>
              <Typography variant="body1" sx={{ mb: 3 }}>
                Tem certeza que deseja retirar a restrição <strong>{formatNome(removeRestricaoModal.policial.restricaoMedica?.nome)}</strong> deste policial?
              </Typography>

              {removeRestricaoModal.error && (
                <Box sx={{ mb: 2, p: 2, backgroundColor: theme.alertErrorBg, borderRadius: 1, color: theme.error }}>
                  {removeRestricaoModal.error}
                </Box>
              )}

              <label style={{ display: 'block', marginBottom: '16px' }}>
                <span style={{ display: 'block', marginBottom: '8px', fontWeight: 500 }}>Digite sua senha para confirmar *</span>
                <input
                  type="password"
                  value={removeRestricaoModal.senha}
                  onChange={(e) => {
                    setRemoveRestricaoModal((prev) => ({
                      ...prev,
                      senha: e.target.value,
                      error: null,
                    }));
                  }}
                  disabled={removeRestricaoModal.loading}
                  style={{
                    width: '100%',
                    padding: '8px 12px',
                    fontSize: '1rem',
                    border: '1px solid var(--border-soft)',
                    borderRadius: '8px',
                  }}
                  autoFocus
                />
              </label>
            </Box>

            <Box sx={{ p: 2, borderTop: 1, borderColor: 'divider', display: 'flex', justifyContent: 'flex-end', gap: 2 }}>
              <button
                type="button"
                className="secondary"
                onClick={() => {
                  setRemoveRestricaoModal({ open: false, policial: null, senha: '', error: null, loading: false });
                }}
                disabled={removeRestricaoModal.loading}
              >
                Cancelar
              </button>
              <button
                type="button"
                className="primary"
                disabled={removeRestricaoModal.loading || !removeRestricaoModal.senha}
                onClick={async () => {
                  if (!removeRestricaoModal.policial || !removeRestricaoModal.senha) return;

                  try {
                    setRemoveRestricaoModal((prev) => ({ ...prev, loading: true, error: null }));
                    const updatedPolicial = await api.removeRestricaoMedicaPolicial(
                      removeRestricaoModal.policial.id,
                      removeRestricaoModal.senha,
                    );

                    // Atualizar o policial na visualização
                    setViewingPolicial(updatedPolicial);
                    
                    // Recarregar lista de policiais
                    await carregarPoliciais(paginaAtual, itensPorPagina);

                    setRemoveRestricaoModal({ open: false, policial: null, senha: '', error: null, loading: false });
                  } catch (err) {
                    setRemoveRestricaoModal((prev) => ({
                      ...prev,
                      loading: false,
                      error: err instanceof Error ? err.message : 'Erro ao remover restrição',
                    }));
                  }
                }}
              >
                {removeRestricaoModal.loading ? 'Removendo...' : 'Confirmar'}
              </button>
            </Box>
          </Box>
        </div>
      )}

      {/* Modal de Desativação (data e observações) */}
      {desativarModal.open && desativarModal.policial && (
        <div className="modal-backdrop" role="dialog" aria-modal="true" onClick={handleCloseDesativarModal}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h3>Desativar policial</h3>
            <p style={{ marginBottom: '16px' }}>
              Informe os dados da desativação de <strong>{desativarModal.policial.nome}</strong> (matrícula {desativarModal.policial.matricula}).
            </p>

            {desativarModal.error && (
              <div className="feedback error" style={{ marginBottom: '16px' }}>
                {desativarModal.error}
                <button
                  type="button"
                  className="feedback-close"
                  onClick={() => setDesativarModal((prev) => ({ ...prev, error: null }))}
                  aria-label="Fechar"
                >
                  ×
                </button>
              </div>
            )}

            <form
              onSubmit={(e) => {
                e.preventDefault();
                void handleConfirmDesativar();
              }}
            >
              <label>
                A partir de:
                <input
                  type="date"
                  value={desativarModal.dataAPartirDe}
                  onChange={(e) =>
                    setDesativarModal((prev) => ({
                      ...prev,
                      dataAPartirDe: e.target.value,
                      error: null,
                    }))
                  }
                  disabled={desativarModal.loading}
                />
              </label>

              <label>
                Observações:
                <textarea
                  value={desativarModal.observacoes}
                  onChange={(e) =>
                    setDesativarModal((prev) => ({
                      ...prev,
                      observacoes: e.target.value,
                      error: null,
                    }))
                  }
                  placeholder="Observações sobre a desativação (opcional)"
                  disabled={desativarModal.loading}
                  rows={3}
                  style={{ resize: 'vertical', minHeight: '60px' }}
                />
              </label>

              <div className="modal-actions">
                <button
                  type="button"
                  className="secondary"
                  onClick={handleCloseDesativarModal}
                  disabled={desativarModal.loading}
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="primary"
                  disabled={desativarModal.loading}
                >
                  {desativarModal.loading ? 'Desativando...' : 'Desativar policial'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal de Exclusão Permanente */}
      {deleteModal.open && deleteModal.policial && (
        <div className="modal-backdrop" role="dialog" aria-modal="true" onClick={handleCloseDeleteModal}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h3>Excluir Permanentemente</h3>
            <p style={{ marginBottom: '24px', color: 'var(--error)', fontWeight: 500 }}>
              ⚠️ Esta ação não pode ser desfeita!
            </p>
            <p style={{ marginBottom: '24px' }}>
              Tem certeza que deseja excluir permanentemente <strong>{deleteModal.policial.nome}</strong> (matrícula {formatMatricula(deleteModal.policial.matricula)}) do banco de dados?
            </p>
            
            {deleteModal.error && (
              <div className="feedback error" style={{ marginBottom: '16px' }}>
                {deleteModal.error}
                <button
                  type="button"
                  className="feedback-close"
                  onClick={() => setDeleteModal((prev) => ({ ...prev, error: null }))}
                  aria-label="Fechar"
                >
                  ×
                </button>
              </div>
            )}

            <form
              onSubmit={(e) => {
                e.preventDefault();
                void handleConfirmDelete();
              }}
            >
              <label>
                Senha do Administrador
                <input
                  type="password"
                  value={deleteModal.senha}
                  onChange={(event) =>
                    setDeleteModal((prev) => ({
                      ...prev,
                      senha: event.target.value,
                      error: null,
                    }))
                  }
                  placeholder="Digite a senha do administrador"
                  autoFocus
                  disabled={deleteModal.loading}
                  required
                />
              </label>

              <div className="modal-actions">
                <button
                  type="button"
                  className="secondary"
                  onClick={handleCloseDeleteModal}
                  disabled={deleteModal.loading}
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="danger"
                  disabled={deleteModal.loading || !deleteModal.senha.trim()}
                >
                  {deleteModal.loading ? 'Excluindo...' : 'Sim, excluir permanentemente'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
        </>
      )}

      {tabAtiva === 1 && (
        <Box sx={{ p: 3 }}>
          <Typography variant="h6" sx={{ mb: 3 }}>
            Gerar efetivo disponível
          </Typography>
          
          <Box sx={{ mb: 3, maxWidth: 400 }}>
            <TextField
              label="Data"
              type="date"
              value={dataEfetivo}
              onChange={(e) => setDataEfetivo(e.target.value)}
              fullWidth
              InputLabelProps={{
                shrink: true,
              }}
              inputProps={{
                min: '2026-01-01',
              }}
              sx={{ mb: 2 }}
            />
            <Button
              variant="contained"
              onClick={handleGerarEfetivo}
              disabled={!dataEfetivo || loadingEfetivo || !funcaoExpedienteId}
              fullWidth
            >
              {loadingEfetivo ? 'Gerando...' : 'Gerar efetivo'}
            </Button>
          </Box>

          {/* Modal com lista de efetivo disponível */}
          <Dialog
            open={modalEfetivoOpen}
            onClose={() => setModalEfetivoOpen(false)}
            maxWidth="md"
            fullWidth
          >
            <DialogTitle>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <Typography variant="h6">
                  Efetivo disponível ({efetivoDisponivel.length} policiais)
                </Typography>
                <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
                  <Button
                    variant="outlined"
                    startIcon={<Print />}
                    onClick={() => window.print()}
                    size="small"
                  >
                    Imprimir
                  </Button>
                  <IconButton
                    onClick={() => setModalEfetivoOpen(false)}
                    size="small"
                  >
                    <CloseIcon />
                  </IconButton>
                </Box>
              </Box>
            </DialogTitle>
            <DialogContent>
              <Box
                id="efetivo-disponivel-print"
                sx={{
                  '@media print': {
                    '&': {
                      padding: 0,
                    },
                    '& .print-header': {
                      display: 'block',
                      marginBottom: 3,
                      paddingBottom: 2,
                      borderBottom: '2px solid var(--accent-muted)',
                    },
                    '& .print-date': {
                      fontSize: '0.875rem',
                      color: '#666',
                      marginTop: 1,
                    },
                    '& .print-list': {
                      display: 'block',
                    },
                    '& .print-table': {
                      width: '100%',
                      borderCollapse: 'collapse',
                    },
                    '& .print-table th, & .print-table td': {
                      border: '1px solid var(--border-soft)',
                      padding: '8px 12px',
                      textAlign: 'left',
                      fontSize: '0.875rem',
                    },
                    '& .print-table th': {
                      backgroundColor: 'var(--card-bg)',
                      fontWeight: 600,
                    },
                    '& .print-table tr:nth-of-type(even)': {
                      backgroundColor: 'rgba(0,0,0,0.1)',
                    },
                  },
                }}
              >
                {/* Cabeçalho para impressão */}
                <Box className="print-header" sx={{ display: 'none' }}>
                  <Typography variant="h4" sx={{ fontWeight: 600, mb: 1 }}>
                    Efetivo Disponível
                  </Typography>
                  <Typography variant="h6" sx={{ color: 'var(--accent-muted)', mb: 0.5 }}>
                    COPOM - Centro de Operações da Polícia Militar
                  </Typography>
                  <Typography className="print-date" variant="body2">
                    Data: {dataEfetivo ? new Date(dataEfetivo).toLocaleDateString('pt-BR') : '-'}
                  </Typography>
                  <Typography variant="body2" sx={{ mt: 1, fontWeight: 500 }}>
                    Total de policiais: {efetivoDisponivel.length}
                  </Typography>
                </Box>

                {efetivoDisponivel.length > 0 ? (
                  <>
                    {/* Versão para tela */}
                    <Box sx={{ '@media print': { display: 'none' } }}>
                      <List>
                        {efetivoDisponivel.map((policial) => (
                          <ListItem key={policial.id}>
                            <ListItemText
                              primary={policial.nome}
                              secondary={
                                <Box component="span" sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', alignItems: 'center', mt: 0.5 }}>
                                  <Typography variant="caption" component="span" color="text.secondary">
                                    Matrícula: {formatMatricula(policial.status === 'COMISSIONADO' && (policial.matriculaComissionadoGdf ?? '').trim() ? policial.matriculaComissionadoGdf!.trim() : policial.matricula)}
                                  </Typography>
                                  {formatEquipeLabel(policial.equipe) !== '—' && (
                                    <Chip
                                      label={`Equipe ${policial.equipe}`}
                                      size="small"
                                      sx={{
                                        height: '20px',
                                        fontSize: '0.65rem',
                                        backgroundColor: theme.alertInfoBg,
                                        color: 'var(--accent-muted)',
                                      }}
                                    />
                                  )}
                                  {policial.funcao && (
                                    <Typography variant="caption" component="span" color="text.secondary">
                                      {formatNome(policial.funcao.nome)}
                                    </Typography>
                                  )}
                                </Box>
                              }
                            />
                          </ListItem>
                        ))}
                      </List>
                    </Box>

                    {/* Versão para impressão: lista em tabela */}
                    <Box className="print-list" sx={{ display: 'none', '@media print': { display: 'block' } }}>
                      <TableContainer component={Paper} elevation={0} sx={{ '@media print': { boxShadow: 'none' } }}>
                        <Table className="print-table" size="small" sx={{ minWidth: 500 }}>
                          <TableHead>
                            <TableRow>
                              <TableCell component="th" sx={{ width: 48 }}>#</TableCell>
                              <TableCell component="th">Nome</TableCell>
                              <TableCell component="th">Matrícula</TableCell>
                              <TableCell component="th">Equipe</TableCell>
                              <TableCell component="th">Função</TableCell>
                            </TableRow>
                          </TableHead>
                          <TableBody>
                            {efetivoDisponivel.map((policial, index) => (
                              <TableRow key={policial.id}>
                                <TableCell>{index + 1}</TableCell>
                                <TableCell>{(policial.nome ?? '').toUpperCase()}</TableCell>
                                <TableCell>
                                  {formatMatricula(
                                    policial.status === 'COMISSIONADO' && (policial.matriculaComissionadoGdf ?? '').trim()
                                      ? policial.matriculaComissionadoGdf!.trim()
                                      : policial.matricula
                                  )}
                                </TableCell>
                                <TableCell>{formatEquipeLabel(policial.equipe)}</TableCell>
                                <TableCell>{policial.funcao ? formatNome(policial.funcao.nome) : '—'}</TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </TableContainer>
                    </Box>
                  </>
                ) : (
                  <Typography variant="body2" color="text.secondary" sx={{ textAlign: 'center', py: 3 }}>
                    Nenhum policial encontrado com os critérios especificados.
                  </Typography>
                )}
              </Box>
            </DialogContent>
          </Dialog>
        </Box>
      )}

      {tabAtiva === 2 && (
        <Box sx={{ p: 3 }}>
          <Typography variant="h6" sx={{ mb: 3 }}>
            Disponibilidade SVG
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
            Crie os intervalos de horário abaixo. Depois, selecione a data e o horário para gerar a lista de policiais que podem tirar o voluntário.
          </Typography>

          <Box sx={{ mb: 3 }}>
            <Typography variant="subtitle2" sx={{ mb: 2 }}>Criar novo intervalo</Typography>
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} alignItems="flex-start" flexWrap="wrap">
              <FormControl size="small" sx={{ minWidth: 120 }}>
                <InputLabel id="svg-hora-inicio-label">Hora início</InputLabel>
                <Select
                  labelId="svg-hora-inicio-label"
                  label="Hora início"
                  value={horaInicioNovo}
                  onChange={(e) => setHoraInicioNovo(e.target.value)}
                >
                  <MenuItem value="">
                    <em>Selecione</em>
                  </MenuItem>
                  {Array.from({ length: 24 }, (_, i) => `${String(i).padStart(2, '0')}:00`).map((h) => (
                    <MenuItem key={h} value={h}>{h}</MenuItem>
                  ))}
                </Select>
              </FormControl>
              <TextField
                label="Hora fim"
                type="time"
                value={horaFimNovo}
                InputLabelProps={{ shrink: true }}
                size="small"
                sx={{ minWidth: 140 }}
                disabled
              />
              <Button
                variant="outlined"
                onClick={handleGravarHorarioSvg}
                disabled={!horaInicioNovo || !horaFimNovo || salvandoHorarioSvg}
                sx={{ mt: { xs: 0, sm: 0 }, alignSelf: { xs: 'stretch', sm: 'flex-start' } }}
              >
                {salvandoHorarioSvg ? 'Gravando...' : 'Gravar'}
              </Button>
            </Stack>
          </Box>

          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} alignItems="flex-start" sx={{ maxWidth: 600, mb: 3 }}>
            <TextField
              label="Data"
              type="date"
              value={dataSvg}
              onChange={(e) => setDataSvg(e.target.value)}
              InputLabelProps={{ shrink: true }}
              inputProps={{ min: '2026-01-01' }}
              size="small"
              sx={{ minWidth: 180 }}
            />
            <FormControl sx={{ minWidth: 250 }} size="small">
              <InputLabel id="svg-horario-label">Horário</InputLabel>
              <Select
                labelId="svg-horario-label"
                label="Horário"
                value={horarioSvg}
                onChange={(e) => setHorarioSvg(e.target.value)}
                disabled={loadingHorariosSvg}
              >
                <MenuItem value="">
                  <em>Selecione um horário</em>
                </MenuItem>
                {horariosSvgOrdenados.map((h) => (
                  <MenuItem key={h.id} value={String(h.id)}>
                    {h.horaInicio} - {h.horaFim}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
            <Button
              variant="contained"
              onClick={handleGerarListaSvg}
              disabled={!dataSvg || !horarioSvg || loadingListaSvg}
              sx={{ alignSelf: { xs: 'stretch', sm: 'flex-start' } }}
            >
              {loadingListaSvg ? 'Gerando...' : 'Gerar lista'}
            </Button>
          </Stack>

          {horariosSvgOrdenados.length > 0 && (
            <Box sx={{ mb: 3 }}>
              <Typography variant="subtitle2" sx={{ mb: 2 }}>Intervalos cadastrados</Typography>
              <List dense sx={{ maxWidth: 400, border: '1px solid', borderColor: 'divider', borderRadius: 1 }}>
                {horariosSvgOrdenados.map((h) => (
                  <ListItem
                    key={h.id}
                    secondaryAction={
                      <IconButton
                        edge="end"
                        size="small"
                        onClick={() => openConfirm({
                          title: 'Excluir intervalo',
                          message: `Deseja excluir o intervalo ${h.horaInicio} - ${h.horaFim}?`,
                          onConfirm: () => handleExcluirHorarioSvg(h.id),
                        })}
                      >
                        <Delete fontSize="small" />
                      </IconButton>
                    }
                  >
                    <ListItemText primary={`${h.horaInicio} - ${h.horaFim}`} />
                  </ListItem>
                ))}
              </List>
            </Box>
          )}

          <Dialog open={modalListaSvgOpen} onClose={() => setModalListaSvgOpen(false)} maxWidth="md" fullWidth>
            <DialogTitle>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <Typography variant="h6">
                  Disponível para SVG ({listaSvg.length} policiais)
                </Typography>
                <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
                  <Button variant="outlined" startIcon={<Print />} onClick={() => window.print()} size="small">
                    Imprimir
                  </Button>
                  <IconButton onClick={() => setModalListaSvgOpen(false)} size="small">
                    <CloseIcon />
                  </IconButton>
                </Box>
              </Box>
            </DialogTitle>
            <DialogContent>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                Data: {dataSvg} | Horário: {horariosSvg.find((h) => String(h.id) === horarioSvg)?.horaInicio ?? ''} - {horariosSvg.find((h) => String(h.id) === horarioSvg)?.horaFim ?? ''}
              </Typography>
              <Box sx={{ display: 'flex', alignItems: 'flex-end', gap: 1, mb: 2 }}>
                <Search sx={{ color: 'action.active', mb: 1 }} fontSize="small" />
                <TextField
                  label="Buscar por nome ou matrícula"
                  value={buscaSvg}
                  onChange={(e) => setBuscaSvg(e.target.value)}
                  variant="outlined"
                  size="small"
                  fullWidth
                />
              </Box>
              {listaSvgFiltrada.length > 0 ? (
                <List dense>
                  {listaSvgFiltrada.map((item, index) => (
                    <ListItem key={item.policial.id} sx={{ flexDirection: 'column', alignItems: 'flex-start' }}>
                      <Box sx={{ width: '100%' }}>
                        <ListItemText primary={`${index + 1}. ${(item.policial.nome ?? '').toUpperCase()}`} />
                        {item.disponivel ? (
                          <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', pl: 7, mt: 0.5 }}>
                            <Chip
                              label={formatMatricula(
                                item.policial.status === 'COMISSIONADO' && (item.policial.matriculaComissionadoGdf ?? '').trim()
                                  ? item.policial.matriculaComissionadoGdf!.trim()
                                  : item.policial.matricula
                              )}
                              size="small"
                              sx={{ height: '20px', fontSize: '0.65rem' }}
                            />
                            {item.policial.equipe && (
                              <Chip
                                label={`Equipe ${item.policial.equipe}`}
                                size="small"
                                sx={{ height: '20px', fontSize: '0.65rem', backgroundColor: theme.alertInfoBg, color: theme.statusPttcText }}
                              />
                            )}
                            {item.policial.funcao && (
                              <Typography variant="caption" component="span" color="text.secondary">
                                {formatNome(item.policial.funcao.nome)}
                              </Typography>
                            )}
                          </Box>
                        ) : (
                          <Box sx={{ pl: 7, mt: 0.5 }}>
                            <Typography variant="caption" color="text.secondary" component="span">
                              Matrícula: {formatMatricula(
                                item.policial.status === 'COMISSIONADO' && (item.policial.matriculaComissionadoGdf ?? '').trim()
                                  ? item.policial.matriculaComissionadoGdf!.trim()
                                  : item.policial.matricula
                              )}
                            </Typography>
                            {item.motivo && (
                              <Alert severity="warning" sx={{ mt: 1, py: 0.5, '& .MuiAlert-message': { fontSize: '0.8rem' } }}>
                                {item.motivo}
                              </Alert>
                            )}
                          </Box>
                        )}
                      </Box>
                    </ListItem>
                  ))}
                </List>
              ) : (
                <Typography variant="body2" color="text.secondary" sx={{ textAlign: 'center', py: 3 }}>
                  {buscaSvg.trim()
                    ? 'Nenhum policial encontrado com esse nome ou matrícula.'
                    : 'Nenhum policial disponível para o horário selecionado conforme as regras do SVG.'}
                </Typography>
              )}
            </DialogContent>
          </Dialog>
        </Box>
      )}
    </section>
  );
}
