const { ModalBuilder, ActionRowBuilder, TextInputBuilder, TextInputStyle } = require('discord.js');

/**
 * Verifica se é um botão do /turma integrar
 */
function isTurmaIntegrarButton(customId) {
    return customId.startsWith('btn_turma_matricular_') || customId.startsWith('btn_turma_finalizar_');
}

/**
 * Abre o Modal adequado dependendo do botão clicado
 */
async function handleTurmaIntegrarButton(interaction, ceobDb) {
    try {
        const customId = interaction.customId;
        const parts = customId.split('_');
        const acao = parts[2]; // 'matricular' ou 'finalizar'
        const turmaId = parts.pop();

        // Reforçar validação de permissão no botão (para evitar que outra pessoa clique)
        const executorMilitar = await ceobDb.militares.getByDiscord(interaction.user.id);
        const turma = await ceobDb.turmas.getById(parseInt(turmaId, 10));

        if (!turma || !executorMilitar) {
            return interaction.reply({ content: '❌ Turma ou militar não encontrados.', ephemeral: true });
        }

        const isCoordenador = turma.coordenador_id === executorMilitar.id;
        const pertenceDGP = await ceobDb.permissoes.pertenceAoOrgao(executorMilitar.id, 'DGP');
        const isSupremo = await ceobDb.permissoes.isComandoSupremo(executorMilitar.id);

        if (!isCoordenador && !pertenceDGP && !isSupremo) {
            return interaction.reply({ content: '❌ Apenas o coordenador da turma ou DGP podem usar estes botões.', ephemeral: true });
        }

        if (acao === 'matricular') {
            const modal = new ModalBuilder()
                .setCustomId(`modal_turma_matricular_${turmaId}`)
                .setTitle(`📘 Matricular Alunos (Turma #${turmaId})`);

            const inputAlunos = new TextInputBuilder()
                .setCustomId('alunos_participantes')
                .setLabel('Nomes dos Alunos (separados por ;)')
                .setStyle(TextInputStyle.Paragraph)
                .setPlaceholder('Ex: SD Silva; CB Souza; Robson')
                .setRequired(true);

            modal.addComponents(new ActionRowBuilder().addComponents(inputAlunos));
            await interaction.showModal(modal);

        } else if (acao === 'finalizar') {
            const modal = new ModalBuilder()
                .setCustomId(`modal_turma_finalizar_${turmaId}`)
                .setTitle(`🏆 Finalizar Curso (Turma #${turmaId})`);

            const inputParticipantes = new TextInputBuilder()
                .setCustomId('alunos_participantes')
                .setLabel('Participantes a processar (separados por ;)')
                .setStyle(TextInputStyle.Paragraph)
                .setPlaceholder('Ex: SD Silva; CB Souza; REC Martins')
                .setRequired(true);

            const inputAprovados = new TextInputBuilder()
                .setCustomId('alunos_aprovados')
                .setLabel('Aprovados (separados por ;)')
                .setStyle(TextInputStyle.Paragraph)
                .setPlaceholder('Ex: SD Silva; CB Souza (os demais constarão como reprovados)')
                .setRequired(false);

            const inputNotas = new TextInputBuilder()
                .setCustomId('notas_finais')
                .setLabel('Notas Finais (opcional, Nome:Nota;)')
                .setStyle(TextInputStyle.Paragraph)
                .setPlaceholder('Ex: Silva:90; Souza:85')
                .setRequired(false);

            modal.addComponents(
                new ActionRowBuilder().addComponents(inputParticipantes),
                new ActionRowBuilder().addComponents(inputAprovados),
                new ActionRowBuilder().addComponents(inputNotas)
            );
            await interaction.showModal(modal);
        }

    } catch (error) {
        console.error('[handleTurmaIntegrarButton] Erro ao abrir modal:', error);
        if (!interaction.replied && !interaction.deferred) {
            await interaction.reply({ content: '❌ Erro ao abrir o formulário.', ephemeral: true });
        }
    }
}

module.exports = { isTurmaIntegrarButton, handleTurmaIntegrarButton };
