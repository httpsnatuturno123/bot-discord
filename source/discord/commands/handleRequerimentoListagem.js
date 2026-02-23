/**
 * Handler do comando /requerimento_listagem
 * @param {import('discord.js').ChatInputCommandInteraction} interaction
 * @param {import('../../database/CeobDatabase')} ceobDb
 */
async function handleRequerimentoListagem(interaction, ceobDb) {
    await interaction.deferReply({ ephemeral: true });

    // 1. Identifica e valida o executor do comando
    const executorDiscordId = interaction.user.id;
    const executorMilitar = await ceobDb.militares.getByDiscord(executorDiscordId);

    // Regra: O usuário NÃO PODE estar cadastrado no sistema
    if (executorMilitar) {
        return interaction.editReply('❌ Você já possui cadastro ativo no sistema. Este comando é apenas para não listados.');
    }

    // 2. Captura os parâmetros
    const nomeGuerra = interaction.options.getString('nome_guerra');
    const patenteAbrev = interaction.options.getString('patente').toUpperCase();
    const omSigla = interaction.options.getString('om').toUpperCase();
    const robloxUsernameInput = interaction.options.getString('roblox_username');

    // 3. Validação na API do Roblox via username
    let robloxId = null;
    let robloxUsername = null;

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

    // 4. Executa a inserção do requerimento + militar inativo
    try {
        const resultado = await ceobDb.requerimentoListagem.requererListagem({
            executadoPorId: null, // Será preenchido dentro do próprio handler como o ID recém-criado
            robloxId,
            robloxUsername,
            nomeGuerra,
            omSigla,
            patenteAbrev,
            discordId: executorDiscordId
        });

        // 5. Constrói a embed de confirmação de envio para o usuário
        const embedUsuario = {
            title: `📋 Requerimento de Listagem Enviado`,
            description: `Seu requerimento de ingresso como **${resultado.patenteNome}** foi submetido com sucesso e será analisado pela **DGP**.`,
            color: 0xE9C46A, // Amarelo PENDENTE
            fields: [
                { name: '🎖️ Militar', value: `**${nomeGuerra}** (${patenteAbrev})`, inline: true },
                { name: '🎮 Roblox', value: `${robloxUsername} (ID: ${robloxId})`, inline: true },
                { name: '🏛️ OM Inicial', value: `${omSigla}`, inline: true },
                { name: '🆔 Protocolo do Requerimento', value: `#${resultado.requerimentoId}`, inline: false }
            ],
            footer: { text: 'Aguardando Análise — Departamento Geral do Pessoal' },
            timestamp: new Date()
        };

        await interaction.editReply({ embeds: [embedUsuario] });

        // 6. Envia a embed interativa para o canal de Requerimentos da DGP
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
                    title: `📥 Novo Requerimento Pessoal — Protocolo #${resultado.requerimentoId}`,
                    description: `**Solicitante:** <@${executorDiscordId}>\n**Tipo:** LISTAGEM / INGRESSO PRÓPRIO`,
                    color: 0xE9C46A,
                    fields: [
                        { name: '🎖️ Militar (Alvo)', value: `**${nomeGuerra}** (${resultado.patenteNome})`, inline: true },
                        { name: '🎮 Roblox', value: `${robloxUsername} (ID: ${robloxId})`, inline: true },
                        { name: '🏛️ OM Solicitada', value: `${omSigla}`, inline: true },
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
        console.error('Erro no requerimento de listagem:', error);

        if (error.message.includes('OM') || error.message.includes('Patente')) {
            return interaction.editReply(`❌ ${error.message}`);
        } else if (error.code === '23505') {
            return interaction.editReply('❌ **Erro**: O Roblox ID fornecido já está vinculado a outro militar no sistema.');
        }

        interaction.editReply('❌ Ocorreu um erro interno ao processar seu requerimento.');
    }
}

module.exports = handleRequerimentoListagem;
