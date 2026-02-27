const robloxService = require('../services/robloxService');

/**
 * Handler do comando /funcao
 * @param {import('discord.js').ChatInputCommandInteraction} interaction
 * @param {import('../../database/CeobDatabase')} ceobDb
 */
async function handleFuncao(interaction, ceobDb) {
    try {
        await interaction.deferReply();

        const executorDiscordId = interaction.user.id;
        const executorMilitar = await ceobDb.militares.getByDiscord(executorDiscordId);

        if (!executorMilitar) {
            return interaction.editReply('❌ Você não possui cadastro no sistema ou está inativo.');
        }

        const isComandoSupremo = await ceobDb.permissoes.isComandoSupremo(executorMilitar.id);

        const subcommand = interaction.options.getSubcommand();

        if (subcommand === 'criar') {
            const nomeStr = interaction.options.getString('nome');
            const omSigla = interaction.options.getString('om').toUpperCase();
            const descricaoStr = interaction.options.getString('descricao') || null;

            const om = await ceobDb.organizacoes.getBySigla(omSigla);
            if (!om) return interaction.editReply(`❌ OM \`${omSigla}\` não encontrada.`);

            const executorFuncoes = await ceobDb.funcoes.getDoMilitar(executorMilitar.id);
            const isComandanteDaOM = executorFuncoes.some(f => f.om_id === om.id && f.funcao_nome.toLowerCase().includes('comandante'));

            if (!isComandoSupremo && !isComandanteDaOM) {
                return interaction.editReply(`❌ Apenas o Comando Supremo ou o Comandante da OM podem criar funções.`);
            }

            try {
                await ceobDb.funcoes.criar(nomeStr, descricaoStr, om.id);
                return interaction.editReply(`✅ Função **${nomeStr}** criada com sucesso para a OM **${om.sigla}**.`);
            } catch (err) {
                if (err.code === '23505') { // unique violation code in Postgres
                    return interaction.editReply(`❌ A função **${nomeStr}** já existe na OM **${om.sigla}**.`);
                }
                throw err;
            }

        } else if (subcommand === 'deletar') {
            const nomeFuncao = interaction.options.getString('nome_funcao');
            const omSigla = interaction.options.getString('om').toUpperCase();

            const om = await ceobDb.organizacoes.getBySigla(omSigla);
            if (!om) return interaction.editReply(`❌ OM \`${omSigla}\` não encontrada.`);

            const executorFuncoes = await ceobDb.funcoes.getDoMilitar(executorMilitar.id);
            const isComandanteDaOM = executorFuncoes.some(f => f.om_id === om.id && f.funcao_nome.toLowerCase().includes('comandante'));

            if (!isComandoSupremo && !isComandanteDaOM) {
                return interaction.editReply(`❌ Apenas o Comando Supremo ou o Comandante da OM podem deletar funções.`);
            }

            const funcoesOm = await ceobDb.funcoes.getByOm(om.id);
            const funcao = funcoesOm.find(f => f.nome.toLowerCase() === nomeFuncao.toLowerCase());

            if (!funcao) {
                return interaction.editReply(`❌ Função **${nomeFuncao}** não encontrada na OM **${omSigla}**.`);
            }

            await ceobDb.funcoes.desativar(funcao.id);
            return interaction.editReply(`✅ Função **${funcao.nome}** deletada/desativada com sucesso da OM **${om.sigla}**.`);

        } else if (subcommand === 'nomear') {
            const alvoInput = interaction.options.getString('militar_identificador').trim();
            const omSigla = interaction.options.getString('om').toUpperCase();
            const nomeFuncao = interaction.options.getString('nome_funcao');

            const om = await ceobDb.organizacoes.getBySigla(omSigla);
            if (!om) return interaction.editReply(`❌ OM \`${omSigla}\` não encontrada.`);

            const funcoesOm = await ceobDb.funcoes.getByOm(om.id);
            const funcao = funcoesOm.find(f => f.nome.toLowerCase() === nomeFuncao.toLowerCase());

            if (!funcao) {
                return interaction.editReply(`❌ Função **${nomeFuncao}** não encontrada na OM **${omSigla}**.`);
            }

            const executorFuncoes = await ceobDb.funcoes.getDoMilitar(executorMilitar.id);
            const isComandanteDaOM = executorFuncoes.some(f => f.om_id === om.id && f.funcao_nome.toLowerCase().includes('comandante'));
            const isNomeandoComandante = funcao.nome.toLowerCase().includes('comandante');

            if (isNomeandoComandante) {
                if (!isComandoSupremo) return interaction.editReply(`❌ O cargo de Comandante só pode ser nomeado por membros do Comando Supremo.`);
            } else {
                if (!isComandoSupremo && !isComandanteDaOM) return interaction.editReply(`❌ Apenas o Comando Supremo ou o Comandante da OM podem nomear membros para esta função.`);
            }

            // Resolver alvo
            const discordIdMatch = alvoInput.match(/<@!?(\d+)>/) || alvoInput.match(/^(\d{17,19})$/);
            let alvoMilitar = null;

            if (discordIdMatch) {
                alvoMilitar = await ceobDb.militares.getByDiscord(discordIdMatch[1]);
            } else {
                const { userId } = await robloxService.resolverUsuario(alvoInput);
                alvoMilitar = await ceobDb.militares.getByRoblox(userId);
            }

            if (!alvoMilitar) {
                return interaction.editReply('❌ Militar não encontrado ou se encontra inativo no sistema.');
            }

            try {
                // Tenta atribuir
                await ceobDb.funcoes.atribuir(alvoMilitar.id, funcao.id, om.id);

                // Registrar Timeline
                await ceobDb.timeline.registrarEvento({
                    militarId: alvoMilitar.id,
                    tipoEvento: 'NOMEACAO_FUNCAO',
                    descricao: `Nomeado para a função de ${funcao.nome} na OM ${om.sigla}.`,
                    executadoPorId: executorMilitar.id,
                    omContextoId: om.id
                });

                return interaction.editReply(`✅ O militar **${alvoMilitar.nome_guerra}** foi nomeado como **${funcao.nome}** na OM **${om.sigla}**.`);
            } catch (err) {
                if (err.code === '23505') { // unique violation in Postgres for militar_funcoes active
                    return interaction.editReply(`❌ O militar já exerce a função **${funcao.nome}** na OM **${om.sigla}** atualmente.`);
                }
                throw err;
            }

        } else if (subcommand === 'exonerar') {
            const alvoInput = interaction.options.getString('militar_identificador').trim();
            const omSigla = interaction.options.getString('om').toUpperCase();
            const nomeFuncao = interaction.options.getString('nome_funcao');

            const om = await ceobDb.organizacoes.getBySigla(omSigla);
            if (!om) return interaction.editReply(`❌ OM \`${omSigla}\` não encontrada.`);

            const funcoesOm = await ceobDb.funcoes.getByOm(om.id);
            const funcao = funcoesOm.find(f => f.nome.toLowerCase() === nomeFuncao.toLowerCase());

            if (!funcao) {
                return interaction.editReply(`❌ Função **${nomeFuncao}** não encontrada na OM **${omSigla}**.`);
            }

            const executorFuncoes = await ceobDb.funcoes.getDoMilitar(executorMilitar.id);
            const isComandanteDaOM = executorFuncoes.some(f => f.om_id === om.id && f.funcao_nome.toLowerCase().includes('comandante'));
            const isExonerandoComandante = funcao.nome.toLowerCase().includes('comandante');

            if (isExonerandoComandante) {
                if (!isComandoSupremo) return interaction.editReply(`❌ O cargo de Comandante só pode ser retirado por membros do Comando Supremo.`);
            } else {
                if (!isComandoSupremo && !isComandanteDaOM) return interaction.editReply(`❌ Apenas o Comando Supremo ou o Comandante da OM podem exonerar membros desta função.`);
            }

            // Resolver alvo
            const discordIdMatch = alvoInput.match(/<@!?(\d+)>/) || alvoInput.match(/^(\d{17,19})$/);
            let alvoMilitar = null;

            if (discordIdMatch) {
                alvoMilitar = await ceobDb.militares.getByDiscord(discordIdMatch[1]);
            } else {
                const { userId } = await robloxService.resolverUsuario(alvoInput);
                alvoMilitar = await ceobDb.militares.getByRoblox(userId);
            }

            if (!alvoMilitar) {
                return interaction.editReply('❌ Militar não encontrado ou se encontra inativo no sistema.');
            }

            // Achar vínculo
            const funcoesAtuais = await ceobDb.funcoes.getDoMilitar(alvoMilitar.id);
            const vinculo = funcoesAtuais.find(f => f.funcao_id === funcao.id && f.om_id === om.id);

            if (!vinculo) {
                return interaction.editReply(`❌ O militar não exerce a função **${funcao.nome}** na OM **${om.sigla}** atualmente.`);
            }

            await ceobDb.funcoes.remover(vinculo.id);

            // Registrar Timeline
            await ceobDb.timeline.registrarEvento({
                militarId: alvoMilitar.id,
                tipoEvento: 'EXONERACAO_FUNCAO',
                descricao: `Exonerado da função de ${funcao.nome} na OM ${om.sigla}.`,
                executadoPorId: executorMilitar.id,
                omContextoId: om.id
            });

            return interaction.editReply(`✅ O militar **${alvoMilitar.nome_guerra}** foi exonerado da função **${funcao.nome}** na OM **${om.sigla}**.`);
        }

    } catch (error) {
        console.error('Erro no comando funcao:', error);
        const msg = error.name === 'RobloxError' ? `❌ **Erro no Roblox:** ${error.message}` : '❌ Ocorreu um erro interno ao gerenciar as funções.';
        try {
            if (interaction.deferred || interaction.replied) {
                await interaction.editReply(msg);
            } else {
                await interaction.reply({ content: msg, ephemeral: true });
            }
        } catch (replyErr) {
            console.error('Falha ao enviar reposta de erro:', replyErr);
        }
    }
}

module.exports = handleFuncao;
