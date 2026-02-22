class TimelineHandle {
    constructor(connection) {
        this.connection = connection;
    }

    async registrarEvento({ militarId, tipoEvento, descricao, dadosExtras, executadoPorId, aprovadoPorId, omContextoId, referenciaExterna }) {
        const { rows } = await this.connection.query(
            `INSERT INTO ceob.timeline_eventos
                (militar_id, tipo_evento, descricao, dados_extras, executado_por_id, aprovado_por_id, om_contexto_id, referencia_externa)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
             RETURNING *`,
            [
                militarId,
                tipoEvento,
                descricao,
                dadosExtras ? JSON.stringify(dadosExtras) : null,
                executadoPorId || null,
                aprovadoPorId || null,
                omContextoId || null,
                referenciaExterna || null
            ]
        );
        return rows[0];
    }

    async getDoMilitar(militarId, limit = 50) {
        const { rows } = await this.connection.query(
            `SELECT t.*,
                    exec.nome_guerra AS executado_por_nome,
                    aprov.nome_guerra AS aprovado_por_nome
             FROM ceob.timeline_eventos t
             LEFT JOIN ceob.militares exec ON t.executado_por_id = exec.id
             LEFT JOIN ceob.militares aprov ON t.aprovado_por_id = aprov.id
             WHERE t.militar_id = $1
             ORDER BY t.created_at DESC
             LIMIT $2`,
            [militarId, limit]
        );
        return rows;
    }
}

module.exports = TimelineHandle;