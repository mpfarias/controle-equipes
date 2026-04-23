-- Contagem de vezes em que cada policial entrou em escala extraordinária salva (API incrementa no POST /escalas/geradas).
CREATE TABLE "PolicialContagemEscalaExtra" (
    "policialId" INTEGER NOT NULL,
    "vezesEscaladoExtra" INTEGER NOT NULL DEFAULT 0,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PolicialContagemEscalaExtra_pkey" PRIMARY KEY ("policialId")
);

ALTER TABLE "PolicialContagemEscalaExtra" ADD CONSTRAINT "PolicialContagemEscalaExtra_policialId_fkey" FOREIGN KEY ("policialId") REFERENCES "Policial"("id") ON DELETE CASCADE ON UPDATE CASCADE;
