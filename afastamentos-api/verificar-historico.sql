-- Script para verificar se há histórico de restrições médicas na tabela

-- Ver todos os históricos
SELECT 
    rmh.id,
    rmh."policialId",
    p.nome as "nome_policial",
    p.matricula,
    rmh."restricaoMedicaId",
    rm.nome as "nome_restricao",
    rmh."dataInicio",
    rmh."dataFim",
    rmh."removidoPorNome",
    rmh."createdAt"
FROM "RestricaoMedicaHistorico" rmh
JOIN "Policial" p ON p.id = rmh."policialId"
JOIN "RestricaoMedica" rm ON rm.id = rmh."restricaoMedicaId"
ORDER BY rmh."dataFim" DESC;

-- Contar por policial
SELECT 
    p.nome,
    p.matricula,
    COUNT(rmh.id) as "total_restricoes_removidas"
FROM "Policial" p
LEFT JOIN "RestricaoMedicaHistorico" rmh ON rmh."policialId" = p.id
GROUP BY p.id, p.nome, p.matricula
HAVING COUNT(rmh.id) > 0
ORDER BY COUNT(rmh.id) DESC;
