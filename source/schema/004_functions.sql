-- ============================================================
-- CEOB - Fase 1: Funções e Triggers
-- ============================================================

-- ────────────────────────────────────────────────────
-- 1. Geração automática de matrícula (YYYY-NNNN)
-- ────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION ceob.gerar_matricula()
RETURNS TEXT AS $$
DECLARE
    ano_atual TEXT;
    proximo_seq INTEGER;
    nova_matricula TEXT;
BEGIN
    ano_atual := EXTRACT(YEAR FROM CURRENT_DATE)::TEXT;

    SELECT COALESCE(
        MAX(
            CAST(SPLIT_PART(matricula, '-', 2) AS INTEGER)
        ), 0
    ) + 1
    INTO proximo_seq
    FROM ceob.militares
    WHERE matricula LIKE ano_atual || '-%';

    nova_matricula := ano_atual || '-' || LPAD(proximo_seq::TEXT, 4, '0');

    RETURN nova_matricula;
END;
$$ LANGUAGE plpgsql;

-- ────────────────────────────────────────────────────
-- 2. Trigger para auto-preencher matrícula no INSERT
-- ────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION ceob.trigger_gerar_matricula()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.matricula IS NULL OR NEW.matricula = '' THEN
        NEW.matricula := ceob.gerar_matricula();
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_militares_matricula ON ceob.militares;
CREATE TRIGGER trg_militares_matricula
    BEFORE INSERT ON ceob.militares
    FOR EACH ROW
    EXECUTE FUNCTION ceob.trigger_gerar_matricula();

-- ────────────────────────────────────────────────────
-- 3. Trigger para atualizar updated_at automaticamente
-- ────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION ceob.trigger_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at := NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Aplicar em tabelas que têm updated_at
DROP TRIGGER IF EXISTS trg_militares_updated ON ceob.militares;
CREATE TRIGGER trg_militares_updated
    BEFORE UPDATE ON ceob.militares
    FOR EACH ROW
    EXECUTE FUNCTION ceob.trigger_updated_at();

DROP TRIGGER IF EXISTS trg_om_updated ON ceob.organizacoes_militares;
CREATE TRIGGER trg_om_updated
    BEFORE UPDATE ON ceob.organizacoes_militares
    FOR EACH ROW
    EXECUTE FUNCTION ceob.trigger_updated_at();

DROP TRIGGER IF EXISTS trg_req_updated ON ceob.requerimentos;
CREATE TRIGGER trg_req_updated
    BEFORE UPDATE ON ceob.requerimentos
    FOR EACH ROW
    EXECUTE FUNCTION ceob.trigger_updated_at();

-- ────────────────────────────────────────────────────
-- 4. Trigger de auditoria genérica
-- ────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION ceob.trigger_audit_log()
RETURNS TRIGGER AS $$
DECLARE
    reg_id BIGINT;
BEGIN
    -- Pega o ID do registro (tenta campo 'id')
    IF TG_OP = 'DELETE' THEN
        reg_id := OLD.id;
    ELSE
        reg_id := NEW.id;
    END IF;

    INSERT INTO ceob.audit_log (tabela, registro_id, operacao, dados_antigos, dados_novos)
    VALUES (
        TG_TABLE_SCHEMA || '.' || TG_TABLE_NAME,
        reg_id,
        TG_OP,
        CASE WHEN TG_OP IN ('UPDATE', 'DELETE') THEN to_jsonb(OLD) ELSE NULL END,
        CASE WHEN TG_OP IN ('INSERT', 'UPDATE') THEN to_jsonb(NEW) ELSE NULL END
    );

    IF TG_OP = 'DELETE' THEN
        RETURN OLD;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Aplicar auditoria nas tabelas críticas
DROP TRIGGER IF EXISTS trg_audit_militares ON ceob.militares;
CREATE TRIGGER trg_audit_militares
    AFTER INSERT OR UPDATE OR DELETE ON ceob.militares
    FOR EACH ROW EXECUTE FUNCTION ceob.trigger_audit_log();

DROP TRIGGER IF EXISTS trg_audit_militar_funcoes ON ceob.militar_funcoes;
CREATE TRIGGER trg_audit_militar_funcoes
    AFTER INSERT OR UPDATE OR DELETE ON ceob.militar_funcoes
    FOR EACH ROW EXECUTE FUNCTION ceob.trigger_audit_log();

DROP TRIGGER IF EXISTS trg_audit_requerimentos ON ceob.requerimentos;
CREATE TRIGGER trg_audit_requerimentos
    AFTER INSERT OR UPDATE OR DELETE ON ceob.requerimentos
    FOR EACH ROW EXECUTE FUNCTION ceob.trigger_audit_log();

DROP TRIGGER IF EXISTS trg_audit_om ON ceob.organizacoes_militares;
CREATE TRIGGER trg_audit_om
    AFTER INSERT OR UPDATE OR DELETE ON ceob.organizacoes_militares
    FOR EACH ROW EXECUTE FUNCTION ceob.trigger_audit_log();

-- ────────────────────────────────────────────────────
-- 5. Proteção: impedir UPDATE/DELETE na timeline
-- ────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION ceob.trigger_timeline_imutavel()
RETURNS TRIGGER AS $$
BEGIN
    RAISE EXCEPTION 'timeline_eventos é append-only. Registros não podem ser alterados ou excluídos.';
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_timeline_no_update ON ceob.timeline_eventos;
CREATE TRIGGER trg_timeline_no_update
    BEFORE UPDATE OR DELETE ON ceob.timeline_eventos
    FOR EACH ROW
    EXECUTE FUNCTION ceob.trigger_timeline_imutavel();

-- ────────────────────────────────────────────────────
-- 6. Função utilitária: gerar número de boletim
-- ────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION ceob.gerar_numero_boletim()
RETURNS TEXT AS $$
DECLARE
    ano_atual TEXT;
    proximo_seq INTEGER;
BEGIN
    ano_atual := EXTRACT(YEAR FROM CURRENT_DATE)::TEXT;

    SELECT COALESCE(
        MAX(
            CAST(SPLIT_PART(numero, '-', 3) AS INTEGER)
        ), 0
    ) + 1
    INTO proximo_seq
    FROM ceob.boletim_eletronico
    WHERE numero LIKE 'BI-' || ano_atual || '-%';

    RETURN 'BI-' || ano_atual || '-' || LPAD(proximo_seq::TEXT, 3, '0');
END;
$$ LANGUAGE plpgsql;
