// src/interactions/modalTransferenciaHandler.js
const { EmbedBuilder } = require('discord.js');

const PREFIXOS_MODAL = {
    APROVAR: 'modaltransf_APROVAR_',
    INDEFERIR: 'modaltransf_INDEFERIR_'
};

function isTransferenciaModal(customId) {
    return customId.startsWith(PREFIXOS_MODAL.APROVAR) || customId.startsWith(PREFIXOS_MODAL.INDEFERIR);
}

async function handleTransferenciaModal(interaction, ceobDb) {
    try {
        await interaction.deferUpdate();

        const customId = interaction.customId;
        const isAprovacao = customId.startsWith(PREFIXOS_MODAL.APROVAR);
        const prefixo = isAprovacao ? PREFIXOS_MODAL.APROVAR : PREFIXOS_MODAL.INDEFERIR;
        const requerimentoId = customId.replace(prefixo, '');
        const motivoDecisao = interaction.fields.getTextInputValue('motivo_decisao');

        const executorDiscordId = interaction.user.id;
        const executorMilitar = await ceobDb.militares.getByDiscord(executorDiscordId);

        if (!executorMilitar) {
            await interaction.followUp({ content: '❌ Você não possui cadastro no sistema.', ephemeral: true });
            return;
        }

        // Valida o req
        const reqDb = await ceobDb.requerimentos.buscarPorId(requerimentoId);
        if (!reqDb) {
            await interaction.followUp({ content: '❌ Requerimento não encontrado no banco de dados.', ephemeral: true });
            return;
        }

        if (reqDb.status !== 'PENDENTE' && reqDb.status !== 'EM_ANALISE') {
            await interaction.followUp({ content: `❌ Este requerimento já foi concluído com status: **${reqDb.status}**.`, ephemeral: true });
            return;
        }

        const dadosExtras = typeof reqDb.dados_extras === 'string' ? JSON.parse(reqDb.dados_extras) : reqDb.dados_extras;
        const omDestinoId = reqDb.orgao_responsavel_id || (dadosExtras ? dadosExtras.omDestinoId : null);

        // Verifica permissão: CMD OM Destino ou Superior ou DGP ou AC
        const executorFuncoes = await ceobDb.funcoes.listarPorMilitar(executorMilitar.id);
        const isComandanteDaOM = executorFuncoes.some(f => f.om_id === omDestinoId && f.funcao_nome.toLowerCase().includes('comandante'));
        const pertenceDGP = await ceobDb.permissoes.pertenceAoOrgao(executorMilitar.id, 'DGP');
        const isAltoComando = await ceobDb.permissoes.isAltoComando(executorMilitar.id);

        if (!isComandanteDaOM && !pertenceDGP && !isAltoComando) {
            await interaction.followUp({ content: `❌ Somente a DGP, o Alto Comando ou o Comandante da OM pretendida podem julgar este requerimento.`, ephemeral: true });
            return;
        }

        // Processa
        if (isAprovacao) {
            // Atualiza OM
            await ceobDb.connection.query(
                `UPDATE ceob.militares SET om_lotacao_id = $1, updated_at = NOW() WHERE id = $2`,
                [omDestinoId, reqDb.solicitante_id]
            );

            // Timeline
            const descricaoTimeline = `Transferência Requerida APROVADA: de ${dadosExtras.omOrigemSigla} para ${dadosExtras.omDestinoSigla}. Motivo solicitação: ${dadosExtras.motivo}. Aprovado por: ${executorMilitar.nome_guerra} - Justificativa: ${motivoDecisao}`;
            const timelineObj = await ceobDb.timeline.registrar({
                militarId: reqDb.solicitante_id,
                tipoEvento: 'TRANSFERENCIA',
                descricao: descricaoTimeline,
                executadoPorId: reqDb.solicitante_id,
                aprovadoPorId: executorMilitar.id,
                omContextoId: omDestinoId
            });

            await ceobDb.requerimentos.atualizar(requerimentoId, {
                status: 'APROVADO',
                analisadoPorId: executorMilitar.id,
                motivoDecisao: motivoDecisao,
                timelineEventoId: timelineObj.id
            });

            // Edita Msg embed Original
            const embedOriginal = interaction.message.embeds[0];
            const newEmbed = EmbedBuilder.from(embedOriginal)
                .setTitle(`✅ Transferência #${requerimentoId} Aprovada`)
                .setColor(0x2ecc71)
                .addFields({ name: `✅ Aprovado por ${executorMilitar.patente_abrev} ${executorMilitar.nome_guerra}`, value: motivoDecisao });

            await interaction.message.edit({ embeds: [newEmbed], components: [] });

        } else {
            // Recusado
            await ceobDb.requerimentos.atualizar(requerimentoId, {
                status: 'INDEFERIDO',
                analisadoPorId: executorMilitar.id,
                motivoDecisao: motivoDecisao,
                timelineEventoId: null // n gera log
            });

            // Edita Msg embed Original
            const embedOriginal = interaction.message.embeds[0];
            const newEmbed = EmbedBuilder.from(embedOriginal)
                .setTitle(`❌ Transferência #${requerimentoId} Indeferida`)
                .setColor(0xe74c3c)
                .addFields({ name: `❌ Indeferido por ${executorMilitar.patente_abrev} ${executorMilitar.nome_guerra}`, value: motivoDecisao });

            await interaction.message.edit({ embeds: [newEmbed], components: [] });
        }

    } catch (err) {
        console.error('Erro no modal da transferencia:', err);
        try {
            await interaction.followUp({ content: '❌ Erro interno ao processar análise da transferência.', ephemeral: true });
        } catch (e) { }
    }
}

module.exports = { isTransferenciaModal, handleTransferenciaModal };
