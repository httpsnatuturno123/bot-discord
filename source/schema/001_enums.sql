-- ============================================================
-- CEOB - Fase 1: Enumerações
-- ============================================================

CREATE SCHEMA IF NOT EXISTS ceob;

-- Situação funcional do militar
DO $$ BEGIN
    CREATE TYPE ceob.situacao_funcional_enum AS ENUM (
        'ATIVO',
        'AFASTADO_CURSO',
        'LICENCA_MEDICA',
        'AGREGADO',
        'RESERVA',
        'REFORMADO',
        'EXCLUIDO'
    );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Círculo hierárquico
DO $$ BEGIN
    CREATE TYPE ceob.circulo_hierarquico_enum AS ENUM (
        'OFICIAIS_GENERAIS',
        'OFICIAIS_SUPERIORES',
        'OFICIAIS_INTERMEDIARIOS',
        'OFICIAIS_SUBALTERNOS',
        'SUBTENENTES_SARGENTOS',
        'CABOS_SOLDADOS'
    );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Tipos de evento da timeline
DO $$ BEGIN
    CREATE TYPE ceob.tipo_evento_timeline_enum AS ENUM (
        'INGRESSO',
        'PROMOCAO',
        'REBAIXAMENTO',
        'TRANSFERENCIA',
        'NOMEACAO_FUNCAO',
        'EXONERACAO_FUNCAO',
        'MUDANCA_SITUACAO',
        'GRATIFICACAO',
        'FO_POSITIVO',
        'FO_NEGATIVO',
        'MATRICULA_CURSO',
        'CONCLUSAO_CURSO',
        'DEMISSAO',
        'EXONERACAO',
        'EXCLUSAO',
        'OBSERVACAO'
    );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Tipo de Organização Militar
DO $$ BEGIN
    CREATE TYPE ceob.tipo_om_enum AS ENUM (
        'COMANDO_SUPREMO',
        'ORGAO_CONSULTIVO',
        'ESTADO_MAIOR',
        'COMANDO_OPERACIONAL',
        'DEPARTAMENTO',
        'JUSTICA',
        'OM_ESPECIAL',
        'OM_SUBORDINADA'
    );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Status de requerimento
DO $$ BEGIN
    CREATE TYPE ceob.status_requerimento_enum AS ENUM (
        'PENDENTE',
        'EM_ANALISE',
        'APROVADO',
        'INDEFERIDO'
    );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
