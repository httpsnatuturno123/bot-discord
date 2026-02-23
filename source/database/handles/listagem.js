class ListagemHandle {
    constructor(connection) {
        this.connection = connection;
    }

    async executarRecrutamento({ executadoPorId, robloxId, robloxUsername, nomeGuerra, omSigla, discordId }) {
        const client = await this.connection.getClient();

        try {
            await client.query('BEGIN');

            const { rows: patenteRows } = await client.query(
                `SELECT id FROM ceob.patentes WHERE abreviacao = 'REC'`
            );
            if (!patenteRows.length) throw new Error('Patente REC não encontrada no banco.');
            const patenteId = patenteRows[0].id;

            const { rows: omRows } = await client.query(
                `SELECT id, nome FROM ceob.organizacoes_militares WHERE sigla = $1`,
                [omSigla]
            );
            if (!omRows.length) throw new Error(`OM com sigla "${omSigla}" não encontrada.`);
            const omId = omRows[0].id;

            const { rows: militarRows } = await client.query(
                `INSERT INTO ceob.militares (nome_guerra, roblox_user_id, roblox_username, discord_user_id, patente_id, om_lotacao_id)
                 VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
                [nomeGuerra, robloxId, robloxUsername, discordId || null, patenteId, omId]
            );
            const novoMilitar = militarRows[0];

            const { rows: reqRows } = await client.query(
                `INSERT INTO ceob.requerimentos (tipo, solicitante_id, militar_alvo_id, status, motivo_solicitacao, is_listagem)
                 VALUES ('LISTAGEM_REGISTRO', $1, $2, 'APROVADO', 'Listagem direta (DGP/Alto Comando)', true) RETURNING *`,
                [executadoPorId, novoMilitar.id]
            );
            const requerimentoId = reqRows[0].id;

            const dadosExtras = JSON.stringify({ patente_inicial: 'REC', om_inicial: omSigla });
            const { rows: timelineRows } = await client.query(
                `INSERT INTO ceob.timeline_eventos (militar_id, tipo_evento, descricao, executado_por_id, om_contexto_id, dados_extras)
                 VALUES ($1, 'INGRESSO', 'Ingresso no CEOB via Listagem de Recrutamento', $2, $3, $4) RETURNING *`,
                [novoMilitar.id, executadoPorId, omId, dadosExtras]
            );
            const timelineId = timelineRows[0].id;

            await client.query(
                `UPDATE ceob.requerimentos SET timeline_evento_id = $1 WHERE id = $2`,
                [timelineId, requerimentoId]
            );

            const { rows: numRows } = await client.query(`SELECT ceob.gerar_numero_boletim() AS numero`);
            const boletimNumero = numRows[0].numero;
            const boletimConteudo = `**INGRESSO NO CEOB**\nO recruta **${nomeGuerra}** foi integrado à instituição e matriculado nas fileiras da OM **${omSigla}**.`;

            const { rows: boletimRows } = await client.query(
                `INSERT INTO ceob.boletim_eletronico (numero, conteudo, requerimento_id, timeline_evento_id)
                 VALUES ($1, $2, $3, $4) RETURNING *`,
                [boletimNumero, boletimConteudo, requerimentoId, timelineId]
            );

            await client.query('COMMIT');

            return {
                militar: novoMilitar,
                boletim: boletimRows[0]
            };

        } catch (error) {
            await client.query('ROLLBACK');
            throw error;
        } finally {
            client.release();
        }
    }
    async executarListagemMilitar({ executadoPorId, robloxId, robloxUsername, nomeGuerra, omSigla, discordId, patenteAbrev }) {
        const client = await this.connection.getClient();

        try {
            await client.query('BEGIN');

            const { rows: patenteRows } = await client.query(
                `SELECT id, nome FROM ceob.patentes WHERE abreviacao = $1 AND ativo = true`,
                [patenteAbrev]
            );
            if (!patenteRows.length) throw new Error(`Patente "${patenteAbrev}" não encontrada no banco.`);
            const patenteId = patenteRows[0].id;
            const patenteNome = patenteRows[0].nome;

            const { rows: omRows } = await client.query(
                `SELECT id, nome FROM ceob.organizacoes_militares WHERE sigla = $1`,
                [omSigla]
            );
            if (!omRows.length) throw new Error(`OM com sigla "${omSigla}" não encontrada.`);
            const omId = omRows[0].id;

            const { rows: militarRows } = await client.query(
                `INSERT INTO ceob.militares (nome_guerra, roblox_user_id, roblox_username, discord_user_id, patente_id, om_lotacao_id)
                 VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
                [nomeGuerra, robloxId, robloxUsername, discordId, patenteId, omId]
            );
            const novoMilitar = militarRows[0];

            const { rows: reqRows } = await client.query(
                `INSERT INTO ceob.requerimentos (tipo, solicitante_id, militar_alvo_id, status, motivo_solicitacao, is_listagem)
                 VALUES ('LISTAGEM_REGISTRO', $1, $2, 'APROVADO', 'Listagem direta de militar (DGP/Alto Comando)', true) RETURNING *`,
                [executadoPorId, novoMilitar.id]
            );
            const requerimentoId = reqRows[0].id;

            const dadosExtras = JSON.stringify({ patente_inicial: patenteAbrev, om_inicial: omSigla });
            const { rows: timelineRows } = await client.query(
                `INSERT INTO ceob.timeline_eventos (militar_id, tipo_evento, descricao, executado_por_id, om_contexto_id, dados_extras)
                 VALUES ($1, 'INGRESSO', $2, $3, $4, $5) RETURNING *`,
                [novoMilitar.id, `Ingresso no CEOB como ${patenteNome} (${patenteAbrev}) via Listagem de Militar`, executadoPorId, omId, dadosExtras]
            );
            const timelineId = timelineRows[0].id;

            await client.query(
                `UPDATE ceob.requerimentos SET timeline_evento_id = $1 WHERE id = $2`,
                [timelineId, requerimentoId]
            );

            const { rows: numRows } = await client.query(`SELECT ceob.gerar_numero_boletim() AS numero`);
            const boletimNumero = numRows[0].numero;
            const boletimConteudo = `**INGRESSO NO CEOB**\nO ${patenteNome} **${nomeGuerra}** foi integrado à instituição com a patente de **${patenteAbrev}** e lotado na OM **${omSigla}**.`;

            const { rows: boletimRows } = await client.query(
                `INSERT INTO ceob.boletim_eletronico (numero, conteudo, requerimento_id, timeline_evento_id)
                 VALUES ($1, $2, $3, $4) RETURNING *`,
                [boletimNumero, boletimConteudo, requerimentoId, timelineId]
            );

            await client.query('COMMIT');

            return {
                militar: novoMilitar,
                boletim: boletimRows[0],
                patenteNome
            };

        } catch (error) {
            await client.query('ROLLBACK');
            throw error;
        } finally {
            client.release();
        }
    }
}

module.exports = ListagemHandle;