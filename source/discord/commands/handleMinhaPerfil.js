const buildFichaEmbed = require('../helpers/buildFichaEmbed');

/**
 * Handler do comando /minhaperfil
 * @param {import('discord.js').ChatInputCommandInteraction} interaction
 * @param {import('../../database/CeobDatabase')} ceobDb
 */
async function handleMinhaPerfil(interaction, ceobDb) {
    try {
        await interaction.deferReply({ ephemeral: true });

        const militar = await ceobDb.militares.getByDiscord(interaction.user.id);

        if (!militar) {
            return interaction.editReply('❌ Você não possui cadastro no CEOB. Solicite seu registro a um superior.');
        }

        const ficha = await ceobDb.ficha.getCompleta(militar.id);
        const embed = buildFichaEmbed(ficha);
        await interaction.editReply({ embeds: [embed] });
    } catch (error) {
        console.error('Erro no comando minhaperfil:', error);
        try {
            if (interaction.deferred || interaction.replied) {
                await interaction.editReply('❌ Ocorreu um erro interno ao consultar seu perfil.');
            } else {
                await interaction.reply({ content: '❌ Ocorreu um erro interno ao consultar seu perfil.', ephemeral: true });
            }
        } catch (replyErr) {
            console.error('Falha ao enviar resposta de erro:', replyErr);
        }
    }
}

module.exports = handleMinhaPerfil;
