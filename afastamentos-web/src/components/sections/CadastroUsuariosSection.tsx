import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControl,
  Grid,
  IconButton,
  InputAdornment,
  InputLabel,
  List,
  ListItem,
  ListItemText,
  MenuItem,
  Paper,
  Select,
  Tab,
  Tabs,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material';
import DeleteIcon from '@mui/icons-material/Delete';
import EditIcon from '@mui/icons-material/Edit';
import BlockIcon from '@mui/icons-material/Block';
import SearchIcon from '@mui/icons-material/Search';
import type {
  EquipeOption,
  FuncaoExpedienteHorarioPreset,
  FuncaoOption,
  FuncaoVinculoEquipe,
  PerguntaSegurancaOption,
  Usuario,
  MotivoAfastamentoOption,
  TipoRestricaoAfastamento,
  StatusPolicialOption,
  RestricaoMedica,
} from '../../types';
import { api } from '../../api';
import { formatNome } from '../../utils/dateUtils';
import { handleKeyDownNormalized } from '../../utils/inputUtils';
import type { PermissoesPorTela } from '../../utils/permissions';
import { canEdit, canExcluir, canDesativar } from '../../utils/permissions';

interface CadastroUsuariosSectionProps {
  currentUser: Usuario;
  permissoes?: PermissoesPorTela | null;
}

type TipoRemocao = 'equipe' | 'funcao' | 'pergunta' | 'motivo' | 'restricao' | 'restricao-servico' | 'status';

type HorarioTrabalhoFuncaoUI = 'EQUIPES_12X36_12X72' | 'SEG_SEX_12X36' | 'EXPEDIENTE_PADRAO' | 'JORNADA_24X72';

const HORARIO_TRABALHO_FUNCAO_LABEL: Record<HorarioTrabalhoFuncaoUI, string> = {
  EQUIPES_12X36_12X72: 'Equipes (12x36, 12x72)',
  SEG_SEX_12X36: '12x36, de seg a sex',
  EXPEDIENTE_PADRAO: 'Expediente (seg a qui: 13 às 19, sex: 07 às 13)',
  JORNADA_24X72: '24x72',
};

function mapPresetParaHorarioUI(v?: FuncaoExpedienteHorarioPreset): HorarioTrabalhoFuncaoUI {
  if (v === 'AUTO') return 'EQUIPES_12X36_12X72';
  if (v === 'SEG_SEX_07_19' || v === 'SEG_SEX_12X36_SEMANA_ALTERNADA') return 'SEG_SEX_12X36';
  if (v === 'JORNADA_24X72') return 'JORNADA_24X72';
  return 'EXPEDIENTE_PADRAO';
}

function mapHorarioUIParaPreset(v: HorarioTrabalhoFuncaoUI): FuncaoExpedienteHorarioPreset {
  if (v === 'SEG_SEX_12X36') return 'SEG_SEX_07_19';
  if (v === 'JORNADA_24X72') return 'JORNADA_24X72';
  return 'ORGAO_DIAS_UTEIS';
}

export function CadastroUsuariosSection({ currentUser, permissoes }: CadastroUsuariosSectionProps) {
  const [equipes, setEquipes] = useState<EquipeOption[]>([]);
  const [funcoes, setFuncoes] = useState<FuncaoOption[]>([]);
  const [perguntas, setPerguntas] = useState<PerguntaSegurancaOption[]>([]);
  const [motivos, setMotivos] = useState<MotivoAfastamentoOption[]>([]);
  const [restricoes, setRestricoes] = useState<TipoRestricaoAfastamento[]>([]);
  const [restricoesServico, setRestricoesServico] = useState<RestricaoMedica[]>([]);
  const [status, setStatus] = useState<StatusPolicialOption[]>([]);
  const [novoEquipe, setNovoEquipe] = useState({ nome: '', descricao: '' });
  const [novaFuncao, setNovaFuncao] = useState<{
    nome: string;
    descricao: string;
    vinculoEquipe: FuncaoVinculoEquipe;
    horarioTrabalho: HorarioTrabalhoFuncaoUI;
  }>({
    nome: '',
    descricao: '',
    vinculoEquipe: 'OPCIONAL',
    horarioTrabalho: 'EQUIPES_12X36_12X72',
  });
  const [novaPergunta, setNovaPergunta] = useState('');
  const [novoMotivo, setNovoMotivo] = useState({ nome: '', descricao: '' });
  const [novaRestricao, setNovaRestricao] = useState({ nome: '', descricao: '' });
  const [novaRestricaoServico, setNovaRestricaoServico] = useState({ nome: '', descricao: '' });
  const [novoStatus, setNovoStatus] = useState({ nome: '', descricao: '' });
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [confirmacaoAberta, setConfirmacaoAberta] = useState(false);
  const [confirmacaoTipo, setConfirmacaoTipo] = useState<'excluir' | 'desativar'>('excluir');
  const [abaAtiva, setAbaAtiva] = useState(0);
  const [filtroTexto, setFiltroTexto] = useState('');
  const [itemSelecionado, setItemSelecionado] = useState<{
    tipo: TipoRemocao;
    id: number;
    label: string;
  } | null>(null);
  const [edicaoAberta, setEdicaoAberta] = useState(false);
  const [edicaoTipo, setEdicaoTipo] = useState<TipoRemocao>('equipe');
  const [edicaoId, setEdicaoId] = useState<number | null>(null);
  const [edicaoEquipe, setEdicaoEquipe] = useState({ nome: '', descricao: '' });
  const [edicaoFuncao, setEdicaoFuncao] = useState<{
    nome: string;
    descricao: string;
    vinculoEquipe: FuncaoVinculoEquipe;
    horarioTrabalho: HorarioTrabalhoFuncaoUI;
  }>({
    nome: '',
    descricao: '',
    vinculoEquipe: 'OBRIGATORIA',
    horarioTrabalho: 'EQUIPES_12X36_12X72',
  });
  const [edicaoPergunta, setEdicaoPergunta] = useState('');
  const [edicaoMotivo, setEdicaoMotivo] = useState({ nome: '', descricao: '' });
  const [edicaoRestricao, setEdicaoRestricao] = useState({ nome: '', descricao: '' });
  const [edicaoRestricaoServico, setEdicaoRestricaoServico] = useState({ nome: '', descricao: '' });
  const [edicaoStatus, setEdicaoStatus] = useState({ nome: '', descricao: '' });

  const carregarDados = useCallback(async () => {
    try {
      const [equipesData, funcoesData, perguntasData, motivosData, restricoesData, restricoesServicoData, statusData] = await Promise.all([
        api.listEquipes(),
        api.listFuncoes(),
        api.listPerguntasSeguranca(),
        api.listMotivos(),
        api.listTiposRestricaoAfastamento(),
        api.listRestricoesMedicas(),
        api.listStatusPolicial(),
      ]);
      setEquipes(equipesData);
      setFuncoes(funcoesData);
      setPerguntas(perguntasData);
      setMotivos(motivosData);
      setRestricoes(restricoesData);
      setRestricoesServico(restricoesServicoData);
      setStatus(statusData);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Não foi possível carregar os cadastros.');
    }
  }, []);

  useEffect(() => {
    void carregarDados();
  }, [carregarDados]);

  const equipesOrdenadas = useMemo(() => {
    return [...equipes].sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR', { sensitivity: 'base' }));
  }, [equipes]);

  const funcoesOrdenadas = useMemo(() => {
    return [...funcoes].sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR', { sensitivity: 'base' }));
  }, [funcoes]);

  const perguntasOrdenadas = useMemo(() => {
    return [...perguntas].sort((a, b) => a.texto.localeCompare(b.texto, 'pt-BR', { sensitivity: 'base' }));
  }, [perguntas]);

  const motivosOrdenados = useMemo(() => {
    return [...motivos].sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR', { sensitivity: 'base' }));
  }, [motivos]);

  const restricoesOrdenadas = useMemo(() => {
    return [...restricoes].sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR', { sensitivity: 'base' }));
  }, [restricoes]);

  const restricoesServicoOrdenadas = useMemo(() => {
    return [...restricoesServico].sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR', { sensitivity: 'base' }));
  }, [restricoesServico]);

  const statusOrdenados = useMemo(() => {
    // Filtrar o status "DESATIVADO" da lista, pois é automático do sistema
    return [...status]
      .filter((s) => s.nome.toUpperCase() !== 'DESATIVADO')
      .sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR', { sensitivity: 'base' }));
  }, [status]);

  const equipesFiltradas = useMemo(() => {
    if (!filtroTexto.trim()) {
      return equipesOrdenadas;
    }
    const termo = filtroTexto.trim().toLowerCase();
    return equipesOrdenadas.filter(
      (equipe) =>
        equipe.nome.toLowerCase().includes(termo) ||
        (equipe.descricao ?? '').toLowerCase().includes(termo),
    );
  }, [equipesOrdenadas, filtroTexto]);

  const funcoesFiltradas = useMemo(() => {
    if (!filtroTexto.trim()) {
      return funcoesOrdenadas;
    }
    const termo = filtroTexto.trim().toLowerCase();
    return funcoesOrdenadas.filter(
      (funcao) =>
        funcao.nome.toLowerCase().includes(termo) ||
        (funcao.descricao ?? '').toLowerCase().includes(termo),
    );
  }, [funcoesOrdenadas, filtroTexto]);

  const perguntasFiltradas = useMemo(() => {
    if (!filtroTexto.trim()) {
      return perguntasOrdenadas;
    }
    const termo = filtroTexto.trim().toLowerCase();
    return perguntasOrdenadas.filter((pergunta) =>
      pergunta.texto.toLowerCase().includes(termo),
    );
  }, [perguntasOrdenadas, filtroTexto]);

  const motivosFiltrados = useMemo(() => {
    if (!filtroTexto.trim()) {
      return motivosOrdenados;
    }
    const termo = filtroTexto.trim().toLowerCase();
    return motivosOrdenados.filter(
      (motivo) =>
        motivo.nome.toLowerCase().includes(termo) ||
        (motivo.descricao ?? '').toLowerCase().includes(termo),
    );
  }, [motivosOrdenados, filtroTexto]);

  const restricoesFiltradas = useMemo(() => {
    if (!filtroTexto.trim()) {
      return restricoesOrdenadas;
    }
    const termo = filtroTexto.trim().toLowerCase();
    return restricoesOrdenadas.filter(
      (restricao) =>
        restricao.nome.toLowerCase().includes(termo) ||
        (restricao.descricao ?? '').toLowerCase().includes(termo),
    );
  }, [restricoesOrdenadas, filtroTexto]);

  const restricoesServicoFiltradas = useMemo(() => {
    if (!filtroTexto.trim()) {
      return restricoesServicoOrdenadas;
    }
    const termo = filtroTexto.trim().toLowerCase();
    return restricoesServicoOrdenadas.filter(
      (restricao) =>
        restricao.nome.toLowerCase().includes(termo) ||
        (restricao.descricao ?? '').toLowerCase().includes(termo),
    );
  }, [restricoesServicoOrdenadas, filtroTexto]);

  const statusFiltrados = useMemo(() => {
    if (!filtroTexto.trim()) {
      return statusOrdenados;
    }
    const termo = filtroTexto.trim().toLowerCase();
    return statusOrdenados.filter(
      (statusItem) =>
        statusItem.nome.toLowerCase().includes(termo) ||
        (statusItem.descricao ?? '').toLowerCase().includes(termo),
    );
  }, [statusOrdenados, filtroTexto]);

  const placeholderFiltro = useMemo(() => {
    if (abaAtiva === 1) {
      return 'Buscar função';
    }
    if (abaAtiva === 2) {
      return 'Buscar pergunta';
    }
    if (abaAtiva === 3) {
      return 'Buscar motivo';
    }
    if (abaAtiva === 4) {
      return 'Buscar restrição de afastamento';
    }
    if (abaAtiva === 5) {
      return 'Buscar restrição de serviço';
    }
    if (abaAtiva === 6) {
      return 'Buscar status';
    }
    return 'Buscar equipe';
  }, [abaAtiva]);

  const abrirConfirmacao = useCallback((acao: 'excluir' | 'desativar', tipo: TipoRemocao, id: number, label: string) => {
    setConfirmacaoTipo(acao);
    setItemSelecionado({ tipo, id, label });
    setConfirmacaoAberta(true);
  }, []);

  const fecharConfirmacao = useCallback(() => {
    setConfirmacaoAberta(false);
    setItemSelecionado(null);
  }, []);

  const confirmarRemocao = useCallback(async () => {
    if (!itemSelecionado) {
      return;
    }
    try {
      if (confirmacaoTipo === 'desativar') {
        if (itemSelecionado.tipo === 'equipe') {
          await api.disableEquipe(itemSelecionado.id);
          setSuccess(`Equipe ${itemSelecionado.label} desativada com sucesso.`);
        }
        if (itemSelecionado.tipo === 'funcao') {
          await api.disableFuncao(itemSelecionado.id);
          setSuccess(`Função ${itemSelecionado.label} desativada com sucesso.`);
        }
        if (itemSelecionado.tipo === 'pergunta') {
          await api.disablePerguntaSeguranca(itemSelecionado.id);
          setSuccess('Pergunta desativada com sucesso.');
        }
      } else {
        if (itemSelecionado.tipo === 'equipe') {
          await api.deleteEquipe(itemSelecionado.id);
          setSuccess(`Equipe ${itemSelecionado.label} removida com sucesso.`);
        }
        if (itemSelecionado.tipo === 'funcao') {
          await api.deleteFuncao(itemSelecionado.id);
          setSuccess(`Função ${itemSelecionado.label} removida com sucesso.`);
        }
        if (itemSelecionado.tipo === 'pergunta') {
          await api.deletePerguntaSeguranca(itemSelecionado.id);
          setSuccess('Pergunta removida com sucesso.');
        }
        if (itemSelecionado.tipo === 'motivo') {
          await api.deleteMotivo(itemSelecionado.id);
          setSuccess(`Motivo ${itemSelecionado.label} removido com sucesso.`);
        }
        if (itemSelecionado.tipo === 'restricao') {
          await api.deleteTipoRestricaoAfastamento(itemSelecionado.id);
          setSuccess(`Tipo de restrição ${itemSelecionado.label} removido com sucesso.`);
        }
        if (itemSelecionado.tipo === 'restricao-servico') {
          await api.deleteRestricaoMedicaOption(itemSelecionado.id);
          setSuccess(`Restrição de serviço ${itemSelecionado.label} removida com sucesso.`);
        }
        if (itemSelecionado.tipo === 'status') {
          await api.deleteStatusPolicial(itemSelecionado.id);
          setSuccess(`Status ${itemSelecionado.label} removido com sucesso.`);
        }
      }
      setError(null);
      await carregarDados();
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : confirmacaoTipo === 'desativar'
            ? 'Não foi possível desativar o item.'
            : 'Não foi possível remover o item.',
      );
    } finally {
      fecharConfirmacao();
    }
  }, [itemSelecionado, confirmacaoTipo, carregarDados, fecharConfirmacao]);

  const criarEquipe = useCallback(async () => {
    if (!novoEquipe.nome.trim()) {
      setError('Informe o nome da equipe.');
      return;
    }
    try {
      await api.createEquipe({
        nome: novoEquipe.nome.trim(),
        descricao: novoEquipe.descricao.trim() || null,
      });
      setNovoEquipe({ nome: '', descricao: '' });
      setSuccess('Equipe criada com sucesso.');
      setError(null);
      await carregarDados();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Não foi possível criar a equipe.');
    }
  }, [novoEquipe, carregarDados]);

  const criarFuncao = useCallback(async () => {
    if (!novaFuncao.nome.trim()) {
      setError('Informe o nome da função.');
      return;
    }
    try {
      const horarioEquipes = novaFuncao.horarioTrabalho === 'EQUIPES_12X36_12X72';
      const payload = horarioEquipes
        ? {
            nome: novaFuncao.nome.trim(),
            descricao: novaFuncao.descricao.trim() || null,
            vinculoEquipe: 'OBRIGATORIA' as FuncaoVinculoEquipe,
            equipeReferencia: null,
            escalaOperacional: true,
            escalaMotorista: true,
            escalaExpediente: false,
            expedienteHorarioPreset: 'AUTO' as FuncaoExpedienteHorarioPreset,
          }
        : {
            nome: novaFuncao.nome.trim(),
            descricao: novaFuncao.descricao.trim() || null,
            vinculoEquipe: 'SEM_EQUIPE' as FuncaoVinculoEquipe,
            equipeReferencia: null,
            escalaOperacional: false,
            escalaMotorista: false,
            escalaExpediente: true,
            expedienteHorarioPreset: mapHorarioUIParaPreset(novaFuncao.horarioTrabalho),
          };
      await api.createFuncao({
        ...payload,
      });
      setNovaFuncao({
        nome: '',
        descricao: '',
        vinculoEquipe: 'OPCIONAL',
        horarioTrabalho: 'EQUIPES_12X36_12X72',
      });
      setSuccess('Função criada com sucesso.');
      setError(null);
      await carregarDados();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Não foi possível criar a função.');
    }
  }, [novaFuncao, carregarDados]);

  const criarPergunta = useCallback(async () => {
    if (!novaPergunta.trim()) {
      setError('Informe a pergunta de segurança.');
      return;
    }
    try {
      await api.createPerguntaSeguranca({ texto: novaPergunta.trim() });
      setNovaPergunta('');
      setSuccess('Pergunta criada com sucesso.');
      setError(null);
      await carregarDados();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Não foi possível criar a pergunta.');
    }
  }, [novaPergunta, carregarDados]);

  const criarMotivo = useCallback(async () => {
    if (!novoMotivo.nome.trim()) {
      setError('Informe o nome do motivo.');
      return;
    }
    try {
      await api.createMotivo({
        nome: novoMotivo.nome.trim(),
        descricao: novoMotivo.descricao.trim() || null,
      });
      setNovoMotivo({ nome: '', descricao: '' });
      setSuccess('Motivo criado com sucesso.');
      setError(null);
      await carregarDados();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Não foi possível criar o motivo.');
    }
  }, [novoMotivo, carregarDados]);

  const criarRestricao = useCallback(async () => {
    if (!novaRestricao.nome.trim()) {
      setError('Informe o nome do tipo de restrição.');
      return;
    }
    try {
      await api.createTipoRestricaoAfastamento({
        nome: novaRestricao.nome.trim(),
        descricao: novaRestricao.descricao.trim() || null,
      });
      setNovaRestricao({ nome: '', descricao: '' });
      setSuccess('Tipo de restrição criado com sucesso.');
      setError(null);
      await carregarDados();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Não foi possível criar o tipo de restrição.');
    }
  }, [novaRestricao, carregarDados]);

  const criarRestricaoServico = useCallback(async () => {
    if (!novaRestricaoServico.nome.trim()) {
      setError('Informe o nome da restrição de serviço.');
      return;
    }
    try {
      await api.createRestricaoMedicaOption({
        nome: novaRestricaoServico.nome.trim(),
        descricao: novaRestricaoServico.descricao.trim() || null,
      });
      setNovaRestricaoServico({ nome: '', descricao: '' });
      setSuccess('Restrição de serviço criada com sucesso.');
      setError(null);
      await carregarDados();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Não foi possível criar a restrição de serviço.');
    }
  }, [novaRestricaoServico, carregarDados]);

  const criarStatus = useCallback(async () => {
    if (!novoStatus.nome.trim()) {
      setError('Informe o nome do status.');
      return;
    }
    // Não permitir criar status com nome "DESATIVADO" (case-insensitive)
    if (novoStatus.nome.trim().toUpperCase() === 'DESATIVADO') {
      setError('O status "Desativado" é automático do sistema e não pode ser criado manualmente.');
      return;
    }
    try {
      await api.createStatusPolicial({
        nome: novoStatus.nome.trim(),
        descricao: novoStatus.descricao.trim() || null,
      });
      setNovoStatus({ nome: '', descricao: '' });
      setSuccess('Status criado com sucesso.');
      setError(null);
      await carregarDados();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Não foi possível criar o status.');
    }
  }, [novoStatus, carregarDados]);

  const abrirEdicao = useCallback(
    (tipo: TipoRemocao, item: EquipeOption | FuncaoOption | PerguntaSegurancaOption | MotivoAfastamentoOption | TipoRestricaoAfastamento | StatusPolicialOption) => {
      setEdicaoTipo(tipo);
      setEdicaoId(item.id);
      if (tipo === 'equipe') {
        const equipe = item as EquipeOption;
        setEdicaoEquipe({ nome: equipe.nome, descricao: equipe.descricao ?? '' });
      }
      if (tipo === 'funcao') {
        const funcao = item as FuncaoOption;
        const horarioTrabalho =
          funcao.escalaExpediente === true
            ? mapPresetParaHorarioUI(funcao.expedienteHorarioPreset)
            : 'EQUIPES_12X36_12X72';
        setEdicaoFuncao({
          nome: funcao.nome,
          descricao: funcao.descricao ?? '',
          vinculoEquipe: (funcao.vinculoEquipe ?? 'OBRIGATORIA') as FuncaoVinculoEquipe,
          horarioTrabalho,
        });
      }
      if (tipo === 'pergunta') {
        const pergunta = item as PerguntaSegurancaOption;
        setEdicaoPergunta(pergunta.texto);
      }
      if (tipo === 'motivo') {
        const motivo = item as MotivoAfastamentoOption;
        setEdicaoMotivo({ nome: motivo.nome, descricao: motivo.descricao ?? '' });
      }
      if (tipo === 'restricao') {
        const restricao = item as TipoRestricaoAfastamento;
        setEdicaoRestricao({ nome: restricao.nome, descricao: restricao.descricao ?? '' });
      }
      if (tipo === 'restricao-servico') {
        const restricao = item as unknown as RestricaoMedica;
        setEdicaoRestricaoServico({ nome: restricao.nome, descricao: restricao.descricao ?? '' });
      }
      if (tipo === 'status') {
        const statusItem = item as StatusPolicialOption;
        setEdicaoStatus({ nome: statusItem.nome, descricao: statusItem.descricao ?? '' });
      }
      setEdicaoAberta(true);
    },
    [],
  );

  const fecharEdicao = useCallback(() => {
    setEdicaoAberta(false);
    setEdicaoId(null);
    setEdicaoEquipe({ nome: '', descricao: '' });
    setEdicaoFuncao({
      nome: '',
      descricao: '',
      vinculoEquipe: 'OBRIGATORIA',
      horarioTrabalho: 'EQUIPES_12X36_12X72',
    });
    setEdicaoPergunta('');
    setEdicaoMotivo({ nome: '', descricao: '' });
    setEdicaoRestricao({ nome: '', descricao: '' });
    setEdicaoRestricaoServico({ nome: '', descricao: '' });
    setEdicaoStatus({ nome: '', descricao: '' });
  }, []);

  const salvarEdicao = useCallback(async () => {
    if (!edicaoId) {
      return;
    }
    try {
      if (edicaoTipo === 'equipe') {
        if (!edicaoEquipe.nome.trim()) {
          setError('Informe o nome da equipe.');
          return;
        }
        await api.updateEquipe(edicaoId, {
          nome: edicaoEquipe.nome.trim(),
          descricao: edicaoEquipe.descricao.trim() || null,
        });
        setSuccess(`Equipe ${edicaoEquipe.nome.trim()} atualizada com sucesso.`);
      }
      if (edicaoTipo === 'funcao') {
        if (!edicaoFuncao.nome.trim()) {
          setError('Informe o nome da função.');
          return;
        }
        const horarioEquipes = edicaoFuncao.horarioTrabalho === 'EQUIPES_12X36_12X72';
        const payload = horarioEquipes
          ? {
              nome: edicaoFuncao.nome.trim(),
              descricao: edicaoFuncao.descricao.trim() || null,
              vinculoEquipe: 'OBRIGATORIA' as FuncaoVinculoEquipe,
              equipeReferencia: null,
              escalaOperacional: true,
              escalaMotorista: true,
              escalaExpediente: false,
              expedienteHorarioPreset: 'AUTO' as FuncaoExpedienteHorarioPreset,
            }
          : {
              nome: edicaoFuncao.nome.trim(),
              descricao: edicaoFuncao.descricao.trim() || null,
              vinculoEquipe: 'SEM_EQUIPE' as FuncaoVinculoEquipe,
              equipeReferencia: null,
              escalaOperacional: false,
              escalaMotorista: false,
              escalaExpediente: true,
              expedienteHorarioPreset: mapHorarioUIParaPreset(edicaoFuncao.horarioTrabalho),
            };
        await api.updateFuncao(edicaoId, {
          ...payload,
        });
        setSuccess(`Função ${edicaoFuncao.nome.trim()} atualizada com sucesso.`);
      }
      if (edicaoTipo === 'pergunta') {
        if (!edicaoPergunta.trim()) {
          setError('Informe a pergunta de segurança.');
          return;
        }
        await api.updatePerguntaSeguranca(edicaoId, { texto: edicaoPergunta.trim() });
        setSuccess('Pergunta atualizada com sucesso.');
      }
      if (edicaoTipo === 'motivo') {
        if (!edicaoMotivo.nome.trim()) {
          setError('Informe o nome do motivo.');
          return;
        }
        await api.updateMotivo(edicaoId, {
          nome: edicaoMotivo.nome.trim(),
          descricao: edicaoMotivo.descricao.trim() || null,
        });
        setSuccess(`Motivo ${edicaoMotivo.nome.trim()} atualizado com sucesso.`);
      }
      if (edicaoTipo === 'restricao') {
        if (!edicaoRestricao.nome.trim()) {
          setError('Informe o nome do tipo de restrição.');
          return;
        }
        await api.updateTipoRestricaoAfastamento(edicaoId, {
          nome: edicaoRestricao.nome.trim(),
          descricao: edicaoRestricao.descricao.trim() || null,
        });
        setSuccess(`Tipo de restrição ${edicaoRestricao.nome.trim()} atualizado com sucesso.`);
      }
      if (edicaoTipo === 'restricao-servico') {
        if (!edicaoRestricaoServico.nome.trim()) {
          setError('Informe o nome da restrição de serviço.');
          return;
        }
        await api.updateRestricaoMedicaOption(edicaoId, {
          nome: edicaoRestricaoServico.nome.trim(),
          descricao: edicaoRestricaoServico.descricao.trim() || null,
        });
        setSuccess(`Restrição de serviço ${edicaoRestricaoServico.nome.trim()} atualizada com sucesso.`);
      }
      if (edicaoTipo === 'status') {
        if (!edicaoStatus.nome.trim()) {
          setError('Informe o nome do status.');
          return;
        }
        // Não permitir editar o status "DESATIVADO"
        if (edicaoStatus.nome.trim().toUpperCase() === 'DESATIVADO') {
          setError('O status "Desativado" é automático do sistema e não pode ser editado.');
          return;
        }
        await api.updateStatusPolicial(edicaoId, {
          nome: edicaoStatus.nome.trim(),
          descricao: edicaoStatus.descricao.trim() || null,
        });
        setSuccess(`Status ${edicaoStatus.nome.trim()} atualizado com sucesso.`);
      }
      setError(null);
      await carregarDados();
      fecharEdicao();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Não foi possível salvar as alterações.');
    }
  }, [
    edicaoId,
    edicaoTipo,
    edicaoEquipe,
    edicaoFuncao,
    edicaoPergunta,
    edicaoMotivo,
    edicaoRestricao,
    edicaoRestricaoServico,
    edicaoStatus,
    carregarDados,
    fecharEdicao,
  ]);

  return (
    <Box display="flex" flexDirection="column" gap={2}>
      <div className="section-header">
        <div>
          <h3>Cadastro de usuários</h3>
          <p className="subtitle">Gerencie as opções dos campos de cadastro.</p>
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

      <Paper variant="outlined" sx={{ borderRadius: 2, overflow: 'hidden' }}>
        <Tabs
          value={abaAtiva}
          onChange={(_, value) => setAbaAtiva(value)}
          variant="scrollable"
          allowScrollButtonsMobile
        >
          <Tab label={`Equipes (${equipesOrdenadas.length})`} />
          <Tab label={`Funções (${funcoesOrdenadas.length})`} />
          <Tab label={`Perguntas (${perguntasOrdenadas.length})`} />
          <Tab label={`Motivos (${motivosOrdenados.length})`} />
          <Tab label={`Restrições de afastamentos (${restricoesOrdenadas.length})`} />
          <Tab label={`Restrições de serviço (${restricoesServicoOrdenadas.length})`} />
          <Tab label={`Status (${statusOrdenados.length})`} />
        </Tabs>
        <Box padding={2} display="flex" flexDirection="column" gap={2}>
          <TextField
            placeholder={placeholderFiltro}
            value={filtroTexto}
            onChange={(event) => setFiltroTexto(event.target.value)}
            size="small"
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <SearchIcon fontSize="small" />
                </InputAdornment>
              ),
            }}
          />

          {abaAtiva === 0 && (
            <>
              <Box display="grid" gap={2} gridTemplateColumns="repeat(auto-fit, minmax(220px, 1fr))">
                <TextField
                  label="Nome"
                  value={novoEquipe.nome}
                  onChange={(event) => {
                    const normalized = event.target.value.toLowerCase().charAt(0).toUpperCase() + event.target.value.toLowerCase().slice(1);
                    setNovoEquipe((prev) => ({ ...prev, nome: normalized }));
                  }}
                  size="small"
                />
                <TextField
                  label="Descrição"
                  value={novoEquipe.descricao}
                  onChange={(event) => {
                    const normalized = event.target.value.toLowerCase().charAt(0).toUpperCase() + event.target.value.toLowerCase().slice(1);
                    setNovoEquipe((prev) => ({ ...prev, descricao: normalized }));
                  }}
                  size="small"
                />
                <Box display="flex" alignItems="center">
                  <Button variant="contained" onClick={() => void criarEquipe()}>
                    Adicionar equipe
                  </Button>
                </Box>
              </Box>
              <List dense>
                {equipesFiltradas.map((equipe) => (
                  <ListItem
                    key={equipe.id}
                    sx={equipe.ativo === false ? { opacity: 0.6 } : undefined}
                    secondaryAction={
                      <Box display="flex" alignItems="center" gap={0.5}>
                        {canEdit(permissoes, 'gestao-sistema') && (
                          <Tooltip title="Editar equipe" arrow>
                            <IconButton
                              edge="end"
                              aria-label="Editar equipe"
                              onClick={() => abrirEdicao('equipe', equipe)}
                            >
                              <EditIcon fontSize="small" />
                            </IconButton>
                          </Tooltip>
                        )}
                        {canDesativar(permissoes, 'gestao-sistema') && (
                          <Tooltip title="Desativar equipe" arrow>
                            <IconButton
                              edge="end"
                              aria-label="Desativar equipe"
                              color="warning"
                              disabled={equipe.ativo === false}
                              onClick={() => abrirConfirmacao('desativar', 'equipe', equipe.id, equipe.nome)}
                            >
                              <BlockIcon fontSize="small" />
                            </IconButton>
                          </Tooltip>
                        )}
                        {canExcluir(permissoes, 'gestao-sistema') && (
                          <Tooltip title="Excluir equipe" arrow>
                            <IconButton
                              edge="end"
                              aria-label="Excluir equipe"
                              color="error"
                              onClick={() => abrirConfirmacao('excluir', 'equipe', equipe.id, equipe.nome)}
                            >
                              <DeleteIcon fontSize="small" />
                            </IconButton>
                          </Tooltip>
                        )}
                      </Box>
                    }
                  >
                    <ListItemText
                      primary={formatNome(equipe.nome)}
                      secondary={
                        [
                          equipe.descricao || '',
                          equipe.ativo === false ? 'Desativada' : '',
                        ]
                          .filter(Boolean)
                          .join(' • ') || undefined
                      }
                    />
                  </ListItem>
                ))}
              </List>
            </>
          )}

          {abaAtiva === 1 && (
            <>
              <Grid container columnSpacing={2} rowSpacing={1.5} alignItems="flex-start">
                <Grid size={{ xs: 12, md: 3 }}>
                  <TextField
                    label="Nome"
                    value={novaFuncao.nome}
                    onChange={(event) => {
                      const normalized = event.target.value.toLowerCase().charAt(0).toUpperCase() + event.target.value.toLowerCase().slice(1);
                      setNovaFuncao((prev) => ({ ...prev, nome: normalized }));
                    }}
                    size="small"
                    fullWidth
                  />
                </Grid>
                <Grid size={{ xs: 12, md: 3 }}>
                  <TextField
                    label="Descrição"
                    value={novaFuncao.descricao}
                    onChange={(event) => {
                      const normalized = event.target.value.toLowerCase().charAt(0).toUpperCase() + event.target.value.toLowerCase().slice(1);
                      setNovaFuncao((prev) => ({ ...prev, descricao: normalized }));
                    }}
                    size="small"
                    fullWidth
                  />
                </Grid>
                <Grid size={{ xs: 12, md: 4 }}>
                  <FormControl size="small" fullWidth>
                    <InputLabel id="nova-funcao-horario-label">Horário de trabalho</InputLabel>
                    <Select
                      labelId="nova-funcao-horario-label"
                      label="Horário de trabalho"
                      value={novaFuncao.horarioTrabalho}
                      onChange={(e) =>
                        setNovaFuncao((prev) => ({
                          ...prev,
                          horarioTrabalho: e.target.value as HorarioTrabalhoFuncaoUI,
                        }))
                      }
                    >
                      {(Object.keys(HORARIO_TRABALHO_FUNCAO_LABEL) as HorarioTrabalhoFuncaoUI[]).map((k) => (
                        <MenuItem key={k} value={k}>
                          {HORARIO_TRABALHO_FUNCAO_LABEL[k]}
                        </MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                </Grid>
                <Grid size={{ xs: 12, md: 2 }}>
                  <Box sx={{ display: 'flex', alignItems: 'flex-start', pt: '2px' }}>
                    <Button variant="contained" onClick={() => void criarFuncao()} fullWidth sx={{ minHeight: 40 }}>
                      Adicionar função
                    </Button>
                  </Box>
                </Grid>
              </Grid>
              <List dense>
                {funcoesFiltradas.map((funcao) => (
                  <ListItem
                    key={funcao.id}
                    sx={funcao.ativo === false ? { opacity: 0.6 } : undefined}
                    secondaryAction={
                      <Box display="flex" alignItems="center" gap={0.5}>
                        {canEdit(permissoes, 'gestao-sistema') && (
                          <Tooltip title="Editar função" arrow>
                            <IconButton
                              edge="end"
                              aria-label="Editar função"
                              onClick={() => abrirEdicao('funcao', funcao)}
                            >
                              <EditIcon fontSize="small" />
                            </IconButton>
                          </Tooltip>
                        )}
                        {canDesativar(permissoes, 'gestao-sistema') && (
                          <Tooltip title="Desativar função" arrow>
                            <IconButton
                              edge="end"
                              aria-label="Desativar função"
                              color="warning"
                              disabled={funcao.ativo === false}
                              onClick={() => abrirConfirmacao('desativar', 'funcao', funcao.id, funcao.nome)}
                            >
                              <BlockIcon fontSize="small" />
                            </IconButton>
                          </Tooltip>
                        )}
                        {canExcluir(permissoes, 'gestao-sistema') && (
                          <Tooltip title="Excluir função" arrow>
                            <IconButton
                              edge="end"
                              aria-label="Excluir função"
                              color="error"
                              onClick={() => abrirConfirmacao('excluir', 'funcao', funcao.id, funcao.nome)}
                            >
                              <DeleteIcon fontSize="small" />
                            </IconButton>
                          </Tooltip>
                        )}
                      </Box>
                    }
                  >
                    <ListItemText
                      primary={formatNome(funcao.nome)}
                      secondary={
                        [
                          `Horário: ${
                            funcao.escalaExpediente === true
                              ? funcao.expedienteHorarioPreset === 'JORNADA_24X72'
                                ? HORARIO_TRABALHO_FUNCAO_LABEL.JORNADA_24X72
                                : funcao.expedienteHorarioPreset === 'SEG_SEX_07_19' ||
                                    funcao.expedienteHorarioPreset === 'SEG_SEX_12X36_SEMANA_ALTERNADA'
                                  ? HORARIO_TRABALHO_FUNCAO_LABEL.SEG_SEX_12X36
                                  : HORARIO_TRABALHO_FUNCAO_LABEL.EXPEDIENTE_PADRAO
                              : HORARIO_TRABALHO_FUNCAO_LABEL.EQUIPES_12X36_12X72
                          }`,
                          funcao.descricao || '',
                          funcao.ativo === false ? 'Desativada' : '',
                        ]
                          .filter(Boolean)
                          .join(' • ') || undefined
                      }
                    />
                  </ListItem>
                ))}
              </List>
            </>
          )}

          {abaAtiva === 2 && (
            <>
              <Box display="grid" gap={2} gridTemplateColumns="1fr auto">
                <TextField
                  label="Pergunta"
                  value={novaPergunta}
                  onChange={(event) => {
                    const normalized = event.target.value.toLowerCase().charAt(0).toUpperCase() + event.target.value.toLowerCase().slice(1);
                    setNovaPergunta(normalized);
                  }}
                  size="small"
                />
                <Box display="flex" alignItems="center">
                  <Button variant="contained" onClick={() => void criarPergunta()}>
                    Adicionar pergunta
                  </Button>
                </Box>
              </Box>
              <List dense>
                {perguntasFiltradas.map((pergunta) => (
                  <ListItem
                    key={pergunta.id}
                    sx={pergunta.ativo === false ? { opacity: 0.6 } : undefined}
                    secondaryAction={
                      <Box display="flex" alignItems="center" gap={0.5}>
                        {canEdit(permissoes, 'gestao-sistema') && (
                          <Tooltip title="Editar pergunta" arrow>
                            <IconButton
                              edge="end"
                              aria-label="Editar pergunta"
                              onClick={() => abrirEdicao('pergunta', pergunta)}
                            >
                              <EditIcon fontSize="small" />
                            </IconButton>
                          </Tooltip>
                        )}
                        {canDesativar(permissoes, 'gestao-sistema') && (
                          <Tooltip title="Desativar pergunta" arrow>
                            <IconButton
                              edge="end"
                              aria-label="Desativar pergunta"
                              color="warning"
                              disabled={pergunta.ativo === false}
                              onClick={() => abrirConfirmacao('desativar', 'pergunta', pergunta.id, pergunta.texto)}
                            >
                              <BlockIcon fontSize="small" />
                            </IconButton>
                          </Tooltip>
                        )}
                        {canExcluir(permissoes, 'gestao-sistema') && (
                          <Tooltip title="Excluir pergunta" arrow>
                            <IconButton
                              edge="end"
                              aria-label="Excluir pergunta"
                              color="error"
                              onClick={() => abrirConfirmacao('excluir', 'pergunta', pergunta.id, pergunta.texto)}
                            >
                              <DeleteIcon fontSize="small" />
                            </IconButton>
                          </Tooltip>
                        )}
                      </Box>
                    }
                  >
                    <ListItemText
                      primary={formatNome(pergunta.texto)}
                      secondary={pergunta.ativo === false ? 'Desativada' : undefined}
                    />
                  </ListItem>
                ))}
              </List>
            </>
          )}

          {abaAtiva === 3 && (
            <>
              <Box display="grid" gap={2} gridTemplateColumns="repeat(auto-fit, minmax(220px, 1fr))">
                <TextField
                  label="Nome"
                  value={novoMotivo.nome}
                  onChange={(event) => {
                    const normalized = event.target.value.toLowerCase().charAt(0).toUpperCase() + event.target.value.toLowerCase().slice(1);
                    setNovoMotivo((prev) => ({ ...prev, nome: normalized }));
                  }}
                  size="small"
                />
                <TextField
                  label="Descrição"
                  value={novoMotivo.descricao}
                  onChange={(event) => {
                    const normalized = event.target.value.toLowerCase().charAt(0).toUpperCase() + event.target.value.toLowerCase().slice(1);
                    setNovoMotivo((prev) => ({ ...prev, descricao: normalized }));
                  }}
                  size="small"
                />
                <Box display="flex" alignItems="center">
                  <Button variant="contained" onClick={() => void criarMotivo()}>
                    Adicionar motivo
                  </Button>
                </Box>
              </Box>
              <List dense>
                {motivosFiltrados.map((motivo) => (
                  <ListItem
                    key={motivo.id}
                    secondaryAction={
                      <Box display="flex" alignItems="center" gap={0.5}>
                        {canEdit(permissoes, 'gestao-sistema') && (
                          <Tooltip title="Editar motivo" arrow>
                            <IconButton
                              edge="end"
                              aria-label="Editar motivo"
                              onClick={() => abrirEdicao('motivo', motivo)}
                            >
                              <EditIcon fontSize="small" />
                            </IconButton>
                          </Tooltip>
                        )}
                        {canExcluir(permissoes, 'gestao-sistema') && (
                          <Tooltip title="Excluir motivo" arrow>
                            <IconButton
                              edge="end"
                              aria-label="Excluir motivo"
                              color="error"
                              onClick={() => abrirConfirmacao('excluir', 'motivo', motivo.id, motivo.nome)}
                            >
                              <DeleteIcon fontSize="small" />
                            </IconButton>
                          </Tooltip>
                        )}
                      </Box>
                    }
                  >
                    <ListItemText
                      primary={formatNome(motivo.nome)}
                      secondary={motivo.descricao || undefined}
                    />
                  </ListItem>
                ))}
              </List>
            </>
          )}

          {abaAtiva === 4 && (
            <>
              <Box display="grid" gap={2} gridTemplateColumns="repeat(auto-fit, minmax(220px, 1fr))">
                <TextField
                  label="Nome"
                  value={novaRestricao.nome}
                  onChange={(event) => {
                    const normalized = event.target.value.toLowerCase().charAt(0).toUpperCase() + event.target.value.toLowerCase().slice(1);
                    setNovaRestricao((prev) => ({ ...prev, nome: normalized }));
                  }}
                  size="small"
                />
                <TextField
                  label="Descrição"
                  value={novaRestricao.descricao}
                  onChange={(event) => {
                    const normalized = event.target.value.toLowerCase().charAt(0).toUpperCase() + event.target.value.toLowerCase().slice(1);
                    setNovaRestricao((prev) => ({ ...prev, descricao: normalized }));
                  }}
                  size="small"
                />
                <Box display="flex" alignItems="center">
                  <Button variant="contained" onClick={() => void criarRestricao()}>
                    Adicionar restrição
                  </Button>
                </Box>
              </Box>
              <List dense>
                {restricoesFiltradas.map((restricao) => (
                  <ListItem
                    key={restricao.id}
                    secondaryAction={
                      <Box display="flex" alignItems="center" gap={0.5}>
                        {canEdit(permissoes, 'gestao-sistema') && (
                          <Tooltip title="Editar restrição" arrow>
                            <IconButton
                              edge="end"
                              aria-label="Editar restrição"
                              onClick={() => abrirEdicao('restricao', restricao)}
                            >
                              <EditIcon fontSize="small" />
                            </IconButton>
                          </Tooltip>
                        )}
                        {canExcluir(permissoes, 'gestao-sistema') && (
                          <Tooltip title="Excluir restrição" arrow>
                            <IconButton
                              edge="end"
                              aria-label="Excluir restrição"
                              color="error"
                              onClick={() => abrirConfirmacao('excluir', 'restricao', restricao.id, restricao.nome)}
                            >
                              <DeleteIcon fontSize="small" />
                            </IconButton>
                          </Tooltip>
                        )}
                      </Box>
                    }
                  >
                    <ListItemText
                      primary={restricao.nome}
                      secondary={restricao.descricao || undefined}
                    />
                  </ListItem>
                ))}
              </List>
            </>
          )}

          {abaAtiva === 5 && (
            <>
              <Box display="grid" gap={2} gridTemplateColumns="repeat(auto-fit, minmax(220px, 1fr))">
                <TextField
                  label="Nome"
                  value={novaRestricaoServico.nome}
                  onChange={(event) => {
                    const normalized = event.target.value.toLowerCase().charAt(0).toUpperCase() + event.target.value.toLowerCase().slice(1);
                    setNovaRestricaoServico((prev) => ({ ...prev, nome: normalized }));
                  }}
                  size="small"
                />
                <TextField
                  label="Descrição"
                  value={novaRestricaoServico.descricao}
                  onChange={(event) => {
                    const normalized = event.target.value.toLowerCase().charAt(0).toUpperCase() + event.target.value.toLowerCase().slice(1);
                    setNovaRestricaoServico((prev) => ({ ...prev, descricao: normalized }));
                  }}
                  size="small"
                />
                <Box display="flex" alignItems="center">
                  <Button variant="contained" onClick={() => void criarRestricaoServico()}>
                    Adicionar restrição de serviço
                  </Button>
                </Box>
              </Box>
              <List dense>
                {restricoesServicoFiltradas.map((restricao) => (
                  <ListItem
                    key={restricao.id}
                    secondaryAction={
                      <Box display="flex" alignItems="center" gap={0.5}>
                        {canEdit(permissoes, 'gestao-sistema') && (
                          <Tooltip title="Editar restrição de serviço" arrow>
                            <IconButton
                              edge="end"
                              aria-label="Editar restrição de serviço"
                              onClick={() => abrirEdicao('restricao-servico', restricao as any)}
                            >
                              <EditIcon fontSize="small" />
                            </IconButton>
                          </Tooltip>
                        )}
                        {canExcluir(permissoes, 'gestao-sistema') && (
                          <Tooltip title="Excluir restrição de serviço" arrow>
                            <IconButton
                              edge="end"
                              aria-label="Excluir restrição de serviço"
                              color="error"
                              onClick={() => abrirConfirmacao('excluir', 'restricao-servico', restricao.id, restricao.nome)}
                            >
                              <DeleteIcon fontSize="small" />
                            </IconButton>
                          </Tooltip>
                        )}
                      </Box>
                    }
                  >
                    <ListItemText
                      primary={formatNome(restricao.nome)}
                      secondary={restricao.descricao || undefined}
                    />
                  </ListItem>
                ))}
              </List>
            </>
          )}

          {abaAtiva === 6 && (
            <>
              <Box display="grid" gap={2} gridTemplateColumns="repeat(auto-fit, minmax(220px, 1fr))">
                <TextField
                  label="Nome"
                  value={novoStatus.nome}
                  onChange={(event) => {
                    const normalized = event.target.value.toLowerCase().charAt(0).toUpperCase() + event.target.value.toLowerCase().slice(1);
                    setNovoStatus((prev) => ({ ...prev, nome: normalized }));
                  }}
                  size="small"
                />
                <TextField
                  label="Descrição"
                  value={novoStatus.descricao}
                  onChange={(event) => {
                    const normalized = event.target.value.toLowerCase().charAt(0).toUpperCase() + event.target.value.toLowerCase().slice(1);
                    setNovoStatus((prev) => ({ ...prev, descricao: normalized }));
                  }}
                  size="small"
                />
                <Box display="flex" alignItems="center">
                  <Button variant="contained" onClick={() => void criarStatus()}>
                    Adicionar status
                  </Button>
                </Box>
              </Box>
              <List dense>
                {statusFiltrados.map((statusItem) => {
                  const isDesativado = statusItem.nome.toUpperCase() === 'DESATIVADO';
                  return (
                    <ListItem
                      key={statusItem.id}
                      secondaryAction={
                        <Box display="flex" alignItems="center" gap={0.5}>
                          {canEdit(permissoes, 'gestao-sistema') && !isDesativado && (
                            <Tooltip title="Editar status" arrow>
                              <IconButton
                                edge="end"
                                aria-label="Editar status"
                                onClick={() => abrirEdicao('status', statusItem)}
                              >
                                <EditIcon fontSize="small" />
                              </IconButton>
                            </Tooltip>
                          )}
                          {canExcluir(permissoes, 'gestao-sistema') && !isDesativado && (
                            <Tooltip title="Excluir status" arrow>
                              <IconButton
                                edge="end"
                                aria-label="Excluir status"
                                color="error"
                                onClick={() => abrirConfirmacao('excluir', 'status', statusItem.id, statusItem.nome)}
                              >
                                <DeleteIcon fontSize="small" />
                              </IconButton>
                            </Tooltip>
                          )}
                        </Box>
                      }
                    >
                      <ListItemText
                        primary={formatNome(statusItem.nome)}
                        secondary={statusItem.descricao || undefined}
                      />
                    </ListItem>
                  );
                })}
              </List>
            </>
          )}
        </Box>
      </Paper>

      <Dialog open={confirmacaoAberta} onClose={fecharConfirmacao} fullWidth maxWidth="xs">
        <DialogTitle component="div">
          <Typography component="div" variant="h6" fontWeight={600}>
            Confirmar exclusão
          </Typography>
        </DialogTitle>
        <DialogContent>
          <Typography component="div" variant="body2" color="text.secondary">
            {confirmacaoTipo === 'desativar'
              ? `Deseja desativar ${itemSelecionado?.label ?? 'o item selecionado'}?`
              : `Deseja excluir ${itemSelecionado?.label ?? 'o item selecionado'}?`}
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button variant="outlined" onClick={fecharConfirmacao}>
            Cancelar
          </Button>
          <Button
            variant="contained"
            color={confirmacaoTipo === 'desativar' ? 'warning' : 'error'}
            onClick={() => void confirmarRemocao()}
          >
            {confirmacaoTipo === 'desativar' ? 'Desativar' : 'Confirmar'}
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={edicaoAberta} onClose={fecharEdicao} fullWidth maxWidth="sm">
        <DialogTitle component="div">
          <Typography component="div" variant="h6" fontWeight={600}>
            {edicaoTipo === 'equipe' && 'Editar equipe'}
            {edicaoTipo === 'funcao' && 'Editar função'}
            {edicaoTipo === 'pergunta' && 'Editar pergunta'}
            {edicaoTipo === 'motivo' && 'Editar motivo'}
            {edicaoTipo === 'restricao' && 'Editar tipo de restrição'}
            {edicaoTipo === 'restricao-servico' && 'Editar restrição de serviço'}
            {edicaoTipo === 'status' && 'Editar status'}
          </Typography>
        </DialogTitle>
        <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 2 }}>
          {edicaoTipo === 'equipe' && (
            <>
              <TextField
                label="Nome"
                value={edicaoEquipe.nome}
                onChange={(event) => {
                  const normalized = event.target.value.toLowerCase().charAt(0).toUpperCase() + event.target.value.toLowerCase().slice(1);
                  setEdicaoEquipe((prev) => ({ ...prev, nome: normalized }));
                }}
                size="small"
              />
              <TextField
                label="Descrição"
                value={edicaoEquipe.descricao}
                onChange={(event) => {
                  const normalized = event.target.value.toLowerCase().charAt(0).toUpperCase() + event.target.value.toLowerCase().slice(1);
                  setEdicaoEquipe((prev) => ({ ...prev, descricao: normalized }));
                }}
                size="small"
              />
            </>
          )}
          {edicaoTipo === 'funcao' && (
            <>
              <TextField
                label="Nome"
                value={edicaoFuncao.nome}
                onChange={(event) => {
                  const normalized = event.target.value.toLowerCase().charAt(0).toUpperCase() + event.target.value.toLowerCase().slice(1);
                  setEdicaoFuncao((prev) => ({ ...prev, nome: normalized }));
                }}
                size="small"
                fullWidth
                InputLabelProps={{ shrink: true }}
                sx={{ mt: 1.5 }}
              />
              <TextField
                label="Descrição"
                value={edicaoFuncao.descricao}
                onChange={(event) => {
                  const normalized = event.target.value.toLowerCase().charAt(0).toUpperCase() + event.target.value.toLowerCase().slice(1);
                  setEdicaoFuncao((prev) => ({ ...prev, descricao: normalized }));
                }}
                size="small"
                fullWidth
                InputLabelProps={{ shrink: true }}
              />
              <FormControl size="small" fullWidth>
                <InputLabel id="edicao-funcao-horario-label">Horário de trabalho</InputLabel>
                <Select
                  labelId="edicao-funcao-horario-label"
                  label="Horário de trabalho"
                  value={edicaoFuncao.horarioTrabalho}
                  onChange={(e) =>
                    setEdicaoFuncao((prev) => ({
                      ...prev,
                      horarioTrabalho: e.target.value as HorarioTrabalhoFuncaoUI,
                    }))
                  }
                >
                  {(Object.keys(HORARIO_TRABALHO_FUNCAO_LABEL) as HorarioTrabalhoFuncaoUI[]).map((k) => (
                    <MenuItem key={k} value={k}>
                      {HORARIO_TRABALHO_FUNCAO_LABEL[k]}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </>
          )}
          {edicaoTipo === 'pergunta' && (
            <TextField
              label="Pergunta"
              value={edicaoPergunta}
              onChange={(event) => {
                const normalized = event.target.value.toLowerCase().charAt(0).toUpperCase() + event.target.value.toLowerCase().slice(1);
                setEdicaoPergunta(normalized);
              }}
              onKeyDown={(e) => handleKeyDownNormalized(e as React.KeyboardEvent<HTMLInputElement | HTMLTextAreaElement>)}
              size="small"
            />
          )}
          {edicaoTipo === 'motivo' && (
            <>
              <TextField
                label="Nome"
                value={edicaoMotivo.nome}
                onChange={(event) => {
                  const normalized = event.target.value.toLowerCase().charAt(0).toUpperCase() + event.target.value.toLowerCase().slice(1);
                  setEdicaoMotivo((prev) => ({ ...prev, nome: normalized }));
                }}
                size="small"
              />
              <TextField
                label="Descrição"
                value={edicaoMotivo.descricao}
                onChange={(event) => {
                  const normalized = event.target.value.toLowerCase().charAt(0).toUpperCase() + event.target.value.toLowerCase().slice(1);
                  setEdicaoMotivo((prev) => ({ ...prev, descricao: normalized }));
                }}
                size="small"
              />
            </>
          )}
          {edicaoTipo === 'restricao' && (
            <>
              <TextField
                label="Nome"
                value={edicaoRestricao.nome}
                onChange={(event) => {
                  const normalized = event.target.value.toLowerCase().charAt(0).toUpperCase() + event.target.value.toLowerCase().slice(1);
                  setEdicaoRestricao((prev) => ({ ...prev, nome: normalized }));
                }}
                size="small"
              />
              <TextField
                label="Descrição"
                value={edicaoRestricao.descricao}
                onChange={(event) => {
                  const normalized = event.target.value.toLowerCase().charAt(0).toUpperCase() + event.target.value.toLowerCase().slice(1);
                  setEdicaoRestricao((prev) => ({ ...prev, descricao: normalized }));
                }}
                size="small"
              />
            </>
          )}
          {edicaoTipo === 'restricao-servico' && (
            <>
              <TextField
                label="Nome"
                value={edicaoRestricaoServico.nome}
                onChange={(event) => {
                  const normalized = event.target.value.toLowerCase().charAt(0).toUpperCase() + event.target.value.toLowerCase().slice(1);
                  setEdicaoRestricaoServico((prev) => ({ ...prev, nome: normalized }));
                }}
                size="small"
              />
              <TextField
                label="Descrição"
                value={edicaoRestricaoServico.descricao}
                onChange={(event) => {
                  const normalized = event.target.value.toLowerCase().charAt(0).toUpperCase() + event.target.value.toLowerCase().slice(1);
                  setEdicaoRestricaoServico((prev) => ({ ...prev, descricao: normalized }));
                }}
                size="small"
              />
            </>
          )}
          {edicaoTipo === 'status' && (
            <>
              <TextField
                label="Nome"
                value={edicaoStatus.nome}
                onChange={(event) => {
                  const normalized = event.target.value.toLowerCase().charAt(0).toUpperCase() + event.target.value.toLowerCase().slice(1);
                  setEdicaoStatus((prev) => ({ ...prev, nome: normalized }));
                }}
                size="small"
                disabled={edicaoStatus.nome.toUpperCase() === 'DESATIVADO'}
                helperText={edicaoStatus.nome.toUpperCase() === 'DESATIVADO' ? 'O status "Desativado" é automático do sistema e não pode ser editado.' : undefined}
              />
              <TextField
                label="Descrição"
                value={edicaoStatus.descricao}
                onChange={(event) => {
                  const normalized = event.target.value.toLowerCase().charAt(0).toUpperCase() + event.target.value.toLowerCase().slice(1);
                  setEdicaoStatus((prev) => ({ ...prev, descricao: normalized }));
                }}
                size="small"
                disabled={edicaoStatus.nome.toUpperCase() === 'DESATIVADO'}
              />
            </>
          )}
        </DialogContent>
        <DialogActions>
          <Button variant="outlined" onClick={fecharEdicao}>
            Cancelar
          </Button>
          <Button variant="contained" onClick={() => void salvarEdicao()}>
            Salvar
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
