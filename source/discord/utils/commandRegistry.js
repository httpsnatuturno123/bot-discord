// src/utils/commandRegistry.js
const { REST, Routes } = require('discord.js');

/**
 * Registra slash commands no Discord (guild ou global).
 */
async function registerSlashCommands(client, token, commands) {
    const rest = new REST({ version: '10' }).setToken(token);
    const guildId = process.env.DISCORD_GUILD_ID;

    console.log(`🔄 Discord: Registrando ${commands.length} slash commands...`);

    try {
        if (guildId) {
            await rest.put(
                Routes.applicationGuildCommands(client.user.id, guildId),
                { body: commands }
            );
            console.log(`✅ Discord: Slash commands registrados no servidor ${guildId}`);
        } else {
            await rest.put(
                Routes.applicationCommands(client.user.id),
                { body: commands }
            );
            console.log('✅ Discord: Slash commands registrados globalmente');
        }
    } catch (err) {
        console.error('❌ Discord: Erro ao registrar slash commands:', err);
        throw err;
    }
}

module.exports = { registerSlashCommands };