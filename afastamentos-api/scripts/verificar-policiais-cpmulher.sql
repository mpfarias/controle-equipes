-- Script para verificar o que os 3 policiais têm em comum
-- e qual é a equipe do usuário Cpmulher

-- 1. Verificar informações do usuário Cpmulher
SELECT 
    u.id,
    u.nome,
    u.matricula,
    u.equipe,
    u."nivelId",
    un.nome as nivel_nome,
    u."funcaoId",
    f.nome as funcao_nome,
    u.status
FROM "Usuario" u
LEFT JOIN "UsuarioNivel" un ON u."nivelId" = un.id
LEFT JOIN "Funcao" f ON u."funcaoId" = f.id
WHERE u.nome ILIKE '%cpmulher%' OR u.matricula ILIKE '%1966905%';

-- 2. Verificar os 3 policiais específicos mencionados
SELECT 
    p.id,
    p.nome,
    p.matricula,
    p.equipe,
    p."statusId",
    sp.nome as status_nome,
    p."funcaoId",
    f.nome as funcao_nome
FROM "Policial" p
LEFT JOIN "StatusPolicial" sp ON p."statusId" = sp.id
LEFT JOIN "Funcao" f ON p."funcaoId" = f.id
WHERE p.matricula IN ('2150522', '00159980', '00213209')
   OR p.nome ILIKE '%HENRIQUE TORRES%'
   OR p.nome ILIKE '%MASSILON%'
   OR p.nome ILIKE '%LUCIANO GOMES%'
ORDER BY p.nome;

-- 3. Verificar quantos policiais têm a função "EXPEDIENTE ADM" e estão na mesma equipe do usuário
SELECT 
    p.equipe,
    COUNT(*) as total_policiais_expediente
FROM "Policial" p
INNER JOIN "Funcao" f ON p."funcaoId" = f.id
INNER JOIN "StatusPolicial" sp ON p."statusId" = sp.id
WHERE f.nome ILIKE '%EXPEDIENTE ADM%'
  AND sp.nome != 'DESATIVADO'
GROUP BY p.equipe
ORDER BY p.equipe;

-- 4. Verificar todos os policiais com função "EXPEDIENTE ADM" por equipe
SELECT 
    p.id,
    p.nome,
    p.matricula,
    p.equipe,
    sp.nome as status_nome,
    f.nome as funcao_nome
FROM "Policial" p
INNER JOIN "Funcao" f ON p."funcaoId" = f.id
INNER JOIN "StatusPolicial" sp ON p."statusId" = sp.id
WHERE f.nome ILIKE '%EXPEDIENTE ADM%'
  AND sp.nome != 'DESATIVADO'
ORDER BY p.equipe, p.nome;

-- 5. Verificar se há alguma relação entre o usuário e os policiais (mesma equipe ou função)
SELECT 
    'Usuário' as tipo,
    u.nome,
    u.matricula,
    u.equipe as equipe_usuario,
    f.nome as funcao_usuario
FROM "Usuario" u
LEFT JOIN "Funcao" f ON u."funcaoId" = f.id
WHERE u.nome ILIKE '%cpmulher%' OR u.matricula ILIKE '%1966905%'
UNION ALL
SELECT 
    'Policial' as tipo,
    p.nome,
    p.matricula,
    p.equipe as equipe_policial,
    f.nome as funcao_policial
FROM "Policial" p
LEFT JOIN "Funcao" f ON p."funcaoId" = f.id
LEFT JOIN "StatusPolicial" sp ON p."statusId" = sp.id
WHERE p.matricula IN ('2150522', '00159980', '00213209')
  AND sp.nome != 'DESATIVADO';
