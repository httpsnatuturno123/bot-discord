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

    async getByDiscordAny(discordUserId) {
        const { rows } = await this.connection.query(
            `SELECT m.*, p.nome AS patente_nome, p.abreviacao AS patente_abrev,
                    p.ordem_precedencia, p.circulo,
                    om.nome AS om_nome, om.sigla AS om_sigla
             FROM ceob.militares m
             JOIN ceob.patentes p ON m.patente_id = p.id
             JOIN ceob.organizacoes_militares om ON m.om_lotacao_id = om.id
             WHERE m.discord_user_id = $1`,
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

    async getByRobloxAny(robloxUserId) {
        const { rows } = await this.connection.query(
            `SELECT m.*, p.nome AS patente_nome, p.abreviacao AS patente_abrev,
                    p.ordem_precedencia, p.circulo,
                    om.nome AS om_nome, om.sigla AS om_sigla
             FROM ceob.militares m
             JOIN ceob.patentes p ON m.patente_id = p.id
             JOIN ceob.organizacoes_militares om ON m.om_lotacao_id = om.id
             WHERE m.roblox_user_id = $1`,
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
    async apagarDefinitivamente(militarId) {
        const client = await this.connection.getClient();
        try {
            await client.query('BEGIN');

            // 1. Apaga Postagens referenciadas ou feitas pelo autor
            await client.query(`DELETE FROM ceob.postagens WHERE autor_id = $1 OR militar_referenciado_id = $1`, [militarId]);

            // 2. Boletins são associados a requerimentos e timeline. Excluídos depois, mas a restrição de requerimento/timeline
            // faz com que tenhamos que deletar os boletins relacionados.
            await client.query(`
                DELETE FROM ceob.boletim_eletronico 
                WHERE requerimento_id IN (
                    SELECT id FROM ceob.requerimentos WHERE solicitante_id = $1 OR militar_alvo_id = $1
                )
                   OR timeline_evento_id IN (
                    SELECT id FROM ceob.timeline_eventos WHERE militar_id = $1 OR executado_por_id = $1 OR aprovado_por_id = $1
                )
            `, [militarId]);

            // 3. Apaga Requerimentos envolvendo o militar
            await client.query(`UPDATE ceob.requerimentos SET analisado_por_id = NULL WHERE analisado_por_id = $1`, [militarId]);
            await client.query(`DELETE FROM ceob.requerimentos WHERE solicitante_id = $1 OR militar_alvo_id = $1`, [militarId]);

            // 4. Apaga Timeline envolvendo o militar
            await client.query(`UPDATE ceob.timeline_eventos SET executado_por_id = NULL, aprovado_por_id = NULL WHERE executado_por_id = $1 OR aprovado_por_id = $1`, [militarId]);
            await client.query(`DELETE FROM ceob.timeline_eventos WHERE militar_id = $1`, [militarId]);

            // 5. Apaga Funções do Militar
            await client.query(`DELETE FROM ceob.militar_funcoes WHERE militar_id = $1`, [militarId]);

            // 6. Apaga o próprio Militar
            await client.query(`DELETE FROM ceob.militares WHERE id = $1`, [militarId]);

            await client.query('COMMIT');
            return true;
        } catch (error) {
            await client.query('ROLLBACK');
            throw error;
        } finally {
            client.release();
        }
    }
}

module.exports = MilitaresHandle;