// src/interactions/index.js
const { isRequerimentoButton, handleRequerimentoButton } = require('./buttonHandler');
const { isRequerimentoModal, handleRequerimentoModal } = require('./modalHandler');
const { isRebaixarModal, handleRebaixarModal } = require('./modalRebaixarHandler');
const { isTransferenciaButton, handleTransferenciaButton } = require('./buttonTransferenciaHandler');
const { isTransferenciaModal, handleTransferenciaModal } = require('./modalTransferenciaHandler');

const { isCursoAplicarModal, handleCursoAplicarModal } = require('./handleCursoAplicarModal');
const { isCursoButton, handleCursoButton } = require('./handleCursoButton');
const { handleCatalogo, handleCatalogoListar, handleCatalogoAutocomplete } = require('../commands/handleCatalogo');
const { handleTurmaAutocomplete } = require('../commands/handleTurma');

const { isTurmaIntegrarButton, handleTurmaIntegrarButton } = require('./handleTurmaIntegrarButton');
const { isTurmaIntegrarModal, handleTurmaIntegrarModal } = require('./handleTurmaIntegrarModal');
const { isTurmaEncerrarButton, handleTurmaEncerrarButton } = require('./handleTurmaEncerrarButton');
const { isTurmaGerenciarSelect, handleTurmaGerenciarSelect } = require('./handleTurmaGerenciarSelect');

/**
 * Roteador central de interações (botões, modais, autocomplete).
 */
async function routeInteraction(interaction, ceobDb) {
    // ── Autocomplete ──
    if (interaction.isAutocomplete()) {
        if (interaction.commandName === 'catalogo') {
            await handleCatalogoAutocomplete(interaction, ceobDb);
            return true;
        }
        if (interaction.commandName === 'turma') {
            await handleTurmaAutocomplete(interaction, ceobDb);
            return true;
        }
        return false;
    }

    // ── Menus de Seleção ──
    if (interaction.isStringSelectMenu()) {
        if (isCatalogoListarSelect(interaction.customId)) {
            await handleCatalogoListarSelect(interaction, ceobDb);
            return true;
        }
        if (isTurmaGerenciarSelect(interaction.customId)) {
            await handleTurmaGerenciarSelect(interaction, ceobDb);
            return true;
        }
    }

    // ── Botões ──
    if (interaction.isButton()) {
        if (isCursoButton(interaction.customId)) {
            await handleCursoButton(interaction, ceobDb);
            return true;
        }
        if (isTransferenciaRequerimentoButton(interaction.customId)) {
            await handleTransferenciaButton(interaction, ceobDb);
            return true;
        }
        if (isCatalogoListarButton(interaction.customId)) {
            await handleCatalogoListarButton(interaction, ceobDb);
            return true;
        }
        if (isTurmaIntegrarButton(interaction.customId)) {
            await handleTurmaIntegrarButton(interaction, ceobDb);
            return true;
        }
        if (isTurmaEncerrarButton(interaction.customId)) {
            await handleTurmaEncerrarButton(interaction, ceobDb);
            return true;
        }
        return false;
    }

    // ── Modais ──
    if (interaction.isModalSubmit()) {
        if (isTransferenciaModal(interaction.customId)) {
            await handleTransferenciaModal(interaction, ceobDb);
            return true;
        }
        if (isCursoAplicarModal(interaction.customId)) {
            await handleCursoAplicarModal(interaction, ceobDb);
            return true;
        }
        if (isTurmaIntegrarModal(interaction.customId)) {
            await handleTurmaIntegrarModal(interaction, ceobDb);
            return true;
        }
        return false;
    }

    return false;
}

module.exports = { routeInteraction };