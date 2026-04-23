import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { api } from '../../api';
import type {
  Policial,
  PolicialExtraido,
  PolicialBulkItem,
  Equipe,
  EquipeOption,
  FuncaoOption,
  PolicialStatus,
  ProcessFileResponse,
  Usuario,
} from '../../types';
import {
  POLICIAL_STATUS_OPTIONS,
  POLICIAL_STATUS_OPTIONS_FORM,
  formatEquipeLabel,
  funcaoEquipeObrigatoriaNoFormulario,
  funcaoOcultaCampoEquipe,
  funcaoRequerFase12x36Expediente,
  funcoesParaSelecao,
  resolveEquipeParaPolicial,
} from '../../constants';
import { formatNome, formatMatricula } from '../../utils/dateUtils';
import { sortPorPatenteENome } from '../../utils/sortPoliciais';
import { maskCpf, cpfToDigits, validarCpf, maskTelefone, telefoneToDigits } from '../../utils/inputUtils';
import type { PermissoesPorTela } from '../../utils/permissions';
import type { ConfirmConfig } from '../common/ConfirmDialog';
import {
  Box,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Checkbox,
  Button,
  Typography,
} from '@mui/material';

const formFieldSx = {
  '& .MuiOutlinedInput-root': {
    borderRadius: '8px',
    fontSize: '0.95rem',
    '& fieldset': { borderColor: 'var(--border-soft)' },
    '&:hover fieldset': { borderColor: 'var(--border-soft)' },
    '&.Mui-focused fieldset': {
      borderColor: 'var(--accent-muted)',
      boxShadow: '0 0 0 3px rgba(107, 155, 196, 0.2)',
    },
    '& input, & textarea': { padding: '10px 12px' },
  },
};

/** Na importação em lote: não aplicar equipe em massa (motorista continua fora do lote). */
function policialModalSemColunaEquipe(
  p: { funcaoId?: number; funcaoNome?: string },
  funcoes: FuncaoOption[],
): boolean {
  if (p.funcaoId) {
    const f = funcoes.find((x) => x.id === p.funcaoId);
    if (f) {
      if (funcaoOcultaCampoEquipe(f)) return true;
      if (f.nome.toUpperCase().includes('MOTORISTA DE DIA')) return true;
    }
  }
  const u = (p.funcaoNome ?? '').toUpperCase();
  return (
    u.includes('EXPEDIENTE') ||
    u.includes('CMT UPM') ||
    u.includes('SUBCMT UPM') ||
    u.includes('MOTORISTA DE DIA')
  );
}

function policialModalMetaFuncao(
  p: { funcaoId?: number; funcaoNome?: string },
  funcoes: FuncaoOption[],
): Pick<FuncaoOption, 'nome' | 'vinculoEquipe'> | undefined {
  if (p.funcaoId) {
    const f = funcoes.find((x) => x.id === p.funcaoId);
    if (f) return f;
  }
  if (p.funcaoNome?.trim()) {
    return { nome: p.funcaoNome, vinculoEquipe: undefined };
  }
  return undefined;
}

interface PoliciaisSectionProps {
  currentUser: Usuario;
  openConfirm: (config: ConfirmConfig) => void;
  onChanged?: () => void;
  permissoes?: PermissoesPorTela | null;
}

export function PoliciaisSection({
  currentUser,
  openConfirm,
  onChanged,
}: PoliciaisSectionProps) {
  const initialForm = {
    nome: '',
    matricula: '',
    cpf: '',
    telefone: '',
    dataNascimento: '',
    email: '',
    matriculaComissionadoGdf: '',
    dataPosse: '',
    status: 'ATIVO' as PolicialStatus,
    funcaoId: undefined as number | undefined,
    equipe: undefined as Equipe | undefined,
    expediente12x36Fase: undefined as 'PAR' | 'IMPAR' | undefined,
  };
  const [policiais, setPoliciais] = useState<Policial[]>([]);
  const [funcoes, setFuncoes] = useState<FuncaoOption[]>([]);
  const [equipes, setEquipes] = useState<EquipeOption[]>([]);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [form, setForm] = useState(initialForm);
  const [matriculaError, setMatriculaError] = useState<string | null>(null);
  const [funcaoError, setFuncaoError] = useState<string | null>(null);
  const [cpfError, setCpfError] = useState<string | null>(null);
  const [emailError, setEmailError] = useState<string | null>(null);
  const [telefoneError, setTelefoneError] = useState<string | null>(null);
  const matriculaTimeoutRef = useRef<number | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [reativarModal, setReativarModal] = useState<{
    open: boolean;
    policial: Policial | null;
    loading: boolean;
  }>({
    open: false,
    policial: null,
    loading: false,
  });
  const [validacaoModal, setValidacaoModal] = useState<{
    open: boolean;
    policiais: Array<PolicialExtraido & { status: PolicialStatus; equipe?: Equipe; jaCadastrado?: boolean }>;
    loading: boolean;
    funcoesCriadas: string[];
  }>({
    open: false,
    policiais: [],
    loading: false,
    funcoesCriadas: [],
  });

  const carregarPoliciais = useCallback(async () => {
    try {
      setLoading(true);
      const data = await api.listPoliciais();
      setPoliciais(data);
    } catch (err) {
      // Silenciosamente falha, não precisa mostrar erro aqui
    } finally {
      setLoading(false);
    }
  }, []);

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

  const funcoesAtivas = useMemo(() => {
    return funcoesParaSelecao(funcoes).filter((f) => f.ativo !== false);
  }, [funcoes]);

  // Ordenar funções alfabeticamente
  const funcoesOrdenadas = useMemo(() => {
    return [...funcoesAtivas].sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR', { sensitivity: 'base' }));
  }, [funcoesAtivas]);


  const validateMatricula = useCallback((matricula: string) => {
    // Se a lista ainda não foi carregada, não valida
    if (loading || (policiais.length === 0 && !error)) {
      return;
    }

    const matriculaTrimmed = matricula.trim().toUpperCase();
    if (!matriculaTrimmed) {
      setMatriculaError(null);
      return;
    }

    const matriculaExists = policiais.some(
      (policial) => policial.matricula.toUpperCase() === matriculaTrimmed,
    );

    if (matriculaExists) {
      setMatriculaError('Esta matrícula já está cadastrada no sistema. Não é possível cadastrar um policial com a mesma matrícula.');
    } else {
      setMatriculaError(null);
    }
  }, [policiais, loading, error]);

  const validateFuncao = useCallback((funcaoId: number | undefined) => {
    if (!funcaoId) {
      setFuncaoError(null);
      return;
    }

    // Se a lista ainda não foi carregada, não valida
    if (loading || (policiais.length === 0 && !error)) {
      return;
    }

    const funcaoSelecionada = funcoes.find(f => f.id === funcaoId);
    if (!funcaoSelecionada) {
      setFuncaoError(null);
      return;
    }

    const funcaoUpper = funcaoSelecionada.nome.toUpperCase();

    // CMT UPM / SUBCMT UPM: só pode haver um policial ATIVO com a mesma função
    if (funcaoUpper.includes('CMT UPM') || funcaoUpper.includes('SUBCMT UPM')) {
      if (form.status !== 'ATIVO') {
        setFuncaoError(null);
        return;
      }
      const jaExiste = policiais.some((policial) => {
        if (policial.status !== 'ATIVO') return false;
        if (!policial.funcao) return false;
        const policialFuncaoUpper = policial.funcao.nome.toUpperCase();
        return policialFuncaoUpper === funcaoUpper;
      });

      if (jaExiste) {
        setFuncaoError(
          `Já existe um policial ativo com a função "${funcaoSelecionada.nome}". Só pode haver um policial ativo nesta função.`,
        );
      } else {
        setFuncaoError(null);
      }
    } else {
      setFuncaoError(null);
    }
  }, [policiais, funcoes, loading, error, form.status]);

  useEffect(() => {
    void carregarPoliciais();
    void carregarFuncoes();
    void carregarEquipes();
  }, [carregarPoliciais, carregarFuncoes, carregarEquipes]);

  const equipesAtivas = useMemo(() => {
    return [...equipes]
      .filter((e) => e.ativo)
      .sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR', { sensitivity: 'base' }));
  }, [equipes]);

  const equipesDisponiveisCadastro = useMemo(() => {
    return equipesAtivas.filter((e) => e.nome !== 'SEM_EQUIPE');
  }, [equipesAtivas]);

  // Revalidar matrícula quando a lista de policiais for atualizada
  useEffect(() => {
    if (form.matricula.trim() && !loading) {
      validateMatricula(form.matricula);
    }
  }, [policiais, form.matricula, validateMatricula, loading]);

  // Revalidar função quando a lista de policiais for atualizada
  useEffect(() => {
    if (form.funcaoId && !loading) {
      validateFuncao(form.funcaoId);
    }
  }, [policiais, form.funcaoId, form.status, validateFuncao, loading]);

  // Limpar timeout ao desmontar o componente
  useEffect(() => {
    return () => {
      if (matriculaTimeoutRef.current) {
        clearTimeout(matriculaTimeoutRef.current);
      }
    };
  }, []);

  const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      const fileName = file.name.toLowerCase();
      // Validar se é um arquivo XLSX ou PDF
      if (!fileName.endsWith('.xlsx') && !fileName.endsWith('.xls') && !fileName.endsWith('.pdf')) {
        setError('Por favor, selecione um arquivo Excel (.xlsx, .xls) ou PDF (.pdf).');
        // Limpar o input
        if (fileInputRef.current) {
          fileInputRef.current.value = '';
        }
        return;
      }
      
      try {
        setError(null);
        setSubmitting(true);
        
        // Enviar arquivo para o backend
        const response: ProcessFileResponse = await api.uploadFile(file);
        
        // Preparar dados para validação (status vindo do PDF/Excel ou padrão ATIVO; jaCadastrado vindo da API)
        const policiaisComStatus = response.policiais.map((policial) => ({
          ...policial,
          status: (policial.status ?? 'ATIVO') as PolicialStatus,
          equipe: undefined as Equipe | undefined,
          jaCadastrado: policial.jaCadastrado ?? false,
        }));
        
        // Abrir modal de validação (ordenado por patente e nome)
        setValidacaoModal({
          open: true,
          policiais: sortPorPatenteENome(policiaisComStatus),
          loading: false,
          funcoesCriadas: response.funcoesCriadas || [],
        });
      } catch (err) {
        setError(
          err instanceof Error
            ? err.message
            : 'Não foi possível processar o arquivo. Verifique se o formato está correto.',
        );
      } finally {
        setSubmitting(false);
        // Limpar o input
        if (fileInputRef.current) {
          fileInputRef.current.value = '';
        }
      }
    }
  };

  const handleFileButtonClick = () => {
    fileInputRef.current?.click();
  };

  // Função que realiza o cadastro do policial
  const submeterCadastro = useCallback(async () => {
    const nome = form.nome.trim();
    const matricula = form.matricula.trim();

    try {
      setSubmitting(true);
      setError(null);
      
      const funcaoSelecionada = form.funcaoId ? funcoes.find((f) => f.id === form.funcaoId) : undefined;
      const equipeFinal = resolveEquipeParaPolicial(funcaoSelecionada, form.equipe, currentUser.equipe);
      
      const cpfDigits = cpfToDigits(form.cpf);
      const telefoneDigits = telefoneToDigits(form.telefone);
      const cpfEnvio = cpfDigits.length === 11 ? cpfDigits : undefined;
      const telefoneEnvio = telefoneDigits.length === 11 ? telefoneDigits : undefined;
      const dataNascimentoEnvio = form.dataNascimento.trim() || undefined;
      const emailEnvio = form.email.trim() || undefined;

      await api.createPolicial({
        nome,
        matricula,
        status: form.status,
        funcaoId: form.funcaoId!,
        cpf: cpfEnvio ?? null,
        telefone: telefoneEnvio ?? null,
        dataNascimento: dataNascimentoEnvio ?? null,
        email: emailEnvio ?? null,
        matriculaComissionadoGdf: form.status === 'COMISSIONADO' && form.matriculaComissionadoGdf.trim() ? form.matriculaComissionadoGdf.trim() : null,
        dataPosse: form.status === 'COMISSIONADO' && form.dataPosse ? form.dataPosse : null,
        equipe: equipeFinal === null ? null : (equipeFinal || undefined),
        ...(funcaoRequerFase12x36Expediente(funcaoSelecionada) && form.expediente12x36Fase
          ? { expediente12x36Fase: form.expediente12x36Fase }
          : {}),
      });
      setSuccess('Policial cadastrado com sucesso.');

      setForm(initialForm);
      setMatriculaError(null);
      setCpfError(null);
      setEmailError(null);
      setTelefoneError(null);
      if (matriculaTimeoutRef.current) {
        clearTimeout(matriculaTimeoutRef.current);
        matriculaTimeoutRef.current = null;
      }
      await carregarPoliciais();
      onChanged?.();
    } catch (err) {
      // Verificar se é erro de policial desativado
      let errorData: unknown = null;
      
      if (err instanceof Error && 'data' in err) {
        errorData = (err as Error & { data: unknown }).data;
      } else if (err instanceof Error) {
        // Tentar fazer parse da mensagem caso o erro venha como string JSON
        try {
          errorData = JSON.parse(err.message);
        } catch {
          // Não é JSON, usar mensagem direta
        }
      }

      if (
        errorData &&
        typeof errorData === 'object' &&
        errorData !== null &&
        'message' in errorData &&
        errorData.message === 'POLICIAL_DESATIVADO' &&
        'policial' in errorData
      ) {
        // Mostrar modal de reativação
        setReativarModal({
          open: true,
          policial: errorData.policial as Policial,
          loading: false,
        });
        setSubmitting(false);
        return;
      }
      
      // Tratar erro de matrícula duplicada do backend
      let errorMessage = err instanceof Error ? err.message : 'Não foi possível cadastrar o policial.';
      
      // Verificar se é erro de matrícula já cadastrada
      if (errorMessage.toLowerCase().includes('matrícula') || errorMessage.toLowerCase().includes('matricula')) {
        setMatriculaError(errorMessage);
      }
      
      setError(errorMessage);
    } finally {
      setSubmitting(false);
    }
  }, [form, funcoes, currentUser, carregarPoliciais, onChanged]);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    setSuccess(null);
    setCpfError(null);
    setEmailError(null);
    setTelefoneError(null);

    const nome = form.nome.trim();
    const matricula = form.matricula.trim();

    if (!nome || !matricula) {
      setError('Informe nome e matrícula.');
      return;
    }
    if (!form.funcaoId) {
      setError('Selecione uma função.');
      return;
    }

    const funcaoParaEquipe = funcoes.find((f) => f.id === form.funcaoId);
    if (funcaoEquipeObrigatoriaNoFormulario(funcaoParaEquipe) && !form.equipe) {
      setError('Selecione uma equipe.');
      return;
    }

    const cpfDigits = cpfToDigits(form.cpf);
    if (cpfDigits.length > 0 && cpfDigits.length !== 11) {
      setCpfError('CPF deve conter 11 dígitos.');
      setError('CPF deve conter 11 dígitos.');
      return;
    }
    if (cpfDigits.length === 11 && !validarCpf(form.cpf)) {
      setCpfError('CPF inválido (dígitos verificadores incorretos).');
      setError('CPF inválido (dígitos verificadores incorretos).');
      return;
    }

    const telefoneDigits = telefoneToDigits(form.telefone);
    if (telefoneDigits.length > 0 && telefoneDigits.length !== 11) {
      setTelefoneError('Telefone deve conter 11 dígitos.');
      setError('Telefone deve conter 11 dígitos.');
      return;
    }

    const emailTrim = form.email.trim();
    if (emailTrim && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailTrim)) {
      setEmailError('E-mail inválido.');
      setError('E-mail inválido.');
      return;
    }

    // Validar matrícula antes de submeter - bloquear cadastro se já existir
    const matriculaTrimmed = matricula.trim().toUpperCase();
    const matriculaExists = policiais.some(
      (policial) => policial.matricula.toUpperCase() === matriculaTrimmed,
    );
    if (matriculaExists) {
      setMatriculaError('Esta matrícula já está cadastrada no sistema. Não é possível cadastrar um policial com a mesma matrícula.');
      setError('Esta matrícula já está cadastrada no sistema. Não é possível cadastrar um policial com a mesma matrícula.');
      return;
    }

    // CMT UPM / SUBCMT UPM: no máximo um policial ATIVO com a mesma função
    if (form.funcaoId && form.status === 'ATIVO') {
      const funcaoSelecionada = funcoes.find(f => f.id === form.funcaoId);
      if (funcaoSelecionada) {
        const funcaoUpper = funcaoSelecionada.nome.toUpperCase();
        if (funcaoUpper.includes('CMT UPM') || funcaoUpper.includes('SUBCMT UPM')) {
          const jaExiste = policiais.some((policial) => {
            if (policial.status !== 'ATIVO') return false;
            if (!policial.funcao) return false;
            const policialFuncaoUpper = policial.funcao.nome.toUpperCase();
            return policialFuncaoUpper === funcaoUpper;
          });

          if (jaExiste) {
            const msg = `Já existe um policial ativo com a função "${funcaoSelecionada.nome}". Só pode haver um policial ativo nesta função.`;
            setFuncaoError(msg);
            setError(msg);
            return;
          }
        }
      }
    }

    // Montar mensagem de confirmação
    const funcaoSelecionada = form.funcaoId ? funcoes.find(f => f.id === form.funcaoId) : null;
    if (funcaoRequerFase12x36Expediente(funcaoSelecionada ?? undefined) && !form.expediente12x36Fase) {
      setError('Selecione a fase da semana (par ou ímpar) para esta função no expediente 12×36.');
      return;
    }
    const funcaoNome = funcaoSelecionada ? formatNome(funcaoSelecionada.nome) : '—';
    const statusLabel = POLICIAL_STATUS_OPTIONS.find(s => s.value === form.status)?.label || form.status;

    const equipeFinal = resolveEquipeParaPolicial(
      funcaoSelecionada ?? undefined,
      form.equipe,
      currentUser.equipe,
    );
    const equipeFinalLabel = equipeFinal ? formatEquipeLabel(equipeFinal) : '—';

    const cpfExibir = form.cpf ? form.cpf : '—';
    const telefoneExibir = form.telefone ? form.telefone : '—';
    const dataNascExibir = form.dataNascimento ? new Date(form.dataNascimento + 'T12:00:00').toLocaleDateString('pt-BR') : '—';
    const emailExibir = form.email.trim() || '—';

    const message =
      `Confirme os dados do policial:\n\n` +
      `Nome: ${nome}\n` +
      `Matrícula: ${matricula}\n` +
      (cpfExibir !== '—' ? `CPF: ${cpfExibir}\n` : '') +
      (telefoneExibir !== '—' ? `Telefone: ${telefoneExibir}\n` : '') +
      (dataNascExibir !== '—' ? `Data de nascimento: ${dataNascExibir}\n` : '') +
      (emailExibir !== '—' ? `E-mail: ${emailExibir}\n` : '') +
      (form.status === 'COMISSIONADO' && form.matriculaComissionadoGdf.trim() ? `Matrícula Comissionado (GDF): ${form.matriculaComissionadoGdf.trim()}\n` : '') +
      (form.status === 'COMISSIONADO' && form.dataPosse ? `Data de posse: ${new Date(form.dataPosse + 'T12:00:00').toLocaleDateString('pt-BR')}\n` : '') +
      `Status: ${statusLabel}\n` +
      `Função: ${funcaoNome}\n` +
      `Equipe: ${equipeFinalLabel}`;

    openConfirm({
      title: 'Confirmar cadastro de policial',
      message,
      confirmLabel: 'Cadastrar policial',
      onConfirm: async () => {
        await submeterCadastro();
      },
    });
  };

  const handleCloseReativarModal = () => {
    setReativarModal({
      open: false,
      policial: null,
      loading: false,
    });
  };

  const handleCloseValidacaoModal = () => {
    setValidacaoModal({
      open: false,
      policiais: [],
      loading: false,
      funcoesCriadas: [],
    });
  };

  const handleConfirmValidacao = async () => {
    const aSalvar = validacaoModal.policiais.filter((p) => !p.jaCadastrado);
    if (aSalvar.length === 0 || validacaoModal.loading) {
      return;
    }
    const semFuncao = aSalvar.filter((p) => !p.funcaoId);
    if (semFuncao.length > 0) {
      setError('Selecione uma função para todos os policiais a cadastrar.');
      return;
    }

    const semEquipeObrigatoria = aSalvar.filter((p) => {
      const meta = policialModalMetaFuncao(p, funcoes);
      return meta && funcaoEquipeObrigatoriaNoFormulario(meta as FuncaoOption) && !p.equipe;
    });
    if (semEquipeObrigatoria.length > 0) {
      setError(
        'Há policial(is) com função que exige equipe sem equipe informada. Preencha a coluna Equipe ou ajuste a função.',
      );
      return;
    }

    try {
      setValidacaoModal((prev) => ({ ...prev, loading: true }));
      setError(null);
      setSuccess(null);

      const policiaisBulk: PolicialBulkItem[] = aSalvar.map((policial) => ({
        matricula: policial.matricula,
        nome: policial.nome,
        status: policial.status,
        funcaoId: policial.funcaoId,
        equipe: policial.equipe,
      }));

      const response = await api.createPoliciaisBulk({ policiais: policiaisBulk });

      // Mostrar resultado
      if (response.erros.length > 0) {
        const errosMsg = response.erros.map((e) => `Matrícula ${e.matricula}: ${e.erro}`).join('\n');
        setError(`${response.criados} policial(es) criado(s). Erros:\n${errosMsg}`);
      } else {
        setSuccess(`${response.criados} policial(is) criado(s) com sucesso.`);
      }

      handleCloseValidacaoModal();
      await carregarPoliciais();
      onChanged?.();
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Não foi possível salvar os policiais.',
      );
      setValidacaoModal((prev) => ({ ...prev, loading: false }));
    }
  };

  const handleConfirmReativar = async () => {
    if (!reativarModal.policial) {
      return;
    }

    try {
      setReativarModal((prev) => ({ ...prev, loading: true }));
      setError(null);
      
      // Reativar o policial
      await api.activatePolicial(reativarModal.policial.id);
      
      const funcaoSelecionada = form.funcaoId ? funcoes.find((f) => f.id === form.funcaoId) : undefined;
      const equipeFinalReativar = resolveEquipeParaPolicial(funcaoSelecionada, form.equipe, currentUser.equipe);
      
      // Atualizar os dados do policial reativado com os novos dados do formulário
      await api.updatePolicial(reativarModal.policial.id, {
        nome: form.nome.trim(),
        status: form.status,
        funcaoId: form.funcaoId,
        telefone: (() => {
          const digits = telefoneToDigits(form.telefone);
          return digits.length === 11 ? digits : null;
        })(),
        equipe: equipeFinalReativar === null ? null : (equipeFinalReativar || undefined),
        matriculaComissionadoGdf: form.status === 'COMISSIONADO' && form.matriculaComissionadoGdf.trim() ? form.matriculaComissionadoGdf.trim() : null,
        dataPosse: form.status === 'COMISSIONADO' && form.dataPosse ? form.dataPosse : null,
      });

      setSuccess('Policial reativado e atualizado com sucesso.');
      setForm(initialForm);
      setMatriculaError(null);
      if (matriculaTimeoutRef.current) {
        clearTimeout(matriculaTimeoutRef.current);
        matriculaTimeoutRef.current = null;
      }
      handleCloseReativarModal();
      await carregarPoliciais();
      onChanged?.();
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Não foi possível reativar o policial.',
      );
      setReativarModal((prev) => ({ ...prev, loading: false }));
    }
  };

  return (
    <section>
      <div className="section-header">
        <div>
          <h2>Cadastrar Policial</h2>
        </div>
        <div>
          <input
            ref={fileInputRef}
            type="file"
            accept=".xlsx,.xls,.pdf,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel,application/pdf"
            onChange={handleFileSelect}
            style={{ display: 'none' }}
          />
          <Button
            variant="outlined"
            onClick={handleFileButtonClick}
            sx={{ textTransform: 'none' }}
          >
            Cadastrar de PDF
          </Button>
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

      <Box
        component="form"
        onSubmit={handleSubmit}
        noValidate
        sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}
      >
        <Box sx={{ display: 'grid', gap: 2, gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' } }}>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.75 }}>
            <Typography component="label" htmlFor="nome-input" sx={{ fontSize: '0.9rem', color: 'text.secondary' }}>
              Nome
            </Typography>
            <TextField
              id="nome-input"
              fullWidth
              required
              size="small"
              variant="outlined"
              value={form.nome}
              onChange={(e) =>
                setForm((prev) => ({ ...prev, nome: e.target.value.toUpperCase() }))
              }
              placeholder="2º SGT JOÃO PEREIRA DA SILVA"
              sx={formFieldSx}
            />
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 1 }}>
              <Checkbox
                checked={form.status === 'COMISSIONADO'}
                onChange={(e) =>
                  setForm((prev) => ({
                    ...prev,
                    status: e.target.checked ? 'COMISSIONADO' : 'ATIVO',
                    ...(e.target.checked ? {} : { matriculaComissionadoGdf: '', dataPosse: '' }),
                  }))
                }
                size="small"
              />
              <Typography component="span" sx={{ fontSize: '0.95rem' }}>
                Comissionado
              </Typography>
            </Box>
          </Box>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.75 }}>
            <Typography component="label" htmlFor="matricula-input" sx={{ fontSize: '0.9rem', color: 'text.secondary' }}>
              Matrícula
            </Typography>
            <TextField
              id="matricula-input"
              fullWidth
              required
              size="small"
              variant="outlined"
              value={form.matricula}
              onChange={(e) => {
                const value = e.target.value.replace(/[^0-9xX]/g, '').toUpperCase();
                setForm((prev) => ({ ...prev, matricula: value }));
                if (matriculaTimeoutRef.current) clearTimeout(matriculaTimeoutRef.current);
                if (!value.trim()) {
                  setMatriculaError(null);
                  return;
                }
                matriculaTimeoutRef.current = setTimeout(() => validateMatricula(value), 300);
              }}
              placeholder="Matrícula"
              error={!!matriculaError}
              helperText={matriculaError}
              sx={formFieldSx}
            />
            {form.status === 'COMISSIONADO' && (
              <>
                <TextField
                  fullWidth
                  size="small"
                  variant="outlined"
                  label="Matrícula Comissionado (GDF)"
                  value={form.matriculaComissionadoGdf}
                  onChange={(e) =>
                    setForm((prev) => ({
                      ...prev,
                      matriculaComissionadoGdf: e.target.value.replace(/[^0-9xX]/g, '').toUpperCase(),
                    }))
                  }
                  placeholder="Matrícula Comissionado (GDF)"
                  sx={{ mt: 1, ...formFieldSx }}
                />
                <Box sx={{ mt: 1 }}>
                  <Typography component="label" htmlFor="data-posse-input" sx={{ fontSize: '0.9rem', color: 'text.secondary' }}>
                    Data de posse
                  </Typography>
                  <TextField
                    id="data-posse-input"
                    fullWidth
                    size="small"
                    variant="outlined"
                    type="date"
                    value={form.dataPosse}
                    onChange={(e) =>
                      setForm((prev) => ({ ...prev, dataPosse: e.target.value }))
                    }
                    InputLabelProps={{ shrink: true }}
                    sx={{ mt: 0.5, ...formFieldSx }}
                  />
                </Box>
              </>
            )}
          </Box>

          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.75 }}>
            <Typography component="label" htmlFor="cpf-input" sx={{ fontSize: '0.9rem', color: 'text.secondary' }}>
              CPF
            </Typography>
            <TextField
              id="cpf-input"
              fullWidth
              size="small"
              variant="outlined"
              value={form.cpf}
              onChange={(e) => {
                setForm((prev) => ({ ...prev, cpf: maskCpf(e.target.value) }));
                if (cpfError) setCpfError(null);
              }}
              onBlur={() => {
                const digits = cpfToDigits(form.cpf);
                if (digits.length === 11 && !validarCpf(form.cpf)) {
                  setCpfError('CPF inválido (dígitos verificadores incorretos).');
                } else if (digits.length > 0 && digits.length !== 11) {
                  setCpfError('CPF deve conter 11 dígitos.');
                } else {
                  setCpfError(null);
                }
              }}
              placeholder="000.000.000-00"
              inputProps={{ maxLength: 14 }}
              error={!!cpfError}
              helperText={cpfError}
              sx={formFieldSx}
            />
          </Box>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.75 }}>
            <Typography component="label" htmlFor="telefone-input" sx={{ fontSize: '0.9rem', color: 'text.secondary' }}>
              Telefone
            </Typography>
            <TextField
              id="telefone-input"
              fullWidth
              size="small"
              variant="outlined"
              value={form.telefone}
              onChange={(e) => {
                setForm((prev) => ({ ...prev, telefone: maskTelefone(e.target.value) }));
                if (telefoneError) setTelefoneError(null);
              }}
              onBlur={() => {
                const digits = telefoneToDigits(form.telefone);
                if (digits.length > 0 && digits.length !== 11) {
                  setTelefoneError('Telefone deve conter 11 dígitos.');
                } else {
                  setTelefoneError(null);
                }
              }}
              placeholder="(00)00000-0000"
              inputProps={{ maxLength: 14 }}
              error={!!telefoneError}
              helperText={telefoneError}
              sx={formFieldSx}
            />
          </Box>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.75 }}>
            <Typography component="label" htmlFor="data-nascimento-input" sx={{ fontSize: '0.9rem', color: 'text.secondary' }}>
              Data de nascimento
            </Typography>
            <TextField
              id="data-nascimento-input"
              fullWidth
              size="small"
              variant="outlined"
              type="date"
              value={form.dataNascimento}
              onChange={(e) =>
                setForm((prev) => ({ ...prev, dataNascimento: e.target.value }))
              }
              InputLabelProps={{ shrink: true }}
              sx={formFieldSx}
            />
          </Box>

          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.75 }}>
            <Typography component="label" htmlFor="email-input" sx={{ fontSize: '0.9rem', color: 'text.secondary' }}>
              E-mail
            </Typography>
            <TextField
              id="email-input"
              fullWidth
              size="small"
              variant="outlined"
              type="email"
              value={form.email}
              onChange={(e) => {
                setForm((prev) => ({ ...prev, email: e.target.value }));
                if (emailError) setEmailError(null);
              }}
              onBlur={() => {
                const v = form.email.trim();
                if (v && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)) {
                  setEmailError('E-mail inválido.');
                } else {
                  setEmailError(null);
                }
              }}
              placeholder="email@exemplo.com"
              error={!!emailError}
              helperText={emailError}
              sx={formFieldSx}
            />
          </Box>
          <Box />

          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.75 }}>
            <Typography component="label" htmlFor="funcao-select" sx={{ fontSize: '0.9rem', color: 'text.secondary' }}>
              Função
            </Typography>
            <FormControl fullWidth size="small" variant="outlined" error={!!funcaoError} sx={formFieldSx}>
              <Select
                id="funcao-select"
                value={form.funcaoId ?? ''}
                displayEmpty
                renderValue={(v) => {
                  if (!v) return 'Selecione uma função';
                  const f = funcoesOrdenadas.find((x) => x.id === v);
                  return f ? formatNome(f.nome) : 'Selecione uma função';
                }}
                onChange={(e) => {
                  const novoFuncaoId = e.target.value ? Number(e.target.value) : undefined;
                  const funcaoSelecionada = funcoes.find((f) => f.id === novoFuncaoId);
                  if (novoFuncaoId) validateFuncao(novoFuncaoId);
                  else setFuncaoError(null);
                  if (funcaoSelecionada) {
                    const isMotoristaDia = funcaoSelecionada.nome.toUpperCase().includes('MOTORISTA DE DIA');
                    const oculta = funcaoOcultaCampoEquipe(funcaoSelecionada);
                    const manterFase = funcaoRequerFase12x36Expediente(funcaoSelecionada);
                    setForm((prev) => ({
                      ...prev,
                      funcaoId: novoFuncaoId,
                      equipe: oculta ? undefined : isMotoristaDia && prev.equipe === 'E' ? undefined : prev.equipe,
                      expediente12x36Fase: manterFase ? prev.expediente12x36Fase : undefined,
                    }));
                  } else {
                    setForm((prev) => ({ ...prev, funcaoId: novoFuncaoId, expediente12x36Fase: undefined }));
                  }
                }}
                MenuProps={{ sx: { zIndex: 1500 } }}
              >
                <MenuItem value="">
                  <em>Selecione uma função</em>
                </MenuItem>
                {funcoesOrdenadas.map((funcao) => (
                  <MenuItem key={funcao.id} value={funcao.id}>
                    {formatNome(funcao.nome)}
                  </MenuItem>
                ))}
              </Select>
              {funcaoError && (
                <Typography variant="caption" sx={{ color: 'error.main', mt: 0.5, display: 'block' }}>
                  {funcaoError}
                </Typography>
              )}
            </FormControl>
          </Box>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.75 }}>
            <Typography component="label" htmlFor="status-select" sx={{ fontSize: '0.9rem', color: 'text.secondary' }}>
              Status
            </Typography>
            <FormControl fullWidth required size="small" variant="outlined" sx={formFieldSx}>
              <Select
                id="status-select"
                value={form.status}
                renderValue={(v) => POLICIAL_STATUS_OPTIONS_FORM.find((o) => o.value === v)?.label ?? v}
                onChange={(e) =>
                  setForm((prev) => ({
                    ...prev,
                    status: e.target.value as PolicialStatus,
                  }))
                }
                MenuProps={{ sx: { zIndex: 1500 } }}
              >
                {POLICIAL_STATUS_OPTIONS_FORM.map((option) => (
                  <MenuItem key={option.value} value={option.value}>
                    {option.label}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </Box>

          {(() => {
            const funcaoSelecionada = form.funcaoId ? funcoes.find((f) => f.id === form.funcaoId) : null;
            const mostrarEquipe = funcaoSelecionada ? !funcaoOcultaCampoEquipe(funcaoSelecionada) : false;
            const equipeObrigatoria = funcaoSelecionada ? funcaoEquipeObrigatoriaNoFormulario(funcaoSelecionada) : false;
            const isMotoristaDia = funcaoSelecionada?.nome.toUpperCase().includes('MOTORISTA DE DIA') ?? false;
            const equipesDisponiveis = (() => {
              let list =
                currentUser.nivel?.nome === 'OPERAÇÕES' && currentUser.equipe
                  ? equipesDisponiveisCadastro.filter((option) => option.nome === currentUser.equipe)
                  : equipesDisponiveisCadastro;
              if (isMotoristaDia) list = list.filter((option) => option.nome !== 'E');
              return list;
            })();

            if (!mostrarEquipe) return null;
            return (
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.75, gridColumn: { md: '1 / -1' } }}>
                <Typography component="label" htmlFor="equipe-select" sx={{ fontSize: '0.9rem', color: 'text.secondary' }}>
                  Equipe
                </Typography>
                <FormControl
                  fullWidth
                  required={equipeObrigatoria}
                  size="small"
                  variant="outlined"
                  sx={{ ...formFieldSx, maxWidth: { md: 400 } }}
                >
                  <Select
                    id="equipe-select"
                    value={form.equipe ?? ''}
                    displayEmpty
                    renderValue={(v) => {
                      if (!v) {
                        return equipeObrigatoria ? 'Selecione uma equipe' : 'Sem equipe (opcional)';
                      }
                      return formatNome(v);
                    }}
                    onChange={(e) =>
                      setForm((prev) => ({
                        ...prev,
                        equipe: e.target.value ? (e.target.value as Equipe) : undefined,
                      }))
                    }
                    MenuProps={{ sx: { zIndex: 1500 } }}
                  >
                    <MenuItem value="">
                      <em>Selecione uma equipe</em>
                    </MenuItem>
                    {equipesDisponiveis.map((option) => (
                      <MenuItem key={option.id} value={option.nome}>
                        {formatNome(option.nome)}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Box>
            );
          })()}
          {(() => {
            const funcaoSel = form.funcaoId ? funcoes.find((f) => f.id === form.funcaoId) : undefined;
            if (!funcaoRequerFase12x36Expediente(funcaoSel)) return null;
            return (
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.75, gridColumn: { md: '1 / -1' } }}>
                <FormControl
                  fullWidth
                  required
                  size="small"
                  variant="outlined"
                  sx={{ ...formFieldSx, maxWidth: { md: 400 } }}
                >
                  <InputLabel id="cad-policial-fase-12x36-label">Fase 12×36 (semana ISO)</InputLabel>
                  <Select
                    labelId="cad-policial-fase-12x36-label"
                    label="Fase 12×36 (semana ISO)"
                    value={form.expediente12x36Fase ?? ''}
                    displayEmpty
                    renderValue={(v) => {
                      if (!v) return 'Selecione par ou ímpar';
                      return v === 'PAR' ? 'Semanas pares' : 'Semanas ímpares';
                    }}
                    onChange={(e) => {
                      const v = e.target.value;
                      setForm((prev) => ({
                        ...prev,
                        expediente12x36Fase: v === 'PAR' || v === 'IMPAR' ? v : undefined,
                      }));
                    }}
                    MenuProps={{ sx: { zIndex: 1500 } }}
                  >
                    <MenuItem value="">
                      <em>Selecione par ou ímpar</em>
                    </MenuItem>
                    <MenuItem value="PAR">Semanas pares</MenuItem>
                    <MenuItem value="IMPAR">Semanas ímpares</MenuItem>
                  </Select>
                </FormControl>
              </Box>
            );
          })()}
        </Box>

        <Box sx={{ mt: 1 }}>
          <Button
            type="submit"
            variant="contained"
            disabled={submitting}
            sx={{
              textTransform: 'none',
              bgcolor: 'var(--sentinela-blue)',
              '&:hover': { bgcolor: 'var(--sentinela-blue)', opacity: 0.9 },
            }}
          >
            {submitting ? 'Salvando...' : 'Cadastrar policial'}
          </Button>
        </Box>
      </Box>

              {/* Modal de Validação de Policiais Extraídos */}
      {validacaoModal.open && (
        <div className="modal-backdrop" role="dialog" aria-modal="true">
          <div className="modal modal-large" style={{ maxHeight: '90vh', display: 'flex', flexDirection: 'column' }}>
            <h3 style={{ flexShrink: 0 }}>Validar Dados Extraídos</h3>
            
            {validacaoModal.funcoesCriadas.length > 0 && (
              <div className="feedback" style={{ marginBottom: '16px', backgroundColor: 'var(--alert-info-bg)', borderColor: 'var(--info)', color: 'var(--alert-info-text)', flexShrink: 0 }}>
                <strong>Funções criadas automaticamente:</strong>
                <ul style={{ margin: '8px 0 0', paddingLeft: '20px' }}>
                  {validacaoModal.funcoesCriadas.map((funcao, idx) => (
                    <li key={idx}>{funcao}</li>
                  ))}
                </ul>
              </div>
            )}

            {validacaoModal.policiais.length === 0 ? (
              <div style={{ flex: '1 1 auto', minHeight: 0, marginBottom: '16px', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '40px 20px' }}>
                <div className="feedback" style={{ backgroundColor: 'var(--alert-info-bg)', borderColor: 'var(--accent-muted)', color: 'var(--alert-info-text)', textAlign: 'center' }}>
                  <strong>Todos os policiais da lista estão cadastrados</strong>
                </div>
              </div>
            ) : (
              <>
                <div style={{ marginBottom: '16px', flexShrink: 0 }}>
                  <label>
                    Definir todos os policiais para a equipe:
                    <select
                      value=""
                      onChange={(event) => {
                        const equipeSelecionada = event.target.value ? (event.target.value as Equipe) : undefined;
                        if (equipeSelecionada) {
                          // Atualizar todos os policiais que têm equipe disponível
                          const novosPoliciais = validacaoModal.policiais.map((policial) => {
                            if (policialModalSemColunaEquipe(policial, funcoes)) {
                              return policial;
                            }
                            return {
                              ...policial,
                              equipe: equipeSelecionada,
                            };
                          });
                          
                          setValidacaoModal((prev) => ({
                            ...prev,
                            policiais: novosPoliciais,
                          }));
                          
                          // Resetar o select
                          event.target.value = '';
                        }
                      }}
                      style={{ width: '100%', marginTop: '8px' }}
                    >
                      <option value="">Selecione uma equipe</option>
                      {(currentUser.nivel?.nome === 'OPERAÇÕES' && currentUser.equipe
                        ? equipesDisponiveisCadastro.filter((option) => option.nome === currentUser.equipe)
                        : equipesDisponiveisCadastro
                      ).map((option) => (
                        <option key={option.id} value={option.nome}>
                          {formatNome(option.nome)}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>
                <div style={{ flex: '1 1 auto', minHeight: 0, overflowY: 'auto', marginBottom: '16px' }}>
                  <table className="table">
                <thead>
                  <tr>
                    <th>Matrícula</th>
                    <th>Nome</th>
                    <th>Função</th>
                    <th>Status</th>
                    <th>Equipe</th>
                  </tr>
                </thead>
                <tbody>
                  {validacaoModal.policiais.map((policial, idx) => {
                    const jaCadastrado = policial.jaCadastrado === true;
                    const meta = policialModalMetaFuncao(policial, funcoes);
                    const naoMostraEquipe = meta ? funcaoOcultaCampoEquipe(meta as FuncaoOption) : false;
                    const fLinha = policial.funcaoId ? funcoes.find((f) => f.id === policial.funcaoId) : undefined;
                    const isMotoristaDia =
                      !!(fLinha?.nome && fLinha.nome.toUpperCase().includes('MOTORISTA DE DIA')) ||
                      !!(policial.funcaoNome && policial.funcaoNome.toUpperCase().includes('MOTORISTA DE DIA'));
                    const equipeObrigLinha = meta ? funcaoEquipeObrigatoriaNoFormulario(meta as FuncaoOption) : false;
                    return (
                      <tr key={idx}>
                        <td>{formatMatricula(policial.matricula)}</td>
                        <td>{policial.nome}</td>
                        {jaCadastrado ? (
                          <td colSpan={3} style={{ color: 'var(--text-secondary)', fontStyle: 'italic' }}>
                            Policial já cadastrado
                          </td>
                        ) : (
                          <>
                            <td>
                              <select
                                value={policial.funcaoId || ''}
                                onChange={(event) => {
                                  const novosPoliciais = [...validacaoModal.policiais];
                                  const novoFuncaoId = event.target.value ? Number(event.target.value) : undefined;
                                  const funcaoSelecionada = funcoes.find((f) => f.id === novoFuncaoId);
                                  const isMD =
                                    funcaoSelecionada?.nome.toUpperCase().includes('MOTORISTA DE DIA') ?? false;
                                  const ocultaEq = funcaoSelecionada ? funcaoOcultaCampoEquipe(funcaoSelecionada) : false;
                                  novosPoliciais[idx] = {
                                    ...novosPoliciais[idx],
                                    funcaoId: novoFuncaoId,
                                    funcaoNome: funcaoSelecionada?.nome || novosPoliciais[idx].funcaoNome,
                                    equipe: ocultaEq
                                      ? undefined
                                      : isMD && novosPoliciais[idx].equipe === 'E'
                                        ? undefined
                                        : novosPoliciais[idx].equipe,
                                  };
                                  setValidacaoModal((prev) => ({ ...prev, policiais: novosPoliciais }));
                                }}
                                style={{ width: '100%', padding: '4px' }}
                              >
                                <option value="">Selecione uma função</option>
                                {funcoesOrdenadas.map((funcao) => (
                                  <option key={funcao.id} value={funcao.id}>
                                    {formatNome(funcao.nome)}
                                  </option>
                                ))}
                              </select>
                            </td>
                            <td>
                              <select
                                value={policial.status}
                                onChange={(event) => {
                                  const novosPoliciais = [...validacaoModal.policiais];
                                  novosPoliciais[idx] = {
                                    ...novosPoliciais[idx],
                                    status: event.target.value as PolicialStatus,
                                  };
                                  setValidacaoModal((prev) => ({ ...prev, policiais: novosPoliciais }));
                                }}
                                style={{ width: '100%', padding: '4px' }}
                              >
                                {POLICIAL_STATUS_OPTIONS_FORM.map((option) => (
                                  <option key={option.value} value={option.value}>
                                    {option.label}
                                  </option>
                                ))}
                              </select>
                            </td>
                            <td>
                              {!naoMostraEquipe ? (
                                <select
                                  value={policial.equipe || ''}
                                  onChange={(event) => {
                                    const novosPoliciais = [...validacaoModal.policiais];
                                    novosPoliciais[idx] = {
                                      ...novosPoliciais[idx],
                                      equipe: event.target.value ? (event.target.value as Equipe) : undefined,
                                    };
                                    setValidacaoModal((prev) => ({ ...prev, policiais: novosPoliciais }));
                                  }}
                                  style={{ width: '100%', padding: '4px' }}
                                  required={equipeObrigLinha}
                                >
                                  <option value="">
                                    {equipeObrigLinha ? 'Selecione uma equipe' : 'Sem equipe (opcional)'}
                                  </option>
                                  {equipesDisponiveisCadastro
                                    .filter((option) => !isMotoristaDia || option.nome !== 'E')
                                    .map((option) => (
                                      <option key={option.id} value={option.nome}>
                                        {option.nome}
                                      </option>
                                    ))}
                                </select>
                              ) : (
                                <span style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>-</span>
                              )}
                            </td>
                          </>
                        )}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              </div>
              </>
            )}

            <div className="modal-actions" style={{ flexShrink: 0 }}>
              <button
                type="button"
                className="secondary"
                onClick={handleCloseValidacaoModal}
                disabled={validacaoModal.loading}
              >
                Cancelar
              </button>
              {validacaoModal.policiais.length > 0 && (() => {
                const qtdNovos = validacaoModal.policiais.filter((p) => !p.jaCadastrado).length;
                return (
                  <button
                    type="button"
                    className="primary"
                    onClick={handleConfirmValidacao}
                    disabled={validacaoModal.loading || qtdNovos === 0}
                  >
                    {validacaoModal.loading ? 'Salvando...' : `Salvar ${qtdNovos} policiais`}
                  </button>
                );
              })()}
            </div>
          </div>
        </div>
      )}

      {/* Modal de Reativação de Policial Desativado */}
      {reativarModal.open && reativarModal.policial && (
        <div className="modal-backdrop" role="dialog" aria-modal="true">
          <div className="modal" style={{ maxWidth: '500px' }}>
            <h3>Policial já cadastrado</h3>
            <div className="feedback" style={{ marginBottom: '16px', backgroundColor: 'var(--alert-warning-bg)', borderColor: 'var(--warning)', color: 'var(--alert-warning-text)' }}>
              <strong>Este policial já existe no sistema, porém está desativado.</strong>
              <p style={{ margin: '8px 0 0', fontSize: '0.9rem' }}>
                <strong>Nome:</strong> {reativarModal.policial.nome}
              </p>
              <p style={{ margin: '4px 0 0', fontSize: '0.9rem' }}>
                <strong>Matrícula:</strong> {formatMatricula(reativarModal.policial.matricula)}
              </p>
              <p style={{ margin: '8px 0 0', fontSize: '0.9rem' }}>
                Deseja reativar este policial com os dados informados?
              </p>
            </div>

            <div className="modal-actions">
              <button
                type="button"
                className="secondary"
                onClick={handleCloseReativarModal}
                disabled={reativarModal.loading}
              >
                Cancelar
              </button>
              <button
                type="button"
                className="primary"
                onClick={handleConfirmReativar}
                disabled={reativarModal.loading}
              >
                {reativarModal.loading ? 'Reativando...' : 'Sim, reativar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}