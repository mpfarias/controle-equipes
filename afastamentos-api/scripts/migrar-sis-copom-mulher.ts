/**
 * Migra dados do sisCopomMulher (PostgreSQL legado) para as tabelas mulher_* do Órion.
 *
 * Uso:
 *   cd afastamentos-api
 *   npx ts-node scripts/migrar-sis-copom-mulher.ts
 *
 * Variáveis:
 *   DATABASE_URL — banco destino (Órion)
 *   MULHER_LEGACY_DATABASE_URL — banco legado (opcional; padrão = DATABASE_URL)
 *   MULHER_MIGRATE_DRY_RUN=1 — apenas simula, sem gravar
 */
import { PrismaClient } from '@prisma/client';
import { Client } from 'pg';

const prisma = new PrismaClient();
const dryRun = process.env.MULHER_MIGRATE_DRY_RUN === '1';

type LegacyOccurrence = {
  id: string;
  origem: string;
  createdAt: Date;
  updatedAt: Date;
  createdById: string | null;
  updatedById: string | null;
  faseAtual: number;
  concluida: boolean;
  carimboDataHora: Date | null;
  nomeVitima: string | null;
  enderecoVitima: string | null;
  telefoneVitima: string | null;
  telefoneVitimaSecundario: string | null;
  cpfVitima: string | null;
  dataNascimentoVitima: Date | null;
  genitoraVitima: string | null;
  pontoReferencia: string | null;
  dataHoraOcorrencia: Date | null;
  regiaoAdministrativa: string | null;
  historicoOcorrencia: string | null;
  nomeAgressor: string | null;
  enderecoAgressor: string | null;
  parentescoAgressorVitima: string | null;
  tipoAmeacaAgressao: string | null;
  agressorEnvolvimento: string | null;
  idadeAgressor: string | null;
  nomeDenunciante: string | null;
  enderecoDenunciante: string | null;
  telefoneDenunciante: string | null;
  comandanteViatura: string | null;
  responsavelAtendimento: string | null;
  encaminhamentoDetalhes: string | null;
  desfecho: string | null;
  registrouBoDp: string | null;
  numeroOcorrenciaCad: string | null;
};

async function tableExists(client: Client, table: string): Promise<boolean> {
  const r = await client.query<{ reg: string | null }>(
    `SELECT to_regclass($1) AS reg`,
    [table.includes('"') ? table : `"${table}"`],
  );
  return r.rows[0]?.reg != null;
}

async function main() {
  const legacyUrl = process.env.MULHER_LEGACY_DATABASE_URL?.trim() || process.env.DATABASE_URL;
  if (!legacyUrl) {
    throw new Error('Defina DATABASE_URL ou MULHER_LEGACY_DATABASE_URL.');
  }

  const legacy = new Client({ connectionString: legacyUrl });
  await legacy.connect();

  console.log(`Modo: ${dryRun ? 'DRY RUN (sem gravar)' : 'MIGRAÇÃO'}`);
  console.log(`Origem legado: ${legacyUrl.replace(/:[^:@/]+@/, ':***@')}`);

  const hasOccurrence = await tableExists(legacy, 'Occurrence');
  if (!hasOccurrence) {
    console.log('Tabela "Occurrence" não encontrada no banco legado. Nada a migrar.');
    await legacy.end();
    await prisma.$disconnect();
    return;
  }

  const legacyUsers = await legacy.query<{ id: string; matricula: string | null; nomeCompleto: string }>(
    `SELECT id, matricula, "nomeCompleto" FROM "User"`,
  );
  const orionUsers = await prisma.usuario.findMany({
    select: { id: true, matricula: true, nome: true },
  });
  const matriculaToOrionId = new Map<string, number>();
  for (const u of orionUsers) {
    const m = u.matricula?.trim().toUpperCase();
    if (m) matriculaToOrionId.set(m, u.id);
  }
  const legacyUserToOrionId = new Map<string, number>();
  const legacyUserNome = new Map<string, string>();
  for (const u of legacyUsers.rows) {
    legacyUserNome.set(u.id, u.nomeCompleto);
    const m = u.matricula?.trim().toUpperCase();
    if (m && matriculaToOrionId.has(m)) {
      legacyUserToOrionId.set(u.id, matriculaToOrionId.get(m)!);
    }
  }

  const occRows = await legacy.query<LegacyOccurrence>(`SELECT * FROM "Occurrence" ORDER BY "createdAt"`);
  console.log(`Ocorrências legadas: ${occRows.rowCount}`);

  let occInserted = 0;
  let occSkipped = 0;
  for (const row of occRows.rows) {
    const exists = await prisma.mulherOcorrencia.findUnique({ where: { id: row.id } });
    if (exists) {
      occSkipped++;
      continue;
    }
    const data = {
      id: row.id,
      origem: row.origem === 'IMPORTACAO_EXCEL' ? ('IMPORTACAO_EXCEL' as const) : ('SISTEMA' as const),
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
      criadoPorId: row.createdById ? (legacyUserToOrionId.get(row.createdById) ?? null) : null,
      atualizadoPorId: row.updatedById ? (legacyUserToOrionId.get(row.updatedById) ?? null) : null,
      faseAtual: row.faseAtual,
      concluida: row.concluida,
      carimboDataHora: row.carimboDataHora,
      nomeVitima: row.nomeVitima,
      enderecoVitima: row.enderecoVitima,
      telefoneVitima: row.telefoneVitima,
      telefoneVitimaSecundario: row.telefoneVitimaSecundario,
      cpfVitima: row.cpfVitima,
      dataNascimentoVitima: row.dataNascimentoVitima,
      genitoraVitima: row.genitoraVitima,
      pontoReferencia: row.pontoReferencia,
      dataHoraOcorrencia: row.dataHoraOcorrencia,
      regiaoAdministrativa: row.regiaoAdministrativa,
      historicoOcorrencia: row.historicoOcorrencia,
      nomeAgressor: row.nomeAgressor,
      enderecoAgressor: row.enderecoAgressor,
      parentescoAgressorVitima: row.parentescoAgressorVitima,
      tipoAmeacaAgressao: row.tipoAmeacaAgressao,
      agressorEnvolvimento: row.agressorEnvolvimento,
      idadeAgressor: row.idadeAgressor,
      nomeDenunciante: row.nomeDenunciante,
      enderecoDenunciante: row.enderecoDenunciante,
      telefoneDenunciante: row.telefoneDenunciante,
      comandanteViatura: row.comandanteViatura,
      responsavelAtendimento: row.responsavelAtendimento,
      encaminhamentoDetalhes: row.encaminhamentoDetalhes,
      desfecho: row.desfecho,
      registrouBoDp: row.registrouBoDp,
      numeroOcorrenciaCad: row.numeroOcorrenciaCad,
    };
    if (!dryRun) {
      await prisma.mulherOcorrencia.create({ data });
    }
    occInserted++;
  }
  console.log(`Ocorrências: ${occInserted} inseridas, ${occSkipped} já existiam.`);

  if (await tableExists(legacy, 'AuditLog')) {
    const auditRows = await legacy.query<{
      id: string;
      userId: string | null;
      acao: string;
      entidade: string;
      entidadeId: string | null;
      detalhes: string | null;
      ip: string | null;
      userAgent: string | null;
      createdAt: Date;
    }>(`SELECT * FROM "AuditLog" ORDER BY "createdAt"`);
    let auditInserted = 0;
    let auditSkipped = 0;
    for (const row of auditRows.rows) {
      const exists = await prisma.mulherAuditoria.findUnique({ where: { id: row.id } });
      if (exists) {
        auditSkipped++;
        continue;
      }
      if (!dryRun) {
        await prisma.mulherAuditoria.create({
          data: {
            id: row.id,
            usuarioId: row.userId ? (legacyUserToOrionId.get(row.userId) ?? null) : null,
            usuarioNome: row.userId ? (legacyUserNome.get(row.userId) ?? null) : null,
            acao: row.acao,
            entidade: row.entidade,
            entidadeId: row.entidadeId,
            detalhes: row.detalhes,
            ip: row.ip,
            userAgent: row.userAgent,
            createdAt: row.createdAt,
          },
        });
      }
      auditInserted++;
    }
    console.log(`Auditoria: ${auditInserted} inseridas, ${auditSkipped} já existiam.`);
  }

  if (await tableExists(legacy, 'VictimMobileCadastro')) {
    const cadRows = await legacy.query(`SELECT * FROM "VictimMobileCadastro" ORDER BY "createdAt"`);
    let cadInserted = 0;
    let cadSkipped = 0;
    for (const row of cadRows.rows) {
      const exists = await prisma.mulherVitimaCadastroMobile.findUnique({ where: { id: row.id } });
      if (exists) {
        cadSkipped++;
        continue;
      }
      if (!dryRun) {
        await prisma.mulherVitimaCadastroMobile.create({
          data: {
            id: row.id,
            createdAt: row.createdAt,
            updatedAt: row.updatedAt,
            telefoneDigits: row.telefoneDigits,
            nomeVitima: row.nomeVitima,
            idade: row.idade,
            cpf: row.cpf,
            identidade: row.identidade,
            medidaProtetiva: row.medidaProtetiva,
            enderecoResidencia: row.enderecoResidencia,
            latitude: row.latitude,
            longitude: row.longitude,
            accuracyM: row.accuracyM,
            nomeAgressor: row.nomeAgressor,
            enderecoAgressor: row.enderecoAgressor,
            fotoVitimaNome: row.fotoVitimaNome,
            fotoAgressorNome: row.fotoAgressorNome,
          },
        });
      }
      cadInserted++;
    }
    console.log(`Cadastros vítima mobile: ${cadInserted} inseridos, ${cadSkipped} já existiam.`);
  }

  if (await tableExists(legacy, 'VictimMobilePanic')) {
    const panicRows = await legacy.query(`SELECT * FROM "VictimMobilePanic" ORDER BY "createdAt"`);
    let panicInserted = 0;
    let panicSkipped = 0;
    for (const row of panicRows.rows) {
      const exists = await prisma.mulherVitimaPanicoMobile.findUnique({ where: { id: row.id } });
      if (exists) {
        panicSkipped++;
        continue;
      }
      if (!dryRun) {
        await prisma.mulherVitimaPanicoMobile.create({
          data: {
            id: row.id,
            createdAt: row.createdAt,
            updatedAt: row.updatedAt,
            cadastroId: row.cadastroId,
            telefoneDigits: row.telefoneDigits,
            latitude: row.latitude,
            longitude: row.longitude,
            accuracyM: row.accuracyM,
            encaminhamento: row.encaminhamento,
            finalizacao: row.finalizacao,
            acknowledgedAt: row.acknowledgedAt,
            acknowledgedById: row.acknowledgedById
              ? (legacyUserToOrionId.get(row.acknowledgedById) ?? null)
              : null,
          },
        });
      }
      panicInserted++;
    }
    console.log(`Pânicos vítima mobile: ${panicInserted} inseridos, ${panicSkipped} já existiam.`);
  }

  if (await tableExists(legacy, 'OccurrenceMobileLink')) {
    const linkRows = await legacy.query(`SELECT * FROM "OccurrenceMobileLink" ORDER BY "createdAt"`);
    let linkInserted = 0;
    let linkSkipped = 0;
    for (const row of linkRows.rows) {
      const exists = await prisma.mulherOcorrenciaLinkMobile.findUnique({ where: { id: row.id } });
      if (exists) {
        linkSkipped++;
        continue;
      }
      const occExists = await prisma.mulherOcorrencia.findUnique({ where: { id: row.occurrenceId } });
      if (!occExists) {
        console.warn(`Link ${row.id} ignorado: ocorrência ${row.occurrenceId} ausente.`);
        continue;
      }
      if (!dryRun) {
        await prisma.mulherOcorrenciaLinkMobile.create({
          data: {
            id: row.id,
            ocorrenciaId: row.occurrenceId,
            tokenHash: row.tokenHash,
            label: row.label,
            expiresAt: row.expiresAt,
            revokedAt: row.revokedAt,
            lastSeenAt: row.lastSeenAt,
            createdAt: row.createdAt,
            criadoPorId: row.createdById
              ? (legacyUserToOrionId.get(row.createdById) ?? null)
              : null,
          },
        });
      }
      linkInserted++;
    }
    console.log(`Links mobile ocorrência: ${linkInserted} inseridos, ${linkSkipped} já existiam.`);
  }

  if (await tableExists(legacy, 'MobileTelemetryEvent')) {
    const telRows = await legacy.query(`SELECT * FROM "MobileTelemetryEvent" ORDER BY "createdAt"`);
    let telInserted = 0;
    let telSkipped = 0;
    for (const row of telRows.rows) {
      const exists = await prisma.mulherTelemetriaMobile.findUnique({ where: { id: row.id } });
      if (exists) {
        telSkipped++;
        continue;
      }
      const linkExists = await prisma.mulherOcorrenciaLinkMobile.findUnique({ where: { id: row.linkId } });
      if (!linkExists) {
        console.warn(`Telemetria ${row.id} ignorada: link ${row.linkId} ausente.`);
        continue;
      }
      if (!dryRun) {
        await prisma.mulherTelemetriaMobile.create({
          data: {
            id: row.id,
            linkId: row.linkId,
            kind: row.kind,
            latitude: row.latitude,
            longitude: row.longitude,
            accuracyM: row.accuracyM,
            altitude: row.altitude,
            speed: row.speed,
            heading: row.heading,
            deviceInfo: row.deviceInfo,
            createdAt: row.createdAt,
            acknowledgedAt: row.acknowledgedAt,
            acknowledgedById: row.acknowledgedById
              ? (legacyUserToOrionId.get(row.acknowledgedById) ?? null)
              : null,
          },
        });
      }
      telInserted++;
    }
    console.log(`Telemetria mobile: ${telInserted} inseridas, ${telSkipped} já existiam.`);
  }

  await legacy.end();
  await prisma.$disconnect();
  console.log('Migração concluída.');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
