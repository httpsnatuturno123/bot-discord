/**
 * Handler do comando /criar_om
 * @param {import('discord.js').ChatInputCommandInteraction} interaction
 * @param {import('../../database/CeobDatabase')} ceobDb
 */
async function handleCriarOM(interaction, ceobDb) {
    try {
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
            return interaction.editReply('❌ **Permissão Negada**: Apenas membros do Comando Supremo podem criar novas Organizações Militares.');
        }

        // 3. Obtém os parâmetros do comando
        const nome = interaction.options.getString('nome');
        const sigla = interaction.options.getString('sigla').toUpperCase();
        const tipo = interaction.options.getString('tipo');
        const parentSigla = interaction.options.getString('parent_sigla')?.toUpperCase();
        const efetivoMaximo = interaction.options.getInteger('efetivo_maximo');
        const descricao = interaction.options.getString('descricao');

        let parentId = null;

        // 4. Se tiver uma OM superior (parent_sigla), busca o ID dela
        if (parentSigla) {
            const resultParent = await ceobDb.query(
                `SELECT id FROM ceob.organizacoes_militares WHERE sigla = $1`,
                [parentSigla]
            );

            if (resultParent.rows.length === 0) {
                return interaction.editReply(`❌ A OM superior informada (\`${parentSigla}\`) não foi encontrada no banco de dados.`);
            }

            parentId = resultParent.rows[0].id;
        }

        // 5. Verifica se a OM com essa sigla já existe
        const resultCheck = await ceobDb.query(
            `SELECT id FROM ceob.organizacoes_militares WHERE sigla = $1`,
            [sigla]
        );

        if (resultCheck.rows.length > 0) {
            return interaction.editReply(`❌ Já existe uma OM com a sigla \`${sigla}\` no sistema.`);
        }

        // 6. Insere a nova OM no banco de dados
        const resultInsert = await ceobDb.query(
            `INSERT INTO ceob.organizacoes_militares 
            (nome, sigla, tipo, parent_id, efetivo_maximo, descricao)
            VALUES ($1, $2, $3, $4, $5, $6)
            RETURNING id, nome, sigla, tipo`,
            [nome, sigla, tipo, parentId, efetivoMaximo, descricao]
        );

        const novaOM = resultInsert.rows[0];

        // 7. Retorna a confirmação
        let mensagemSucesso = `✅ **Organização Militar Criada com Sucesso!**\n\n`;
        mensagemSucesso += `**Nome:** ${novaOM.nome}\n`;
        mensagemSucesso += `**Sigla:** ${novaOM.sigla}\n`;
        mensagemSucesso += `**Tipo:** ${novaOM.tipo}\n`;
        if (parentSigla) mensagemSucesso += `**Subordinada a:** ${parentSigla}\n`;
        if (efetivoMaximo) mensagemSucesso += `**Efetivo Máximo:** ${efetivoMaximo}\n`;
        if (descricao) mensagemSucesso += `**Descrição:** ${descricao}\n`;

        return interaction.editReply(mensagemSucesso);

    } catch (error) {
        console.error(`[handleCriarOM] Erro ao criar a OM:`, error);
        try {
            if (interaction.deferred || interaction.replied) {
                await interaction.editReply('❌ **Erro interno**: Ocorreu um problema ao tentar criar a OM no banco de dados.');
            } else {
                await interaction.reply({ content: '❌ **Erro interno**: Ocorreu um problema ao tentar criar a OM.', ephemeral: true });
            }
        } catch (replyErr) {
            console.error('Falha ao enviar resposta de erro:', replyErr);
        }
    }
}

module.exports = handleCriarOM;
