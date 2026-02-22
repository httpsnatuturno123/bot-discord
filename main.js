require('dotenv').config();

const Database = require('./source/Database');
const CeobDatabase = require('./source/CeobDatabase');
const ApiServer = require('./source/ApiServer');
const DiscordBot = require('./source/DiscordBot');

// Verifica variáveis críticas
const requiredVars = ['DISCORD_TOKEN', 'API_KEY', 'DATABASE_URL'];
const missing = requiredVars.filter(v => !process.env[v]);
if (missing.length > 0) {
    console.error(`❌ Faltam variáveis de ambiente: ${missing.join(', ')}`);
    process.exit(1);
}

async function bootstrap() {
    console.log('══════════════════════════════════════════');
    console.log('  CEOB - Sistema Integrado v1.0');
    console.log('══════════════════════════════════════════\n');

    // 1. Banco Legado (MySQL) - mantido para compatibilidade
    let legacyDb = null;
    if (process.env.LEGACY_DATABASE_URL) {
        legacyDb = new Database(process.env.LEGACY_DATABASE_URL);
        await legacyDb.init();
        console.log('');
    } else {
        console.log('⚠️  Legado: LEGACY_DATABASE_URL não definida, banco legado desabilitado.\n');
    }

    // 2. Banco CEOB (PostgreSQL)
    const ceobDb = new CeobDatabase(process.env.DATABASE_URL);
    await ceobDb.init();
    console.log('');

    // 3. API Express
    const port = process.env.PORT || 3000;
    const api = new ApiServer(port, process.env.API_KEY, legacyDb);
    api.start();

    // 4. Bot do Discord (recebe ambos os bancos)
    const bot = new DiscordBot(process.env.DISCORD_TOKEN, legacyDb, ceobDb);
    bot.start();

    // Graceful shutdown
    const shutdown = async (signal) => {
        console.log(`\n🛑 ${signal} recebido. Encerrando...`);
        await ceobDb.close();
        process.exit(0);
    };
    process.on('SIGINT', () => shutdown('SIGINT'));
    process.on('SIGTERM', () => shutdown('SIGTERM'));
}

bootstrap().catch(err => {
    console.error('❌ Erro fatal na inicialização:', err);
    process.exit(1);
});
