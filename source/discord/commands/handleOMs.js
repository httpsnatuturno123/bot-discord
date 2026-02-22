/**
 * Handler do comando /oms
 * @param {import('discord.js').ChatInputCommandInteraction} interaction
 * @param {import('../../database/CeobDatabase')} ceobDb
 */
async function handleOMs(interaction, ceobDb) {
    const oms = await ceobDb.getOMs();

    let desc = '';
    for (const om of oms) {
        const parent = om.parent_id
            ? oms.find(o => o.id === om.parent_id)?.sigla || '?'
            : '—';
        desc += `**${om.sigla}** — ${om.nome} (↑ ${parent})\n`;
    }

    await interaction.reply({
        embeds: [{
            title: '🏛️ Organizações Militares do CEOB',
            description: desc.trim(),
            color: 0x2D6A4F
        }]
    });
}

module.exports = handleOMs;
