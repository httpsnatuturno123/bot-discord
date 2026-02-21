require('dotenv').config();

const { Client, GatewayIntentBits } = require('discord.js');
const express = require('express');

console.log("==== DEBUG START ====");
console.log("Node version:", process.version);
console.log("DISCORD_TOKEN exists?", !!process.env.DISCORD_TOKEN);
console.log("API_KEY exists?", !!process.env.API_KEY);

if (process.env.DISCORD_TOKEN) {
    console.log("Token preview:", process.env.DISCORD_TOKEN.slice(0, 5) + "...");
}
console.log("=====================");

const app = express();

const PORT = process.env.PORT || 3000;
const DISCORD_TOKEN = process.env.DISCORD_TOKEN;
const API_KEY = process.env.API_KEY;

let banList = [];

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

client.on('error', (err) => {
    console.error("❌ Discord Client Error:", err);
});

client.on('shardError', (err) => {
    console.error("❌ Shard Error:", err);
});

client.on('messageCreate', async (message) => {

    console.log("Mensagem recebida:", message.content);

    if (message.author.bot) return;

    if (!message.content.startsWith('!ban')) return;

    const args = message.content.split(" ");
    const userId = args[1];

    if (!userId) {
        return message.reply("Informe o UserId.");
    }

    if (banList.includes(userId)) {
        return message.reply("Já está banido.");
    }

    banList.push(userId);

    console.log("Ban adicionado:", userId);

    message.reply(`UserId ${userId} adicionado à lista.`);
});

app.get('/bans', (req, res) => {

    console.log("Requisição /bans recebida");
    console.log("Authorization header:", req.headers.authorization);

    if (req.headers.authorization !== API_KEY) {
        console.log("❌ API_KEY inválida");
        return res.status(403).send("Acesso negado");
    }

    console.log("✅ API_KEY válida");
    res.json({ bans: banList });
});

(async () => {
    try {
        console.log("Tentando logar no Discord...");
        await client.login(DISCORD_TOKEN);
        console.log("Login executado.");
    } catch (err) {
        console.error("❌ ERRO AO LOGAR:", err);
    }
})();

app.listen(PORT, () => {
    console.log(`Servidor rodando na porta ${PORT}`);
});