class BoletimHandle {
    constructor(connection) {
        this.connection = connection;
    }

    async criar({ conteudo, requerimentoId, timelineEventoId, discordMessageId }) {
        const { rows: numRows } = await this.connection.query(
            `SELECT ceob.gerar_numero_boletim() AS numero`
        );
        const numero = numRows[0].numero;

        const { rows } = await this.connection.query(
            `INSERT INTO ceob.boletim_eletronico
                (numero, conteudo, requerimento_id, timeline_evento_id, discord_message_id)
             VALUES ($1, $2, $3, $4, $5)
             RETURNING *`,
            [numero, conteudo, requerimentoId || null, timelineEventoId || null, discordMessageId || null]
        );
        return rows[0];
    }
}

module.exports = BoletimHandle;