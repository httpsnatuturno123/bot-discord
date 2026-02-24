const { ActionRowBuilder, ModalBuilder, TextInputBuilder, TextInputStyle } = require('discord.js');
const { robloxService } = require('../services');

/**
 * Handler do comando /rebaixar
 * @param {import('discord.js').ChatInputCommandInteraction} interaction
 * @param {import('../../database/CeobDatabase')} ceobDb
 */
async function handleRebaixar(interaction, ceobDb) {
    const executorDiscordId = interaction.user.id;
    const executorMilitar = await ceobDb.militares.getByDiscord(executorDiscordId);

    if (!executorMilitar) {
        return interaction.reply({ content: '❌ Você não possui cadastro no sistema ou está inativo.', ephemeral: true });
    }

    // 1. Verificar se o executor é Oficial (ordem_precedencia <= 11)
    if (executorMilitar.ordem_precedencia > 11) {
        return interaction.reply({ content: '❌ Apenas Oficiais podem utilizar este comando.', ephemeral: true });
    }

    // 2. Capturar parâmetros
    const alvoInput = interaction.options.getString('alvo_identificador').trim();
    const novaPatenteAbrev = interaction.options.getString('nova_patente').toUpperCase();
    const robloxRoleId = interaction.options.getString('roblox_role_id').trim();

    try {
        // Como não podemos fazer deferReply e showModal juntos, precisamos resolver as validações de input
        // ou deixar para o modalHandler. Faremos a resolução primária aqui.

        let robloxId = alvoInput;
        const discordIdMatch = alvoInput.match(/<@!?(\d+)>/) || alvoInput.match(/^(\d{17,19})$/);
        let alvoMilitar = null;

        if (discordIdMatch) {
            alvoMilitar = await ceobDb.militares.getByDiscord(discordIdMatch[1]);
        } else {
            // Em caso de username ou ID numérico
            const { userId } = await robloxService.resolverUsuario(alvoInput);
            robloxId = userId;
            alvoMilitar = await ceobDb.militares.getByRoblox(robloxId);
        }

        if (!alvoMilitar) {
            return interaction.reply({ content: '❌ Militar não encontrado ou se encontra inativo/excluído no sistema.', ephemeral: true });
        }

        if (alvoMilitar.id === executorMilitar.id) {
            return interaction.reply({ content: '❌ Você não pode rebaixar a si mesmo.', ephemeral: true });
        }

        const novaPatente = await ceobDb.patentes.getByAbreviacao(novaPatenteAbrev);

        if (!novaPatente) {
            return interaction.reply({ content: `❌ Patente \`${novaPatenteAbrev}\` não encontrada no sistema.`, ephemeral: true });
        }

        // Validações Básicas (para poupar o usuário de preencher o formulário para nada)
        if (novaPatente.ordem_precedencia <= alvoMilitar.ordem_precedencia) {
            return interaction.reply({ content: `❌ Rebaixamento inválido. A nova patente (${novaPatente.nome}) deve ser hierarquicamente inferior à patente atual (${alvoMilitar.patente_nome}).`, ephemeral: true });
        }

        if (alvoMilitar.ordem_precedencia <= executorMilitar.ordem_precedencia) {
            return interaction.reply({ content: `❌ Você não pode rebaixar um militar de patente igual ou superior à sua.`, ephemeral: true });
        }

        const isAltoComando = await ceobDb.permissoes.isAltoComando(executorMilitar.id);
        if (alvoMilitar.ordem_precedencia <= 11 && !isAltoComando) {
            return interaction.reply({ content: `❌ Apenas membros do Alto Comando podem rebaixar Oficiais.`, ephemeral: true });
        }

        // Montar o customId limitando o tamanho (100 caracteres max).
        // Format: rebaixar:alvoId:novaPatenteAbrev:roleId
        // alvo.id (integer) ~ 4 chars + patente ~ 4 chars + roleId ~ 10 chars -> Bem seguro
        const customId = `modal_rebaixar:${alvoMilitar.id}:${novaPatente.id}:${robloxRoleId}`;

        if (customId.length > 100) {
            return interaction.reply({ content: '❌ Erro interno: IDs muito longos para gerar o formulário.', ephemeral: true });
        }

        // 3. Criar o Modal
        const modal = new ModalBuilder()
            .setCustomId(customId)
            .setTitle(`Rebaixamento: ${alvoMilitar.nome_guerra}`);

        const motivoInput = new TextInputBuilder()
            .setCustomId('motivo_input')
            .setLabel('Motivo do Rebaixamento (Mínimo 20 caracteres)')
            .setStyle(TextInputStyle.Paragraph)
            .setRequired(true)
            .setMinLength(20)
            .setMaxLength(1000);

        const actionRow = new ActionRowBuilder().addComponents(motivoInput);
        modal.addComponents(actionRow);

        await interaction.showModal(modal);

    } catch (error) {
        console.error('Erro no pre-rebaixar:', error);
        if (error.name === 'RobloxError') {
            return interaction.reply({ content: `❌ **Erro no Roblox:** ${error.message}`, ephemeral: true });
        }
        return interaction.reply({ content: '❌ Ocorreu um erro interno ao iniciar o rebaixamento.', ephemeral: true });
    }
}

module.exports = handleRebaixar;
