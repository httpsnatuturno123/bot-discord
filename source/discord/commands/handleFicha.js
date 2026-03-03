const { ActionRowBuilder, ButtonBuilder, ButtonStyle, ComponentType } = require('discord.js');
const buildFichaEmbed = require('../helpers/buildFichaEmbed');
const robloxService = require('../services/robloxService');

/**
 * Handler do comando /ficha
 * @param {import('discord.js').ChatInputCommandInteraction} interaction
 * @param {import('../../database/CeobDatabase')} ceobDb
 */
async function handleFicha(interaction, ceobDb) {
    try {
        await interaction.deferReply();

        const identificador = interaction.options.getString('identificador').trim();
        let militar = null;

        // 1. Tentar como Matrícula (Formato YYYY-XXXX)
        if (/^\d{4}-\d{4}$/.test(identificador)) {
            militar = await ceobDb.militares.getByMatricula(identificador);
        }
        // 2. Tentar como Menção do Discord (<@123...>)
        else if (/<@!?(\d+)>/.test(identificador) || /^\d{17,19}$/.test(identificador)) {
            const discordIdMatch = identificador.match(/<@!?(\d+)>/) || identificador.match(/^(\d{17,19})$/);
            if (discordIdMatch) {
                militar = await ceobDb.militares.getByDiscord(discordIdMatch[1]);
            }
        }
        // 3. Tentar como Roblox ID ou Username usando robloxService
        else {
            try {
                const { userId } = await robloxService.resolverUsuario(identificador);
                militar = await ceobDb.militares.getByRoblox(userId);
            } catch (err) {
                return interaction.editReply(`❌ Erro ao buscar usuário no Roblox: ${err.message}`);
            }
        }

        if (!militar) {
            return interaction.editReply('❌ Militar não encontrado no sistema.');
        }

        // Busca dados da ficha
        const ficha = await ceobDb.ficha.getCompleta(militar.id);
        const pages = buildFichaEmbed(ficha);

        // Se por algum motivo retornar apenas 1 embed
        if (!Array.isArray(pages) || pages.length <= 1) {
            return interaction.editReply({ embeds: Array.isArray(pages) ? pages : [pages] });
        }

        let currentPage = 0;

        // Cria os botões
        const getRow = (pageIndex) => {
            const row = new ActionRowBuilder()
                .addComponents(
                    new ButtonBuilder()
                        .setCustomId('prev_ficha')
                        .setLabel('⬅️ Anterior')
                        .setStyle(ButtonStyle.Primary)
                        .setDisabled(pageIndex === 0),
                    new ButtonBuilder()
                        .setCustomId('next_ficha')
                        .setLabel('Próximo ➡️')
                        .setStyle(ButtonStyle.Primary)
                        .setDisabled(pageIndex === pages.length - 1)
                );
            return row;
        };

        const message = await interaction.editReply({
            embeds: [pages[currentPage]],
            components: [getRow(currentPage)]
        });

        // Coletor de interações
        const collector = message.createMessageComponentCollector({
            componentType: ComponentType.Button,
            time: 120000 // 2 minutos
        });

        collector.on('collect', async (i) => {
            if (i.user.id !== interaction.user.id) {
                return i.reply({ content: '❌ Apenas quem executou o comando pode usar estes botões.', ephemeral: true });
            }

            if (i.customId === 'prev_ficha') {
                currentPage--;
            } else if (i.customId === 'next_ficha') {
                currentPage++;
            }

            await i.update({
                embeds: [pages[currentPage]],
                components: [getRow(currentPage)]
            });
        });

        collector.on('end', async () => {
            // Desativa os botões após o tempo
            try {
                const disabledRow = new ActionRowBuilder()
                    .addComponents(
                        new ButtonBuilder().setCustomId('prev_ficha').setLabel('⬅️ Anterior').setStyle(ButtonStyle.Primary).setDisabled(true),
                        new ButtonBuilder().setCustomId('next_ficha').setLabel('Próximo ➡️').setStyle(ButtonStyle.Primary).setDisabled(true)
                    );
                await interaction.editReply({ components: [disabledRow] });
            } catch (e) {
                // Mensagem pode ter sido apagada, ignora o erro
            }
        });

    } catch (error) {
        console.error('Erro no comando ficha:', error);
        try {
            if (interaction.deferred || interaction.replied) {
                await interaction.editReply('❌ Ocorreu um erro interno ao consultar a ficha.');
            } else {
                await interaction.reply({ content: '❌ Ocorreu um erro interno ao consultar a ficha.', ephemeral: true });
            }
        } catch (replyErr) {
            console.error('Falha ao enviar resposta de erro:', replyErr);
        }
    }
}

module.exports = handleFicha;
