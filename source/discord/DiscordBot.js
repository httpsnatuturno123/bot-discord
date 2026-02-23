const { Client, GatewayIntentBits, REST, Routes } = require('discord.js');

// Definições de comandos
const getSlashCommands = require('./commands/commandDefinitions');

// Handlers de Slash Commands
const handleFicha = require('./commands/handleFicha');
const handlePatentes = require('./commands/handlePatentes');
const handleOMs = require('./commands/handleOMs');
const handleEfetivo = require('./commands/handleEfetivo');
const handleMinhaPerfil = require('./commands/handleMinhaPerfil');
const handleListarRecrutamento = require('./commands/handleListarRecrutamento');
const handleRequererRecrutamento = require('./commands/handleRequererRecrutamento');
const handleApagarMilitar = require('./commands/handleApagarMilitar');

// Handler legado (prefixo)
const handleBanLegado = require('./commands/handleBanLegado');

class DiscordBot {
    constructor(token, legacyDb, ceobDb) {
        this.token = token;
        this.legacyDb = legacyDb;
        this.ceobDb = ceobDb;

        this.client = new Client({
            intents: [
                GatewayIntentBits.Guilds,
                GatewayIntentBits.GuildMessages,
                GatewayIntentBits.MessageContent
            ]
        });

        this.setupEvents();
    }

    // ────────────────────────────────────────────────────
    // Registro dos Slash Commands
    // ────────────────────────────────────────────────────
    async registerCommands() {
        const rest = new REST({ version: '10' }).setToken(this.token);

        try {
            const commands = getSlashCommands();
            console.log(`🔄 Discord: Registrando ${commands.length} slash commands...`);

            if (process.env.DISCORD_GUILD_ID) {
                await rest.put(
                    Routes.applicationGuildCommands(this.client.user.id, process.env.DISCORD_GUILD_ID),
                    { body: commands }
                );
                console.log(`✅ Discord: Slash commands registrados no servidor ${process.env.DISCORD_GUILD_ID}`);
            } else {
                await rest.put(
                    Routes.applicationCommands(this.client.user.id),
                    { body: commands }
                );
                console.log('✅ Discord: Slash commands registrados globalmente');
            }
        } catch (err) {
            console.error('❌ Discord: Erro ao registrar slash commands:', err);
        }
    }

    // ────────────────────────────────────────────────────
    // Mapa de comandos → handlers
    // ────────────────────────────────────────────────────
    getCommandMap() {
        return {
            'ficha': (i) => handleFicha(i, this.ceobDb),
            'patentes': (i) => handlePatentes(i, this.ceobDb),
            'oms': (i) => handleOMs(i, this.ceobDb),
            'efetivo': (i) => handleEfetivo(i, this.ceobDb),
            'minhaperfil': (i) => handleMinhaPerfil(i, this.ceobDb),
            'listar_recrutamento': (i) => handleListarRecrutamento(i, this.ceobDb),
            'requerer_recrutamento': (i) => handleRequererRecrutamento(i, this.ceobDb),
            'apagar_militar': (i) => handleApagarMilitar(i, this.ceobDb),
        };
    }

    // ────────────────────────────────────────────────────
    // Event Handlers
    // ────────────────────────────────────────────────────
    setupEvents() {
        this.client.once('ready', async () => {
            console.log(`✅ Discord: Bot logado como ${this.client.user.tag}`);
            await this.registerCommands();
        });

        // ── Slash Commands ──
        this.client.on('interactionCreate', async (interaction) => {
            if (!interaction.isChatInputCommand()) return;

            const commandMap = this.getCommandMap();
            const handler = commandMap[interaction.commandName];

            try {
                if (handler) {
                    await handler(interaction);
                } else {
                    await interaction.reply({ content: '⚠️ Comando desconhecido.', ephemeral: true });
                }
            } catch (err) {
                console.error(`❌ Erro no comando /${interaction.commandName}:`, err);
                const reply = { content: '❌ Ocorreu um erro interno. Tente novamente.', ephemeral: true };
                if (interaction.replied || interaction.deferred) {
                    await interaction.followUp(reply);
                } else {
                    await interaction.reply(reply);
                }
            }
        });

        // ── Comandos Legados por Prefixo ──
        this.client.on('messageCreate', async (message) => {
            await handleBanLegado(message, this.legacyDb);
        });
    }

    start() {
        this.client.login(this.token).catch(err => {
            console.error("❌ Discord: Erro ao logar:", err);
        });
    }
}

module.exports = DiscordBot;
