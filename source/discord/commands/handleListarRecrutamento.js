/**
 * Handler do comando /listar_recrutamento
 * @param {import('discord.js').ChatInputCommandInteraction} interaction
 * @param {import('../../database/CeobDatabase')} ceobDb
 */
async function handleListarRecrutamento(interaction, ceobDb) {
    await interaction.deferReply();

    // 1. Identifica e valida o executor do comando
    const executorDiscordId = interaction.user.id;
    const executorMilitar = await ceobDb.getMilitarByDiscord(executorDiscordId);

    if (!executorMilitar) {
        return interaction.editReply('❌ Você não possui cadastro no sistema e não tem permissão para listar recrutas.');
    }

    // 2. Verifica se o usuário tem permissão para usar (DGP ou Alto Comando)
    const pertenceDGP = await ceobDb.pertenceAoOrgao(executorMilitar.id, 'DGP');
    const isAltoComando = await ceobDb.isAltoComando(executorMilitar.id);

    if (!pertenceDGP && !isAltoComando) {
        return interaction.editReply('❌ **Permissão Negada**: Apenas membros alocados na DGP ou no Alto Comando podem realizar listagens de recrutamento diretas.');
    }

    // 3. Captura os parâmetros
    const nomeGuerra = interaction.options.getString('nome_guerra');
    const robloxId = interaction.options.getString('roblox_id');
    const omSigla = interaction.options.getString('om').toUpperCase();
    const usuarioDiscord = interaction.options.getUser('usuario');

    if (isNaN(robloxId)) {
        return interaction.editReply('⚠️ O campo **Roblox ID** deve conter apenas números.');
    }

    // ==========================================
    // VALIDAÇÃO BLOQUEANTE: API DO ROBLOX
    // ==========================================
    let robloxUsername = null;
    try {
        const robloxResponse = await fetch(`https://users.roblox.com/v1/users/${robloxId}`);

        if (robloxResponse.status === 404) {
            return interaction.editReply(`❌ **Bloqueado:** Nenhuma conta do Roblox foi encontrada com o ID \`${robloxId}\`. Verifique se os números estão corretos.`);
        } else if (!robloxResponse.ok) {
            return interaction.editReply(`❌ **Erro na API do Roblox:** Não foi possível validar o ID no momento (Status: ${robloxResponse.status}). O registro foi bloqueado por segurança. Tente novamente mais tarde.`);
        }

        const robloxData = await robloxResponse.json();
        robloxUsername = robloxData.name;

    } catch (err) {
        console.error("Erro ao consultar API do Roblox:", err);
        return interaction.editReply(`❌ **Falha de Comunicação:** O bot não conseguiu se conectar aos servidores do Roblox para validar o ID. O registro foi cancelado.`);
    }
    // ==========================================

    // 4. Executa a inserção múltipla no banco (Transação)
    try {
        const resultado = await ceobDb.executarListagemRecrutamento({
            executadoPorId: executorMilitar.id,
            robloxId,
            robloxUsername,
            nomeGuerra,
            omSigla,
            discordId: usuarioDiscord ? usuarioDiscord.id : null
        });

        // 5. Constrói o Boletim Eletrônico Visual
        const embed = {
            title: `📄 Boletim Interno — ${resultado.boletim.numero}`,
            description: resultado.boletim.conteudo,
            color: 0x219EBC,
            fields: [
                { name: '🎖️ Nova Matrícula', value: `\`${resultado.militar.matricula}\``, inline: true },
                { name: '🎮 Roblox', value: `${robloxUsername} (ID: ${robloxId})`, inline: true },
                { name: '✍️ Listado por', value: `${executorMilitar.patente_abrev} ${executorMilitar.nome_guerra}`, inline: true }
            ],
            footer: { text: 'DGP — Departamento Geral do Pessoal' },
            timestamp: new Date()
        };

        // 6. Enviar a embed para o canal específico do .env
        const canalBoletimId = process.env.CANAL_BOLETIM_ID;

        if (!canalBoletimId) {
            return interaction.editReply({
                content: '✅ **Listagem concluída!** *(Aviso: CANAL_BOLETIM_ID não configurado no .env)*',
                embeds: [embed]
            });
        }

        try {
            const canalDeBoletins = await interaction.client.channels.fetch(canalBoletimId);
            const mensagemEnviada = await canalDeBoletins.send({ embeds: [embed] });

            await ceobDb.query(
                `UPDATE ceob.boletim_eletronico SET discord_message_id = $1 WHERE id = $2`,
                [mensagemEnviada.id, resultado.boletim.id]
            );

            await interaction.editReply(`✅ **Listagem concluída com sucesso!** O recruta foi registrado e o boletim foi publicado em ${canalDeBoletins}.`);

        } catch (err) {
            console.error('❌ Erro ao enviar mensagem para o canal de boletim:', err);
            await interaction.editReply(`✅ **Listagem salva no banco!** ⚠️ Porém, o bot não conseguiu enviar o boletim no canal. Verifique se o bot tem permissão de "Ver Canal" e "Enviar Mensagens" no canal configurado.`);
        }

    } catch (error) {
        console.error('Erro no recrutamento:', error);

        if (error.message.includes('OM')) {
            return interaction.editReply(`❌ ${error.message}`);
        } else if (error.code === '23505') {
            return interaction.editReply('❌ **Erro**: Este Roblox ID ou Usuário do Discord já está cadastrado em outro militar no sistema.');
        }

        interaction.editReply('❌ Ocorreu um erro interno ao processar a listagem.');
    }
}

module.exports = handleListarRecrutamento;
