// source/discord/commands/handleConfigurarLogsServidor.js

const { EmbedBuilder, PermissionFlagsBits, ChannelType } = require('discord.js');
const serverTracker = require('../services/serverTrackerService');

/**
 * Configura o canal onde os logs de servidor Roblox serão enviados.
 * Apenas administradores podem usar este comando.
 */
async function handleConfigurarLogsServidor(interaction) {
    // Verificar permissão de administrador
    if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
        return interaction.reply({
            content: '❌ Apenas **Administradores** podem configurar o canal de logs.',
            ephemeral: true,
        });
    }

    const canal = interaction.options.getChannel('canal');

    // Verificar se é um canal de texto
    if (canal.type !== ChannelType.GuildText) {
        return interaction.reply({
            content: '❌ O canal precisa ser um **canal de texto**.',
            ephemeral: true,
        });
    }

    // Configurar o canal no serverTracker
    serverTracker.setLogChannel(canal.id);

    const embed = new EmbedBuilder()
        .setColor(0x2ecc71)
        .setTitle('✅ Canal de Logs Configurado')
        .setDescription(`Os logs de servidores Roblox serão enviados em ${canal}.`)
        .addFields(
            { name: '📺 Canal', value: `${canal}`, inline: true },
            { name: '🔑 ID do Canal', value: `\`${canal.id}\``, inline: true },
        )
        .setFooter({ text: 'CEOB • Sistema de Monitoramento' })
        .setTimestamp();

    await interaction.reply({ embeds: [embed], ephemeral: true });

    // Enviar mensagem de teste no canal configurado
    const testEmbed = new EmbedBuilder()
        .setColor(0x9b59b6)
        .setTitle('🔔 Canal de Monitoramento Ativado')
        .setDescription(
            'Este canal foi configurado para receber logs de servidores Roblox.\n\n' +
            '**Eventos monitorados:**\n' +
            '🟢 Servidor Iniciado\n' +
            '➡️ Player Conectou (com ID e Nickname)\n' +
            '⬅️ Player Desconectou\n' +
            '🔴 Servidor Encerrado\n' +
            '📊 Status dos Servidores'
        )
        .setFooter({ text: 'CEOB • Sistema de Monitoramento' })
        .setTimestamp();

    try {
        await canal.send({ embeds: [testEmbed] });
    } catch (err) {
        console.error('❌ Erro ao enviar mensagem de teste no canal:', err);
    }
}

module.exports = handleConfigurarLogsServidor;
