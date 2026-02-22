require('dotenv').config();

const Database = require('./src/Database');
const ApiServer = require('./src/ApiServer');
const DiscordBot = require('./src/DiscordBot');

// Verifica variáveis críticas
if (!process.env.DISCORD_TOKEN || !process.env.API_KEY || !process.env.DATABASE_URL) {
    console.error("❌ Faltam variáveis de ambiente críticas no .env.");
    process.exit(1);
}

// Inicializa o sistema
async function bootstrap() {
    // 1. Inicia o Banco de Dados
    const db = new Database(process.env.DATABASE_URL);
    await db.init();

    // 2. Inicia a API do Express, injetando o banco de dados
    const port = process.env.PORT || 3000;
    const api = new ApiServer(port, process.env.API_KEY, db);
    api.start();

    // 3. Inicia o Bot do Discord, injetando o banco de dados
    const bot = new DiscordBot(process.env.DISCORD_TOKEN, db);
    bot.start();
}

bootstrap();