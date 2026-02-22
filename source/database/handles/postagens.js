class PostagensHandle {
    constructor(connection) {
        this.connection = connection;
    }

    async criar({ autorId, tipo, titulo, conteudo, militarReferenciadoId, requerimentoId, discordMessageId, discordChannelId }) {
        const { rows } = await this.connection.query(
            `INSERT INTO ceob.postagens
                (autor_id, tipo, titulo, conteudo, militar_referenciado_id, requerimento_id, discord_message_id, discord_channel_id)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
             RETURNING *`,
            [autorId, tipo, titulo, conteudo || null, militarReferenciadoId || null, requerimentoId || null, discordMessageId || null, discordChannelId || null]
        );
        return rows[0];
    }
}

module.exports = PostagensHandle;