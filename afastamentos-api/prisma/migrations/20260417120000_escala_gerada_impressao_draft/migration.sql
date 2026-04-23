-- Snapshot do rascunho definitivo (blocos, cabeçalhos por bloco, etc.) para reimpressão idêntica.
ALTER TABLE "EscalaGerada" ADD COLUMN "impressaoDraft" JSONB;
