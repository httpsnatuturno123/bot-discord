class MilitaresHandle {
    constructor(connection) {
        this.connection = connection;
    }

    async getByDiscord(discordUserId) {
        const { rows } = await this.connection.query(
            `SELECT m.*, p.nome AS patente_nome, p.abreviacao AS patente_abrev,
                    p.ordem_precedencia, p.circulo,
                    om.nome AS om_nome, om.sigla AS om_sigla
             FROM ceob.militares m
             JOIN ceob.patentes p ON m.patente_id = p.id
             JOIN ceob.organizacoes_militares om ON m.om_lotacao_id = om.id
             WHERE m.discord_user_id = $1 AND m.ativo = true`,
            [discordUserId]
        );
        return rows[0] || null;
    }

    async getByRoblox(robloxUserId) {
        const { rows } = await this.connection.query(
            `SELECT m.*, p.nome AS patente_nome, p.abreviacao AS patente_abrev,
                    p.ordem_precedencia, p.circulo,
                    om.nome AS om_nome, om.sigla AS om_sigla
             FROM ceob.militares m
             JOIN ceob.patentes p ON m.patente_id = p.id
             JOIN ceob.organizacoes_militares om ON m.om_lotacao_id = om.id
             WHERE m.roblox_user_id = $1 AND m.ativo = true`,
            [robloxUserId]
        );
        return rows[0] || null;
    }

    async getByMatricula(matricula) {
        const { rows } = await this.connection.query(
            `SELECT m.*, p.nome AS patente_nome, p.abreviacao AS patente_abrev,
                    p.ordem_precedencia, p.circulo,
                    om.nome AS om_nome, om.sigla AS om_sigla
             FROM ceob.militares m
             JOIN ceob.patentes p ON m.patente_id = p.id
             JOIN ceob.organizacoes_militares om ON m.om_lotacao_id = om.id
             WHERE m.matricula = $1`,
            [matricula]
        );
        return rows[0] || null;
    }

    async criar({ nomeGuerra, robloxUserId, robloxUsername, discordUserId, patenteId, omLotacaoId }) {
        const { rows } = await this.connection.query(
            `INSERT INTO ceob.militares
                (nome_guerra, roblox_user_id, roblox_username, discord_user_id, patente_id, om_lotacao_id)
             VALUES ($1, $2, $3, $4, $5, $6)
             RETURNING *`,
            [nomeGuerra, robloxUserId, robloxUsername || null, discordUserId || null, patenteId, omLotacaoId]
        );
        return rows[0];
    }
    async criarInativo({ nomeGuerra, robloxUserId, robloxUsername, discordUserId, patenteId, omLotacaoId }) {
        const { rows } = await this.connection.query(
            `INSERT INTO ceob.militares
                (nome_guerra, roblox_user_id, roblox_username, discord_user_id, patente_id, om_lotacao_id, ativo)
             VALUES ($1, $2, $3, $4, $5, $6, false)
             RETURNING *`,
            [nomeGuerra, robloxUserId, robloxUsername || null, discordUserId || null, patenteId, omLotacaoId]
        );
        return rows[0];
    }
}

module.exports = MilitaresHandle;