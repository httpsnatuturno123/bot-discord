require('dotenv').config();

const { Client, GatewayIntentBits } = require('discord.js');
const express = require('express');
const mysql = require('mysql2/promise');

const app = express();
app.use(express.json());

// =============================
// CONFIGURAÇÕES
// =============================
const PORT = process.env.PORT || 3000;
const DISCORD_TOKEN = process.env.DISCORD_TOKEN;
const API_KEY = process.env.API_KEY;
const DATABASE_URL = process.env.DATABASE_URL_TEST || process.env.DATABASE_URL; // Usa a URL de teste se estiver definida

if (!DISCORD_TOKEN || !API_KEY || !DATABASE_URL) {
    console.error("❌ Faltam variáveis de ambiente. Verifica o teu ficheiro .env.");
    process.exit(1);
}

// =============================
// LIGAÇÃO AO BANCO DE DADOS (MySQL)
// =============================
// Criamos um 'pool' de conexões. O Railway vai gerir as ligações através deste URL.
const pool = mysql.createPool(DATABASE_URL);

// Função para garantir que a tabela existe logo ao iniciar o bot
async function initDB() {
    try {
        await pool.query(`
            CREATE TABLE IF NOT EXISTS pending_bans (
                id INT AUTO_INCREMENT PRIMARY KEY,
                user_id VARCHAR(255) NOT NULL,
                reason TEXT
            );
        `);
        console.log("✅ Tabela 'pending_bans' verificada/criada com sucesso no MySQL do Railway.");
    } catch (error) {
        console.error("❌ Erro ao tentar criar a tabela no banco de dados:", error);
    }
}
// Executa a função assim que o código arranca
initDB();

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

client.once('clientReady', () => {
    console.log(`✅ Bot autenticado como ${client.user.tag}`);
});

client.on('messageCreate', async (message) => {
    try {
        if (message.author.bot) return;
        if (!message.content.startsWith('!ban')) return;

        const args = message.content.trim().split(/\s+/);
        const userId = args[1];
        const reason = args.slice(2).join(" ") || "Sem motivo especificado";

        if (!userId || isNaN(userId)) {
            return message.reply("⚠️ Por favor, indica um UserId válido (apenas números).");
        }

        // Guarda o banimento diretamente no MySQL do Railway
        await pool.query(
            'INSERT INTO pending_bans (user_id, reason) VALUES (?, ?)',
            [userId, reason]
        );

        console.log(`📌 Novo ban registado no banco de dados: ${userId}`);
        message.reply(`🚫 UserId ${userId} guardado no banco de dados. O servidor do Roblox fará a leitura em breve.`);
        
    } catch (err) {
        console.error("Erro ao executar o comando !ban:", err);
        message.reply("❌ Ocorreu um erro interno ao tentar registar o banimento.");
    }
});

client.login(DISCORD_TOKEN).catch(err => {
    console.error("❌ Falha ao iniciar sessão no Discord:", err);
});

// =============================
// ENDPOINTS DA API (Para o Roblox)
// =============================

// Rota de teste
app.get('/', (req, res) => {
    res.status(200).send("API online e ligada ao MySQL.");
});

// O teu script em Luau no Roblox vai fazer um GET a esta rota
app.get('/pending-bans', async (req, res) => {
    try {
        if (req.headers["x-api-key"] !== API_KEY) {
            console.log("❌ Tentativa de acesso com API_KEY inválida.");
            return res.status(403).json({ error: "Acesso negado" });
        }

        // 1. Vai buscar todos os banimentos pendentes ao banco de dados
        const [rows] = await pool.query('SELECT * FROM pending_bans');
        console.log(`📤 O Roblox solicitou a lista. A enviar ${rows.length} registos pendentes.`);
        
        // Envia a resposta para o jogo
        res.json(rows);

        // 2. Se enviou dados com sucesso, limpa a tabela para não banir em duplicado na próxima verificação
        if (rows.length > 0) {
            await pool.query('TRUNCATE TABLE pending_bans');
        }

    } catch (err) {
        console.error("Erro no endpoint /pending-bans:", err);
        res.status(500).json({ error: "Erro interno do servidor" });
    }
});

app.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 Servidor Express a correr na porta ${PORT}`);
});