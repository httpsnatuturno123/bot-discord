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

    async getById(militarId) {
        const { rows } = await this.connection.query(
            `SELECT m.*, p.nome AS patente_nome, p.abreviacao AS patente_abrev,
                    p.ordem_precedencia, p.circulo,
                    om.nome AS om_nome, om.sigla AS om_sigla
             FROM ceob.militares m
             JOIN ceob.patentes p ON m.patente_id = p.id
             JOIN ceob.organizacoes_militares om ON m.om_lotacao_id = om.id
             WHERE m.id = $1`,
            [militarId]
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

    async getByNomeGuerra(nomeGuerra) {
        const { rows } = await this.connection.query(
            `SELECT m.*, p.nome AS patente_nome, p.abreviacao AS patente_abrev,
                    p.ordem_precedencia, p.circulo,
                    om.nome AS om_nome, om.sigla AS om_sigla
             FROM ceob.militares m
             JOIN ceob.patentes p ON m.patente_id = p.id
             JOIN ceob.organizacoes_militares om ON m.om_lotacao_id = om.id
             WHERE m.nome_guerra = $1 AND m.ativo = true`,
            [nomeGuerra]
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

    async listagem() {
        const { rows } = await this.connection.query(
            `SELECT m.id, m.matricula, m.nome_guerra, m.roblox_user_id, m.roblox_username,
                    m.discord_user_id, m.ativo, m.data_ingresso, m.data_ultima_promocao,
                    p.nome AS patente_nome, p.abreviacao AS patente_abrev,
                    p.ordem_precedencia, p.circulo,
                    om.nome AS om_nome, om.sigla AS om_sigla
             FROM ceob.militares m
             JOIN ceob.patentes p ON m.patente_id = p.id
             JOIN ceob.organizacoes_militares om ON m.om_lotacao_id = om.id
             WHERE m.ativo = true
             ORDER BY p.ordem_precedencia ASC, m.nome_guerra ASC`
        );
        return rows;
    }

    async atualizarPatente(militarId, novaPatenteId) {
        const { rows } = await this.connection.query(
            `UPDATE ceob.militares
             SET patente_id = $1
             WHERE id = $2
             RETURNING *`,
            [novaPatenteId, militarId]
        );
        return rows[0];
    }

    async desligar(militarId, situacaoFuncional) {
        const { rows } = await this.connection.query(
            `UPDATE ceob.militares
             SET ativo = false, situacao_funcional = $1, updated_at = NOW()
             WHERE id = $2
             RETURNING *`,
            [situacaoFuncional, militarId]
        );
        return rows[0];
    }


    async apagarDefinitivamente(militarId) {
        const client = await this.connection.getClient();
        try {
            await client.query('BEGIN');

            // 1. Identifica os IDs dos requerimentos envolvendo este militar
            const { rows: reqIds } = await client.query(
                `SELECT id FROM ceob.requerimentos WHERE solicitante_id = $1 OR militar_alvo_id = $1`,
                [militarId]
            );
            const requerimentoIds = reqIds.map(r => r.id);

            // 2. Identifica os IDs das timeline_eventos envolvendo este militar
            const { rows: tlIds } = await client.query(
                `SELECT id FROM ceob.timeline_eventos WHERE militar_id = $1 OR executado_por_id = $1 OR aprovado_por_id = $1`,
                [militarId]
            );
            const timelineIds = tlIds.map(t => t.id);

            // 3. Apaga Boletins que referenciam requerimentos ou timeline deste militar
            if (requerimentoIds.length > 0) {
                await client.query(`DELETE FROM ceob.boletim_eletronico WHERE requerimento_id = ANY($1)`, [requerimentoIds]);
            }
            if (timelineIds.length > 0) {
                await client.query(`DELETE FROM ceob.boletim_eletronico WHERE timeline_evento_id = ANY($1)`, [timelineIds]);
            }

            // 4. Apaga Postagens feitas pelo militar, referenciando o militar, OU que referenciam requerimentos dele
            await client.query(`DELETE FROM ceob.postagens WHERE autor_id = $1 OR militar_referenciado_id = $1`, [militarId]);
            if (requerimentoIds.length > 0) {
                await client.query(`DELETE FROM ceob.postagens WHERE requerimento_id = ANY($1)`, [requerimentoIds]);
            }

            // 5. Anula referências cruzadas nos requerimentos antes de deletar
            await client.query(`UPDATE ceob.requerimentos SET analisado_por_id = NULL WHERE analisado_por_id = $1`, [militarId]);
            await client.query(`UPDATE ceob.requerimentos SET timeline_evento_id = NULL WHERE solicitante_id = $1 OR militar_alvo_id = $1`, [militarId]);

            // 6. Deleta os requerimentos
            await client.query(`DELETE FROM ceob.requerimentos WHERE solicitante_id = $1 OR militar_alvo_id = $1`, [militarId]);

            // 7. Desabilita temporariamente o trigger de proteção append-only da timeline
            await client.query(`ALTER TABLE ceob.timeline_eventos DISABLE TRIGGER trg_timeline_no_update`);

            // 8. Limpa referências do militar em timeline_eventos de OUTROS militares e deleta as dele
            await client.query(`UPDATE ceob.timeline_eventos SET executado_por_id = NULL WHERE executado_por_id = $1`, [militarId]);
            await client.query(`UPDATE ceob.timeline_eventos SET aprovado_por_id = NULL WHERE aprovado_por_id = $1`, [militarId]);
            await client.query(`DELETE FROM ceob.timeline_eventos WHERE militar_id = $1`, [militarId]);

            // 9. Reabilita o trigger de proteção da timeline
            await client.query(`ALTER TABLE ceob.timeline_eventos ENABLE TRIGGER trg_timeline_no_update`);

            // 10. Apaga Funções do Militar
            await client.query(`DELETE FROM ceob.militar_funcoes WHERE militar_id = $1`, [militarId]);

            // 11. Apaga o próprio Militar
            await client.query(`DELETE FROM ceob.militares WHERE id = $1`, [militarId]);

            await client.query('COMMIT');
            return true;
        } catch (error) {
            await client.query('ROLLBACK');
            console.error('SQL Error:', error.message, '| Constraint:', error.constraint, '| Table:', error.table);
            throw error;
        } finally {
            client.release();
        }
    }
}

module.exports = MilitaresHandle;