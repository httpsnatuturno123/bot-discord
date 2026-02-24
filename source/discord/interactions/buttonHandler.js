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
 * Extrai o valor de um campo da embed pelo nome (prefixo).
 */
function extrairCampoEmbed(embed, prefixoNome) {
    if (!embed || !embed.fields) return '';
    const field = embed.fields.find(f => f.name.includes(prefixoNome));
    if (!field) return '';
    // Remove markdown bold (**texto**)
    return field.value.replace(/\*\*/g, '').trim();
}

/**
 * Trata clique em botão de aprovar/recusar requerimento.
 */
async function handleRequerimentoButton(interaction) {
    try {
        const isAprovacao = interaction.customId.startsWith(PREFIXOS.APROVAR);
        const prefixo = isAprovacao ? PREFIXOS.APROVAR : PREFIXOS.RECUSAR;
        const requerimentoId = interaction.customId.replace(prefixo, '');
        const acao = isAprovacao ? 'APROVAR' : 'INDEFERIR';

        const modal = new ModalBuilder()
            .setCustomId(`req_modal_${acao}_${requerimentoId}`)
            .setTitle(isAprovacao ? `✅ Aprovar #${requerimentoId}` : `❌ Indeferir #${requerimentoId}`);

        if (isAprovacao) {
            // Modal de APROVAÇÃO: Nome de Guerra (editável), OM (definível), Patente (definível), Justificativa
            const embed = interaction.message.embeds[0];
            const nomeGuerraAtual = extrairCampoEmbed(embed, 'Militar (Alvo)').split('**')[1] || '';
            const patenteAtual = extrairCampoEmbed(embed, 'Militar (Alvo)').split('(')[1]?.replace(')', '') || '';

            const nomeGuerraInput = new TextInputBuilder()
                .setCustomId('nome_guerra')
                .setLabel('Nome de Guerra (pode alterar)')
                .setPlaceholder('Nome de Guerra do recruta')
                .setStyle(TextInputStyle.Short)
                .setValue(nomeGuerraAtual)
                .setRequired(true)
                .setMaxLength(100);

            const omInput = new TextInputBuilder()
                .setCustomId('om_destino')
                .setLabel('Sigla da OM de destino')
                .setPlaceholder('Ex: PE, 5º BIL, 9º BEC, COTER')
                .setStyle(TextInputStyle.Short)
                .setRequired(true)
                .setMaxLength(30);

            const patenteInput = new TextInputBuilder()
                .setCustomId('patente')
                .setLabel('Patente de destino (Abreviação)')
                .setPlaceholder('Ex: REC, SD, CB, 3º SGT')
                .setStyle(TextInputStyle.Short)
                .setValue(patenteAtual)
                .setRequired(true)
                .setMaxLength(30);

            const motivoInput = new TextInputBuilder()
                .setCustomId('motivo_decisao')
                .setLabel('Justificativa da Aprovação')
                .setPlaceholder('Escreva o motivo da aprovação...')
                .setStyle(TextInputStyle.Paragraph)
                .setRequired(true)
                .setMinLength(3)
                .setMaxLength(1000);

            modal.addComponents(
                new ActionRowBuilder().addComponents(nomeGuerraInput),
                new ActionRowBuilder().addComponents(omInput),
                new ActionRowBuilder().addComponents(patenteInput),
                new ActionRowBuilder().addComponents(motivoInput)
            );
        } else {
            // Modal de INDEFERIMENTO: apenas Justificativa (inalterado)
            const motivoInput = new TextInputBuilder()
                .setCustomId('motivo_decisao')
                .setLabel('Justificativa / Motivo da Decisão')
                .setPlaceholder('Escreva o motivo do indeferimento...')
                .setStyle(TextInputStyle.Paragraph)
                .setRequired(true)
                .setMinLength(3)
                .setMaxLength(1000);

            modal.addComponents(new ActionRowBuilder().addComponents(motivoInput));
        }

        await interaction.showModal(modal);

    } catch (error) {
        console.error('Erro ao processar botão de requerimento:', error);
        try {
            if (interaction.deferred || interaction.replied) {
                await interaction.editReply('❌ Ocorreu um erro interno ao processar o botão.');
            } else {
                await interaction.reply({ content: '❌ Ocorreu um erro interno ao processar o botão.', ephemeral: true });
            }
        } catch (replyErr) {
            console.error('Falha ao enviar resposta de erro:', replyErr);
        }
    }
}

module.exports = { isRequerimentoButton, handleRequerimentoButton };