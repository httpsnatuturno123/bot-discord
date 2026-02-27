-- ============================================================
-- CEOB - Fase 1: Tabelas
-- ============================================================

-- 1. Patentes
CREATE TABLE IF NOT EXISTS ceob.patentes (
    id SERIAL PRIMARY KEY,
    nome VARCHAR(100) NOT NULL UNIQUE,
    abreviacao VARCHAR(20) NOT NULL UNIQUE,
    circulo ceob.circulo_hierarquico_enum NOT NULL,
    ordem_precedencia SMALLINT NOT NULL UNIQUE,
    is_praca_especial BOOLEAN DEFAULT false,
    is_oficial BOOLEAN DEFAULT false,
    ativo BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Organizações Militares (hierarquia dinâmica via self-reference)
CREATE TABLE IF NOT EXISTS ceob.organizacoes_militares (
    id SERIAL PRIMARY KEY,
    nome VARCHAR(200) NOT NULL,
    sigla VARCHAR(30) NOT NULL UNIQUE,
    tipo ceob.tipo_om_enum NOT NULL,
    parent_id INTEGER REFERENCES ceob.organizacoes_militares (id) ON DELETE RESTRICT,
    descricao TEXT,
    efetivo_maximo INTEGER,
    ativo BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Militares (tabela central)
CREATE TABLE IF NOT EXISTS ceob.militares (
    id SERIAL PRIMARY KEY,
    matricula VARCHAR(20) NOT NULL UNIQUE,
    nome_guerra VARCHAR(100) NOT NULL,
    roblox_user_id BIGINT NOT NULL UNIQUE,
    roblox_username VARCHAR(100),
    discord_user_id BIGINT UNIQUE,
    patente_id INTEGER NOT NULL REFERENCES ceob.patentes (id) ON DELETE RESTRICT,
    om_lotacao_id INTEGER NOT NULL REFERENCES ceob.organizacoes_militares (id) ON DELETE RESTRICT,
    situacao_funcional ceob.situacao_funcional_enum NOT NULL DEFAULT 'ATIVO',
    data_ingresso DATE NOT NULL DEFAULT CURRENT_DATE,
    data_ultima_promocao DATE,
    observacoes TEXT,
    ativo BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. Funções (catálogo dinâmico por OM)
CREATE TABLE IF NOT EXISTS ceob.funcoes (
    id SERIAL PRIMARY KEY,
    nome VARCHAR(150) NOT NULL,
    descricao TEXT,
    om_id INTEGER NOT NULL REFERENCES ceob.organizacoes_militares (id) ON DELETE CASCADE,
    ativo BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE (nome, om_id)
);

-- 5. Militar ↔ Funções (associativa, cumulativa)
CREATE TABLE IF NOT EXISTS ceob.militar_funcoes (
    id SERIAL PRIMARY KEY,
    militar_id INTEGER NOT NULL REFERENCES ceob.militares (id) ON DELETE RESTRICT,
    funcao_id INTEGER NOT NULL REFERENCES ceob.funcoes (id) ON DELETE RESTRICT,
    om_id INTEGER NOT NULL REFERENCES ceob.organizacoes_militares (id) ON DELETE RESTRICT,
    data_inicio DATE NOT NULL DEFAULT CURRENT_DATE,
    data_fim DATE,
    ativo BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Constraint: mesma função na mesma OM não pode estar duplicada enquanto ativa
CREATE UNIQUE INDEX IF NOT EXISTS idx_militar_funcao_unica_ativa ON ceob.militar_funcoes (militar_id, funcao_id, om_id)
WHERE
    ativo = true;

-- 6. Timeline de Eventos (append-only, imutável)
CREATE TABLE IF NOT EXISTS ceob.timeline_eventos (
    id BIGSERIAL PRIMARY KEY,
    militar_id INTEGER NOT NULL REFERENCES ceob.militares (id) ON DELETE RESTRICT,
    tipo_evento ceob.tipo_evento_timeline_enum NOT NULL,
    descricao TEXT NOT NULL,
    dados_extras JSONB,
    executado_por_id INTEGER REFERENCES ceob.militares (id) ON DELETE RESTRICT,
    aprovado_por_id INTEGER REFERENCES ceob.militares (id) ON DELETE RESTRICT,
    om_contexto_id INTEGER REFERENCES ceob.organizacoes_militares (id) ON DELETE RESTRICT,
    referencia_externa VARCHAR(200),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 7. Requerimentos
CREATE TABLE IF NOT EXISTS ceob.requerimentos (
    id BIGSERIAL PRIMARY KEY,
    tipo VARCHAR(50) NOT NULL,
    solicitante_id INTEGER NOT NULL REFERENCES ceob.militares (id) ON DELETE RESTRICT,
    militar_alvo_id INTEGER NOT NULL REFERENCES ceob.militares (id) ON DELETE RESTRICT,
    status ceob.status_requerimento_enum NOT NULL DEFAULT 'PENDENTE',
    orgao_responsavel_id INTEGER REFERENCES ceob.organizacoes_militares (id) ON DELETE RESTRICT,
    analisado_por_id INTEGER REFERENCES ceob.militares (id) ON DELETE RESTRICT,
    motivo_solicitacao TEXT NOT NULL,
    motivo_decisao TEXT,
    dados_extras JSONB,
    is_listagem BOOLEAN DEFAULT false,
    timeline_evento_id BIGINT REFERENCES ceob.timeline_eventos (id) ON DELETE RESTRICT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 8. Postagens
CREATE TABLE IF NOT EXISTS ceob.postagens (
    id BIGSERIAL PRIMARY KEY,
    autor_id INTEGER NOT NULL REFERENCES ceob.militares (id) ON DELETE RESTRICT,
    tipo VARCHAR(80) NOT NULL,
    titulo VARCHAR(300) NOT NULL,
    conteudo TEXT,
    militar_referenciado_id INTEGER REFERENCES ceob.militares (id) ON DELETE RESTRICT,
    requerimento_id BIGINT REFERENCES ceob.requerimentos (id) ON DELETE RESTRICT,
    discord_message_id BIGINT,
    discord_channel_id BIGINT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 9. Boletim Eletrônico
CREATE TABLE IF NOT EXISTS ceob.boletim_eletronico (
    id BIGSERIAL PRIMARY KEY,
    numero VARCHAR(30) NOT NULL UNIQUE,
    conteudo TEXT NOT NULL,
    requerimento_id BIGINT REFERENCES ceob.requerimentos (id) ON DELETE RESTRICT,
    timeline_evento_id BIGINT REFERENCES ceob.timeline_eventos (id) ON DELETE RESTRICT,
    discord_message_id BIGINT,
    publicado_em TIMESTAMPTZ DEFAULT NOW(),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 10. Audit Log
CREATE TABLE IF NOT EXISTS ceob.audit_log (
    id BIGSERIAL PRIMARY KEY,
    tabela VARCHAR(100) NOT NULL,
    registro_id BIGINT NOT NULL,
    operacao VARCHAR(10) NOT NULL,
    dados_antigos JSONB,
    dados_novos JSONB,
    executado_por VARCHAR(100),
    ip_origem VARCHAR(50),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Tabela de controle de migrações
CREATE TABLE IF NOT EXISTS ceob.schema_migrations (
    version VARCHAR(50) PRIMARY KEY,
    applied_at TIMESTAMPTZ DEFAULT NOW()
);