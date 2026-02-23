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
        militarAlvo = await ceobDb.militares.getByRoblox(robloxId);
    } else if (discordUser) {
        militarAlvo = await ceobDb.militares.getByDiscord(discordUser.id);
    }

    if (!militarAlvo) {
        return interaction.editReply(`❌ Militar não encontrado no sistema. Verifique os dados e tente novamente.`);
    }

    // 4. Executa a deleção em Cascata Segura
    try {
        await ceobDb.militares.apagarDefinitivamente(militarAlvo.id);

        return interaction.editReply(`✅ **Lixeira Administrativa:** O militar **${militarAlvo.nome_guerra}** (Mat. ${militarAlvo.matricula}) e todos os seus rastros foram fisicamente apagados do banco de dados com sucesso.`);
    } catch (error) {
        console.error(`Erro ao apagar definitivamente o militar ${militarAlvo.id}:`, error);
        return interaction.editReply('❌ Ocorreu um erro interno de restrição ao tentar apagar esse militar (Foreign Key Cascade Limit). Peça a um administrador de T.I. verificar os logs.');
    }
}

module.exports = handleApagarMilitar;
