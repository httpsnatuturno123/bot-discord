// src/interactions/index.js
const { isRequerimentoButton, handleRequerimentoButton } = require('./buttonHandler');
const { isRequerimentoModal, handleRequerimentoModal } = require('./modalHandler');

/**
 * Roteador central de interações (botões, modais).
 * Retorna true se a interação foi tratada, false caso contrário.
 */
async function routeInteraction(interaction, ceobDb) {

    // ── Botões ──
    if (interaction.isButton()) {
        if (isRequerimentoButton(interaction.customId)) {
            await handleRequerimentoButton(interaction);
            return true;
        }
        return false;
    }

    // ── Modais ──
    if (interaction.isModalSubmit()) {
        if (isRequerimentoModal(interaction.customId)) {
            await handleRequerimentoModal(interaction, ceobDb);
            return true;
        }
        return false;
    }

    return false;
}

module.exports = { routeInteraction };