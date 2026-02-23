/**
 * Handler do comando /deletar_om
 * @param {import('discord.js').ChatInputCommandInteraction} interaction
 * @param {import('../../database/CeobDatabase')} ceobDb
 */
async function handleDeletarOM(interaction, ceobDb) {
    await interaction.deferReply({ ephemeral: false });

    // 1. Identifica e valida o executor do comando
    const executorDiscordId = interaction.user.id;
    const executorMilitar = await ceobDb.militares.getByDiscord(executorDiscordId);

    if (!executorMilitar) {
        return interaction.editReply('❌ Você não possui cadastro no sistema.');
    }

    // 2. Validação da Permissão (Comando Supremo)
    const isSupremo = await ceobDb.permissoes.isComandoSupremo(executorMilitar.id);

    if (!isSupremo) {
        return interaction.editReply('❌ **Permissão Negada**: Apenas membros do Comando Supremo podem deletar Organizações Militares.');
    }

    // 3. Obtém a sigla da OM a ser deletada
    const sigla = interaction.options.getString('sigla').toUpperCase();

    try {
        // 4. Busca a OM pelo campo sigla
        const resultOM = await ceobDb.query(
            `SELECT id, nome, sigla FROM ceob.organizacoes_militares WHERE sigla = $1 AND ativo = true`,
            [sigla]
        );

        if (resultOM.rows.length === 0) {
            return interaction.editReply(`❌ Nenhuma OM ativa com a sigla \`${sigla}\` foi encontrada.`);
        }

        const om = resultOM.rows[0];

        // 5. Verifica se existem militares ativos lotados nesta OM
        const resultMilitares = await ceobDb.query(
            `SELECT COUNT(*) AS total FROM ceob.militares WHERE om_lotacao_id = $1 AND ativo = true`,
            [om.id]
        );

        const totalMilitares = parseInt(resultMilitares.rows[0].total, 10);
        if (totalMilitares > 0) {
            return interaction.editReply(
                `❌ **Não é possível deletar a OM \`${om.sigla}\`**: Existem **${totalMilitares}** militar(es) ativo(s) lotado(s) nela.\n` +
                `Transfira ou remova os militares antes de deletar a OM.`
            );
        }

        // 6. Verifica se existem OMs subordinadas ativas
        const resultFilhas = await ceobDb.query(
            `SELECT COUNT(*) AS total FROM ceob.organizacoes_militares WHERE parent_id = $1 AND ativo = true`,
            [om.id]
        );

        const totalFilhas = parseInt(resultFilhas.rows[0].total, 10);
        if (totalFilhas > 0) {
            return interaction.editReply(
                `❌ **Não é possível deletar a OM \`${om.sigla}\`**: Existem **${totalFilhas}** OM(s) subordinada(s) ativa(s).\n` +
                `Delete ou transfira as OMs subordinadas antes de deletar esta OM.`
            );
        }

        // 7. Soft delete — desativa a OM
        await ceobDb.query(
            `UPDATE ceob.organizacoes_militares SET ativo = false WHERE id = $1`,
            [om.id]
        );

        // 8. Retorna a confirmação
        let mensagem = `✅ **Organização Militar Deletada com Sucesso!**\n\n`;
        mensagem += `**Nome:** ${om.nome}\n`;
        mensagem += `**Sigla:** ${om.sigla}\n`;
        mensagem += `\n_A OM foi desativada e não aparecerá mais nas listagens._`;

        return interaction.editReply(mensagem);

    } catch (error) {
        console.error(`[handleDeletarOM] Erro ao deletar a OM ${sigla}:`, error);
        return interaction.editReply('❌ **Erro interno**: Ocorreu um problema ao tentar deletar a OM do banco de dados.');
    }
}

module.exports = handleDeletarOM;
