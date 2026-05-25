import { z } from "zod";

const telefoneDigits = z
  .string()
  .transform((s) => s.replace(/\D/g, ""))
  .refine((d) => d.length === 10 || d.length === 11, "Telefone deve ter 10 ou 11 dígitos.");

export const victimAppCadastroBodySchema = z.object({
  telefone: telefoneDigits,
  nomeVitima: z.string().trim().min(1).max(200),
  idade: z.string().trim().max(20).optional().nullable(),
  cpf: z.string().trim().max(20).optional().nullable(),
  identidade: z.string().trim().max(50).optional().nullable(),
  medidaProtetiva: z.enum(["sim", "nao", "nao_informado"]).optional().nullable(),
  enderecoResidencia: z.string().trim().min(1).max(2000),
  latitude: z.number().finite().optional().nullable(),
  longitude: z.number().finite().optional().nullable(),
  accuracyM: z.number().finite().optional().nullable(),
  nomeAgressor: z.string().trim().min(1).max(200),
  enderecoAgressor: z.string().trim().min(1).max(2000),
  fotoVitimaNome: z.string().trim().max(500).optional().nullable(),
  fotoAgressorNome: z.string().trim().max(500).optional().nullable(),
});

/** Corpo mínimo para consultar o último cadastro na central pelo telefone. */
export const victimAppCadastroCarregarSchema = z.object({
  telefone: telefoneDigits,
});

/** Atualização pelo operador na central (o telefone do registo não é alterado por esta rota). */
export const centralVitimaCadastroPatchSchema = victimAppCadastroBodySchema.omit({ telefone: true });

export const victimAppPanicoBodySchema = z.object({
  telefone: telefoneDigits,
  latitude: z.number().finite(),
  longitude: z.number().finite(),
  accuracyM: z.number().finite().optional().nullable(),
});

export const vitimaPanicEncaminhamentoValues = [
  "VIATURA_DESPACHADA",
  "CONTATO_TELEFONE",
  "ALERTA_FALSO",
  "DADOS_INCOMPATIVEIS",
  "LOCALIZACAO_NAO_ENCONTRADA",
] as const;

export const vitimaPanicFinalizacaoValues = [
  "RESOLVIDO_NO_LOCAL",
  "ENCAMINHADA_DELEGACIA",
  "AVERIGUADA_NADA_CONSTATADO",
  "TCO_NO_LOCAL",
  "ORIENTACAO_PARTES",
] as const;

export const centralVitimaPanicPatchSchema = z.object({
  encaminhamento: z.enum(vitimaPanicEncaminhamentoValues).optional().nullable(),
  finalizacao: z.enum(vitimaPanicFinalizacaoValues).optional().nullable(),
  acknowledged: z.boolean().optional(),
});
