// source/discord/services/serverTrackerService.js

const { EmbedBuilder } = require('discord.js');

/**
 * Serviço que rastreia servidores Roblox ativos e envia
 * notificações no Discord quando:
 *  - Um servidor é iniciado
 *  - Um player entra no servidor
 *  - Um player sai do servidor
 *  - Um servidor é encerrado
 */
class ServerTrackerService {
    constructor() {
        // Map<serverId, { jobId, placeId, startedAt, players: Map<playerId, { nickname, joinedAt }> }>
        this.activeServers = new Map();

        // ID do canal do Discord onde os logs serão enviados (SIDA)
        this.logChannelId = '1475194798758564082';

        // Referência ao client do Discord (setada pelo bot ao iniciar)
        this.discordClient = null;
    }

    /**
     * Configura o client do Discord.
     */
    setClient(client) {
        this.discordClient = client;
    }

    /**
     * Configura o canal de logs do Discord.
     */
    setLogChannel(channelId) {
        this.logChannelId = channelId;
    }

    /**
     * Retorna o canal de logs, se configurado.
     */
    async getLogChannel() {
        if (!this.discordClient || !this.logChannelId) return null;
        try {
            return await this.discordClient.channels.fetch(this.logChannelId);
        } catch {
            console.error('❌ ServerTracker: Canal de logs não encontrado:', this.logChannelId);
            return null;
        }
    }

    // ─────────────────────────────────────────────────
    // Evento: Servidor Iniciado
    // ─────────────────────────────────────────────────
    async handleServerStart({ jobId, placeId, serverName }) {
        const serverData = {
            jobId,
            placeId,
            serverName: serverName || 'Servidor Roblox',
            startedAt: new Date(),
            players: new Map(),
        };

        this.activeServers.set(jobId, serverData);

        console.log(`🟢 ServerTracker: Servidor iniciado → JobId: ${jobId}`);

        const channel = await this.getLogChannel();
        if (!channel) return;

        const embed = new EmbedBuilder()
            .setColor(0x2ecc71) // Verde
            .setTitle('🟢 Servidor Iniciado')
            .setDescription(`Um novo servidor Roblox foi iniciado!`)
            .addFields(
                { name: '🏷️ Nome', value: serverData.serverName, inline: true },
                { name: '🔑 Job ID', value: `\`${jobId}\``, inline: true },
                { name: '🎮 Place ID', value: `\`${placeId}\``, inline: true },
            )
            .setFooter({ text: 'CEOB • Sistema de Monitoramento' })
            .setTimestamp();

        await channel.send({ embeds: [embed] });
    }

    // ─────────────────────────────────────────────────
    // Evento: Player Entrou
    // ─────────────────────────────────────────────────
    async handlePlayerJoin({ jobId, playerId, nickname, displayName }) {
        const server = this.activeServers.get(jobId);

        if (!server) {
            console.warn(`⚠️ ServerTracker: Player join para servidor desconhecido → JobId: ${jobId}`);
            // Cria servidor on-the-fly caso o evento de start tenha sido perdido
            this.activeServers.set(jobId, {
                jobId,
                placeId: 'Desconhecido',
                serverName: 'Servidor Roblox',
                startedAt: new Date(),
                players: new Map(),
            });
        }

        const serverData = this.activeServers.get(jobId);
        serverData.players.set(String(playerId), {
            nickname: nickname || 'Desconhecido',
            displayName: displayName || nickname || 'Desconhecido',
            joinedAt: new Date(),
        });

        const playerCount = serverData.players.size;

        console.log(`➡️  ServerTracker: Player entrou → ID: ${playerId} | Nick: ${nickname} | Servidor: ${jobId} | Total: ${playerCount}`);

        const channel = await this.getLogChannel();
        if (!channel) return;

        const embed = new EmbedBuilder()
            .setColor(0x3498db) // Azul
            .setTitle('➡️ Player Conectou')
            .addFields(
                { name: '🆔 Player ID', value: `\`${playerId}\``, inline: true },
                { name: '👤 Nickname', value: nickname || 'N/A', inline: true },
                { name: '📛 Display Name', value: displayName || nickname || 'N/A', inline: true },
                { name: '🏷️ Servidor', value: serverData.serverName, inline: true },
                { name: '👥 Players Online', value: `\`${playerCount}\``, inline: true },
                { name: '🔗 Perfil Roblox', value: `[Ver Perfil](https://www.roblox.com/users/${playerId}/profile)`, inline: true },
            )
            .setThumbnail(`https://thumbnails.roblox.com/v1/users/avatar-headshot?userIds=${playerId}&size=150x150&format=Png&isCircular=false`)
            .setFooter({ text: `CEOB • Job: ${jobId.substring(0, 8)}...` })
            .setTimestamp();

        await channel.send({ embeds: [embed] });
    }

    // ─────────────────────────────────────────────────
    // Evento: Player Saiu
    // ─────────────────────────────────────────────────
    async handlePlayerLeave({ jobId, playerId, nickname }) {
        const server = this.activeServers.get(jobId);
        if (!server) return;

        const playerData = server.players.get(String(playerId));
        server.players.delete(String(playerId));

        const playerCount = server.players.size;
        const tempoOnline = playerData
            ? this.formatDuration(new Date() - playerData.joinedAt)
            : 'N/A';

        console.log(`⬅️  ServerTracker: Player saiu → ID: ${playerId} | Nick: ${nickname} | Tempo: ${tempoOnline}`);

        const channel = await this.getLogChannel();
        if (!channel) return;

        const embed = new EmbedBuilder()
            .setColor(0xe74c3c) // Vermelho
            .setTitle('⬅️ Player Desconectou')
            .addFields(
                { name: '🆔 Player ID', value: `\`${playerId}\``, inline: true },
                { name: '👤 Nickname', value: nickname || 'N/A', inline: true },
                { name: '⏱️ Tempo Online', value: tempoOnline, inline: true },
                { name: '👥 Players Online', value: `\`${playerCount}\``, inline: true },
            )
            .setFooter({ text: `CEOB • Job: ${jobId.substring(0, 8)}...` })
            .setTimestamp();

        await channel.send({ embeds: [embed] });
    }

    // ─────────────────────────────────────────────────
    // Evento: Servidor Encerrado
    // ─────────────────────────────────────────────────
    async handleServerStop({ jobId }) {
        const server = this.activeServers.get(jobId);
        if (!server) return;

        const uptime = this.formatDuration(new Date() - server.startedAt);

        console.log(`🔴 ServerTracker: Servidor encerrado → JobId: ${jobId} | Uptime: ${uptime}`);

        this.activeServers.delete(jobId);

        const channel = await this.getLogChannel();
        if (!channel) return;

        const embed = new EmbedBuilder()
            .setColor(0x95a5a6) // Cinza
            .setTitle('🔴 Servidor Encerrado')
            .addFields(
                { name: '🏷️ Nome', value: server.serverName, inline: true },
                { name: '🔑 Job ID', value: `\`${jobId}\``, inline: true },
                { name: '⏱️ Uptime', value: uptime, inline: true },
            )
            .setFooter({ text: 'CEOB • Sistema de Monitoramento' })
            .setTimestamp();

        await channel.send({ embeds: [embed] });
    }

    // ─────────────────────────────────────────────────
    // Utilitário: Lista de servidores ativos
    // ─────────────────────────────────────────────────
    getActiveServers() {
        const result = [];
        for (const [jobId, data] of this.activeServers) {
            result.push({
                jobId,
                serverName: data.serverName,
                placeId: data.placeId,
                startedAt: data.startedAt,
                playerCount: data.players.size,
                players: Array.from(data.players.entries()).map(([id, p]) => ({
                    playerId: id,
                    nickname: p.nickname,
                    displayName: p.displayName,
                    joinedAt: p.joinedAt,
                })),
            });
        }
        return result;
    }

    // ─────────────────────────────────────────────────
    // Utilitário: Formata duração em texto legível
    // ─────────────────────────────────────────────────
    formatDuration(ms) {
        const seconds = Math.floor(ms / 1000);
        const minutes = Math.floor(seconds / 60);
        const hours = Math.floor(minutes / 60);

        if (hours > 0) {
            return `${hours}h ${minutes % 60}m`;
        }
        if (minutes > 0) {
            return `${minutes}m ${seconds % 60}s`;
        }
        return `${seconds}s`;
    }
}

// Singleton — uma única instância compartilhada entre API e Discord
const serverTracker = new ServerTrackerService();

module.exports = serverTracker;
