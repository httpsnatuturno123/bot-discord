-- ============================================================
-- CEOB - Fase 1: Índices
-- ============================================================

-- Organizações Militares
CREATE INDEX IF NOT EXISTS idx_om_parent_id ON ceob.organizacoes_militares(parent_id);
CREATE INDEX IF NOT EXISTS idx_om_tipo      ON ceob.organizacoes_militares(tipo);
CREATE INDEX IF NOT EXISTS idx_om_ativo     ON ceob.organizacoes_militares(ativo) WHERE ativo = true;

-- Militares
CREATE INDEX IF NOT EXISTS idx_militares_matricula ON ceob.militares(matricula);
CREATE INDEX IF NOT EXISTS idx_militares_roblox    ON ceob.militares(roblox_user_id);
CREATE INDEX IF NOT EXISTS idx_militares_discord   ON ceob.militares(discord_user_id);
CREATE INDEX IF NOT EXISTS idx_militares_patente   ON ceob.militares(patente_id);
CREATE INDEX IF NOT EXISTS idx_militares_om        ON ceob.militares(om_lotacao_id);
CREATE INDEX IF NOT EXISTS idx_militares_situacao  ON ceob.militares(situacao_funcional);
CREATE INDEX IF NOT EXISTS idx_militares_ativo     ON ceob.militares(ativo) WHERE ativo = true;

-- Timeline
CREATE INDEX IF NOT EXISTS idx_timeline_militar      ON ceob.timeline_eventos(militar_id);
CREATE INDEX IF NOT EXISTS idx_timeline_tipo         ON ceob.timeline_eventos(tipo_evento);
CREATE INDEX IF NOT EXISTS idx_timeline_created      ON ceob.timeline_eventos(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_timeline_militar_tipo  ON ceob.timeline_eventos(militar_id, tipo_evento);

-- Requerimentos
CREATE INDEX IF NOT EXISTS idx_req_solicitante ON ceob.requerimentos(solicitante_id);
CREATE INDEX IF NOT EXISTS idx_req_alvo        ON ceob.requerimentos(militar_alvo_id);
CREATE INDEX IF NOT EXISTS idx_req_status      ON ceob.requerimentos(status);
CREATE INDEX IF NOT EXISTS idx_req_tipo        ON ceob.requerimentos(tipo);
CREATE INDEX IF NOT EXISTS idx_req_orgao       ON ceob.requerimentos(orgao_responsavel_id);

-- Postagens
CREATE INDEX IF NOT EXISTS idx_post_autor      ON ceob.postagens(autor_id);
CREATE INDEX IF NOT EXISTS idx_post_referencia ON ceob.postagens(militar_referenciado_id);

-- Boletim
CREATE INDEX IF NOT EXISTS idx_boletim_numero  ON ceob.boletim_eletronico(numero);

-- Audit Log
CREATE INDEX IF NOT EXISTS idx_audit_tabela    ON ceob.audit_log(tabela);
CREATE INDEX IF NOT EXISTS idx_audit_registro  ON ceob.audit_log(registro_id);
CREATE INDEX IF NOT EXISTS idx_audit_created   ON ceob.audit_log(created_at DESC);
