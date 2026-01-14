import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { api } from '../../api';
import type {
  Colaborador,
  ColaboradorExtraido,
  ColaboradorBulkItem,
  Equipe,
  FuncaoOption,
  PolicialStatus,
  ProcessFileResponse,
  Usuario,
} from '../../types';
import { EQUIPE_FONETICA, EQUIPE_OPTIONS, POLICIAL_STATUS_OPTIONS } from '../../constants';

interface ColaboradoresSectionProps {
  currentUser: Usuario;
  onChanged?: () => void;
}

export function ColaboradoresSection({
  currentUser,
  onChanged,
}: ColaboradoresSectionProps) {
  const initialForm = { nome: '', matricula: '', status: 'ATIVO' as PolicialStatus, funcaoId: undefined as number | undefined };
  const [colaboradores, setColaboradores] = useState<Colaborador[]>([]);
  const [funcoes, setFuncoes] = useState<FuncaoOption[]>([]);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [form, setForm] = useState(initialForm);
  const [matriculaError, setMatriculaError] = useState<string | null>(null);
  const matriculaTimeoutRef = useRef<number | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [reativarModal, setReativarModal] = useState<{
    open: boolean;
    colaborador: Colaborador | null;
    loading: boolean;
  }>({
    open: false,
    colaborador: null,
    loading: false,
  });
  const [validacaoModal, setValidacaoModal] = useState<{
    open: boolean;
    colaboradores: Array<ColaboradorExtraido & { status: PolicialStatus; equipe?: Equipe }>;
    loading: boolean;
    funcoesCriadas: string[];
  }>({
    open: false,
    colaboradores: [],
    loading: false,
    funcoesCriadas: [],
  });

  const carregarColaboradores = useCallback(async () => {
    try {
      setLoading(true);
      const data = await api.listColaboradores();
      setColaboradores(data);
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

  // Ordenar funções alfabeticamente
  const funcoesOrdenadas = useMemo(() => {
    return [...funcoes].sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR', { sensitivity: 'base' }));
  }, [funcoes]);

  const validateMatricula = useCallback((matricula: string) => {
    // Se a lista ainda não foi carregada, não valida
    if (loading || (colaboradores.length === 0 && !error)) {
      return;
    }

    const matriculaTrimmed = matricula.trim().toUpperCase();
    if (!matriculaTrimmed) {
      setMatriculaError(null);
      return;
    }

    const matriculaExists = colaboradores.some(
      (colaborador) => colaborador.matricula.toUpperCase() === matriculaTrimmed,
    );

    if (matriculaExists) {
      setMatriculaError('Esta matrícula já está cadastrada.');
    } else {
      setMatriculaError(null);
    }
  }, [colaboradores, loading, error]);

  useEffect(() => {
    void carregarColaboradores();
    void carregarFuncoes();
  }, [carregarColaboradores, carregarFuncoes]);

  // Revalidar matrícula quando a lista de colaboradores for atualizada
  useEffect(() => {
    if (form.matricula.trim() && !loading) {
      validateMatricula(form.matricula);
    }
  }, [colaboradores, form.matricula, validateMatricula, loading]);

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
        const colaboradoresComStatus = response.colaboradores.map((colab) => ({
          ...colab,
          status: 'ATIVO' as PolicialStatus,
          equipe: undefined as Equipe | undefined,
        }));
        
        // Abrir modal de validação
        setValidacaoModal({
          open: true,
          colaboradores: colaboradoresComStatus,
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

    // Validar matrícula antes de submeter
    const matriculaExists = colaboradores.some(
      (colaborador) => colaborador.matricula.toUpperCase() === matricula.toUpperCase(),
    );
    if (matriculaExists) {
      setMatriculaError('Esta matrícula já está cadastrada.');
      setError('Esta matrícula já está cadastrada.');
      return;
    }

    try {
      setSubmitting(true);
      await api.createColaborador({ 
        nome, 
        matricula, 
        status: form.status,
        equipe: currentUser.equipe,
      });
      setSuccess('Policial cadastrado com sucesso.');

      setForm(initialForm);
      setMatriculaError(null);
      if (matriculaTimeoutRef.current) {
        clearTimeout(matriculaTimeoutRef.current);
        matriculaTimeoutRef.current = null;
      }
      await carregarColaboradores();
      onChanged?.();
    } catch (err) {
      // Verificar se é erro de colaborador desativado
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
        errorData.message === 'COLABORADOR_DESATIVADO' &&
        'colaborador' in errorData
      ) {
        // Mostrar modal de reativação
        setReativarModal({
          open: true,
          colaborador: errorData.colaborador as Colaborador,
          loading: false,
        });
        setSubmitting(false);
        return;
      }
      
      setError(
        err instanceof Error
          ? err.message
          : 'Não foi possível cadastrar o policial.',
      );
    } finally {
      setSubmitting(false);
    }
  };

  const handleCloseReativarModal = () => {
    setReativarModal({
      open: false,
      colaborador: null,
      loading: false,
    });
  };

  const handleCloseValidacaoModal = () => {
    setValidacaoModal({
      open: false,
      colaboradores: [],
      loading: false,
      funcoesCriadas: [],
    });
  };

  const handleConfirmValidacao = async () => {
    if (validacaoModal.colaboradores.length === 0 || validacaoModal.loading) {
      return;
    }

    try {
      setValidacaoModal((prev) => ({ ...prev, loading: true }));
      setError(null);
      setSuccess(null);

      // Preparar dados para envio
      const colaboradoresBulk: ColaboradorBulkItem[] = validacaoModal.colaboradores.map((colab) => ({
        matricula: colab.matricula,
        nome: colab.nome,
        status: colab.status,
        funcaoId: colab.funcaoId,
        equipe: colab.equipe,
      }));

      // Enviar para o backend
      const response = await api.createColaboradoresBulk({ colaboradores: colaboradoresBulk });

      // Mostrar resultado
      if (response.erros.length > 0) {
        const errosMsg = response.erros.map((e) => `Matrícula ${e.matricula}: ${e.erro}`).join('\n');
        setError(`${response.criados} colaborador(es) criado(s). Erros:\n${errosMsg}`);
      } else {
        setSuccess(`${response.criados} colaborador(es) criado(s) com sucesso.`);
      }

      handleCloseValidacaoModal();
      await carregarColaboradores();
      onChanged?.();
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Não foi possível salvar os colaboradores.',
      );
      setValidacaoModal((prev) => ({ ...prev, loading: false }));
    }
  };

  const handleConfirmReativar = async () => {
    if (!reativarModal.colaborador) {
      return;
    }

    try {
      setReativarModal((prev) => ({ ...prev, loading: true }));
      setError(null);
      
      // Reativar o colaborador
      await api.activateColaborador(reativarModal.colaborador.id);
      
      // Atualizar os dados do colaborador reativado com os novos dados do formulário
      await api.updateColaborador(reativarModal.colaborador.id, {
        nome: form.nome.trim(),
        status: form.status,
        equipe: currentUser.equipe,
      });

      setSuccess('Policial reativado e atualizado com sucesso.');
      setForm(initialForm);
      setMatriculaError(null);
      if (matriculaTimeoutRef.current) {
        clearTimeout(matriculaTimeoutRef.current);
        matriculaTimeoutRef.current = null;
      }
      handleCloseReativarModal();
      await carregarColaboradores();
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
          Inserir manualmente
        </button>
      </div>

      {error && <div className="feedback error">{error}</div>}
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
              onChange={(event) =>
                setForm((prev) => ({
                  ...prev,
                  funcaoId: event.target.value ? Number(event.target.value) : undefined,
                }))
              }
            >
              <option value="">Selecione uma função</option>
              {funcoesOrdenadas.map((funcao) => (
                <option key={funcao.id} value={funcao.id}>
                  {funcao.nome}
                </option>
              ))}
            </select>
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
        <div className="form-actions">
          <button className="primary" type="submit" disabled={submitting}>
            {submitting ? 'Salvando...' : 'Cadastrar policial'}
          </button>
        </div>
      </form>

      {/* Modal de Validação de Colaboradores Extraídos */}
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

            {validacaoModal.colaboradores.length === 0 ? (
              <div style={{ flex: '1 1 auto', minHeight: 0, marginBottom: '16px', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '40px 20px' }}>
                <div className="feedback" style={{ backgroundColor: '#f0f9ff', borderColor: '#3b82f6', color: '#1e40af', textAlign: 'center' }}>
                  <strong>Todos os policiais da lista estão cadastrados</strong>
                </div>
              </div>
            ) : (
              <>
                <div style={{ marginBottom: '16px', flexShrink: 0 }}>
                  <label className="switch" style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                    <input
                      type="checkbox"
                      onChange={(event) => {
                        if (event.target.checked) {
                          // Atualizar todos os colaboradores que têm equipe disponível
                          const novosColaboradores = validacaoModal.colaboradores.map((colab) => {
                            const funcaoUpper = colab.funcaoNome?.toUpperCase() || '';
                            const naoMostraEquipe = 
                              funcaoUpper.includes('EXPEDIENTE') || 
                              funcaoUpper.includes('CMT UPM') || 
                              funcaoUpper.includes('SUBCMT UPM');
                            
                            if (!naoMostraEquipe) {
                              return {
                                ...colab,
                                equipe: currentUser.equipe,
                              };
                            }
                            return colab;
                          });
                          
                          setValidacaoModal((prev) => ({
                            ...prev,
                            colaboradores: novosColaboradores,
                          }));
                        }
                      }}
                    />
                    <span>Definir todos os policiais para a equipe atual</span>
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
                  {validacaoModal.colaboradores.map((colab, idx) => {
                    // Funções que não devem mostrar equipe: EXPEDIENTE ADM, CMT UPM, SUBCMT UPM
                    const funcaoUpper = colab.funcaoNome?.toUpperCase() || '';
                    const naoMostraEquipe = 
                      funcaoUpper.includes('EXPEDIENTE') || 
                      funcaoUpper.includes('CMT UPM') || 
                      funcaoUpper.includes('SUBCMT UPM');
                    return (
                      <tr key={idx}>
                        <td>{colab.matricula}</td>
                        <td>{colab.nome}</td>
                        <td>
                          <select
                            value={colab.funcaoId || ''}
                            onChange={(event) => {
                              const novosColaboradores = [...validacaoModal.colaboradores];
                              const novoFuncaoId = event.target.value ? Number(event.target.value) : undefined;
                              const funcaoSelecionada = funcoes.find(f => f.id === novoFuncaoId);
                              novosColaboradores[idx] = {
                                ...novosColaboradores[idx],
                                funcaoId: novoFuncaoId,
                                funcaoNome: funcaoSelecionada?.nome || novosColaboradores[idx].funcaoNome,
                              };
                              setValidacaoModal((prev) => ({
                                ...prev,
                                colaboradores: novosColaboradores,
                              }));
                            }}
                            style={{ width: '100%', padding: '4px' }}
                          >
                            <option value="">Selecione uma função</option>
                            {funcoesOrdenadas.map((funcao) => (
                              <option key={funcao.id} value={funcao.id}>
                                {funcao.nome}
                              </option>
                            ))}
                          </select>
                        </td>
                        <td>
                          <select
                            value={colab.status}
                            onChange={(event) => {
                              const novosColaboradores = [...validacaoModal.colaboradores];
                              novosColaboradores[idx] = {
                                ...novosColaboradores[idx],
                                status: event.target.value as PolicialStatus,
                              };
                              setValidacaoModal((prev) => ({
                                ...prev,
                                colaboradores: novosColaboradores,
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
                              value={colab.equipe || ''}
                              onChange={(event) => {
                                const novosColaboradores = [...validacaoModal.colaboradores];
                                novosColaboradores[idx] = {
                                  ...novosColaboradores[idx],
                                  equipe: event.target.value ? (event.target.value as Equipe) : undefined,
                                };
                                setValidacaoModal((prev) => ({
                                  ...prev,
                                  colaboradores: novosColaboradores,
                                }));
                              }}
                              style={{ width: '100%', padding: '4px' }}
                              required
                            >
                              <option value="">Selecione uma equipe</option>
                              {EQUIPE_OPTIONS.map((option) => (
                                <option key={option.value} value={option.value}>
                                  {EQUIPE_FONETICA[option.value]} ({option.value})
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
              {validacaoModal.colaboradores.length > 0 && (
                <button
                  type="button"
                  className="primary"
                  onClick={handleConfirmValidacao}
                  disabled={validacaoModal.loading}
                >
                  {validacaoModal.loading ? 'Salvando...' : `Salvar ${validacaoModal.colaboradores.length} policiais`}
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Modal de Reativação de Colaborador Desativado */}
      {reativarModal.open && reativarModal.colaborador && (
        <div className="modal-backdrop" role="dialog" aria-modal="true">
          <div className="modal" style={{ maxWidth: '500px' }}>
            <h3>Colaborador já cadastrado</h3>
            <div className="feedback" style={{ marginBottom: '16px', backgroundColor: '#fef3c7', borderColor: '#f59e0b', color: '#92400e' }}>
              <strong>Este colaborador já existe no sistema, porém está desativado.</strong>
              <p style={{ margin: '8px 0 0', fontSize: '0.9rem' }}>
                <strong>Nome:</strong> {reativarModal.colaborador.nome}
              </p>
              <p style={{ margin: '4px 0 0', fontSize: '0.9rem' }}>
                <strong>Matrícula:</strong> {reativarModal.colaborador.matricula}
              </p>
              <p style={{ margin: '8px 0 0', fontSize: '0.9rem' }}>
                Deseja reativar este colaborador com os dados informados?
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
