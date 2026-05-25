-- Órion Mulher: tabelas do sisCopomMulher integradas ao ecossistema Órion.

CREATE TYPE "MulherOperadorPerfilEnum" AS ENUM ('ADMINISTRADOR', 'ATENDENTE', 'CONSULTA');
CREATE TYPE "MulherOrigemOcorrencia" AS ENUM ('SISTEMA', 'IMPORTACAO_EXCEL');
CREATE TYPE "MulherTelemetriaKind" AS ENUM ('LOCATION', 'PANIC');
CREATE TYPE "MulherVitimaPanicEncaminhamento" AS ENUM (
  'VIATURA_DESPACHADA',
  'CONTATO_TELEFONE',
  'ALERTA_FALSO',
  'DADOS_INCOMPATIVEIS',
  'LOCALIZACAO_NAO_ENCONTRADA'
);
CREATE TYPE "MulherVitimaPanicFinalizacao" AS ENUM (
  'RESOLVIDO_NO_LOCAL',
  'ENCAMINHADA_DELEGACIA',
  'AVERIGUADA_NADA_CONSTATADO',
  'TCO_NO_LOCAL',
  'ORIENTACAO_PARTES'
);

CREATE TABLE "mulher_operador_perfil" (
  "id" SERIAL NOT NULL,
  "usuarioId" INTEGER NOT NULL,
  "perfil" "MulherOperadorPerfilEnum" NOT NULL DEFAULT 'ATENDENTE',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "mulher_operador_perfil_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "mulher_auditoria" (
  "id" TEXT NOT NULL,
  "usuarioId" INTEGER,
  "usuarioNome" VARCHAR(200),
  "acao" VARCHAR(120) NOT NULL,
  "entidade" VARCHAR(80) NOT NULL,
  "entidadeId" VARCHAR(80),
  "detalhes" TEXT,
  "ip" VARCHAR(64),
  "userAgent" VARCHAR(500),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "mulher_auditoria_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "mulher_ocorrencia" (
  "id" TEXT NOT NULL,
  "origem" "MulherOrigemOcorrencia" NOT NULL DEFAULT 'SISTEMA',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  "criadoPorId" INTEGER,
  "atualizadoPorId" INTEGER,
  "faseAtual" INTEGER NOT NULL DEFAULT 1,
  "concluida" BOOLEAN NOT NULL DEFAULT false,
  "carimboDataHora" TIMESTAMP(3),
  "nomeVitima" TEXT,
  "enderecoVitima" TEXT,
  "telefoneVitima" TEXT,
  "telefoneVitimaSecundario" TEXT,
  "cpfVitima" TEXT,
  "dataNascimentoVitima" TIMESTAMP(3),
  "genitoraVitima" TEXT,
  "pontoReferencia" TEXT,
  "dataHoraOcorrencia" TIMESTAMP(3),
  "regiaoAdministrativa" TEXT,
  "historicoOcorrencia" TEXT,
  "nomeAgressor" TEXT,
  "enderecoAgressor" TEXT,
  "parentescoAgressorVitima" TEXT,
  "tipoAmeacaAgressao" TEXT,
  "agressorEnvolvimento" TEXT,
  "idadeAgressor" TEXT,
  "nomeDenunciante" TEXT,
  "enderecoDenunciante" TEXT,
  "telefoneDenunciante" TEXT,
  "comandanteViatura" TEXT,
  "responsavelAtendimento" TEXT,
  "encaminhamentoDetalhes" TEXT,
  "desfecho" TEXT,
  "registrouBoDp" TEXT,
  "numeroOcorrenciaCad" TEXT,
  CONSTRAINT "mulher_ocorrencia_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "mulher_ocorrencia_link_mobile" (
  "id" TEXT NOT NULL,
  "ocorrenciaId" TEXT NOT NULL,
  "tokenHash" TEXT NOT NULL,
  "label" TEXT,
  "expiresAt" TIMESTAMP(3),
  "revokedAt" TIMESTAMP(3),
  "lastSeenAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "criadoPorId" INTEGER,
  CONSTRAINT "mulher_ocorrencia_link_mobile_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "mulher_telemetria_mobile" (
  "id" TEXT NOT NULL,
  "linkId" TEXT NOT NULL,
  "kind" "MulherTelemetriaKind" NOT NULL,
  "latitude" DOUBLE PRECISION NOT NULL,
  "longitude" DOUBLE PRECISION NOT NULL,
  "accuracyM" DOUBLE PRECISION,
  "altitude" DOUBLE PRECISION,
  "speed" DOUBLE PRECISION,
  "heading" DOUBLE PRECISION,
  "deviceInfo" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "acknowledgedAt" TIMESTAMP(3),
  "acknowledgedById" INTEGER,
  CONSTRAINT "mulher_telemetria_mobile_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "mulher_vitima_cadastro_mobile" (
  "id" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  "telefoneDigits" TEXT NOT NULL,
  "nomeVitima" TEXT,
  "idade" TEXT,
  "cpf" TEXT,
  "identidade" TEXT,
  "medidaProtetiva" TEXT,
  "enderecoResidencia" TEXT,
  "latitude" DOUBLE PRECISION,
  "longitude" DOUBLE PRECISION,
  "accuracyM" DOUBLE PRECISION,
  "nomeAgressor" TEXT,
  "enderecoAgressor" TEXT,
  "fotoVitimaNome" TEXT,
  "fotoAgressorNome" TEXT,
  CONSTRAINT "mulher_vitima_cadastro_mobile_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "mulher_vitima_panico_mobile" (
  "id" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  "cadastroId" TEXT,
  "telefoneDigits" TEXT NOT NULL,
  "latitude" DOUBLE PRECISION NOT NULL,
  "longitude" DOUBLE PRECISION NOT NULL,
  "accuracyM" DOUBLE PRECISION,
  "encaminhamento" "MulherVitimaPanicEncaminhamento",
  "finalizacao" "MulherVitimaPanicFinalizacao",
  "acknowledgedAt" TIMESTAMP(3),
  "acknowledgedById" INTEGER,
  CONSTRAINT "mulher_vitima_panico_mobile_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "mulher_operador_perfil_usuarioId_key" ON "mulher_operador_perfil"("usuarioId");
CREATE INDEX "mulher_auditoria_createdAt_idx" ON "mulher_auditoria"("createdAt");
CREATE INDEX "mulher_auditoria_usuarioId_idx" ON "mulher_auditoria"("usuarioId");
CREATE INDEX "mulher_ocorrencia_regiaoAdministrativa_idx" ON "mulher_ocorrencia"("regiaoAdministrativa");
CREATE INDEX "mulher_ocorrencia_nomeVitima_idx" ON "mulher_ocorrencia"("nomeVitima");
CREATE INDEX "mulher_ocorrencia_nomeAgressor_idx" ON "mulher_ocorrencia"("nomeAgressor");
CREATE INDEX "mulher_ocorrencia_dataHoraOcorrencia_idx" ON "mulher_ocorrencia"("dataHoraOcorrencia");
CREATE INDEX "mulher_ocorrencia_createdAt_idx" ON "mulher_ocorrencia"("createdAt");
CREATE INDEX "mulher_ocorrencia_updatedAt_idx" ON "mulher_ocorrencia"("updatedAt");
CREATE INDEX "mulher_ocorrencia_origem_idx" ON "mulher_ocorrencia"("origem");
CREATE UNIQUE INDEX "mulher_ocorrencia_link_mobile_tokenHash_key" ON "mulher_ocorrencia_link_mobile"("tokenHash");
CREATE INDEX "mulher_ocorrencia_link_mobile_ocorrenciaId_idx" ON "mulher_ocorrencia_link_mobile"("ocorrenciaId");
CREATE INDEX "mulher_telemetria_mobile_linkId_createdAt_idx" ON "mulher_telemetria_mobile"("linkId", "createdAt");
CREATE INDEX "mulher_telemetria_mobile_kind_createdAt_idx" ON "mulher_telemetria_mobile"("kind", "createdAt");
CREATE INDEX "mulher_vitima_cadastro_mobile_telefoneDigits_createdAt_idx" ON "mulher_vitima_cadastro_mobile"("telefoneDigits", "createdAt");
CREATE INDEX "mulher_vitima_panico_mobile_telefoneDigits_createdAt_idx" ON "mulher_vitima_panico_mobile"("telefoneDigits", "createdAt");

ALTER TABLE "mulher_operador_perfil" ADD CONSTRAINT "mulher_operador_perfil_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "Usuario"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "mulher_ocorrencia" ADD CONSTRAINT "mulher_ocorrencia_criadoPorId_fkey" FOREIGN KEY ("criadoPorId") REFERENCES "Usuario"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "mulher_ocorrencia" ADD CONSTRAINT "mulher_ocorrencia_atualizadoPorId_fkey" FOREIGN KEY ("atualizadoPorId") REFERENCES "Usuario"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "mulher_ocorrencia_link_mobile" ADD CONSTRAINT "mulher_ocorrencia_link_mobile_ocorrenciaId_fkey" FOREIGN KEY ("ocorrenciaId") REFERENCES "mulher_ocorrencia"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "mulher_telemetria_mobile" ADD CONSTRAINT "mulher_telemetria_mobile_linkId_fkey" FOREIGN KEY ("linkId") REFERENCES "mulher_ocorrencia_link_mobile"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "mulher_telemetria_mobile" ADD CONSTRAINT "mulher_telemetria_mobile_acknowledgedById_fkey" FOREIGN KEY ("acknowledgedById") REFERENCES "Usuario"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "mulher_vitima_panico_mobile" ADD CONSTRAINT "mulher_vitima_panico_mobile_cadastroId_fkey" FOREIGN KEY ("cadastroId") REFERENCES "mulher_vitima_cadastro_mobile"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "mulher_vitima_panico_mobile" ADD CONSTRAINT "mulher_vitima_panico_mobile_acknowledgedById_fkey" FOREIGN KEY ("acknowledgedById") REFERENCES "Usuario"("id") ON DELETE SET NULL ON UPDATE CASCADE;
