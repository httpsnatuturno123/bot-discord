// src/interactions/buttonHandler.js
const {
    ModalBuilder,
    TextInputBuilder,
    TextInputStyle,
    ActionRowBuilder
} = require('discord.js');

const PREFIXOS = {
    APROVAR: 'req_aprovar_',
    RECUSAR: 'req_recusar_'
};

/**
 * Verifica se o botão é de requerimento.
 */
function isRequerimentoButton(customId) {
    return customId.startsWith(PREFIXOS.APROVAR) || customId.startsWith(PREFIXOS.RECUSAR);
}

/**
 * Trata clique em botão de aprovar/recusar requerimento.
 */
async function handleRequerimentoButton(interaction) {
    const isAprovacao = interaction.customId.startsWith(PREFIXOS.APROVAR);
    const prefixo = isAprovacao ? PREFIXOS.APROVAR : PREFIXOS.RECUSAR;
    const requerimentoId = interaction.customId.replace(prefixo, '');
    const acao = isAprovacao ? 'APROVAR' : 'INDEFERIR';

    const modal = new ModalBuilder()
        .setCustomId(`req_modal_${acao}_${requerimentoId}`)
        .setTitle(isAprovacao ? `✅ Aprovar #${requerimentoId}` : `❌ Indeferir #${requerimentoId}`);

    const motivoInput = new TextInputBuilder()
        .setCustomId('motivo_decisao')
        .setLabel('Justificativa / Motivo da Decisão')
        .setPlaceholder('Escreva o motivo da aprovação ou indeferimento...')
        .setStyle(TextInputStyle.Paragraph)
        .setRequired(true)
        .setMinLength(3)
        .setMaxLength(1000);

    modal.addComponents(new ActionRowBuilder().addComponents(motivoInput));
    await interaction.showModal(modal);
}

module.exports = { isRequerimentoButton, handleRequerimentoButton };