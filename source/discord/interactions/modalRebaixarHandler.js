const robloxService = require('../services/robloxService');

/**
 * Retorna true se a customId pertencer ao modal de rebaixamento
 */
function isRebaixarModal(customId) {
    return customId.startsWith('modal_rebaixar:');
}

/**
 * Processa a submissão do modal de rebaixamento
 * @param {import('discord.js').ModalSubmitInteraction} interaction 
 * @param {import('../../database/CeobDatabase')} ceobDb 
 */
async function handleRebaixarModal(interaction, ceobDb) {
    await interaction.deferReply();

    // Extrair os dados do customId (modal_rebaixar:alvoId:novaPatenteId:robloxRank)
    const parts = interaction.customId.split(':');
    if (parts.length !== 4) {
        return interaction.editReply('❌ **Erro Interno**: O ID do formulário está mal formatado.');
    }

    const alvoId = parseInt(parts[1], 10);
    const novaPatenteId = parseInt(parts[2], 10);
    const robloxRank = parseInt(parts[3], 10);

    // Extrair o motivo preenchido
    const motivo = interaction.fields.getTextInputValue('motivo_input').trim();

    if (motivo.length < 20) {
        return interaction.editReply('❌ O motivo deve ter no mínimo 20 caracteres.');
    }

    const executorDiscordId = interaction.user.id;
    const executorMilitar = await ceobDb.militares.getByDiscord(executorDiscordId);

    if (!executorMilitar) {
        return interaction.editReply('❌ Você não possui cadastro no sistema.');
    }

    try {
        const alvoMilitar = await ceobDb.militares.getById(alvoId);
        if (!alvoMilitar || !alvoMilitar.ativo) {
            return interaction.editReply('❌ O militar alvo não foi encontrado ou está inativo.');
        }

        const novaPatente = await ceobDb.patentes.getById(novaPatenteId);
        if (!novaPatente) {
            return interaction.editReply('❌ A nova patente informada no momento do comando não foi encontrada.');
        }

        // --- Verificações Finais de Segurança ---
        // Checar se a patente inferior e se não está promovendo, além do cargo >= executor
        if (novaPatente.ordem_precedencia <= alvoMilitar.ordem_precedencia) {
            return interaction.editReply(`❌ Rebaixamento inválido. A nova patente (${novaPatente.nome}) não é inferior à atual (${alvoMilitar.patente_nome}).`);
        }
        if (alvoMilitar.ordem_precedencia <= executorMilitar.ordem_precedencia) {
            return interaction.editReply(`❌ Você não tem hierarquia suficiente para rebaixar um ${alvoMilitar.patente_nome}.`);
        }

        const isAltoComando = await ceobDb.permissoes.isAltoComando(executorMilitar.id);
        if (alvoMilitar.ordem_precedencia <= 11 && !isAltoComando) {
            return interaction.editReply(`❌ Apenas membros do Alto Comando podem rebaixar Oficiais.`);
        }

        // 1. Atualizar Roblox
        try {
            await robloxService.promoverMembro(alvoMilitar.roblox_user_id, robloxRank);
        } catch (err) {
            console.error('Erro na integração com Roblox (Rebaixamento):', err);
            return interaction.editReply(`❌ **Falha ao atualizar o cargo no Roblox do militar:** ${err.message}\n` +
                `O rebaixamento no banco de dados **NÃO** foi registrado para evitar inconsistências.`);
        }

        // 2. Atualizar Banco de Dados
        await ceobDb.militares.atualizarPatente(alvoMilitar.id, novaPatente.id);

        // 3. Registrar na Timeline (agora com o motivo na descrição)
        const descricaoEvento = `Rebaixado de ${alvoMilitar.patente_nome} para ${novaPatente.nome} por ${executorMilitar.patente_abrev} ${executorMilitar.nome_guerra}. Motivo: "${motivo}"`;
        await ceobDb.timeline.registrarEvento({
            militarId: alvoMilitar.id,
            tipoEvento: 'REBAIXAMENTO',
            descricao: descricaoEvento,
            executadoPorId: executorMilitar.id
        });

        // 4. Enviar Boletim Eletrônico
        const embed = {
            title: `⚠️ Boletim de Rebaixamento — ${alvoMilitar.nome_guerra}`,
            description: `Foi determinado o rebaixamento disciplinar do militar **${alvoMilitar.nome_guerra}**.`,
            color: 0xE53935, // Vermelho
            fields: [
                { name: '👤 Militar', value: `<@${alvoMilitar.discord_user_id}>`, inline: true },
                { name: '🎖️ Patente Anterior', value: `${alvoMilitar.patente_nome} (${alvoMilitar.patente_abrev})`, inline: true },
                { name: '⬇️ Nova Patente', value: `${novaPatente.nome} (${novaPatente.abreviacao})`, inline: true },
                { name: '✍️ Rebaixado Por', value: `${executorMilitar.patente_nome} ${executorMilitar.nome_guerra}`, inline: true },
                { name: '🏛️ OM', value: alvoMilitar.om_sigla || 'N/A', inline: true },
                { name: '📝 Motivo', value: motivo, inline: false }
            ],
            footer: { text: 'DGP — Departamento Geral do Pessoal' },
            timestamp: new Date()
        };

        const canalBoletimId = process.env.BOLETIM_CANAL_PROMOCOES;

        if (canalBoletimId) {
            try {
                const canalDeBoletins = await interaction.client.channels.fetch(canalBoletimId);
                await canalDeBoletins.send({ embeds: [embed] });
            } catch (err) {
                console.error('Erro ao enviar mensagem para o canal de punições/promoções:', err);
            }
        }

        return interaction.editReply({
            content: `✅ O militar **${alvoMilitar.nome_guerra}** foi rebaixado com sucesso para **${novaPatente.nome}** no Banco e no Roblox!${!canalBoletimId ? '\n*(Aviso: BOLETIM_CANAL_PROMOCOES não configurado, formatação visual indisponível.)*' : ''}`,
            embeds: [embed]
        });

    } catch (error) {
        console.error('Erro no processamento do rebaixamento:', error);
        return interaction.editReply('❌ Ocorreu um erro interno ao processar o formulário de rebaixamento.');
    }
}

module.exports = {
    isRebaixarModal,
    handleRebaixarModal
};
