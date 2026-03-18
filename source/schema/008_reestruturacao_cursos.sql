-- ============================================================
-- CEOB - Fase 2: Reestruturação do Sistema de Cursos
-- ============================================================

-- 1. Criar ceob.catalogo_cursos
CREATE TABLE IF NOT EXISTS ceob.catalogo_cursos (
    id SERIAL PRIMARY KEY,
    nome VARCHAR(150) NOT NULL,
    sigla VARCHAR(30) UNIQUE NOT NULL,
    ativo BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Criar ceob.turmas
CREATE TABLE IF NOT EXISTS ceob.turmas (
    id SERIAL PRIMARY KEY,
    curso_id INTEGER NOT NULL REFERENCES ceob.catalogo_cursos (id) ON DELETE RESTRICT,
    identificador_turma VARCHAR(50) NOT NULL,
    coordenador_id INTEGER NOT NULL REFERENCES ceob.militares (id) ON DELETE RESTRICT,
    instrutor_id INTEGER NOT NULL REFERENCES ceob.militares (id) ON DELETE RESTRICT,
    auxiliar_id INTEGER NOT NULL REFERENCES ceob.militares (id) ON DELETE RESTRICT,
    om_id INTEGER REFERENCES ceob.organizacoes_militares (id) ON DELETE SET NULL,
    status ceob.status_curso_enum NOT NULL DEFAULT 'PLANEJADO',
    data_encerramento TIMESTAMPTZ NULL,
    ativo BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE (curso_id, identificador_turma)
);

-- 3. Migração de Dados
-- a) Popular catalogo_cursos com dados distintos de cursos
INSERT INTO
    ceob.catalogo_cursos (nome, sigla)
SELECT DISTINCT
    nome,
    sigla
FROM ceob.cursos ON CONFLICT (sigla) DO NOTHING;

-- b) Popular turmas referenciando o catálogo
INSERT INTO
    ceob.turmas (
        id,
        curso_id,
        identificador_turma,
        coordenador_id,
        instrutor_id,
        auxiliar_id,
        om_id,
        status,
        ativo,
        created_at,
        updated_at
    )
SELECT c.id, cat.id, c.turma, c.coordenador_id, c.instrutor_id, c.auxiliar_id, c.om_id, c.status, c.ativo, c.created_at, c.updated_at
FROM ceob.cursos c
    JOIN ceob.catalogo_cursos cat ON c.sigla = cat.sigla ON CONFLICT (id) DO NOTHING;

-- c) Ajustar a sequence de turmas para continuar do último ID inserido
SELECT setval (
        pg_get_serial_sequence ('ceob.turmas', 'id'), coalesce(max(id), 0) + 1, false
    )
FROM ceob.turmas;

-- 4. Alterar as FKs e dropar a tabela antiga
-- Substituir a restrição da FK em militar_cursos
ALTER TABLE ceob.militar_cursos
DROP CONSTRAINT IF EXISTS militar_cursos_curso_id_fkey;

ALTER TABLE ceob.militar_cursos
ADD CONSTRAINT militar_cursos_curso_id_fkey FOREIGN KEY (curso_id) REFERENCES ceob.turmas (id) ON DELETE CASCADE;

-- Atualizar o nome da constante única em militar_cursos, já não se refere mais a 'curso', mas 'turma' (opcional, mas mantemos o formato original na tabela militar_cursos)
-- Drop tabela antiga
DROP TABLE ceob.cursos;

-- 5. Triggers
-- a) trigger_updated_at
DROP TRIGGER IF EXISTS trg_catalogo_cursos_updated ON ceob.catalogo_cursos;

CREATE TRIGGER trg_catalogo_cursos_updated
    BEFORE UPDATE ON ceob.catalogo_cursos
    FOR EACH ROW
    EXECUTE FUNCTION ceob.trigger_updated_at();

DROP TRIGGER IF EXISTS trg_turmas_updated ON ceob.turmas;

CREATE TRIGGER trg_turmas_updated
    BEFORE UPDATE ON ceob.turmas
    FOR EACH ROW
    EXECUTE FUNCTION ceob.trigger_updated_at();

-- b) trigger_audit_log
DROP TRIGGER IF EXISTS trg_audit_catalogo_cursos ON ceob.catalogo_cursos;

CREATE TRIGGER trg_audit_catalogo_cursos
    AFTER INSERT OR UPDATE OR DELETE ON ceob.catalogo_cursos
    FOR EACH ROW EXECUTE FUNCTION ceob.trigger_audit_log();

DROP TRIGGER IF EXISTS trg_audit_turmas ON ceob.turmas;

CREATE TRIGGER trg_audit_turmas
    AFTER INSERT OR UPDATE OR DELETE ON ceob.turmas
    FOR EACH ROW EXECUTE FUNCTION ceob.trigger_audit_log();

-- 6. Registrar versão
INSERT INTO
    ceob.schema_migrations (version)
VALUES (
        'v1.2.0_reestruturacao_cursos'
    ) ON CONFLICT (version) DO NOTHING;