// src/bot.js
const { Client, GatewayIntentBits } = require('discord.js');

// Registro de comandos
const getSlashCommands = require('./commands/commandDefinitions');
const { registerSlashCommands } = require('./utils/commandRegistry');

// Roteador de interações (botões, modais)
const { routeInteraction } = require('./interactions');

// Handlers de Slash Commands
const handleFicha = require('./commands/handleFicha');
const handlePatentes = require('./commands/handlePatentes');
const handleOMs = require('./commands/handleOMs');
const handleEfetivo = require('./commands/handleEfetivo');
const handleMinhaPerfil = require('./commands/handleMinhaPerfil');
const handleListarRecrutamento = require('./commands/handleListarRecrutamento');
const handleRequererRecrutamento = require('./commands/handleRequererRecrutamento');
const handleApagarMilitar = require('./commands/handleApagarMilitar');
const handleListagem = require('./commands/handleListagem');
const handleListarMilitar = require('./commands/handleListarMilitar');
const handleRequerimentoListagem = require('./commands/handleRequerimentoListagem');
const handleCriarOM = require('./commands/handleCriarOM');
const handleDeletarOM = require('./commands/handleDeletarOM');
const handlePromover = require('./commands/handlePromover');

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

        this.commandMap = this.buildCommandMap();
        this.setupEvents();
    }

    // ────────────────────────────────────────────────────
    // Mapa de comandos → handlers
    // ────────────────────────────────────────────────────
    buildCommandMap() {
        const db = this.ceobDb;
        return {
            'ficha': (i) => handleFicha(i, db),
            'patentes': (i) => handlePatentes(i, db),
            'oms': (i) => handleOMs(i, db),
            'efetivo': (i) => handleEfetivo(i, db),
            'minhaperfil': (i) => handleMinhaPerfil(i, db),
            'listar_recrutamento': (i) => handleListarRecrutamento(i, db),
            'requerer_recrutamento': (i) => handleRequererRecrutamento(i, db),
            'apagar_militar': (i) => handleApagarMilitar(i, db),
            'listagem': (i) => handleListagem(i, db),
            'listar_militar': (i) => handleListarMilitar(i, db),
            'requerimento_listagem': (i) => handleRequerimentoListagem(i, db),
            'criar_om': (i) => handleCriarOM(i, db),
            'deletar_om': (i) => handleDeletarOM(i, db),
            'promover': (i) => handlePromover(i, db),
        };
    }

    // ────────────────────────────────────────────────────
    // Event Handlers
    // ────────────────────────────────────────────────────
    setupEvents() {
        this.client.once('ready', async () => {
            console.log(`✅ Discord: Bot logado como ${this.client.user.tag}`);
            await registerSlashCommands(this.client, this.token, getSlashCommands());
        });

        this.client.on('interactionCreate', (interaction) => this.handleInteraction(interaction));
        this.client.on('messageCreate', (message) => handleBanLegado(message, this.legacyDb));
    }

    // ────────────────────────────────────────────────────
    // Roteamento central de interações
    // ────────────────────────────────────────────────────
    async handleInteraction(interaction) {
        try {
            // Tenta rotear botões e modais primeiro
            const handled = await routeInteraction(interaction, this.ceobDb);
            if (handled) return;

            // Slash Commands
            if (!interaction.isChatInputCommand()) return;

            const handler = this.commandMap[interaction.commandName];

            if (handler) {
                await handler(interaction);
            } else {
                await interaction.reply({ content: '⚠️ Comando desconhecido.', ephemeral: true });
            }
        } catch (err) {
            console.error(`❌ Erro na interação:`, err);
            const reply = { content: '❌ Ocorreu um erro interno. Tente novamente.', ephemeral: true };

            if (interaction.replied || interaction.deferred) {
                await interaction.followUp(reply).catch(() => { });
            } else {
                await interaction.reply(reply).catch(() => { });
            }
        }
    }

    // ────────────────────────────────────────────────────
    // Inicialização
    // ────────────────────────────────────────────────────
    start() {
        this.client.login(this.token).catch(err => {
            console.error('❌ Discord: Erro ao logar:', err);
        });
    }
}

module.exports = DiscordBot;