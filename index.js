require('dotenv').config();

const { Client, GatewayIntentBits } = require('discord.js');
const express = require('express');

const app = express();
app.use(express.json());

const PORT = process.env.PORT || 3000;
const DISCORD_TOKEN = process.env.DISCORD_TOKEN;
const API_KEY = process.env.API_KEY;

// 🔥 Lista de bans pendentes (Roblox vai buscar aqui)
let pendingBans = [];

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent
    ]
});

client.on('ready', () => {
    console.log(`✅ Bot logado como ${client.user.tag}`);
});

client.on('messageCreate', async (message) => {

    if (message.author.bot) return;
    if (!message.content.startsWith('!ban')) return;

    const args = message.content.split(" ");
    const userId = args[1];
    const reason = args.slice(2).join(" ") || "Sem motivo";

    if (!userId) {
        return message.reply("Informe o UserId.");
    }

    pendingBans.push({
        userId,
        reason
    });

    console.log("Ban enviado para Roblox:", userId);

    message.reply("Ban enviado para o jogo.");
});


// 🔥 ROBLOX VAI BUSCAR BANS AQUI
app.get('/pending-bans', (req, res) => {

    if (req.headers["x-api-key"] !== API_KEY) {
        return res.status(403).json({ error: "Acesso negado" });
    }

    res.json(pendingBans);

    // limpa depois de enviar
    pendingBans = [];
});

client.login(DISCORD_TOKEN);

app.listen(PORT, () => {
    console.log(`Servidor rodando na porta ${PORT}`);
});
