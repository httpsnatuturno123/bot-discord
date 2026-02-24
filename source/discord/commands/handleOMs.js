/**
 * Handler do comando /oms
 * @param {import('discord.js').ChatInputCommandInteraction} interaction
 * @param {import('../../database/CeobDatabase')} ceobDb
 */
async function handleOMs(interaction, ceobDb) {
    try {
        const oms = await ceobDb.organizacoes.getAll();

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
    } catch (error) {
        console.error('Erro no comando oms:', error);
        try {
            if (interaction.deferred || interaction.replied) {
                await interaction.editReply('❌ Ocorreu um erro interno ao listar as OMs.');
            } else {
                await interaction.reply({ content: '❌ Ocorreu um erro interno ao listar as OMs.', ephemeral: true });
            }
        } catch (replyErr) {
            console.error('Falha ao enviar resposta de erro:', replyErr);
        }
    }
}

module.exports = handleOMs;
