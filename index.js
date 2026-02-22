require('dotenv').config();

const { Client, GatewayIntentBits } = require('discord.js');
const express = require('express');

const app = express();
app.use(express.json());

// =============================
// CONFIG
// =============================

const PORT = process.env.PORT || 3000;
const DISCORD_TOKEN = process.env.DISCORD_TOKEN;
const API_KEY = process.env.API_KEY;

if (!DISCORD_TOKEN) {
    console.error("❌ DISCORD_TOKEN não definido.");
    process.exit(1);
}

if (!API_KEY) {
    console.error("❌ API_KEY não definida.");
    process.exit(1);
}

// =============================
// SISTEMA DE BAN
// =============================

let pendingBans = [];

// =============================
// DISCORD BOT
// =============================

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent
    ]
});

client.once('ready', () => {
    console.log(`✅ Bot logado como ${client.user.tag}`);
});

client.on('messageCreate', async (message) => {
    try {
        if (message.author.bot) return;
        if (!message.content.startsWith('!ban')) return;

        const args = message.content.trim().split(/\s+/);
        const userId = args[1];
        const reason = args.slice(2).join(" ") || "Sem motivo";

        if (!userId || isNaN(userId)) {
            return message.reply("⚠️ Informe um UserId válido.");
        }

        pendingBans.push({ userId, reason });

        console.log("📌 Ban adicionado:", userId);

        message.reply(`🚫 UserId ${userId} enviado para o Roblox.`);
    } catch (err) {
        console.error("Erro no comando !ban:", err);
    }
});

client.login(DISCORD_TOKEN).catch(err => {
    console.error("❌ Erro ao logar no Discord:", err);
});

// =============================
// ENDPOINTS
// =============================

// Health check
app.get('/', (req, res) => {
    res.status(200).send("API online.");
});

// Endpoint usado pelo Roblox
app.get('/pending-bans', (req, res) => {
    try {
        if (req.headers["x-api-key"] !== API_KEY) {
            console.log("❌ API_KEY inválida.");
            return res.status(403).json({ error: "Acesso negado" });
        }

        console.log("📤 Enviando bans:", pendingBans.length);

        res.json(pendingBans);

        // limpa depois de enviar
        pendingBans = [];
    } catch (err) {
        console.error("Erro no endpoint:", err);
        res.status(500).json({ error: "Erro interno" });
    }
});

// =============================
// START SERVER
// =============================

app.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 Servidor rodando na porta ${PORT}`);
});
