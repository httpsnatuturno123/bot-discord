// src/interactions/buttonTransferenciaHandler.js
const {
    ModalBuilder,
    TextInputBuilder,
    TextInputStyle,
    ActionRowBuilder
} = require('discord.js');

const PREFIXOS = {
    APROVAR: 'reqtransf_aprovar_',
    RECUSAR: 'reqtransf_recusar_'
};

function isTransferenciaButton(customId) {
    return customId.startsWith(PREFIXOS.APROVAR) || customId.startsWith(PREFIXOS.RECUSAR);
}

async function handleTransferenciaButton(interaction) {
    try {
        const isAprovacao = interaction.customId.startsWith(PREFIXOS.APROVAR);
        const prefixo = isAprovacao ? PREFIXOS.APROVAR : PREFIXOS.RECUSAR;
        const requerimentoId = interaction.customId.replace(prefixo, '');
        const acao = isAprovacao ? 'APROVAR' : 'INDEFERIR';

        const modal = new ModalBuilder()
            .setCustomId(`modaltransf_${acao}_${requerimentoId}`)
            .setTitle(isAprovacao ? `✅ Aprovar Transferência #${requerimentoId}` : `❌ Indeferir #${requerimentoId}`);

        const motivoInput = new TextInputBuilder()
            .setCustomId('motivo_decisao')
            .setLabel(isAprovacao ? 'Justificativa da Aprovação' : 'Justificativa do Indeferimento')
            .setPlaceholder('Escreva o motivo...')
            .setStyle(TextInputStyle.Paragraph)
            .setRequired(true)
            .setMinLength(3)
            .setMaxLength(1000);

        modal.addComponents(new ActionRowBuilder().addComponents(motivoInput));

        await interaction.showModal(modal);
    } catch (error) {
        console.error('Erro ao processar botão de transferência:', error);
        try {
            if (interaction.deferred || interaction.replied) {
                await interaction.editReply('❌ Ocorreu um erro interno ao processar o botão da transferência.');
            } else {
                await interaction.reply({ content: '❌ Ocorreu um erro interno ao processar o botão da transferência.', ephemeral: true });
            }
        } catch (e) { }
    }
}

module.exports = { isTransferenciaButton, handleTransferenciaButton };
