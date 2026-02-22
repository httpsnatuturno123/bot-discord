/**
 * Handler do comando legado !ban (prefixo)
 * @param {import('discord.js').Message} message
 * @param {import('../../database/Database')} legacyDb
 */
async function handleBanLegado(message, legacyDb) {
    if (message.author.bot) return;
    if (!legacyDb) return;
    if (!message.content.startsWith('!ban')) return;

    const args = message.content.trim().split(/\s+/);
    const userId = args[1];
    const reason = args.slice(2).join(" ") || "Sem motivo especificado";

    if (!userId || isNaN(userId)) {
        return message.reply("⚠️ Informe um UserId válido (apenas números).");
    }

    try {
        await legacyDb.addBan(userId, reason);
        console.log(`📌 Discord: Ban salvo no banco: ${userId}`);
        message.reply(`🚫 UserId ${userId} salvo no banco. O Roblox fará a leitura em breve.`);
    } catch (err) {
        console.error("❌ Erro ao salvar ban via Discord:", err);
        message.reply("❌ Ocorreu um erro interno ao tentar registrar o banimento.");
    }
}

module.exports = handleBanLegado;
