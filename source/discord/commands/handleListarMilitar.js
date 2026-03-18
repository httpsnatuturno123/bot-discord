/**
 * Handler do comando /listar_militar
 * @param {import('discord.js').ChatInputCommandInteraction} interaction
 * @param {import('../../database/CeobDatabase')} ceobDb
 */
async function handleListarMilitar(interaction, ceobDb) {
    try {
        await interaction.deferReply();

        // 1. Identifica e valida o executor
        const executorDiscordId = interaction.user.id;
        const executorMilitar = await ceobDb.militares.getByDiscord(executorDiscordId);

        if (!executorMilitar) {
            return interaction.editReply('❌ Você não possui cadastro no sistema.');
        }

        // 2. Verifica permissão: DGP ou Alto Comando
        const pertenceDGP = await ceobDb.permissoes.pertenceAoOrgao(executorMilitar.id, 'DGP');
        const isAltoComando = await ceobDb.permissoes.isAltoComando(executorMilitar.id);

        if (!pertenceDGP && !isAltoComando) {
            return interaction.editReply('❌ **Permissão Negada**: Apenas membros alocados na DGP ou no Alto Comando podem listar militares diretamente.');
        }

        // 3. Captura os parâmetros
        const nomeGuerra = interaction.options.getString('nome_guerra');
        const patenteAbrev = interaction.options.getString('patente').toUpperCase();
        const omSigla = interaction.options.getString('om').toUpperCase();
        const usuarioDiscord = interaction.options.getUser('usuario');
        const robloxIdInput = interaction.options.getString('roblox_id');
        const robloxUsernameInput = interaction.options.getString('roblox_username');

        // 4. Validação: Ao menos um identificador Roblox deve ser fornecido
        if (!robloxIdInput && !robloxUsernameInput) {
            return interaction.editReply('⚠️ Você precisa fornecer o **Roblox ID** ou o **Username do Roblox** do militar.');
        }

        // 5. Resolução do Roblox ID e Username
        let robloxId = robloxIdInput;
        let robloxUsername = null;

        if (robloxId) {
            // Se o ID foi informado, valida que é numérico e busca o username na API
            if (isNaN(robloxId)) {
                return interaction.editReply('⚠️ O campo **Roblox ID** deve conter apenas números.');
            }

            try {
                const response = await fetch(`https://users.roblox.com/v1/users/${robloxId}`);

                if (response.status === 404) {
                    return interaction.editReply(`❌ **Bloqueado:** Nenhuma conta do Roblox foi encontrada com o ID \`${robloxId}\`.`);
                } else if (!response.ok) {
                    return interaction.editReply(`❌ **Erro na API do Roblox:** Status ${response.status}. Tente novamente mais tarde.`);
                }

                const data = await response.json();
                robloxUsername = data.name;
            } catch (err) {
                console.error('Erro ao consultar API do Roblox (por ID):', err);
                return interaction.editReply('❌ **Falha de Comunicação:** Não foi possível conectar aos servidores do Roblox.');
            }
        } else {
            // Se apenas o username foi informado, busca o ID através do username
            try {
                const response = await fetch('https://users.roblox.com/v1/usernames/users', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        usernames: [robloxUsernameInput],
                        excludeBannedUsers: false
                    })
                });

                if (!response.ok) {
                    return interaction.editReply(`❌ **Erro na API do Roblox:** Status ${response.status}. Tente novamente mais tarde.`);
                }

                const data = await response.json();

                if (!data.data || data.data.length === 0) {
                    return interaction.editReply(`❌ **Bloqueado:** Nenhuma conta do Roblox encontrada com o username \`${robloxUsernameInput}\`. Verifique a ortografia.`);
                }

                robloxId = data.data[0].id.toString();
                robloxUsername = data.data[0].name;
            } catch (err) {
                console.error('Erro ao consultar API do Roblox (por username):', err);
                return interaction.editReply('❌ **Falha de Comunicação:** Não foi possível conectar aos servidores do Roblox.');
            }
        }

        // 6. Executa a listagem no banco
        const resultado = await ceobDb.listagem.executarListagemMilitar({
            executadoPorId: executorMilitar.id,
            robloxId,
            robloxUsername,
            nomeGuerra,
            omSigla,
            discordId: usuarioDiscord.id,
            patenteAbrev
        });

        // 7. Constrói o Boletim Eletrônico Visual
        const embed = {
            title: `📄 Boletim Interno — ${resultado.boletim.numero}`,
            description: resultado.boletim.conteudo,
            color: 0x219EBC,
            fields: [
                { name: '🎖️ Patente', value: `${resultado.patenteNome} (${patenteAbrev})`, inline: true },
                { name: '🎖️ Matrícula', value: `\`${resultado.militar.matricula}\``, inline: true },
                { name: '🎮 Roblox', value: `${robloxUsername} (ID: ${robloxId})`, inline: true },
                { name: '🏛️ OM', value: omSigla, inline: true },
                { name: '💬 Discord', value: `<@${usuarioDiscord.id}>`, inline: true },
                { name: '✍️ Listado por', value: `${executorMilitar.patente_abrev} ${executorMilitar.nome_guerra}`, inline: true }
            ],
            footer: { text: 'DGP — Departamento Geral do Pessoal' },
            timestamp: new Date()
        };

        // 8. Publicar no canal de boletins
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

            await interaction.editReply(`✅ **Listagem concluída com sucesso!** O ${resultado.patenteNome} **${nomeGuerra}** foi registrado e o boletim publicado em ${canalDeBoletins}.`);
        } catch (err) {
            console.error('❌ Erro ao enviar mensagem para o canal de boletim:', err);
            await interaction.editReply(`✅ **Listagem salva no banco!** ⚠️ Porém, o bot não conseguiu enviar o boletim no canal.`);
        }

    } catch (error) {
        console.error('Erro na listagem de militar:', error);

        const msg = error.message || '';
        let respostaUsuario;

        if (msg.includes('OM') || msg.includes('Patente')) {
            respostaUsuario = `❌ ${msg}`;
        } else if (error.code === '23505') {
            respostaUsuario = '❌ **Erro**: Este Roblox ID ou Usuário do Discord já está cadastrado em outro militar no sistema.';
        } else {
            respostaUsuario = '❌ Ocorreu um erro interno ao processar a listagem.';
        }

        try {
            if (interaction.deferred || interaction.replied) {
                await interaction.editReply(respostaUsuario);
            } else {
                await interaction.reply({ content: respostaUsuario, ephemeral: true });
            }
        } catch (replyErr) {
            console.error('Falha ao enviar resposta de erro:', replyErr);
        }
    }
}

module.exports = handleListarMilitar;
