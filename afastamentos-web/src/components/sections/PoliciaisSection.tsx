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
import { POLICIAL_STATUS_OPTIONS, formatEquipeLabel } from '../../constants';
import { formatNome } from '../../utils/dateUtils';
import { createNormalizedInputHandler, handleKeyDownNormalized } from '../../utils/inputUtils';
import type { PermissoesPorTela } from '../../utils/permissions';
import { canEdit, canExcluir, canDesativar } from '../../utils/permissions';
import type { ConfirmConfig } from '../common/ConfirmDialog';

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
  permissoes,
}: PoliciaisSectionProps) {
  const initialForm = { nome: '', matricula: '', status: 'ATIVO' as PolicialStatus, funcaoId: undefined as number | undefined, equipe: undefined as Equipe | undefined };
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
    policiais: Array<PolicialExtraido & { status: PolicialStatus; equipe?: Equipe }>;
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
    return funcoes.filter((f) => f.ativo !== false);
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
    
    // Verificar se é CMT UPM ou SUBCMT UPM
    if (funcaoUpper.includes('CMT UPM') || funcaoUpper.includes('SUBCMT UPM')) {
      // Verificar se já existe alguém com essa função
      const jaExiste = policiais.some((policial) => {
        if (!policial.funcao) return false;
        const policialFuncaoUpper = policial.funcao.nome.toUpperCase();
        return policialFuncaoUpper === funcaoUpper;
      });

      if (jaExiste) {
        setFuncaoError(`Já existe um policial cadastrado com a função "${funcaoSelecionada.nome}". Não pode haver mais de um.`);
      } else {
        setFuncaoError(null);
      }
    } else {
      setFuncaoError(null);
    }
  }, [policiais, funcoes, loading, error]);

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
  }, [policiais, form.funcaoId, validateFuncao, loading]);

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
      if (!fileName.endsWith('.xlsx') && !fileName.endsWith('.pdf')) {
        setError('Por favor, selecione um arquivo Excel (.xlsx) ou PDF (.pdf).');
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
        
        // Preparar dados para validação (adicionar status padrão)
        const policiaisComStatus = response.policiais.map((policial) => ({
          ...policial,
          status: 'ATIVO' as PolicialStatus,
          equipe: undefined as Equipe | undefined,
        }));
        
        // Abrir modal de validação
        setValidacaoModal({
          open: true,
          policiais: policiaisComStatus,
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
      
      // Determinar a equipe: se não tiver função ou se a função permitir equipe, usar a selecionada ou a do usuário
      let equipeFinal: Equipe | null | undefined = undefined;
      
      if (form.funcaoId) {
        const funcaoSelecionada = funcoes.find(f => f.id === form.funcaoId);
        if (funcaoSelecionada) {
          const funcaoUpper = funcaoSelecionada.nome.toUpperCase();
          const naoMostraEquipe = 
            funcaoUpper.includes('EXPEDIENTE ADM') || 
            funcaoUpper.includes('CMT UPM') || 
            funcaoUpper.includes('SUBCMT UPM');
          
          if (!naoMostraEquipe) {
            // Função permite equipe: usar a selecionada ou a do usuário
            let equipeTemp: Equipe | null = form.equipe || (currentUser.equipe as Equipe) || null;
            // MOTORISTA DE DIA não pode ter equipe E
            if (funcaoUpper.includes('MOTORISTA DE DIA') && equipeTemp === 'E') {
              equipeTemp = null;
            }
            equipeFinal = equipeTemp;
          } else {
            // Função não permite equipe
            equipeFinal = null;
          }
        } else {
          // Função não encontrada, usar a selecionada ou a do usuário
          equipeFinal = form.equipe || currentUser.equipe || null;
        }
      } else {
        // Sem função selecionada, usar a selecionada ou a do usuário
        equipeFinal = form.equipe || currentUser.equipe || null;
      }
      
      await api.createPolicial({ 
        nome, 
        matricula, 
        status: form.status,
        funcaoId: form.funcaoId,
        equipe: equipeFinal === null ? null : (equipeFinal || undefined),
      });
      setSuccess('Policial cadastrado com sucesso.');

      setForm(initialForm);
      setMatriculaError(null);
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

    const nome = form.nome.trim();
    const matricula = form.matricula.trim();

    if (!nome || !matricula) {
      setError('Informe nome e matrícula.');
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

    // Validar função antes de submeter (especialmente para CMT UPM e SUBCMT UPM)
    if (form.funcaoId) {
      const funcaoSelecionada = funcoes.find(f => f.id === form.funcaoId);
      if (funcaoSelecionada) {
        const funcaoUpper = funcaoSelecionada.nome.toUpperCase();
        if (funcaoUpper.includes('CMT UPM') || funcaoUpper.includes('SUBCMT UPM')) {
          const jaExiste = policiais.some((policial) => {
            if (!policial.funcao) return false;
            const policialFuncaoUpper = policial.funcao.nome.toUpperCase();
            return policialFuncaoUpper === funcaoUpper;
          });

          if (jaExiste) {
            setFuncaoError(`Já existe um policial cadastrado com a função "${funcaoSelecionada.nome}". Não pode haver mais de um.`);
            setError(`Já existe um policial cadastrado com a função "${funcaoSelecionada.nome}". Não pode haver mais de um.`);
            return;
          }
        }
      }
    }

    // Montar mensagem de confirmação
    const funcaoSelecionada = form.funcaoId ? funcoes.find(f => f.id === form.funcaoId) : null;
    const funcaoNome = funcaoSelecionada ? formatNome(funcaoSelecionada.nome) : '—';
    const statusLabel = POLICIAL_STATUS_OPTIONS.find(s => s.value === form.status)?.label || form.status;

    // Determinar equipe final para exibição
    let equipeFinal: Equipe | null | undefined = undefined;
    if (form.funcaoId) {
      const funcaoSelecionada = funcoes.find(f => f.id === form.funcaoId);
      if (funcaoSelecionada) {
        const funcaoUpper = funcaoSelecionada.nome.toUpperCase();
        const naoMostraEquipe = 
          funcaoUpper.includes('EXPEDIENTE ADM') || 
          funcaoUpper.includes('CMT UPM') || 
          funcaoUpper.includes('SUBCMT UPM');
        
        if (!naoMostraEquipe) {
          equipeFinal = form.equipe || (currentUser.equipe as Equipe) || null;
        } else {
          equipeFinal = null;
        }
      }
    } else {
      equipeFinal = form.equipe || currentUser.equipe || null;
    }
    const equipeFinalLabel = equipeFinal ? formatEquipeLabel(equipeFinal) : '—';

    const message =
      `Confirme os dados do policial:\n\n` +
      `Nome: ${nome}\n` +
      `Matrícula: ${matricula}\n` +
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
    if (validacaoModal.policiais.length === 0 || validacaoModal.loading) {
      return;
    }

    try {
      setValidacaoModal((prev) => ({ ...prev, loading: true }));
      setError(null);
      setSuccess(null);

      // Preparar dados para envio
      const policiaisBulk: PolicialBulkItem[] = validacaoModal.policiais.map((policial) => ({
        matricula: policial.matricula,
        nome: policial.nome,
        status: policial.status,
        funcaoId: policial.funcaoId,
        equipe: policial.equipe,
      }));

      // Enviar para o backend
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
      
      // Determinar a equipe para reativação (mesma lógica do cadastro)
      let equipeFinalReativar: Equipe | null | undefined = undefined;
      
      if (form.funcaoId) {
        const funcaoSelecionada = funcoes.find(f => f.id === form.funcaoId);
        if (funcaoSelecionada) {
          const funcaoUpper = funcaoSelecionada.nome.toUpperCase();
          const naoMostraEquipe = 
            funcaoUpper.includes('EXPEDIENTE ADM') || 
            funcaoUpper.includes('CMT UPM') || 
            funcaoUpper.includes('SUBCMT UPM');
          
          if (!naoMostraEquipe) {
            let equipeTemp: Equipe | null = form.equipe || (currentUser.equipe as Equipe) || null;
            // MOTORISTA DE DIA não pode ter equipe E
            if (funcaoUpper.includes('MOTORISTA DE DIA') && equipeTemp === 'E') {
              equipeTemp = null;
            }
            equipeFinalReativar = equipeTemp;
          } else {
            equipeFinalReativar = null;
          }
        } else {
          equipeFinalReativar = form.equipe || currentUser.equipe || null;
        }
      } else {
        equipeFinalReativar = form.equipe || currentUser.equipe || null;
      }
      
      // Atualizar os dados do policial reativado com os novos dados do formulário
      await api.updatePolicial(reativarModal.policial.id, {
        nome: form.nome.trim(),
        status: form.status,
        funcaoId: form.funcaoId,
        equipe: equipeFinalReativar === null ? null : (equipeFinalReativar || undefined),
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
      <div>
        <h2>
          {(() => {
            return 'Cadastrar Policial';
          })()}
        </h2>
      </div>

      <div>
        <input
          ref={fileInputRef}
          type="file"
          accept=".xlsx,.pdf,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/pdf"
          onChange={handleFileSelect}
          style={{ display: 'none' }}
        />
        <button className="success" type="button" onClick={handleFileButtonClick}>
          Cadastrar de PDF
        </button>
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

      <form onSubmit={handleSubmit}>
        <div className="grid two-columns">
          <label>
            Nome
            <input
              autoFocus
              value={form.nome}
              onChange={(event) =>
                setForm((prev) => ({
                  ...prev,
                  nome: event.target.value.toUpperCase(),
                }))
              }
              placeholder="2º SGT JOÃO PEREIRA DA SILVA"
              required
            />
          </label>
          <label>
            Matrícula
            <input
              value={form.matricula}
              onChange={(event) => {
                const value = event.target.value
                  .replace(/[^0-9xX]/g, '')
                  .toUpperCase();
                setForm((prev) => ({
                  ...prev,
                  matricula: value,
                }));

                // Limpar timeout anterior
                if (matriculaTimeoutRef.current) {
                  clearTimeout(matriculaTimeoutRef.current);
                }

                // Limpar erro imediatamente se o campo estiver vazio
                if (!value.trim()) {
                  setMatriculaError(null);
                  return;
                }

                // Validar após 300ms de inatividade (debounce)
                matriculaTimeoutRef.current = setTimeout(() => {
                  validateMatricula(value);
                }, 300);
              }}
              placeholder="Matrícula"
              required
              className={matriculaError ? 'input-error' : ''}
              aria-invalid={matriculaError ? 'true' : 'false'}
            />
            {matriculaError && (
              <span className="field-error">{matriculaError}</span>
            )}
          </label>
        </div>
        <div className="grid two-columns">
          <label>
            Função
            <select
              value={form.funcaoId || ''}
              onChange={(event) => {
                const novoFuncaoId = event.target.value ? Number(event.target.value) : undefined;
                const funcaoSelecionada = funcoes.find(f => f.id === novoFuncaoId);
                
                // Validar função após seleção
                if (novoFuncaoId) {
                  validateFuncao(novoFuncaoId);
                } else {
                  setFuncaoError(null);
                }
                
                // Se a função selecionada não permite equipe, limpar o campo de equipe
                // Se for MOTORISTA DE DIA e a equipe for E, limpar também
                if (funcaoSelecionada) {
                  const funcaoUpper = funcaoSelecionada.nome.toUpperCase();
                  const naoMostraEquipe = 
                    funcaoUpper.includes('EXPEDIENTE ADM') || 
                    funcaoUpper.includes('CMT UPM') || 
                    funcaoUpper.includes('SUBCMT UPM');
                  
                  const isMotoristaDia = funcaoUpper.includes('MOTORISTA DE DIA');
                  
                  setForm((prev) => ({
                    ...prev,
                    funcaoId: novoFuncaoId,
                    equipe: naoMostraEquipe ? undefined : (isMotoristaDia && prev.equipe === 'E' ? undefined : prev.equipe),
                  }));
                } else {
                  setForm((prev) => ({
                    ...prev,
                    funcaoId: novoFuncaoId,
                  }));
                }
              }}
              className={funcaoError ? 'input-error' : ''}
              aria-invalid={funcaoError ? 'true' : 'false'}
            >
              <option value="">Selecione uma função</option>
              {funcoesOrdenadas.map((funcao) => (
                <option key={funcao.id} value={funcao.id}>
                  {formatNome(funcao.nome)}
                </option>
              ))}
            </select>
            {funcaoError && (
              <span className="field-error">{funcaoError}</span>
            )}
          </label>
          <label>
            Status
            <select
              value={form.status}
              onChange={(event) =>
                setForm((prev) => ({
                  ...prev,
                  status: event.target.value as PolicialStatus,
                }))
              }
              required
            >
              {POLICIAL_STATUS_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
        </div>
        
        {/* Campo Equipe - Mostrar apenas se a função selecionada permitir */}
        {(() => {
          const funcaoSelecionada = form.funcaoId ? funcoes.find(f => f.id === form.funcaoId) : null;
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
            <div className="grid two-columns">
              <label>
                Equipe
                <select
                  value={form.equipe || ''}
                  onChange={(event) =>
                    setForm((prev) => ({
                      ...prev,
                      equipe: event.target.value ? (event.target.value as Equipe) : undefined,
                    }))
                  }
                  required
                >
                  <option value="">Selecione uma equipe</option>
                  {equipesDisponiveis.map((option) => (
                    <option key={option.id} value={option.nome}>
                      {formatNome(option.nome)}
                    </option>
                  ))}
                </select>
              </label>
              <div></div>
            </div>
          ) : null;
        })()}
        <div className="form-actions">
          <button className="primary" type="submit" disabled={submitting}>
            {submitting ? 'Salvando...' : 'Cadastrar policial'}
          </button>
        </div>
      </form>

              {/* Modal de Validação de Policiais Extraídos */}
      {validacaoModal.open && (
        <div className="modal-backdrop" role="dialog" aria-modal="true">
          <div className="modal modal-large" style={{ maxHeight: '90vh', display: 'flex', flexDirection: 'column' }}>
            <h3 style={{ flexShrink: 0 }}>Validar Dados Extraídos</h3>
            
            {validacaoModal.funcoesCriadas.length > 0 && (
              <div className="feedback" style={{ marginBottom: '16px', backgroundColor: '#dbeafe', borderColor: '#3b82f6', color: '#1e40af', flexShrink: 0 }}>
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
                <div className="feedback" style={{ backgroundColor: '#f0f9ff', borderColor: '#3b82f6', color: '#1e40af', textAlign: 'center' }}>
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
                            const funcaoUpper = policial.funcaoNome?.toUpperCase() || '';
                            const naoMostraEquipe = 
                              funcaoUpper.includes('EXPEDIENTE') || 
                              funcaoUpper.includes('CMT UPM') || 
                              funcaoUpper.includes('SUBCMT UPM') ||
                              funcaoUpper.includes('MOTORISTA DE DIA');
                            
                            if (!naoMostraEquipe) {
                              return {
                                ...policial,
                                equipe: equipeSelecionada,
                              };
                            }
                            return policial;
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
                    // Funções que não devem mostrar equipe: EXPEDIENTE ADM, CMT UPM, SUBCMT UPM
                    const funcaoUpper = policial.funcaoNome?.toUpperCase() || '';
                    const naoMostraEquipe = 
                      funcaoUpper.includes('EXPEDIENTE') || 
                      funcaoUpper.includes('CMT UPM') || 
                      funcaoUpper.includes('SUBCMT UPM');
                    const isMotoristaDia = funcaoUpper.includes('MOTORISTA DE DIA');
                    return (
                      <tr key={idx}>
                        <td>{policial.matricula}</td>
                        <td>{policial.nome}</td>
                        <td>
                          <select
                            value={policial.funcaoId || ''}
                            onChange={(event) => {
                              const novosPoliciais = [...validacaoModal.policiais];
                              const novoFuncaoId = event.target.value ? Number(event.target.value) : undefined;
                              const funcaoSelecionada = funcoes.find(f => f.id === novoFuncaoId);
                              const funcaoUpper = funcaoSelecionada?.nome.toUpperCase() || '';
                              const isMotoristaDia = funcaoUpper.includes('MOTORISTA DE DIA');
                              
                              novosPoliciais[idx] = {
                                ...novosPoliciais[idx],
                                funcaoId: novoFuncaoId,
                                funcaoNome: funcaoSelecionada?.nome || novosPoliciais[idx].funcaoNome,
                                // Se mudar para MOTORISTA DE DIA e a equipe for E, limpar
                                equipe: isMotoristaDia && novosPoliciais[idx].equipe === 'E' 
                                  ? undefined 
                                  : novosPoliciais[idx].equipe,
                              };
                              setValidacaoModal((prev) => ({
                                ...prev,
                                policiais: novosPoliciais,
                              }));
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
                              setValidacaoModal((prev) => ({
                                ...prev,
                                policiais: novosPoliciais,
                              }));
                            }}
                            style={{ width: '100%', padding: '4px' }}
                          >
                            {POLICIAL_STATUS_OPTIONS.map((option) => (
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
                                setValidacaoModal((prev) => ({
                                  ...prev,
                                  policiais: novosPoliciais,
                                }));
                              }}
                              style={{ width: '100%', padding: '4px' }}
                              required
                            >
                              <option value="">Selecione uma equipe</option>
                              {equipesDisponiveisCadastro
                                .filter((option) => !isMotoristaDia || option.nome !== 'E')
                                .map((option) => (
                                  <option key={option.id} value={option.nome}>
                                    {option.nome}
                                  </option>
                                ))}
                            </select>
                          ) : (
                            <span style={{ color: '#64748b', fontSize: '0.9rem' }}>-</span>
                          )}
                        </td>
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
              {validacaoModal.policiais.length > 0 && (
                <button
                  type="button"
                  className="primary"
                  onClick={handleConfirmValidacao}
                  disabled={validacaoModal.loading}
                >
                  {validacaoModal.loading ? 'Salvando...' : `Salvar ${validacaoModal.policiais.length} policiais`}
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Modal de Reativação de Policial Desativado */}
      {reativarModal.open && reativarModal.policial && (
        <div className="modal-backdrop" role="dialog" aria-modal="true">
          <div className="modal" style={{ maxWidth: '500px' }}>
            <h3>Policial já cadastrado</h3>
            <div className="feedback" style={{ marginBottom: '16px', backgroundColor: '#fef3c7', borderColor: '#f59e0b', color: '#92400e' }}>
              <strong>Este policial já existe no sistema, porém está desativado.</strong>
              <p style={{ margin: '8px 0 0', fontSize: '0.9rem' }}>
                <strong>Nome:</strong> {reativarModal.policial.nome}
              </p>
              <p style={{ margin: '4px 0 0', fontSize: '0.9rem' }}>
                <strong>Matrícula:</strong> {reativarModal.policial.matricula}
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