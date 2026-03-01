-- ============================================================
-- CEOB - Fase 2: Sistema de Cursos Estruturado
-- ============================================================

-- 1. Enumerações de Curso
DO $$ BEGIN
    CREATE TYPE ceob.status_curso_enum AS ENUM (
        'PLANEJADO',
        'EM_ANDAMENTO',
        'ENCERRADO'
    );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    CREATE TYPE ceob.status_aluno_enum AS ENUM (
        'CURSANDO',
        'APROVADO',
        'REPROVADO'
    );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- 2. Tabela de Cursos (Catálogo e Turmas)
CREATE TABLE IF NOT EXISTS ceob.cursos (
    id SERIAL PRIMARY KEY,
    nome VARCHAR(150) NOT NULL,
    sigla VARCHAR(30) NOT NULL,
    turma VARCHAR(50) NOT NULL,

-- Colaboradores (FKs para militares existentes)
coordenador_id INTEGER NOT NULL REFERENCES ceob.militares (id) ON DELETE RESTRICT,
instrutor_id INTEGER NOT NULL REFERENCES ceob.militares (id) ON DELETE RESTRICT,
auxiliar_id INTEGER NOT NULL REFERENCES ceob.militares (id) ON DELETE RESTRICT,

-- Escopo: NULL se for geral CEOB, preenchido se for de uma OM específica
om_id INTEGER REFERENCES ceob.organizacoes_militares (id) ON DELETE SET NULL,
status ceob.status_curso_enum NOT NULL DEFAULT 'PLANEJADO',
ativo BOOLEAN DEFAULT true,
created_at TIMESTAMPTZ DEFAULT NOW(),
updated_at TIMESTAMPTZ DEFAULT NOW(),

-- Um curso com mesma sigla e turma não deve ser duplicado
UNIQUE (sigla, turma) );

-- 3. Tabela de Matrículas (Militar <-> Curso)

CREATE TABLE IF NOT EXISTS ceob.militar_cursos (
    id SERIAL PRIMARY KEY,
    militar_id INTEGER NOT NULL REFERENCES ceob.militares (id) ON DELETE CASCADE,
    curso_id INTEGER NOT NULL REFERENCES ceob.cursos (id) ON DELETE CASCADE,
    
    status_aluno ceob.status_aluno_enum NOT NULL DEFAULT 'CURSANDO',
    nota_final DECIMAL(4,2),
    data_conclusao DATE,
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),

-- Um militar só pode estar matriculado uma vez na mesma turma de curso
UNIQUE (militar_id, curso_id) );

-- 4. Triggers de updated_at
DROP TRIGGER IF EXISTS trg_cursos_updated ON ceob.cursos;

CREATE TRIGGER trg_cursos_updated
    BEFORE UPDATE ON ceob.cursos
    FOR EACH ROW
    EXECUTE FUNCTION ceob.trigger_updated_at();

DROP TRIGGER IF EXISTS trg_militar_cursos_updated ON ceob.militar_cursos;

CREATE TRIGGER trg_militar_cursos_updated
    BEFORE UPDATE ON ceob.militar_cursos
    FOR EACH ROW
    EXECUTE FUNCTION ceob.trigger_updated_at();

-- 5. Registro em Audit Log
DROP TRIGGER IF EXISTS trg_audit_cursos ON ceob.cursos;

CREATE TRIGGER trg_audit_cursos
    AFTER INSERT OR UPDATE OR DELETE ON ceob.cursos
    FOR EACH ROW EXECUTE FUNCTION ceob.trigger_audit_log();

DROP TRIGGER IF EXISTS trg_audit_militar_cursos ON ceob.militar_cursos;

CREATE TRIGGER trg_audit_militar_cursos
    AFTER INSERT OR UPDATE OR DELETE ON ceob.militar_cursos
    FOR EACH ROW EXECUTE FUNCTION ceob.trigger_audit_log();

-- 6. Registrar versão da migração
INSERT INTO
    ceob.schema_migrations (version)
VALUES ('v1.1.0_sistema_cursos') ON CONFLICT (version) DO NOTHING;