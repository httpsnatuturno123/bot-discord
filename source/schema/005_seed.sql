-- ============================================================
-- CEOB - Fase 1: Dados Iniciais (Seed)
-- ============================================================
-- Este arquivo é idempotente: pode ser executado múltiplas vezes
-- sem duplicar dados (usa ON CONFLICT DO NOTHING).

-- ────────────────────────────────────────────────────
-- 1. PATENTES
-- ────────────────────────────────────────────────────

INSERT INTO ceob.patentes (nome, abreviacao, circulo, ordem_precedencia, is_praca_especial, is_oficial)
VALUES
    -- Círculo de Oficiais-Generais
    ('Marechal',              'MAR',            'OFICIAIS_GENERAIS',     1,  false, true),
    ('General de Exército',   'GEN EX',         'OFICIAIS_GENERAIS',     2,  false, true),
    ('General de Divisão',    'GEN DIV',        'OFICIAIS_GENERAIS',     3,  false, true),
    ('General de Brigada',    'GEN BDA',        'OFICIAIS_GENERAIS',     4,  false, true),

    -- Círculo de Oficiais Superiores
    ('Coronel',               'CEL',            'OFICIAIS_SUPERIORES',   5,  false, true),
    ('Tenente-Coronel',       'TC',             'OFICIAIS_SUPERIORES',   6,  false, true),
    ('Major',                 'MAJ',            'OFICIAIS_SUPERIORES',   7,  false, true),

    -- Círculo de Oficiais Intermediários
    ('Capitão',               'CAP',            'OFICIAIS_INTERMEDIARIOS', 8,  false, true),

    -- Círculo de Oficiais Subalternos
    ('1º Tenente',            '1º TEN',         'OFICIAIS_SUBALTERNOS',  9,  false, true),
    ('2º Tenente',            '2º TEN',         'OFICIAIS_SUBALTERNOS',  10, false, true),
    ('Aspirante a Oficial',   'ASP',            'OFICIAIS_SUBALTERNOS',  11, true,  true),

    -- Círculo de Subtenentes e Sargentos
    ('Cadete da AMAN',        'CAD',            'SUBTENENTES_SARGENTOS', 12, true,  false),
    ('Subtenente',            'ST',             'SUBTENENTES_SARGENTOS', 13, false, false),
    ('1º Sargento',           '1 SGT',          'SUBTENENTES_SARGENTOS', 14, false, false),
    ('2º Sargento',           '2 SGT',          'SUBTENENTES_SARGENTOS', 15, false, false),
    ('Aluno da EsPCEx',       'ALU ESPCEX',     'SUBTENENTES_SARGENTOS', 16, true,  false),
    ('3º Sargento',           '3 SGT',          'SUBTENENTES_SARGENTOS', 17, false, false),

    -- Círculo de Cabos e Soldados
    ('Aluno da ESA',          'ALU ESA',        'CABOS_SOLDADOS',        18, true,  false),
    ('Cabo Aluno (CFST)',     'CB ALU (CFST)',  'CABOS_SOLDADOS',        19, true,  false),
    ('Cabo',                  'CB',             'CABOS_SOLDADOS',        20, false, false),
    ('SD/REC Aluno (CFC)',    'SD/REC ALU (CFC)','CABOS_SOLDADOS',      21, true,  false),
    ('Soldado',               'SD',             'CABOS_SOLDADOS',        22, false, false),
    ('Soldado-Recruta',       'REC',            'CABOS_SOLDADOS',        23, false, false)
ON CONFLICT (nome) DO NOTHING;

-- ────────────────────────────────────────────────────
-- 2. ORGANIZAÇÕES MILITARES
-- ────────────────────────────────────────────────────

-- Nível 0: Raiz
INSERT INTO ceob.organizacoes_militares (nome, sigla, tipo, parent_id, descricao)
VALUES (
    'Comando Supremo',
    'CMD SUP',
    'COMANDO_SUPREMO',
    NULL,
    'Ordem máxima do CEOB. Composto por até 3 militares.'
) ON CONFLICT (sigla) DO NOTHING;

-- Nível 1: Subordinados diretos do Comando Supremo
INSERT INTO ceob.organizacoes_militares (nome, sigla, tipo, parent_id, descricao)
VALUES (
    'Alto Comando',
    'ALTO CMD',
    'ORGAO_CONSULTIVO',
    (SELECT id FROM ceob.organizacoes_militares WHERE sigla = 'CMD SUP'),
    'Órgão consultivo e aconselhador. Composto por todos os militares com patente >= Coronel.'
) ON CONFLICT (sigla) DO NOTHING;

INSERT INTO ceob.organizacoes_militares (nome, sigla, tipo, parent_id, descricao)
VALUES (
    'Estado Maior do Exército',
    'EME',
    'ESTADO_MAIOR',
    (SELECT id FROM ceob.organizacoes_militares WHERE sigla = 'CMD SUP'),
    'Responsável por toda a política e doutrina do Exército. Subordina instalações de inteligência. Segundo responsável por atividades administrativas.'
) ON CONFLICT (sigla) DO NOTHING;

INSERT INTO ceob.organizacoes_militares (nome, sigla, tipo, parent_id, descricao)
VALUES (
    'Comando de Operações Terrestres',
    'COTER',
    'COMANDO_OPERACIONAL',
    (SELECT id FROM ceob.organizacoes_militares WHERE sigla = 'CMD SUP'),
    'Responsável pela doutrina, manuais e organização das unidades subordinadas.'
) ON CONFLICT (sigla) DO NOTHING;

INSERT INTO ceob.organizacoes_militares (nome, sigla, tipo, parent_id, descricao)
VALUES (
    'Justiça Militar',
    'JM',
    'JUSTICA',
    (SELECT id FROM ceob.organizacoes_militares WHERE sigla = 'CMD SUP'),
    'Responsável por todo o aparato jurídico da instituição. Composto por Ministros.'
) ON CONFLICT (sigla) DO NOTHING;

INSERT INTO ceob.organizacoes_militares (nome, sigla, tipo, parent_id, descricao)
VALUES (
    'Departamento Geral do Pessoal',
    'DGP',
    'DEPARTAMENTO',
    (SELECT id FROM ceob.organizacoes_militares WHERE sigla = 'CMD SUP'),
    'Responsável pela listagem e verificação de requerimentos.'
) ON CONFLICT (sigla) DO NOTHING;

-- Nível 2: Subordinados de segundo nível
INSERT INTO ceob.organizacoes_militares (nome, sigla, tipo, parent_id, descricao)
VALUES (
    'Polícia do Exército',
    'PE',
    'OM_ESPECIAL',
    (SELECT id FROM ceob.organizacoes_militares WHERE sigla = 'JM'),
    'OM Especial subordinada à Justiça Militar.'
) ON CONFLICT (sigla) DO NOTHING;

-- ────────────────────────────────────────────────────
-- 3. FUNÇÕES
-- ────────────────────────────────────────────────────

INSERT INTO ceob.funcoes (nome, descricao)
VALUES
    ('Comandante',                'Comandante de Organização Militar'),
    ('Subcomandante',             'Subcomandante de Organização Militar'),
    ('Chefe do Estado-Maior',     'Chefe do Estado Maior do Exército'),
    ('Ministro da Justiça Militar','Ministro integrante da Justiça Militar'),
    ('Chefe da DGP',              'Chefe do Departamento Geral do Pessoal'),
    ('Chefe do COTER',            'Chefe do Comando de Operações Terrestres'),
    ('Ajudante de Ordens',        'Ajudante de ordens de autoridade militar'),
    ('Instrutor',                 'Instrutor em curso ou unidade'),
    ('Aluno',                     'Aluno matriculado em curso'),
    ('Membro do Alto Comando',    'Integrante do órgão consultivo Alto Comando')
ON CONFLICT (nome) DO NOTHING;

-- ────────────────────────────────────────────────────
-- Registrar versão da migração
-- ────────────────────────────────────────────────────
INSERT INTO ceob.schema_migrations (version)
VALUES ('v1.0.0_fase1_fundacional')
ON CONFLICT (version) DO NOTHING;
