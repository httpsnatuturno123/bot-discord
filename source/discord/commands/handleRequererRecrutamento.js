/**
 * Handler do comando /requerer_recrutamento
 * @param {import('discord.js').ChatInputCommandInteraction} interaction
 * @param {import('../../database/CeobDatabase')} ceobDb
 */
async function handleRequererRecrutamento(interaction, ceobDb) {
    await interaction.deferReply({ ephemeral: true });

    // 1. Identifica e valida o executor do comando
    const executorDiscordId = interaction.user.id;
    const executorMilitar = await ceobDb.militares.getByDiscord(executorDiscordId);

    if (!executorMilitar) {
        return interaction.editReply('❌ Você não possui cadastro no sistema.');
    }

    // 2. Regra de Negócio RN-010: Um requerimento de registro só pode ser solicitado por militar com patente > Cabo
    // Observação: Para essa regra nós precisamos verificar a ordem de precedência da patente do usuário.
    // Quanto menor a ordem de precedência, maior a patente.
    const CAboOrdem = 20; // De acordo com as instruções

    // Verificando se o militar podeReq.
    // Usamos o método do handle de permissões já existente
    const podeRequisitar = await ceobDb.permissoes.podeRequisitarRegistro(executorMilitar.id);

    if (!podeRequisitar) {
        return interaction.editReply('❌ **Permissão Negada**: Apenas militares com patente superior a Cabo podem requerer o ingresso de novos recrutas.');
    }

    // 3. Captura os parâmetros
    const nomeGuerra = interaction.options.getString('nome_guerra');
    const robloxId = interaction.options.getString('roblox_id');
    const omSigla = interaction.options.getString('om').toUpperCase();
    const usuarioDiscord = interaction.options.getUser('usuario');
    const motivo = interaction.options.getString('motivo') || "Sem motivo adicional informado.";

    if (isNaN(robloxId)) {
        return interaction.editReply('⚠️ O campo **Roblox ID** deve conter apenas números.');
    }

    // 4. Validação na API do Roblox
    let robloxUsername = null;
    try {
        const robloxResponse = await fetch(`https://users.roblox.com/v1/users/${robloxId}`);

        if (robloxResponse.status === 404) {
            return interaction.editReply(`❌ **Bloqueado:** Nenhuma conta do Roblox foi encontrada com o ID \`${robloxId}\`. Verifique se os números estão corretos.`);
        } else if (!robloxResponse.ok) {
            return interaction.editReply(`❌ **Erro na API do Roblox:** Não foi possível validar o ID no momento (Status: ${robloxResponse.status}). Tente novamente mais tarde.`);
        }

        const robloxData = await robloxResponse.json();
        robloxUsername = robloxData.name;

    } catch (err) {
        console.error("Erro ao consultar API do Roblox:", err);
        return interaction.editReply(`❌ **Falha de Comunicação:** O bot não conseguiu se conectar aos servidores do Roblox para validar o ID.`);
    }

    // 5. Executa a inserção do requerimento + recruta inativo
    try {
        const resultado = await ceobDb.requerimentoRecrutamento.requererRecrutamento({
            executadoPorId: executorMilitar.id,
            robloxId,
            robloxUsername,
            nomeGuerra,
            omSigla,
            discordId: usuarioDiscord ? usuarioDiscord.id : null,
            motivo
        });

        // 6. Constrói a embed de confirmação de envio para o usuário
        const embedUsuario = {
            title: `📋 Requerimento de Recrutamento Enviado`,
            description: `Seu requerimento foi submetido com sucesso e será analisado pela **DGP**.`,
            color: 0xE9C46A, // Amarelo PENDENTE
            fields: [
                { name: '🎖️ Recruta (Alvo)', value: `**${nomeGuerra}**`, inline: true },
                { name: '🎮 Roblox', value: `${robloxUsername} (${robloxId})`, inline: true },
                { name: '🏛️ OM Inicial', value: `${omSigla}`, inline: true },
                { name: '📝 Motivo da Solicitação', value: motivo, inline: false },
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
                        { name: '🎮 Roblox', value: `${robloxUsername} (ID: ${robloxId})`, inline: true },
                        { name: '🏛️ OM Solicitada', value: `${omSigla}`, inline: true },
                        { name: '📝 Motivo', value: motivo, inline: false }
                    ],
                    footer: { text: 'Pendente de análise' },
                    timestamp: new Date()
                };

                await canalDeRequs.send({ embeds: [embedDGP], components: [botoes] });
            } catch (err) {
                console.error('❌ Erro ao enviar mensagem para o canal de requerimentos da DGP:', err);
            }
        }
    } catch (error) {
        console.error('Erro no requerimento de recrutamento:', error);

        if (error.message.includes('OM') || error.message.includes('Patente')) {
            return interaction.editReply(`❌ ${error.message}`);
        } else if (error.code === '23505') {
            return interaction.editReply('❌ **Erro**: Este Roblox ID, Usuário do Discord ou Nome de Guerra já está vinculado a outro militar no sistema.');
        }

        interaction.editReply('❌ Ocorreu um erro interno ao processar seu requerimento.');
    }
}

module.exports = handleRequererRecrutamento;
