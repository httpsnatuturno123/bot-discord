const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');

const PREFIX = 'btn_turma_encerrar_';

function isTurmaEncerrarButton(customId) {
    return customId.startsWith(PREFIX);
}

async function handleTurmaEncerrarButton(interaction, ceobDb) {
    const customId = interaction.customId;
    const parts = customId.split('_');
    const turmaId = parseInt(parts.pop(), 10);
    const action = parts.pop(); // confirm ou cancel

    await interaction.deferUpdate();

    try {
        // Validação de Permissão e de Turma
        const executorDiscordId = interaction.user.id;
        const executorMilitar = await ceobDb.militares.getByDiscord(executorDiscordId);
        const turma = await ceobDb.turmas.getById(turmaId);

        if (!turma || !executorMilitar) {
            return interaction.followUp({ content: '❌ Turma ou militar não encontrados.', ephemeral: true });
        }

        const isCoordenador = turma.coordenador_id === executorMilitar.id;
        const pertenceDGP = await ceobDb.permissoes.pertenceAoOrgao(executorMilitar.id, 'DGP');
        const isSupremo = await ceobDb.permissoes.isComandoSupremo(executorMilitar.id);

        if (!isCoordenador && !pertenceDGP && !isSupremo) {
            return interaction.followUp({ content: '❌ Apenas o coordenador da turma, DGP ou Supremo podem encerrar a turma.', ephemeral: true });
        }

        if (turma.status === 'ENCERRADO' || turma.status === 'CANCELADO') {
            return interaction.followUp({ content: `❌ A turma já está ${turma.status}.`, ephemeral: true });
        }

        if (action === 'cancel') {
            const embed = EmbedBuilder.from(interaction.message.embeds[0])
                .setTitle(`🛑 Encerramento Cancelado: ${turma.sigla} "${turma.identificador_turma}"`)
                .setColor(0x95A5A6); // Cinza

            return interaction.editReply({ embeds: [embed], components: [] });
        }

        if (action === 'confirm') {
            // Se for PLANEJADO, cancela direto.
            if (turma.status === 'PLANEJADO') {
                await ceobDb.turmas.atualizarStatus(turma.id, 'CANCELADO');

                const embed = EmbedBuilder.from(interaction.message.embeds[0])
                    .setTitle(`✅ Turma Cancelada: ${turma.sigla} "${turma.identificador_turma}"`)
                    .setColor(0x2ECC71)
                    .setDescription(`A turma referida, por não ter sido iniciada, foi cancelada diretamente.`);

                return interaction.editReply({ embeds: [embed], components: [] });
            }

            // Se for EM_ANDAMENTO, gera o requerimento.
            if (turma.status === 'EM_ANDAMENTO') {
                // Buscamos os alunos para montar o requerimento
                const todosAlunos = await ceobDb.militarCursos.getAlunosDoCurso(turmaId);
                const aprovados = todosAlunos.filter(a => a.status_aluno === 'APROVADO');
                const reprovados = todosAlunos.filter(a => a.status_aluno === 'REPROVADO');

                // Montar o Embed do Requerimento DGP
                const embedRequerimento = new EmbedBuilder()
                    .setTitle(`📋 REQUERIMENTO DGP — Encerramento de Turma`)
                    .setColor(0xE67E22) // Laranja = Pendente
                    .addFields(
                        { name: '📚 Turma', value: `[#${turma.id}] ${turma.sigla} "${turma.identificador_turma}"`, inline: false },
                        { name: '👨‍🏫 Coordenador', value: `${executorMilitar.patente_abrev} ${executorMilitar.nome_guerra} (<@${interaction.user.id}>)`, inline: false },
                        {
                            name: '👥 Alunos e Resultados', value:
                                (aprovados.map(a => `• ${a.patente_abrev} **${a.nome_guerra}** (${a.roblox_username}) - ✅`).join('\n') + '\n' +
                                    reprovados.map(r => `• ${r.patente_abrev} **${r.nome_guerra}** (${r.roblox_username}) - ❌`).join('\n')) || '*Nenhum aluno processado*'
                        }
                    )
                    .setTimestamp();

                // Botões de Aprovação/Rejeição. Vamos reaproveitar a estrutura do `handleCursoButton` ou criar novo.
                // Como ele usa "curso_confirmar_IDInstrutor_SiglaCurso", podemos criar um específico para turma.
                const rowButtons = new ActionRowBuilder().addComponents(
                    new ButtonBuilder()
                        .setCustomId(`turmaencerrar_confirmar_${turma.id}`)
                        .setLabel('✅ Aprovar e Encerrar')
                        .setStyle(ButtonStyle.Success),
                    new ButtonBuilder()
                        .setCustomId(`turmaencerrar_rejeitar_${turma.id}`)
                        .setLabel('❌ Rejeitar')
                        .setStyle(ButtonStyle.Danger)
                );

                // Enviar para o canal de Requerimentos
                const canalRequerimentosId = process.env.CANAL_REQUERIMENTOS_ID;
                if (!canalRequerimentosId) {
                    console.error('[handleTurmaEncerrarButton] CANAL_REQUERIMENTOS_ID não definido no .env');
                    return interaction.followUp({ content: '❌ Erro interno: Canal de Requerimentos não configurado.', ephemeral: true });
                }
                const canalRequerimentos = interaction.client.channels.cache.get(canalRequerimentosId) || await interaction.client.channels.fetch(canalRequerimentosId);

                if (canalRequerimentos) {
                    await canalRequerimentos.send({ embeds: [embedRequerimento], components: [rowButtons] });
                } else {
                    console.error('[handleTurmaEncerrarButton] Canal de Requerimentos não encontrado.');
                    return interaction.followUp({ content: '❌ Erro interno: Canal de Requerimentos não encontrado.', ephemeral: true });
                }

                // Atualizar o embed original informando que foi para Requerimentos
                const embedOriginal = EmbedBuilder.from(interaction.message.embeds[0])
                    .setTitle(`⏳ Aguardando Aprovação: ${turma.sigla} "${turma.identificador_turma}"`)
                    .setColor(0xF1C40F) // Amarelo
                    .setDescription(`Requerimento de encerramento enviado ao canal de **Requerimentos** com sucesso. A turma será encerrada após aprovação.`);

                await interaction.editReply({ embeds: [embedOriginal], components: [] });
            }
        }
    } catch (error) {
        console.error('[handleTurmaEncerrarButton] Erro:', error);
        await interaction.followUp({ content: '❌ Ocorreu um erro ao processar sua resposta.', ephemeral: true });
    }
}

module.exports = { isTurmaEncerrarButton, handleTurmaEncerrarButton };
