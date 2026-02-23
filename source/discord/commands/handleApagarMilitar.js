/**
 * Handler do comando /apagar_militar
 * @param {import('discord.js').ChatInputCommandInteraction} interaction
 * @param {import('../../database/CeobDatabase')} ceobDb
 */
async function handleApagarMilitar(interaction, ceobDb) {
    await interaction.deferReply({ ephemeral: true });

    // 1. Identifica e valida o executor do comando
    const executorDiscordId = interaction.user.id;
    const executorMilitar = await ceobDb.militares.getByDiscord(executorDiscordId);

    if (!executorMilitar) {
        return interaction.editReply('❌ Você não possui cadastro no sistema.');
    }

    // 2. Validação da Permissão (Comando Supremo)
    const isSupremo = await ceobDb.permissoes.isComandoSupremo(executorMilitar.id);

    if (!isSupremo) {
        return interaction.editReply('❌ **Permissão Negada**: Apenas membros do Comando Supremo podem apagar militares definitivamente.');
    }

    // 3. Obtém o Alvo
    const robloxId = interaction.options.getString('roblox_id');
    const discordUser = interaction.options.getUser('discord_user');

    if (!robloxId && !discordUser) {
        return interaction.editReply('⚠️ Você precisa fornecer o **Roblox ID** ou o **Usuário do Discord** do militar que deseja apagar.');
    }

    let militarAlvo = null;

    if (robloxId) {
        if (isNaN(robloxId)) return interaction.editReply('⚠️ O campo **Roblox ID** deve conter apenas números.');
        console.log(`[DEBUG apagar_militar] Buscando por Roblox ID: "${robloxId}" (tipo: ${typeof robloxId})`);
        militarAlvo = await ceobDb.militares.getByRobloxAny(robloxId);
        console.log(`[DEBUG apagar_militar] Resultado da busca:`, militarAlvo);
    } else if (discordUser) {
        console.log(`[DEBUG apagar_militar] Buscando por Discord ID: "${discordUser.id}" (tipo: ${typeof discordUser.id})`);
        militarAlvo = await ceobDb.militares.getByDiscordAny(discordUser.id);
        console.log(`[DEBUG apagar_militar] Resultado da busca:`, militarAlvo);
    }

    if (!militarAlvo) {
        return interaction.editReply(`❌ Militar não encontrado no sistema. Verifique os dados e tente novamente.`);
    }

    // 4. Executa a deleção em Cascata Segura
    try {
        await ceobDb.militares.apagarDefinitivamente(militarAlvo.id);

        return interaction.editReply(`✅ **Lixeira Administrativa:** O militar **${militarAlvo.nome_guerra}** (Mat. ${militarAlvo.matricula}) e todos os seus rastros foram fisicamente apagados do banco de dados com sucesso.`);
    } catch (error) {
        console.error(`Erro ao apagar definitivamente o militar ${militarAlvo.id}:`, error.message);
        console.error(`Detalhe PG:`, error.detail, `| Constraint:`, error.constraint, `| Tabela:`, error.table);
        // ...
    }
}

module.exports = handleApagarMilitar;
