const { Client, GatewayIntentBits } = require('discord.js');

class DiscordBot {
    constructor(token, db) {
        this.token = token;
        this.db = db;
        this.client = new Client({
            intents: [
                GatewayIntentBits.Guilds,
                GatewayIntentBits.GuildMessages,
                GatewayIntentBits.MessageContent
            ]
        });

        this.setupEvents();
    }

    setupEvents() {
        this.client.once('clientReady', () => {
            console.log(`✅ Discord: Bot logado como ${this.client.user.tag}`);
        });

        this.client.on('messageCreate', async (message) => {
            if (message.author.bot) return;
            if (!message.content.startsWith('!ban')) return;

            const args = message.content.trim().split(/\s+/);
            const userId = args[1];
            const reason = args.slice(2).join(" ") || "Sem motivo especificado";

            if (!userId || isNaN(userId)) {
                return message.reply("⚠️ Informe um UserId válido (apenas números).");
            }

            try {
                await this.db.addBan(userId, reason);
                console.log(`📌 Discord: Ban salvo no banco: ${userId}`);
                message.reply(`🚫 UserId ${userId} salvo no banco. O Roblox fará a leitura em breve.`);
            } catch (err) {
                console.error("❌ Erro ao salvar ban via Discord:", err);
                message.reply("❌ Ocorreu um erro interno ao tentar registrar o banimento.");
            }
        });
    }

    start() {
        this.client.login(this.token).catch(err => {
            console.error("❌ Discord: Erro ao logar:", err);
        });
    }
}

module.exports = DiscordBot;