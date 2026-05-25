-- Guarda COPOM: preset de expediente (valor do enum em transação separada do UPDATE).
ALTER TYPE "FuncaoExpedienteHorarioPreset" ADD VALUE IF NOT EXISTS 'GUARDA_COPOM_12X36';
