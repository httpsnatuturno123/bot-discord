/**
 * Handler do comando /efetivo
 * @param {import('discord.js').ChatInputCommandInteraction} interaction
 * @param {import('../../database/CeobDatabase')} ceobDb
 */
async function handleEfetivo(interaction, ceobDb) {
    const sigla = interaction.options.getString('sigla').toUpperCase();
    const om = await ceobDb.organizacoes.getBySigla(sigla);

    if (!om) {
        return interaction.reply({ content: `❌ OM com sigla "${sigla}" não encontrada.`, ephemeral: true });
    }

    const efetivo = await ceobDb.organizacoes.getEfetivo(om.id);
    const max = om.efetivo_maximo ? ` / ${om.efetivo_maximo}` : '';

    await interaction.reply({
        embeds: [{
            title: `📊 Efetivo — ${om.sigla}`,
            description: `**${om.nome}**\n\nMilitares ativos: **${efetivo}${max}**`,
            color: 0x40916C
        }]
    });
}

module.exports = handleEfetivo;
