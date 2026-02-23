class RequerimentoRecrutamentoHandle {
    constructor(connection) {
        this.connection = connection;
    }

    async requererRecrutamento({ executadoPorId, robloxId, robloxUsername, nomeGuerra, discordId, observacao }) {
        const client = await this.connection.getClient();

        try {
            await client.query('BEGIN');

            const { rows: patenteRows } = await client.query(
                `SELECT id FROM ceob.patentes WHERE abreviacao = 'REC'`
            );
            if (!patenteRows.length) throw new Error('Patente REC não encontrada no banco.');
            const patenteId = patenteRows[0].id;

            // Usar DGP como OM temporária (será alterada pelo analista na aprovação)
            const { rows: omRows } = await client.query(
                `SELECT id FROM ceob.organizacoes_militares WHERE sigla = 'DGP'`
            );
            if (!omRows.length) throw new Error('OM padrão "DGP" não encontrada no banco.');
            const omTemporariaId = omRows[0].id;

            // Criar o militar alvo como inativo para o processo do requerimento
            const { rows: militarRows } = await client.query(
                `INSERT INTO ceob.militares (nome_guerra, roblox_user_id, roblox_username, discord_user_id, patente_id, om_lotacao_id, ativo)
                 VALUES ($1, $2, $3, $4, $5, $6, false) RETURNING id, matricula, nome_guerra`,
                [nomeGuerra, robloxId, robloxUsername, discordId || null, patenteId, omTemporariaId]
            );
            const militarPendente = militarRows[0];

            // Inserir o ticket do requerimento para a DGP
            const orgaoResponsavelSigla = 'DGP';
            const { rows: reqOmRows } = await client.query(
                `SELECT id FROM ceob.organizacoes_militares WHERE sigla = $1`,
                [orgaoResponsavelSigla]
            );

            let orgaoResponsavelId = null;
            if (reqOmRows.length > 0) {
                orgaoResponsavelId = reqOmRows[0].id;
            }

            const dadosExtras = {
                patente_inicial: 'REC',
                roblox_username: robloxUsername,
                roblox_user_id: robloxId,
                observacao: observacao
            };

            const { rows: reqRows } = await client.query(
                `INSERT INTO ceob.requerimentos (tipo, solicitante_id, militar_alvo_id, orgao_responsavel_id, status, motivo_solicitacao, dados_extras, is_listagem)
                 VALUES ('RECRUTAMENTO', $1, $2, $3, 'PENDENTE', $4, $5, false) RETURNING id`,
                [executadoPorId, militarPendente.id, orgaoResponsavelId, observacao, JSON.stringify(dadosExtras)]
            );
            const requerimentoId = reqRows[0].id;

            await client.query('COMMIT');

            return {
                militar: militarPendente,
                requerimentoId: requerimentoId
            };

        } catch (error) {
            await client.query('ROLLBACK');
            throw error;
        } finally {
            client.release();
        }
    }
}

module.exports = RequerimentoRecrutamentoHandle;
