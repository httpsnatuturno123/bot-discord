class RequerimentosHandle {
    constructor(connection) {
        this.connection = connection;
    }

    async criar({ tipo, solicitanteId, militarAlvoId, orgaoResponsavelId, motivoSolicitacao, dadosExtras, isListagem }) {
        const { rows } = await this.connection.query(
            `INSERT INTO ceob.requerimentos
                (tipo, solicitante_id, militar_alvo_id, orgao_responsavel_id, motivo_solicitacao, dados_extras, is_listagem)
             VALUES ($1, $2, $3, $4, $5, $6, $7)
             RETURNING *`,
            [
                tipo,
                solicitanteId,
                militarAlvoId,
                orgaoResponsavelId || null,
                motivoSolicitacao,
                dadosExtras ? JSON.stringify(dadosExtras) : null,
                isListagem || false
            ]
        );
        return rows[0];
    }

    async atualizar(requerimentoId, { status, analisadoPorId, motivoDecisao, timelineEventoId }) {
        const { rows } = await this.connection.query(
            `UPDATE ceob.requerimentos
             SET status = $2,
                 analisado_por_id = $3,
                 motivo_decisao = $4,
                 timeline_evento_id = $5
             WHERE id = $1
             RETURNING *`,
            [requerimentoId, status, analisadoPorId || null, motivoDecisao || null, timelineEventoId || null]
        );
        return rows[0];
    }

    async buscarPorId(requerimentoId) {
        const { rows } = await this.connection.query(
            `SELECT * FROM ceob.requerimentos WHERE id = $1`,
            [requerimentoId]
        );
        return rows[0] || null;
    }
}

module.exports = RequerimentosHandle;