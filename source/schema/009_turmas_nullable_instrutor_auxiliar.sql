-- ============================================================
-- CEOB - Turmas: Permitir Instrutor e Auxiliar como opcionais
-- ============================================================

ALTER TABLE ceob.turmas ALTER COLUMN instrutor_id DROP NOT NULL;

ALTER TABLE ceob.turmas ALTER COLUMN auxiliar_id DROP NOT NULL;

-- Registrar versão
INSERT INTO
    ceob.schema_migrations (version)
VALUES (
        'v1.3.0_turmas_nullable_instrutor_auxiliar'
    ) ON CONFLICT (version) DO NOTHING;