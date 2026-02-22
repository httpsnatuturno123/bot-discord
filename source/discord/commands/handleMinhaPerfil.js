const buildFichaEmbed = require('../helpers/buildFichaEmbed');

/**
 * Handler do comando /minhaperfil
 * @param {import('discord.js').ChatInputCommandInteraction} interaction
 * @param {import('../../database/CeobDatabase')} ceobDb
 */
async function handleMinhaPerfil(interaction, ceobDb) {
    await interaction.deferReply({ ephemeral: true });

    const militar = await ceobDb.getMilitarByDiscord(interaction.user.id);

    if (!militar) {
        return interaction.editReply('❌ Você não possui cadastro no CEOB. Solicite seu registro a um superior.');
    }

    const ficha = await ceobDb.getFichaCompleta(militar.id);
    const embed = buildFichaEmbed(ficha);
    await interaction.editReply({ embeds: [embed] });
}

module.exports = handleMinhaPerfil;
