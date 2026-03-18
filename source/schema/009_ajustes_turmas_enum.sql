-- ============================================================
-- CEOB - Fase 2.1: Ajustes no Enum e Constraints de Turmas
-- ============================================================

-- 1. Adicionar 'CANCELADO' ao enum status_curso_enum
DO $$ BEGIN
    ALTER TYPE ceob.status_curso_enum ADD VALUE IF NOT EXISTS 'CANCELADO';
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- 2. Tornar instrutor_id e auxiliar_id opcionais em turmas
ALTER TABLE ceob.turmas ALTER COLUMN instrutor_id DROP NOT NULL;

ALTER TABLE ceob.turmas ALTER COLUMN auxiliar_id DROP NOT NULL;

-- 3. Registrar versão
INSERT INTO
    ceob.schema_migrations (version)
VALUES ('v1.2.1_ajustes_turmas_enum') ON CONFLICT (version) DO NOTHING;