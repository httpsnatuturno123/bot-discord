// src/interactions/index.js
const { isRequerimentoButton, handleRequerimentoButton } = require('./buttonHandler');
const { isRequerimentoModal, handleRequerimentoModal } = require('./modalHandler');
const { isRebaixarModal, handleRebaixarModal } = require('./modalRebaixarHandler');
const { isTransferenciaButton, handleTransferenciaButton } = require('./buttonTransferenciaHandler');
const { isTransferenciaModal, handleTransferenciaModal } = require('./modalTransferenciaHandler');

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

        if (isTransferenciaButton(interaction.customId)) {
            await handleTransferenciaButton(interaction);
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

        if (isRebaixarModal(interaction.customId)) {
            await handleRebaixarModal(interaction, ceobDb);
            return true;
        }

        if (isTransferenciaModal(interaction.customId)) {
            await handleTransferenciaModal(interaction, ceobDb);
            return true;
        }

        return false;
    }

    return false;
}

module.exports = { routeInteraction };