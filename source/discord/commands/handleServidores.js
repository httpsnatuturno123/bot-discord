// source/discord/commands/handleServidores.js

const { EmbedBuilder } = require('discord.js');
const serverTracker = require('../services/serverTrackerService');

/**
 * Mostra o status de todos os servidores Roblox ativos
 * e os players que estão online em cada um.
 */
async function handleServidores(interaction) {
    const servers = serverTracker.getActiveServers();

    if (servers.length === 0) {
        const embed = new EmbedBuilder()
            .setColor(0x95a5a6)
            .setTitle('📊 Status dos Servidores')
            .setDescription('Nenhum servidor Roblox ativo no momento.')
            .setFooter({ text: 'CEOB • Sistema de Monitoramento' })
            .setTimestamp();

        return interaction.reply({ embeds: [embed], ephemeral: true });
    }

    const embeds = [];

    for (const server of servers) {
        const uptime = serverTracker.formatDuration(new Date() - server.startedAt);

        let playerList = 'Nenhum player online';
        if (server.players.length > 0) {
            playerList = server.players
                .map((p, i) => `**${i + 1}.** \`${p.playerId}\` — **${p.nickname}** (${p.displayName})`)
                .join('\n');
        }

        const embed = new EmbedBuilder()
            .setColor(0x2ecc71)
            .setTitle(`🖥️ ${server.serverName}`)
            .addFields(
                { name: '🔑 Job ID', value: `\`${server.jobId}\``, inline: true },
                { name: '🎮 Place ID', value: `\`${server.placeId}\``, inline: true },
                { name: '⏱️ Uptime', value: uptime, inline: true },
                { name: `👥 Players Online (${server.playerCount})`, value: playerList },
            )
            .setFooter({ text: 'CEOB • Sistema de Monitoramento' })
            .setTimestamp();

        embeds.push(embed);
    }

    // Discord permite no máximo 10 embeds por mensagem
    await interaction.reply({ embeds: embeds.slice(0, 10), ephemeral: true });
}

module.exports = handleServidores;
