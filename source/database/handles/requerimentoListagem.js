class RequerimentoListagemHandle {
    constructor(connection) {
        this.connection = connection;
    }

    async requererListagem({ executadoPorId, robloxId, robloxUsername, nomeGuerra, omSigla, patenteAbrev, discordId }) {
        const client = await this.connection.getClient();

        try {
            await client.query('BEGIN');

            const { rows: patenteRows } = await client.query(
                `SELECT id, nome FROM ceob.patentes WHERE abreviacao = $1 AND ativo = true`,
                [patenteAbrev]
            );
            if (!patenteRows.length) throw new Error(`Patente "${patenteAbrev}" não encontrada no banco.`);
            const patenteId = patenteRows[0].id;

            const { rows: omRows } = await client.query(
                `SELECT id, nome FROM ceob.organizacoes_militares WHERE sigla = $1`,
                [omSigla]
            );
            if (!omRows.length) throw new Error(`OM com sigla "${omSigla}" não encontrada.`);
            const omId = omRows[0].id;

            // Criar o militar alvo como inativo para o processo do requerimento
            const { rows: militarRows } = await client.query(
                `INSERT INTO ceob.militares (nome_guerra, roblox_user_id, roblox_username, discord_user_id, patente_id, om_lotacao_id, ativo)
                 VALUES ($1, $2, $3, $4, $5, $6, false) RETURNING id, matricula, nome_guerra`,
                [nomeGuerra, robloxId, robloxUsername, discordId || null, patenteId, omId]
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

            // O próprio solicitante será o militar recém-criado na fase Inativa
            const solicitanteId = militarPendente.id;

            const dadosExtras = { patente_inicial: patenteAbrev, om_inicial: omSigla, roblox_username: robloxUsername };

            const { rows: reqRows } = await client.query(
                `INSERT INTO ceob.requerimentos (tipo, solicitante_id, militar_alvo_id, orgao_responsavel_id, status, motivo_solicitacao, dados_extras, is_listagem)
                 VALUES ('LISTAGEM_REGISTRO', $1, $2, $3, 'PENDENTE', $4, $5, true) RETURNING id`,
                [solicitanteId, militarPendente.id, orgaoResponsavelId, "Solicitação de cadastro próprio.", JSON.stringify(dadosExtras)]
            );
            const requerimentoId = reqRows[0].id;

            await client.query('COMMIT');

            return {
                militar: militarPendente,
                requerimentoId: requerimentoId,
                patenteNome: patenteRows[0].nome
            };

        } catch (error) {
            await client.query('ROLLBACK');
            throw error;
        } finally {
            client.release();
        }
    }
}

module.exports = RequerimentoListagemHandle;
