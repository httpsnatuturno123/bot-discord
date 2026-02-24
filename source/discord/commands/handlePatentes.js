/**
 * Handler do comando /patentes
 * @param {import('discord.js').ChatInputCommandInteraction} interaction
 * @param {import('../../database/CeobDatabase')} ceobDb
 */
async function handlePatentes(interaction, ceobDb) {
    try {
        const patentes = await ceobDb.patentes.getAll();

        let desc = '';
        let currentCirculo = '';

        for (const p of patentes) {
            if (p.circulo !== currentCirculo) {
                currentCirculo = p.circulo;
                const label = currentCirculo.replace(/_/g, ' ');
                desc += `\n**── ${label} ──**\n`;
            }
            const especial = p.is_praca_especial ? ' ⭐' : '';
            desc += `\`${String(p.ordem_precedencia).padStart(2, ' ')}\` ${p.abreviacao} — ${p.nome}${especial}\n`;
        }

        await interaction.reply({
            embeds: [{
                title: '🎖️ Hierarquia de Patentes do CEOB',
                description: desc.trim(),
                color: 0x1B4332,
                footer: { text: '⭐ = Praça Especial' }
            }]
        });
    } catch (error) {
        console.error('Erro no comando patentes:', error);
        try {
            if (interaction.deferred || interaction.replied) {
                await interaction.editReply('❌ Ocorreu um erro interno ao listar as patentes.');
            } else {
                await interaction.reply({ content: '❌ Ocorreu um erro interno ao listar as patentes.', ephemeral: true });
            }
        } catch (replyErr) {
            console.error('Falha ao enviar resposta de erro:', replyErr);
        }
    }
}

module.exports = handlePatentes;
