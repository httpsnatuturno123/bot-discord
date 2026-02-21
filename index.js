require('dotenv').config();

const { Client, GatewayIntentBits } = require('discord.js');
const express = require('express');

process.on('uncaughtException', (err) => {
    console.error('UNCAUGHT EXCEPTION:', err);
});

process.on('unhandledRejection', (err) => {
    console.error('UNHANDLED REJECTION:', err);
});

const app = express();
app.use(express.json());

const PORT = process.env.PORT || 3000;
const DISCORD_TOKEN = process.env.DISCORD_TOKEN;
const API_KEY = process.env.API_KEY;

let pendingBans = [];

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent
    ]
});

client.once('clientReady', () => {
    console.log(`✅ Bot logado como ${client.user.tag}`);
});

client.on('error', console.error);

client.on('messageCreate', async (message) => {
    if (message.author.bot) return;
    if (!message.content.startsWith('!ban')) return;

    const args = message.content.trim().split(/\s+/);
    const userId = args[1];
    const reason = args.slice(2).join(" ") || "Sem motivo";

    if (!userId) return;

    pendingBans.push({ userId, reason });
    message.reply("Ban enviado para o Roblox.");
});

app.get('/', (req, res) => {
    res.send("API online.");
});

app.get('/pending-bans', (req, res) => {
    if (req.headers["x-api-key"] !== API_KEY) {
        return res.status(403).json({ error: "Acesso negado" });
    }

    res.json(pendingBans);
    pendingBans = [];
});

app.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 Servidor rodando na porta ${PORT}`);
});

client.login(DISCORD_TOKEN).catch(console.error);