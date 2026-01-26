import { useCallback, useEffect, useState } from 'react';
import { api } from '../../api';
import type { AuditLog, Usuario, RelatorioLog, ErroLog, AcessoLog } from '../../types';
import type { PermissoesPorTela } from '../../utils/permissions';
import { canView } from '../../utils/permissions';
import jsPDF from 'jspdf';

interface RelatoriosSectionProps {
  currentUser: Usuario;
  permissoes?: PermissoesPorTela | null;
}

export function RelatoriosSection({ currentUser, permissoes }: RelatoriosSectionProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [generating, setGenerating] = useState(false);
  const [generatingUsuarios, setGeneratingUsuarios] = useState(false);
  const [generatingRelatorioLogs, setGeneratingRelatorioLogs] = useState(false);
  const [generatingErros, setGeneratingErros] = useState(false);
  const [generatingAcessos, setGeneratingAcessos] = useState(false);
  const [usuarios, setUsuarios] = useState<Usuario[]>([]);
  const [relatorioLogs, setRelatorioLogs] = useState<RelatorioLog[]>([]);
  const [erroLogs, setErroLogs] = useState<ErroLog[]>([]);
  const [acessoLogs, setAcessoLogs] = useState<AcessoLog[]>([]);
  const [modalDataFiltro, setModalDataFiltro] = useState<{
    open: boolean;
    tipoRelatorio: 'auditoria' | 'usuarios' | 'geracao-relatorios' | 'erros' | 'acessos' | null;
    dataInicio: string;
    dataFim: string;
  }>({
    open: false,
    tipoRelatorio: null,
    dataInicio: '',
    dataFim: '',
  });

  const [expandedCard, setExpandedCard] = useState<'auditoria' | 'servico' | null>('auditoria');
  const [dataFimFocada, setDataFimFocada] = useState(false);


  const carregarLogs = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      // Buscar todos os logs (sem limite para o relatório completo)
      const response = await api.listAuditLogs();
      setAuditLogs(response.logs);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Não foi possível carregar os logs de auditoria.',
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void carregarLogs();
  }, [carregarLogs]);

  const carregarUsuarios = useCallback(async () => {
    try {
      const data = await api.listUsuarios();
      setUsuarios(data);
    } catch (err) {
      console.error('Erro ao carregar usuários:', err);
    }
  }, []);

  useEffect(() => {
    void carregarUsuarios();
  }, [carregarUsuarios]);

  const carregarRelatorioLogs = useCallback(async () => {
    try {
      const response = await api.listRelatorioLogs();
      setRelatorioLogs(response.logs);
    } catch (err) {
      console.error('Erro ao carregar logs de relatórios:', err);
    }
  }, []);

  useEffect(() => {
    void carregarRelatorioLogs();
  }, [carregarRelatorioLogs]);

  const carregarErroLogs = useCallback(async () => {
    try {
      const response = await api.listErroLogs();
      const logs = response.logs || response.erros || [];
      setErroLogs(Array.isArray(logs) ? logs : []);
    } catch (err) {
      console.error('Erro ao carregar logs de erros:', err);
    }
  }, []);

  useEffect(() => {
    void carregarErroLogs();
  }, [carregarErroLogs]);

  const carregarAcessoLogs = useCallback(async () => {
    try {
      const response = await api.listAcessoLogs();
      const logs = response.logs || response.acessos || [];
      setAcessoLogs(Array.isArray(logs) ? logs : []);
    } catch (err) {
      console.error('Erro ao carregar logs de acessos:', err);
    }
  }, []);

  useEffect(() => {
    void carregarAcessoLogs();
  }, [carregarAcessoLogs]);

  // Função auxiliar para adicionar rodapé em todas as páginas
  const adicionarRodape = useCallback((doc: jsPDF, pageWidth: number, pageHeight: number) => {
    const agora = new Date();
    const dia = String(agora.getDate()).padStart(2, '0');
    const mes = String(agora.getMonth() + 1).padStart(2, '0');
    const ano = agora.getFullYear();
    const horas = String(agora.getHours()).padStart(2, '0');
    const minutos = String(agora.getMinutes()).padStart(2, '0');
    const data = `${dia}/${mes}/${ano}`;
    const hora = `${horas}:${minutos}`;
    
    const rodape = `Relatório gerado por ${currentUser.nome} - ${currentUser.matricula} - ${data} às ${hora}`;
    
    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');
    const textWidth = doc.getTextWidth(rodape);
    const xPosition = (pageWidth - textWidth) / 2; // Centralizar
    doc.text(rodape, xPosition, pageHeight - 10);
  }, [currentUser]);

  const abrirModalFiltro = useCallback((tipoRelatorio: 'auditoria' | 'usuarios' | 'geracao-relatorios' | 'erros' | 'acessos') => {
    const hoje = new Date();
    const primeiroDiaMes = new Date(hoje.getFullYear(), hoje.getMonth(), 1);
    const ultimoDiaMes = new Date(hoje.getFullYear(), hoje.getMonth() + 1, 0);
    
    setModalDataFiltro({
      open: true,
      tipoRelatorio,
      dataInicio: primeiroDiaMes.toISOString().split('T')[0],
      dataFim: ultimoDiaMes.toISOString().split('T')[0],
    });
    setDataFimFocada(false);
  }, []);

  const fecharModalFiltro = useCallback(() => {
    setModalDataFiltro({
      open: false,
      tipoRelatorio: null,
      dataInicio: '',
      dataFim: '',
    });
    setDataFimFocada(false);
  }, []);

  const gerarRelatorioCompleto = useCallback(async (dataInicio?: string, dataFim?: string) => {
    try {
      setGenerating(true);
      setError(null);

      // Buscar todos os logs de auditoria com filtro de data
      const responseAudit = await api.listAuditLogs(undefined, undefined, dataInicio, dataFim);
      const auditLogs = responseAudit.logs;

      // Buscar todos os logs de geração de relatórios com filtro de data
      const responseRelatorios = await api.listRelatorioLogs(1, 10000, dataInicio, dataFim);
      const relatorioLogs = responseRelatorios.logs;

      // Combinar e ordenar todos os logs por data/hora
      const todosLogs = [
        ...auditLogs.map((log) => ({
          tipo: 'auditoria' as const,
          data: log.createdAt,
          acao: log.action === 'CREATE' ? 'Criar' : log.action === 'UPDATE' ? 'Atualizar' : 'Excluir',
          entidade: log.entity,
          entityId: log.entityId?.toString() || '-',
          usuario: log.userName || 'Sistema',
        })),
        ...relatorioLogs.map((log) => ({
          tipo: 'relatorio' as const,
          data: log.createdAt,
          acao: 'Gerar Relatório',
          entidade: 'Relatório',
          entityId: log.tipoRelatorio,
          usuario: log.userName || log.matricula || 'Sistema',
        })),
      ].sort((a, b) => new Date(b.data).getTime() - new Date(a.data).getTime());

      const logs = todosLogs;

      // Criar PDF em orientação paisagem
      const doc = new jsPDF('landscape');
      const pageWidth = doc.internal.pageSize.getWidth();
      const pageHeight = doc.internal.pageSize.getHeight();
      const margin = 15;
      const lineHeight = 6;
      let yPosition = margin;

      // Título
      doc.setFontSize(18);
      doc.text('Relatório de Auditoria do Sistema', margin, yPosition);
      yPosition += lineHeight * 2;

      // Data de geração
      doc.setFontSize(10);
      const dataGeracao = new Date().toLocaleString('pt-BR');
      doc.text(`Gerado em: ${dataGeracao}`, margin, yPosition);
      yPosition += lineHeight * 1.5;

      // Período filtrado
      if (dataInicio || dataFim) {
        const dataInicioFormatada = dataInicio 
          ? new Date(dataInicio).toLocaleDateString('pt-BR')
          : 'Início';
        const dataFimFormatada = dataFim
          ? new Date(dataFim).toLocaleDateString('pt-BR')
          : 'Fim';
        doc.text(`Período: ${dataInicioFormatada} a ${dataFimFormatada}`, margin, yPosition);
        yPosition += lineHeight * 1.5;
      }

      // Informações gerais
      doc.setFontSize(12);
      doc.text(`Total de ações registradas: ${logs.length}`, margin, yPosition);
      yPosition += lineHeight * 2;

      // Cabeçalho da tabela
      doc.setFontSize(9);
      doc.setFont('helvetica', 'bold');
      const headers = ['Data/Hora', 'Ação', 'Entidade', 'ID Entidade', 'Usuário'];
      const colWidths = [45, 28, 40, 50, 80];
      let xPosition = margin;

      headers.forEach((header, index) => {
        doc.text(header, xPosition, yPosition);
        xPosition += colWidths[index];
      });
      yPosition += lineHeight;

      // Adicionar rodapé na primeira página
      adicionarRodape(doc, pageWidth, pageHeight);

      // Linhas de dados
      doc.setFont('helvetica', 'normal');
      logs.forEach((log) => {
        // Verificar se precisa de nova página
        if (yPosition > pageHeight - margin - lineHeight - 15) { // -15 para espaço do rodapé
          doc.addPage('landscape');
          yPosition = margin;
          // Adicionar rodapé na nova página
          adicionarRodape(doc, pageWidth, pageHeight);
        }

        // Formatar data/hora corretamente (DD/MM/YYYY HH:MM)
        const date = new Date(log.data);
        const dia = String(date.getDate()).padStart(2, '0');
        const mes = String(date.getMonth() + 1).padStart(2, '0');
        const ano = date.getFullYear();
        const horas = String(date.getHours()).padStart(2, '0');
        const minutos = String(date.getMinutes()).padStart(2, '0');
        const dataHora = `${dia}/${mes}/${ano} ${horas}:${minutos}`;
        
        const acao = log.acao;
        const entidade = log.entidade;
        const entityId = log.entityId;
        const usuario = log.usuario;

        xPosition = margin;
        
        // Data/Hora - limitar largura se necessário
        const dataHoraText = doc.splitTextToSize(dataHora, colWidths[0]);
        doc.text(dataHoraText[0], xPosition, yPosition);
        xPosition += colWidths[0];
        
        // Ação
        const acaoText = doc.splitTextToSize(acao, colWidths[1]);
        doc.text(acaoText[0], xPosition, yPosition);
        xPosition += colWidths[1];
        
        // Entidade
        const entidadeText = doc.splitTextToSize(entidade, colWidths[2]);
        doc.text(entidadeText[0], xPosition, yPosition);
        xPosition += colWidths[2];
        
        // ID Entidade - limitar largura para não sobrepor
        const entityIdText = doc.splitTextToSize(entityId, colWidths[3]);
        doc.text(entityIdText[0], xPosition, yPosition);
        xPosition += colWidths[3];
        
        // Usuário
        const usuarioText = doc.splitTextToSize(usuario, colWidths[4]);
        doc.text(usuarioText[0], xPosition, yPosition);

        yPosition += lineHeight;
      });

      // Salvar PDF
      const fileName = `relatorio-auditoria-${new Date().toISOString().split('T')[0]}.pdf`;
      doc.save(fileName);

      // Registrar geração do relatório
      try {
        await api.registrarGeracaoRelatorio('Relatório de Auditoria do Sistema');
      } catch (err) {
        console.error('Erro ao registrar geração do relatório:', err);
      }
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Não foi possível gerar o relatório.',
      );
    } finally {
      setGenerating(false);
    }
  }, [adicionarRodape]);

  const gerarRelatorioUsuarios = useCallback(async (dataInicio?: string, dataFim?: string) => {
    try {
      setGeneratingUsuarios(true);
      setError(null);

      // Buscar todos os usuários
      const usuariosData = await api.listUsuarios();
      
      // Filtrar por data se fornecido
      let usuariosFiltrados = usuariosData;
      if (dataInicio || dataFim) {
        usuariosFiltrados = usuariosData.filter((usuario) => {
          const dataCriacao = new Date(usuario.createdAt);
          if (dataInicio && dataCriacao < new Date(dataInicio)) return false;
          if (dataFim) {
            const fimDoDia = new Date(dataFim);
            fimDoDia.setHours(23, 59, 59, 999);
            if (dataCriacao > fimDoDia) return false;
          }
          return true;
        });
      }
      
      // Ordenar por data de criação (mais recentes primeiro)
      const usuariosOrdenados = [...usuariosFiltrados].sort((a, b) => 
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      );

      // Criar PDF em orientação paisagem
      const doc = new jsPDF('landscape');
      const pageWidth = doc.internal.pageSize.getWidth();
      const pageHeight = doc.internal.pageSize.getHeight();
      const margin = 15;
      const lineHeight = 6;
      let yPosition = margin;

      // Título
      doc.setFontSize(18);
      doc.text('Relatório de Usuários Cadastrados', margin, yPosition);
      yPosition += lineHeight * 2;

      // Data de geração
      doc.setFontSize(10);
      const dataGeracao = new Date().toLocaleString('pt-BR');
      doc.text(`Gerado em: ${dataGeracao}`, margin, yPosition);
      yPosition += lineHeight * 1.5;

      // Período filtrado
      if (dataInicio || dataFim) {
        const dataInicioFormatada = dataInicio 
          ? new Date(dataInicio).toLocaleDateString('pt-BR')
          : 'Início';
        const dataFimFormatada = dataFim
          ? new Date(dataFim).toLocaleDateString('pt-BR')
          : 'Fim';
        doc.text(`Período: ${dataInicioFormatada} a ${dataFimFormatada}`, margin, yPosition);
        yPosition += lineHeight * 1.5;
      }

      // Informações gerais
      doc.setFontSize(12);
      doc.text(`Total de usuários cadastrados: ${usuariosOrdenados.length}`, margin, yPosition);
      yPosition += lineHeight * 2;

      // Cabeçalho da tabela
      doc.setFontSize(9);
      doc.setFont('helvetica', 'bold');
      const headers = ['Data', 'Hora', 'Quem Cadastrou', 'Usuário Cadastrado', 'Nível', 'Função'];
      const colWidths = [25, 18, 50, 60, 50, 70];
      let xPosition = margin;

      headers.forEach((header, index) => {
        doc.text(header, xPosition, yPosition);
        xPosition += colWidths[index];
      });
      yPosition += lineHeight;

      // Linha separadora
      doc.setLineWidth(0.5);
      doc.line(margin, yPosition - 2, pageWidth - margin, yPosition - 2);
      yPosition += lineHeight * 0.5;

      // Adicionar rodapé na primeira página
      adicionarRodape(doc, pageWidth, pageHeight);

      // Linhas de dados
      doc.setFont('helvetica', 'normal');
      usuariosOrdenados.forEach((usuario) => {
        // Verificar se precisa de nova página
        if (yPosition > pageHeight - margin - lineHeight - 15) { // -15 para espaço do rodapé
          doc.addPage('landscape');
          yPosition = margin;
          
          // Reimprimir cabeçalho
          doc.setFont('helvetica', 'bold');
          xPosition = margin;
          headers.forEach((header, index) => {
            doc.text(header, xPosition, yPosition);
            xPosition += colWidths[index];
          });
          yPosition += lineHeight;
          doc.line(margin, yPosition - 2, pageWidth - margin, yPosition - 2);
          yPosition += lineHeight * 0.5;
          doc.setFont('helvetica', 'normal');
          
          // Adicionar rodapé na nova página
          adicionarRodape(doc, pageWidth, pageHeight);
        }

        // Formatar data e hora separadamente
        const date = new Date(usuario.createdAt);
        const dia = String(date.getDate()).padStart(2, '0');
        const mes = String(date.getMonth() + 1).padStart(2, '0');
        const ano = date.getFullYear();
        const data = `${dia}/${mes}/${ano}`;
        const horas = String(date.getHours()).padStart(2, '0');
        const minutos = String(date.getMinutes()).padStart(2, '0');
        const hora = `${horas}:${minutos}`;
        
        const quemCadastrou = usuario.createdByName || 'Sistema';
        const usuarioCadastrado = `${usuario.nome} (${usuario.matricula})`;
        const nivel = usuario.nivel?.nome || '-';
        const funcao = usuario.funcao?.nome || '-';

        xPosition = margin;
        doc.text(data, xPosition, yPosition);
        xPosition += colWidths[0];
        doc.text(hora, xPosition, yPosition);
        xPosition += colWidths[1];
        doc.text(quemCadastrou, xPosition, yPosition);
        xPosition += colWidths[2];
        doc.text(usuarioCadastrado, xPosition, yPosition);
        xPosition += colWidths[3];
        doc.text(nivel, xPosition, yPosition);
        xPosition += colWidths[4];
        doc.text(funcao, xPosition, yPosition);

        yPosition += lineHeight;
      });

      // Salvar PDF
      const fileName = `relatorio-usuarios-${new Date().toISOString().split('T')[0]}.pdf`;
      doc.save(fileName);

      // Registrar geração do relatório
      try {
        await api.registrarGeracaoRelatorio('Relatório de Usuários Cadastrados');
      } catch (err) {
        console.error('Erro ao registrar geração do relatório:', err);
      }
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Não foi possível gerar o relatório de usuários.',
      );
    } finally {
      setGeneratingUsuarios(false);
    }
  }, [adicionarRodape]);

  const gerarRelatorioLogsRelatorios = useCallback(async (dataInicio?: string, dataFim?: string) => {
    try {
      setGeneratingRelatorioLogs(true);
      setError(null);

      // Buscar todos os logs de relatórios (sem paginação) com filtro de data
      const response = await api.listRelatorioLogs(1, 10000, dataInicio, dataFim);
      const logs = response.logs;

      // Criar PDF em orientação paisagem
      const doc = new jsPDF('landscape');
      const pageWidth = doc.internal.pageSize.getWidth();
      const pageHeight = doc.internal.pageSize.getHeight();
      const margin = 15;
      const lineHeight = 6;
      let yPosition = margin;

      // Título
      doc.setFontSize(18);
      doc.text('Relatório de Geração de Relatórios', margin, yPosition);
      yPosition += lineHeight * 2;

      // Data de geração
      doc.setFontSize(10);
      const dataGeracao = new Date().toLocaleString('pt-BR');
      doc.text(`Gerado em: ${dataGeracao}`, margin, yPosition);
      yPosition += lineHeight * 1.5;

      // Período filtrado
      if (dataInicio || dataFim) {
        const dataInicioFormatada = dataInicio 
          ? new Date(dataInicio).toLocaleDateString('pt-BR')
          : 'Início';
        const dataFimFormatada = dataFim
          ? new Date(dataFim).toLocaleDateString('pt-BR')
          : 'Fim';
        doc.text(`Período: ${dataInicioFormatada} a ${dataFimFormatada}`, margin, yPosition);
        yPosition += lineHeight * 1.5;
      }

      // Informações gerais
      doc.setFontSize(12);
      doc.text(`Total de relatórios gerados: ${logs.length}`, margin, yPosition);
      yPosition += lineHeight * 2;

      // Cabeçalho da tabela
      doc.setFontSize(9);
      doc.setFont('helvetica', 'bold');
      const headers = ['Data', 'Hora', 'Nome', 'Matrícula', 'Tipo de Relatório'];
      const colWidths = [30, 20, 80, 40, 100];
      let xPosition = margin;

      headers.forEach((header, index) => {
        doc.text(header, xPosition, yPosition);
        xPosition += colWidths[index];
      });
      yPosition += lineHeight;

      // Linha separadora
      doc.setLineWidth(0.5);
      doc.line(margin, yPosition - 2, pageWidth - margin, yPosition - 2);
      yPosition += lineHeight * 0.5;

      // Adicionar rodapé na primeira página
      adicionarRodape(doc, pageWidth, pageHeight);

      // Linhas de dados
      doc.setFont('helvetica', 'normal');
      logs.forEach((log) => {
        // Verificar se precisa de nova página
        if (yPosition > pageHeight - margin - lineHeight - 15) { // -15 para espaço do rodapé
          doc.addPage('landscape');
          yPosition = margin;
          
          // Reimprimir cabeçalho
          doc.setFont('helvetica', 'bold');
          xPosition = margin;
          headers.forEach((header, index) => {
            doc.text(header, xPosition, yPosition);
            xPosition += colWidths[index];
          });
          yPosition += lineHeight;
          doc.line(margin, yPosition - 2, pageWidth - margin, yPosition - 2);
          yPosition += lineHeight * 0.5;
          doc.setFont('helvetica', 'normal');
          
          // Adicionar rodapé na nova página
          adicionarRodape(doc, pageWidth, pageHeight);
        }

        // Formatar data e hora separadamente
        const date = new Date(log.createdAt);
        const dia = String(date.getDate()).padStart(2, '0');
        const mes = String(date.getMonth() + 1).padStart(2, '0');
        const ano = date.getFullYear();
        const data = `${dia}/${mes}/${ano}`;
        const horas = String(date.getHours()).padStart(2, '0');
        const minutos = String(date.getMinutes()).padStart(2, '0');
        const hora = `${horas}:${minutos}`;
        
        const nome = log.userName || '-';
        const matricula = log.matricula || '-';
        const tipoRelatorio = log.tipoRelatorio;

        xPosition = margin;
        doc.text(data, xPosition, yPosition);
        xPosition += colWidths[0];
        doc.text(hora, xPosition, yPosition);
        xPosition += colWidths[1];
        doc.text(nome, xPosition, yPosition);
        xPosition += colWidths[2];
        doc.text(matricula, xPosition, yPosition);
        xPosition += colWidths[3];
        doc.text(tipoRelatorio, xPosition, yPosition);

        yPosition += lineHeight;
      });

      // Salvar PDF
      const fileName = `relatorio-geracao-relatorios-${new Date().toISOString().split('T')[0]}.pdf`;
      doc.save(fileName);

      // Registrar geração do relatório
      try {
        await api.registrarGeracaoRelatorio('Relatório de Geração de Relatórios');
      } catch (err) {
        console.error('Erro ao registrar geração do relatório:', err);
      }
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Não foi possível gerar o relatório de geração de relatórios.',
      );
    } finally {
      setGeneratingRelatorioLogs(false);
    }
  }, [adicionarRodape]);

  const gerarRelatorioErros = useCallback(async (dataInicio?: string, dataFim?: string) => {
    try {
      setGeneratingErros(true);
      setError(null);

      // Buscar todos os logs de erros (sem paginação) com filtro de data
      const response = await api.listErroLogs(1, 10000, dataInicio, dataFim);
      const logs = response.logs || response.erros || [];
      const errosList = Array.isArray(logs) ? logs : [];

      // Criar PDF em orientação paisagem
      const doc = new jsPDF('landscape');
      const pageWidth = doc.internal.pageSize.getWidth();
      const pageHeight = doc.internal.pageSize.getHeight();
      const margin = 15;
      const lineHeight = 6;
      let yPosition = margin;

      // Título
      doc.setFontSize(18);
      doc.text('Relatório de Erros do Sistema', margin, yPosition);
      yPosition += lineHeight * 2;

      // Data de geração
      doc.setFontSize(10);
      const dataGeracao = new Date().toLocaleString('pt-BR');
      doc.text(`Gerado em: ${dataGeracao}`, margin, yPosition);
      yPosition += lineHeight * 1.5;

      // Período filtrado
      if (dataInicio || dataFim) {
        const dataInicioFormatada = dataInicio 
          ? new Date(dataInicio).toLocaleDateString('pt-BR')
          : 'Início';
        const dataFimFormatada = dataFim
          ? new Date(dataFim).toLocaleDateString('pt-BR')
          : 'Fim';
        doc.text(`Período: ${dataInicioFormatada} a ${dataFimFormatada}`, margin, yPosition);
        yPosition += lineHeight * 1.5;
      }

      // Informações gerais
      doc.setFontSize(12);
      doc.text(`Total de erros registrados: ${errosList.length}`, margin, yPosition);
      yPosition += lineHeight * 2;

      // Cabeçalho da tabela
      doc.setFontSize(8);
      doc.setFont('helvetica', 'bold');
      const headers = ['Data', 'Hora', 'Status', 'Método', 'Endpoint', 'Mensagem', 'Usuário'];
      const colWidths = [25, 18, 20, 18, 60, 90, 50];
      let xPosition = margin;

      headers.forEach((header, index) => {
        doc.text(header, xPosition, yPosition);
        xPosition += colWidths[index];
      });
      yPosition += lineHeight;

      // Linha separadora
      doc.setLineWidth(0.5);
      doc.line(margin, yPosition - 2, pageWidth - margin, yPosition - 2);
      yPosition += lineHeight * 0.5;

      // Adicionar rodapé na primeira página
      adicionarRodape(doc, pageWidth, pageHeight);

      // Linhas de dados
      doc.setFont('helvetica', 'normal');
      errosList.forEach((erro) => {
        // Verificar se precisa de nova página
        if (yPosition > pageHeight - margin - lineHeight - 15) { // -15 para espaço do rodapé
          doc.addPage('landscape');
          yPosition = margin;
          
          // Reimprimir cabeçalho
          doc.setFont('helvetica', 'bold');
          xPosition = margin;
          headers.forEach((header, index) => {
            doc.text(header, xPosition, yPosition);
            xPosition += colWidths[index];
          });
          yPosition += lineHeight;
          doc.line(margin, yPosition - 2, pageWidth - margin, yPosition - 2);
          yPosition += lineHeight * 0.5;
          doc.setFont('helvetica', 'normal');
          
          // Adicionar rodapé na nova página
          adicionarRodape(doc, pageWidth, pageHeight);
        }

        // Formatar data e hora separadamente
        const date = new Date(erro.createdAt);
        const dia = String(date.getDate()).padStart(2, '0');
        const mes = String(date.getMonth() + 1).padStart(2, '0');
        const ano = date.getFullYear();
        const data = `${dia}/${mes}/${ano}`;
        const horas = String(date.getHours()).padStart(2, '0');
        const minutos = String(date.getMinutes()).padStart(2, '0');
        const hora = `${horas}:${minutos}`;
        
        const statusCode = erro.statusCode?.toString() || '-';
        const metodo = erro.metodo || '-';
        const endpoint = erro.endpoint || '-';
        const mensagem = erro.mensagem || '-';
        const usuario = erro.userName || erro.matricula || '-';

        xPosition = margin;
        
        // Truncar textos longos
        const truncarTexto = (texto: string, largura: number) => {
          const textoTruncado = doc.splitTextToSize(texto, largura);
          return textoTruncado[0] || texto.substring(0, 20);
        };
        
        doc.text(data, xPosition, yPosition);
        xPosition += colWidths[0];
        doc.text(hora, xPosition, yPosition);
        xPosition += colWidths[1];
        doc.text(statusCode, xPosition, yPosition);
        xPosition += colWidths[2];
        doc.text(metodo, xPosition, yPosition);
        xPosition += colWidths[3];
        doc.text(truncarTexto(endpoint, colWidths[4]), xPosition, yPosition);
        xPosition += colWidths[4];
        doc.text(truncarTexto(mensagem, colWidths[5]), xPosition, yPosition);
        xPosition += colWidths[5];
        doc.text(truncarTexto(usuario, colWidths[6]), xPosition, yPosition);

        yPosition += lineHeight;
      });

      // Salvar PDF
      const fileName = `relatorio-erros-${new Date().toISOString().split('T')[0]}.pdf`;
      doc.save(fileName);

      // Registrar geração do relatório
      try {
        await api.registrarGeracaoRelatorio('Relatório de Erros do Sistema');
      } catch (err) {
        console.error('Erro ao registrar geração do relatório:', err);
      }
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Não foi possível gerar o relatório de erros.',
      );
    } finally {
      setGeneratingErros(false);
    }
  }, [adicionarRodape]);

  const gerarRelatorioAcessos = useCallback(async (dataInicio?: string, dataFim?: string) => {
    try {
      setGeneratingAcessos(true);
      setError(null);

      // Buscar todos os logs de acessos (sem paginação) com filtro de data
      const response = await api.listAcessoLogs(1, 10000, dataInicio, dataFim);
      const logs = response.logs || response.acessos || [];
      const acessosList = Array.isArray(logs) ? logs : [];

      // Criar PDF em orientação paisagem
      const doc = new jsPDF('landscape');
      const pageWidth = doc.internal.pageSize.getWidth();
      const pageHeight = doc.internal.pageSize.getHeight();
      const margin = 15;
      const lineHeight = 6;
      let yPosition = margin;

      // Título
      doc.setFontSize(18);
      doc.text('Relatório de Acessos ao Sistema', margin, yPosition);
      yPosition += lineHeight * 2;

      // Data de geração
      doc.setFontSize(10);
      const dataGeracao = new Date().toLocaleString('pt-BR');
      doc.text(`Gerado em: ${dataGeracao}`, margin, yPosition);
      yPosition += lineHeight * 1.5;

      // Período filtrado
      if (dataInicio || dataFim) {
        const dataInicioFormatada = dataInicio 
          ? new Date(dataInicio).toLocaleDateString('pt-BR')
          : 'Início';
        const dataFimFormatada = dataFim
          ? new Date(dataFim).toLocaleDateString('pt-BR')
          : 'Fim';
        doc.text(`Período: ${dataInicioFormatada} a ${dataFimFormatada}`, margin, yPosition);
        yPosition += lineHeight * 1.5;
      }

      // Informações gerais
      doc.setFontSize(12);
      doc.text(`Total de acessos registrados: ${acessosList.length}`, margin, yPosition);
      yPosition += lineHeight * 2;

      // Cabeçalho da tabela
      doc.setFontSize(8);
      doc.setFont('helvetica', 'bold');
      const headers = ['Data Entrada', 'Hora Entrada', 'Usuário', 'Matrícula', 'IP', 'Data Saída', 'Hora Saída', 'Tempo Sessão'];
      const colWidths = [25, 18, 60, 25, 30, 25, 18, 30];
      let xPosition = margin;

      headers.forEach((header, index) => {
        doc.text(header, xPosition, yPosition);
        xPosition += colWidths[index];
      });
      yPosition += lineHeight;

      // Linha separadora
      doc.setLineWidth(0.5);
      doc.line(margin, yPosition - 2, pageWidth - margin, yPosition - 2);
      yPosition += lineHeight * 0.5;

      // Adicionar rodapé na primeira página
      adicionarRodape(doc, pageWidth, pageHeight);

      // Linhas de dados
      doc.setFont('helvetica', 'normal');
      acessosList.forEach((acesso) => {
        // Verificar se precisa de nova página
        if (yPosition > pageHeight - margin - lineHeight - 15) { // -15 para espaço do rodapé
          doc.addPage('landscape');
          yPosition = margin;
          
          // Reimprimir cabeçalho
          doc.setFont('helvetica', 'bold');
          xPosition = margin;
          headers.forEach((header, index) => {
            doc.text(header, xPosition, yPosition);
            xPosition += colWidths[index];
          });
          yPosition += lineHeight;
          doc.line(margin, yPosition - 2, pageWidth - margin, yPosition - 2);
          yPosition += lineHeight * 0.5;
          doc.setFont('helvetica', 'normal');
          
          // Adicionar rodapé na nova página
          adicionarRodape(doc, pageWidth, pageHeight);
        }

        // Formatar data e hora de entrada separadamente
        const dateEntrada = new Date(acesso.dataEntrada);
        const diaEntrada = String(dateEntrada.getDate()).padStart(2, '0');
        const mesEntrada = String(dateEntrada.getMonth() + 1).padStart(2, '0');
        const anoEntrada = dateEntrada.getFullYear();
        const dataEntrada = `${diaEntrada}/${mesEntrada}/${anoEntrada}`;
        const horasEntrada = String(dateEntrada.getHours()).padStart(2, '0');
        const minutosEntrada = String(dateEntrada.getMinutes()).padStart(2, '0');
        const horaEntrada = `${horasEntrada}:${minutosEntrada}`;
        
        // Formatar data e hora de saída separadamente (se houver)
        let dataSaida = '-';
        let horaSaida = '-';
        if (acesso.dataSaida) {
          const dateSaida = new Date(acesso.dataSaida);
          const diaSaida = String(dateSaida.getDate()).padStart(2, '0');
          const mesSaida = String(dateSaida.getMonth() + 1).padStart(2, '0');
          const anoSaida = dateSaida.getFullYear();
          dataSaida = `${diaSaida}/${mesSaida}/${anoSaida}`;
          const horasSaida = String(dateSaida.getHours()).padStart(2, '0');
          const minutosSaida = String(dateSaida.getMinutes()).padStart(2, '0');
          horaSaida = `${horasSaida}:${minutosSaida}`;
        }
        
        const usuario = acesso.userName || '-';
        const matricula = acesso.matricula || '-';
        const ip = acesso.ip || '-';
        
        // Calcular tempo de sessão diretamente das datas para garantir precisão
        // Formato: hh:mm:ss
        const calcularTempoSessao = (dataEntrada: Date | string, dataSaida: Date | string | null | undefined): string => {
          if (!dataSaida) {
            return '-';
          }
          
          // Garantir que ambas as datas sejam objetos Date
          const dateEntradaObj = dataEntrada instanceof Date ? dataEntrada : new Date(dataEntrada);
          const dateSaidaObj = dataSaida instanceof Date ? dataSaida : new Date(dataSaida);
          
          // Verificar se as datas são válidas
          if (isNaN(dateEntradaObj.getTime()) || isNaN(dateSaidaObj.getTime())) {
            return '-';
          }
          
          // Calcular diferença em segundos
          const diferencaMs = dateSaidaObj.getTime() - dateEntradaObj.getTime();
          const segundosTotal = Math.floor(diferencaMs / 1000);
          
          // Se a diferença for negativa, retornar '-'
          if (segundosTotal < 0) {
            return '-';
          }
          
          // Converter para hh:mm:ss
          const horas = Math.floor(segundosTotal / 3600);
          const minutosRestantes = Math.floor((segundosTotal % 3600) / 60);
          const segundos = segundosTotal % 60;
          
          return `${String(horas).padStart(2, '0')}:${String(minutosRestantes).padStart(2, '0')}:${String(segundos).padStart(2, '0')}`;
        };
        
        const tempoSessao = calcularTempoSessao(acesso.dataEntrada, acesso.dataSaida);

        xPosition = margin;
        
        // Truncar textos longos
        const truncarTexto = (texto: string, largura: number) => {
          const textoTruncado = doc.splitTextToSize(texto, largura);
          return textoTruncado[0] || texto.substring(0, 20);
        };
        
        doc.text(dataEntrada, xPosition, yPosition);
        xPosition += colWidths[0];
        doc.text(horaEntrada, xPosition, yPosition);
        xPosition += colWidths[1];
        doc.text(truncarTexto(usuario, colWidths[2]), xPosition, yPosition);
        xPosition += colWidths[2];
        doc.text(matricula, xPosition, yPosition);
        xPosition += colWidths[3];
        doc.text(truncarTexto(ip, colWidths[4]), xPosition, yPosition);
        xPosition += colWidths[4];
        doc.text(dataSaida, xPosition, yPosition);
        xPosition += colWidths[5];
        doc.text(horaSaida, xPosition, yPosition);
        xPosition += colWidths[6];
        doc.text(tempoSessao, xPosition, yPosition);

        yPosition += lineHeight;
      });

      // Salvar PDF
      const fileName = `relatorio-acessos-${new Date().toISOString().split('T')[0]}.pdf`;
      doc.save(fileName);

      // Registrar geração do relatório
      try {
        await api.registrarGeracaoRelatorio('Relatório de Acessos ao Sistema');
      } catch (err) {
        console.error('Erro ao registrar geração do relatório:', err);
      }
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Não foi possível gerar o relatório de acessos.',
      );
    } finally {
      setGeneratingAcessos(false);
    }
  }, [adicionarRodape]);

  const confirmarGeracaoRelatorio = useCallback(async () => {
    const { tipoRelatorio, dataInicio, dataFim } = modalDataFiltro;
    fecharModalFiltro();

    if (tipoRelatorio === 'auditoria') {
      await gerarRelatorioCompleto(dataInicio, dataFim);
    } else if (tipoRelatorio === 'usuarios') {
      await gerarRelatorioUsuarios(dataInicio, dataFim);
    } else if (tipoRelatorio === 'geracao-relatorios') {
      await gerarRelatorioLogsRelatorios(dataInicio, dataFim);
    } else if (tipoRelatorio === 'erros') {
      await gerarRelatorioErros(dataInicio, dataFim);
    } else if (tipoRelatorio === 'acessos') {
      await gerarRelatorioAcessos(dataInicio, dataFim);
    }
  }, [modalDataFiltro, fecharModalFiltro, gerarRelatorioCompleto, gerarRelatorioUsuarios, gerarRelatorioLogsRelatorios, gerarRelatorioErros, gerarRelatorioAcessos]);

  return (
    <section>
      <div>
        <h2>Relatórios</h2>
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

      {/* Cards principais */}
      {!canView(permissoes, 'relatorios-sistema') && !canView(permissoes, 'relatorios-servico') ? (
        <div className="empty-state" style={{ marginTop: '1.5rem' }}>
          Você não possui permissão para visualizar nenhum tipo de relatório.
        </div>
      ) : (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
            gap: '1.5rem',
            marginTop: '1.5rem',
          }}
        >
          {/* Card principal - Auditoria do Sistema */}
          {canView(permissoes, 'relatorios-sistema') && (
          <button
            type="button"
            onClick={() =>
              setExpandedCard((prev) => (prev === 'auditoria' ? null : 'auditoria'))
            }
          style={{
            textAlign: 'left',
            border: expandedCard === 'auditoria' ? '2px solid #2563eb' : '1px solid #e2e8f0',
            borderRadius: '8px',
            padding: '1.25rem 1.5rem',
            backgroundColor: expandedCard === 'auditoria' ? '#eff6ff' : '#ffffff',
            display: 'flex',
            flexDirection: 'column',
            gap: '0.5rem',
            cursor: 'pointer',
            transition: 'border-color 0.2s ease, background-color 0.2s ease, box-shadow 0.2s ease, transform 0.1s ease',
            boxShadow:
              expandedCard === 'auditoria'
                ? '0 4px 12px rgba(37, 99, 235, 0.15)'
                : '0 1px 3px rgba(15, 23, 42, 0.08)',
          }}
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: '0.75rem',
            }}
          >
            <div>
              <h3 style={{ margin: 0 }}>Relatórios de Auditoria do Sistema</h3>
              <p
                style={{
                  margin: 0,
                  marginTop: '0.25rem',
                  color: '#64748b',
                  fontSize: '0.9rem',
                }}
              >
                Relatórios sobre ações no sistema, usuários, erros e acessos.
              </p>
            </div>
            <span
              style={{
                fontSize: '1.25rem',
                color: '#2563eb',
                transform: expandedCard === 'auditoria' ? 'rotate(90deg)' : 'rotate(0deg)',
                transition: 'transform 0.2s ease',
              }}
            >
              ▶
            </span>
          </div>
          <span
            style={{
              fontSize: '0.8rem',
              fontWeight: 500,
              color: '#1d4ed8',
              marginTop: '0.25rem',
            }}
          >
            {expandedCard === 'auditoria' ? 'Clique para recolher' : 'Clique para ver opções'}
          </span>
          </button>
          )}

          {/* Card principal - Relatórios de Serviço */}
          {canView(permissoes, 'relatorios-servico') && (
          <button
            type="button"
            onClick={() =>
              setExpandedCard((prev) => (prev === 'servico' ? null : 'servico'))
            }
          style={{
            textAlign: 'left',
            border: expandedCard === 'servico' ? '2px solid #2563eb' : '1px solid #e2e8f0',
            borderRadius: '8px',
            padding: '1.25rem 1.5rem',
            backgroundColor: expandedCard === 'servico' ? '#eff6ff' : '#ffffff',
            display: 'flex',
            flexDirection: 'column',
            gap: '0.5rem',
            cursor: 'pointer',
            transition: 'border-color 0.2s ease, background-color 0.2s ease, box-shadow 0.2s ease, transform 0.1s ease',
            boxShadow:
              expandedCard === 'servico'
                ? '0 4px 12px rgba(37, 99, 235, 0.15)'
                : '0 1px 3px rgba(15, 23, 42, 0.08)',
          }}
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: '0.75rem',
            }}
          >
            <div>
              <h3 style={{ margin: 0 }}>Relatórios de Serviço</h3>
              <p
                style={{
                  margin: 0,
                  marginTop: '0.25rem',
                  color: '#64748b',
                  fontSize: '0.9rem',
                }}
              >
                Relatórios operacionais do serviço (escala, equipes, indicadores etc.).
              </p>
            </div>
            <span
              style={{
                fontSize: '1.25rem',
                color: '#2563eb',
                transform: expandedCard === 'servico' ? 'rotate(90deg)' : 'rotate(0deg)',
                transition: 'transform 0.2s ease',
              }}
            >
              ▶
            </span>
          </div>
          <span
            style={{
              fontSize: '0.8rem',
              fontWeight: 500,
              color: '#1d4ed8',
              marginTop: '0.25rem',
            }}
          >
            {expandedCard === 'servico' ? 'Clique para recolher' : 'Clique para ver opções'}
          </span>
          </button>
          )}
        </div>
      )}

      {/* Área expandida - Auditoria do Sistema */}
      {canView(permissoes, 'relatorios-sistema') && (
        <div
          style={{
            marginTop: '1.5rem',
            maxHeight: expandedCard === 'auditoria' ? 1000 : 0,
          opacity: expandedCard === 'auditoria' ? 1 : 0,
          transform:
            expandedCard === 'auditoria' ? 'translateY(0px)' : 'translateY(-8px)',
          overflow: 'hidden',
          transition:
            'max-height 0.3s ease, opacity 0.3s ease, transform 0.3s ease',
        }}
      >
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
            gap: '2rem',
          }}
        >
          <div
            style={{
              border: '1px solid #e2e8f0',
              borderRadius: '8px',
              padding: '1.5rem',
              display: 'flex',
              flexDirection: 'column',
              gap: '1rem',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <h3 style={{ margin: 0 }}>Relatório de Auditoria</h3>
              <div className="tooltip-container">
                <span className="tooltip-icon">?</span>
                <div className="tooltip-text">
                  Este relatório mostra todas as ações realizadas no sistema e quem as executou.
                </div>
              </div>
            </div>
            {loading ? (
              <p className="empty-state" style={{ margin: 0 }}>
                Carregando logs de auditoria...
              </p>
            ) : (
              <button
                className="primary"
                type="button"
                onClick={() => abrirModalFiltro('auditoria')}
                disabled={generating || auditLogs.length === 0}
                style={{ marginTop: 'auto' }}
              >
                {generating ? 'Gerando PDF...' : 'Gerar PDF'}
              </button>
            )}
          </div>

          <div
            style={{
              border: '1px solid #e2e8f0',
              borderRadius: '8px',
              padding: '1.5rem',
              display: 'flex',
              flexDirection: 'column',
              gap: '1rem',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <h3 style={{ margin: 0 }}>Relatório de Usuários Cadastrados</h3>
              <div className="tooltip-container">
                <span className="tooltip-icon">?</span>
                <div className="tooltip-text">
                  Este relatório mostra todos os usuários cadastrados no sistema, incluindo quem os cadastrou, data, hora, nível e função.
                </div>
              </div>
            </div>
            <button
              className="primary"
              type="button"
              onClick={() => abrirModalFiltro('usuarios')}
              disabled={generatingUsuarios || usuarios.length === 0}
              style={{ marginTop: 'auto' }}
            >
              {generatingUsuarios ? 'Gerando PDF...' : 'Gerar PDF'}
            </button>
          </div>

          <div
            style={{
              border: '1px solid #e2e8f0',
              borderRadius: '8px',
              padding: '1.5rem',
              display: 'flex',
              flexDirection: 'column',
              gap: '1rem',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <h3 style={{ margin: 0 }}>Relatório de Geração de Relatórios</h3>
              <div className="tooltip-container">
                <span className="tooltip-icon">?</span>
                <div className="tooltip-text">
                  Este relatório mostra quem gerou relatórios no sistema, incluindo nome, matrícula, data, hora e tipo de relatório.
                </div>
              </div>
            </div>
            <button
              className="primary"
              type="button"
              onClick={() => abrirModalFiltro('geracao-relatorios')}
              disabled={generatingRelatorioLogs || relatorioLogs.length === 0}
              style={{ marginTop: 'auto' }}
            >
              {generatingRelatorioLogs ? 'Gerando PDF...' : 'Gerar PDF'}
            </button>
          </div>

          <div
            style={{
              border: '1px solid #e2e8f0',
              borderRadius: '8px',
              padding: '1.5rem',
              display: 'flex',
              flexDirection: 'column',
              gap: '1rem',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <h3 style={{ margin: 0 }}>Relatório de Erros do Sistema</h3>
              <div className="tooltip-container">
                <span className="tooltip-icon">?</span>
                <div className="tooltip-text">
                  Este relatório mostra todos os erros registrados no sistema, incluindo data, hora, status HTTP, método, endpoint, mensagem de erro e usuário relacionado.
                </div>
              </div>
            </div>
            <button
              className="primary"
              type="button"
              onClick={() => abrirModalFiltro('erros')}
              disabled={generatingErros || erroLogs.length === 0}
              style={{ marginTop: 'auto' }}
            >
              {generatingErros ? 'Gerando PDF...' : 'Gerar PDF'}
            </button>
          </div>

          <div
            style={{
              border: '1px solid #e2e8f0',
              borderRadius: '8px',
              padding: '1.5rem',
              display: 'flex',
              flexDirection: 'column',
              gap: '1rem',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <h3 style={{ margin: 0 }}>Relatório de Acessos ao Sistema</h3>
              <div className="tooltip-container">
                <span className="tooltip-icon">?</span>
                <div className="tooltip-text">
                  Este relatório mostra todos os acessos ao sistema, incluindo quem entrou, data e hora de entrada, IP, data e hora de saída, e tempo de sessão.
                </div>
              </div>
            </div>
            <button
              className="primary"
              type="button"
              onClick={() => abrirModalFiltro('acessos')}
              disabled={generatingAcessos || acessoLogs.length === 0}
              style={{ marginTop: 'auto' }}
            >
              {generatingAcessos ? 'Gerando PDF...' : 'Gerar PDF'}
            </button>
          </div>
        </div>
      </div>
      )}

      {/* Área expandida - Relatórios de Serviço */}
      {canView(permissoes, 'relatorios-servico') && (
        <div
          style={{
            marginTop: '1.5rem',
            maxHeight: expandedCard === 'servico' ? 600 : 0,
          opacity: expandedCard === 'servico' ? 1 : 0,
          transform:
            expandedCard === 'servico' ? 'translateY(0px)' : 'translateY(-8px)',
          overflow: 'hidden',
          transition:
            'max-height 0.3s ease, opacity 0.3s ease, transform 0.3s ease',
        }}
      >
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
            gap: '2rem',
          }}
        >
          <div
            style={{
              border: '1px solid #e2e8f0',
              borderRadius: '8px',
              padding: '1.5rem',
              display: 'flex',
              flexDirection: 'column',
              gap: '0.75rem',
              backgroundColor: '#f9fafb',
            }}
          >
            <h4 style={{ margin: 0 }}>Relatórios de Serviço (em breve)</h4>
            <p style={{ margin: 0, color: '#6b7280', fontSize: '0.9rem' }}>
              Em breve você poderá gerar relatórios específicos do serviço, como escala, equipes, afastamentos por período e outros indicadores operacionais.
            </p>
            <button
              type="button"
              className="secondary"
              disabled
              style={{ marginTop: 'auto', cursor: 'not-allowed', opacity: 0.7 }}
            >
              Em desenvolvimento
            </button>
          </div>
        </div>
      </div>
      )}

      {/* Modal de Seleção de Período */}
      {modalDataFiltro.open && (
        <div className="modal-backdrop" role="dialog" aria-modal="true">
          <div className="modal" style={{ maxWidth: '500px' }}>
            <h3>Selecionar Período</h3>
            <p>Escolha o período para gerar o relatório:</p>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', marginTop: '1rem' }}>
              <div>
                <label htmlFor="dataInicio" style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '500' }}>
                  Data Início:
                </label>
                <input
                  id="dataInicio"
                  type="date"
                  value={modalDataFiltro.dataInicio}
                  onChange={(e) => {
                    setModalDataFiltro((prev) => ({ ...prev, dataInicio: e.target.value }));
                    // Resetar o estado de foco quando a data de início mudar para permitir pré-seleção novamente
                    if (!modalDataFiltro.dataFim) {
                      setDataFimFocada(false);
                    }
                  }}
                  style={{
                    width: '100%',
                    padding: '0.5rem',
                    border: '1px solid #cbd5e1',
                    borderRadius: '4px',
                    fontSize: '14px',
                  }}
                />
              </div>

              <div>
                <label htmlFor="dataFim" style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '500' }}>
                  Data Fim:
                </label>
                <input
                  id="dataFim"
                  type="date"
                  value={modalDataFiltro.dataFim}
                  onChange={(e) => {
                    setModalDataFiltro((prev) => ({ ...prev, dataFim: e.target.value }));
                    setDataFimFocada(true);
                  }}
                  min={modalDataFiltro.dataInicio || undefined}
                  onFocus={(event) => {
                    // Quando o campo recebe foco e não tem valor, pré-selecionar a data de início
                    if (!modalDataFiltro.dataFim && modalDataFiltro.dataInicio && !dataFimFocada) {
                      const input = event.currentTarget;
                      // Definir o valor diretamente no input para que o calendário abra com essa data pré-selecionada
                      input.value = modalDataFiltro.dataInicio;
                      setModalDataFiltro((prev) => ({ ...prev, dataFim: prev.dataInicio }));
                      setDataFimFocada(true);
                    }
                  }}
                  style={{
                    width: '100%',
                    padding: '0.5rem',
                    border: '1px solid #cbd5e1',
                    borderRadius: '4px',
                    fontSize: '14px',
                  }}
                />
              </div>
            </div>

            <div className="modal-actions" style={{ marginTop: '1.5rem' }}>
              <button
                type="button"
                className="secondary"
                onClick={fecharModalFiltro}
              >
                Cancelar
              </button>
              <button
                type="button"
                className="primary"
                onClick={confirmarGeracaoRelatorio}
                disabled={
                  !modalDataFiltro.dataInicio ||
                  !modalDataFiltro.dataFim ||
                  generating ||
                  generatingUsuarios ||
                  generatingRelatorioLogs ||
                  generatingErros ||
                  generatingAcessos
                }
              >
                Gerar Relatório
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
