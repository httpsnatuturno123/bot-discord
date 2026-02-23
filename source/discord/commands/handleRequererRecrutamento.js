/**
 * Handler do comando /requerer_recrutamento
 * @param {import('discord.js').ChatInputCommandInteraction} interaction
 * @param {import('../../database/CeobDatabase')} ceobDb
 */
const robloxService = require('../services/robloxService');

async function handleRequererRecrutamento(interaction, ceobDb) {
    await interaction.deferReply({ ephemeral: true });

    // 1. Identifica e valida o executor do comando
    const executorDiscordId = interaction.user.id;
    const executorMilitar = await ceobDb.militares.getByDiscord(executorDiscordId);

    if (!executorMilitar) {
        return interaction.editReply('❌ Você não possui cadastro no sistema.');
    }

    // 2. Regra de Negócio RN-010: Um requerimento de registro só pode ser solicitado por militar com patente > Cabo
    const podeRequisitar = await ceobDb.permissoes.podeRequisitarRegistro(executorMilitar.id);

    if (!podeRequisitar) {
        return interaction.editReply('❌ **Permissão Negada**: Apenas militares com patente superior a Cabo podem requerer o ingresso de novos recrutas.');
    }

    // 3. Captura os parâmetros (OM removida, roblox aceita username ou ID, observação obrigatória)
    const nomeGuerra = interaction.options.getString('nome_guerra');
    const robloxInput = interaction.options.getString('roblox');
    const usuarioDiscord = interaction.options.getUser('usuario');
    const observacao = interaction.options.getString('observacao');

    // 4. Resolução automática do Roblox (username ou ID)
    let robloxUserId = null;
    let robloxUsername = null;
    try {
        const resultado = await robloxService.resolverUsuario(robloxInput);
        robloxUserId = resultado.userId;
        robloxUsername = resultado.username;
    } catch (err) {
        if (err.name === 'RobloxError') {
            return interaction.editReply(`❌ **Bloqueado:** ${err.message}`);
        }
        console.error("Erro ao consultar API do Roblox:", err);
        return interaction.editReply('❌ **Falha de Comunicação:** O bot não conseguiu se conectar aos servidores do Roblox para validar o usuário.');
    }

    // 5. Executa a inserção do requerimento + recruta inativo (sem OM — será definida pelo DGP)
    try {
        const resultado = await ceobDb.requerimentoRecrutamento.requererRecrutamento({
            executadoPorId: executorMilitar.id,
            robloxId: robloxUserId,
            robloxUsername,
            nomeGuerra,
            discordId: usuarioDiscord ? usuarioDiscord.id : null,
            observacao
        });

        // 6. Constrói a embed de confirmação de envio para o usuário
        const embedUsuario = {
            title: `📋 Requerimento de Recrutamento Enviado`,
            description: `Seu requerimento foi submetido com sucesso e será analisado pela **DGP**.`,
            color: 0xE9C46A, // Amarelo PENDENTE
            fields: [
                { name: '🎖️ Recruta (Alvo)', value: `**${nomeGuerra}**`, inline: true },
                { name: '🎮 Roblox', value: `${robloxUsername} (${robloxUserId})`, inline: true },
                { name: '📝 Observação', value: observacao, inline: false },
                { name: '🆔 Protocolo do Requerimento', value: `#${resultado.requerimentoId}`, inline: false }
            ],
            footer: { text: 'Aguardando Análise — Departamento Geral do Pessoal' },
            timestamp: new Date()
        };

        await interaction.editReply({ embeds: [embedUsuario] });

        // 7. Envia a embed interativa para o canal de Requerimentos da DGP
        const canalRequerimentosId = process.env.CANAL_REQUERIMENTOS_ID;
        if (canalRequerimentosId) {
            try {
                const canalDeRequs = await interaction.client.channels.fetch(canalRequerimentosId);

                const { ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');

                const botoes = new ActionRowBuilder().addComponents(
                    new ButtonBuilder()
                        .setCustomId(`req_aprovar_${resultado.requerimentoId}`)
                        .setLabel('Aprovar')
                        .setStyle(ButtonStyle.Success)
                        .setEmoji('✅'),
                    new ButtonBuilder()
                        .setCustomId(`req_recusar_${resultado.requerimentoId}`)
                        .setLabel('Indeferir')
                        .setStyle(ButtonStyle.Danger)
                        .setEmoji('❌')
                );

                const embedDGP = {
                    title: `📥 Novo Requerimento — Protocolo #${resultado.requerimentoId}`,
                    description: `**Solicitante:** <@${executorDiscordId}> (${executorMilitar.patente_abrev} ${executorMilitar.nome_guerra})\n**Tipo:** REGISTRO / RECRUTAMENTO`,
                    color: 0xE9C46A,
                    fields: [
                        { name: '🎖️ Recruta (Alvo)', value: `**${nomeGuerra}**`, inline: true },
                        { name: '🎮 Roblox', value: `${robloxUsername} (ID: ${robloxUserId})`, inline: true },
                        { name: '📝 Observação', value: observacao, inline: false }
                    ],
                    footer: { text: 'Pendente de análise — OM será definida pelo DGP' },
                    timestamp: new Date()
                };

                await canalDeRequs.send({ embeds: [embedDGP], components: [botoes] });
            } catch (err) {
                console.error('❌ Erro ao enviar mensagem para o canal de requerimentos da DGP:', err);
            }
        }
    } catch (error) {
        console.error('Erro no requerimento de recrutamento:', error);

        if (error.message.includes('Patente')) {
            return interaction.editReply(`❌ ${error.message}`);
        } else if (error.code === '23505') {
            return interaction.editReply('❌ **Erro**: Este Roblox ID, Usuário do Discord ou Nome de Guerra já está vinculado a outro militar no sistema.');
        }

        interaction.editReply('❌ Ocorreu um erro interno ao processar seu requerimento.');
    }
}

module.exports = handleRequererRecrutamento;
