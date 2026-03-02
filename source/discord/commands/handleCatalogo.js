const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');

/**
 * Handler central do comando /catalogo
 * @param {import('discord.js').ChatInputCommandInteraction} interaction
 * @param {import('../../database/CeobDatabase')} ceobDb
 */
async function handleCatalogo(interaction, ceobDb) {
    const subcommand = interaction.options.getSubcommand();

    if (subcommand === 'criar') {
        return handleCatalogoCriar(interaction, ceobDb);
    }

    if (subcommand === 'listar') {
        const mostrarArquivados = interaction.options.getBoolean('mostrar_arquivados') || false;
        return handleCatalogoListar(interaction, ceobDb, mostrarArquivados, 1);
    }

    if (subcommand === 'arquivar') {
        return handleCatalogoArquivar(interaction, ceobDb);
    }

    if (subcommand === 'reativar') {
        return handleCatalogoReativar(interaction, ceobDb);
    }
}

/**
 * Lógica do subcomando: /catalogo listar
 */
async function handleCatalogoListar(interaction, ceobDb, mostrarArquivados, page = 1) {
    try {
        const isUpdate = interaction.isButton();
        if (!isUpdate) {
            await interaction.deferReply({ ephemeral: false });
        }

        // 1. Identifica o executor
        const executorDiscordId = interaction.user.id;
        const executorMilitar = await ceobDb.militares.getByDiscord(executorDiscordId);

        if (!executorMilitar) {
            const msg = '❌ Você não possui cadastro no sistema.';
            return isUpdate ? interaction.update({ content: msg, embeds: [], components: [] }) : interaction.editReply(msg);
        }

        // 2. Busca cursos no catálogo
        const cursos = await ceobDb.catalogoCursos.listar(!mostrarArquivados);

        if (cursos.length === 0) {
            const msg = '📚 Nenhum curso encontrado no catálogo.';
            return isUpdate ? interaction.update({ content: msg, embeds: [], components: [] }) : interaction.editReply(msg);
        }

        // 3. Paginação (10 por página)
        const itemsPerPage = 10;
        const totalPages = Math.ceil(cursos.length / itemsPerPage);
        const currentPage = Math.max(1, Math.min(page, totalPages));

        const start = (currentPage - 1) * itemsPerPage;
        const end = start + itemsPerPage;
        const cursosPagina = cursos.slice(start, end);

        // 4. Constrói o Embed
        const embed = new EmbedBuilder()
            .setTitle(`📚 Catálogo de Cursos Institucionais${mostrarArquivados ? ' (Completo)' : ' (Ativos)'}`)
            .setColor(mostrarArquivados ? 0x606c38 : 0x283618)
            .setFooter({ text: `Página ${currentPage} de ${totalPages} • Total: ${cursos.length} cursos` })
            .setTimestamp();

        let descricao = '';
        cursosPagina.forEach(curso => {
            const statusIcon = curso.ativo ? '🟢' : '🔴';
            descricao += `**${statusIcon} [${curso.sigla}] ${curso.nome}**\n`;
            descricao += `└ Turmas realizadas: \`${curso.total_turmas}\`\n\n`;
        });
        embed.setDescription(descricao || '_Sem cursos nesta página._');

        // 5. Botões de Navegação
        const components = [];
        if (totalPages > 1) {
            const row = new ActionRowBuilder();

            row.addComponents(
                new ButtonBuilder()
                    .setCustomId(`catalogo_listar_page_${mostrarArquivados}_${currentPage - 1}`)
                    .setLabel('⬅️ Anterior')
                    .setStyle(ButtonStyle.Secondary)
                    .setDisabled(currentPage === 1),
                new ButtonBuilder()
                    .setCustomId(`catalogo_listar_page_${mostrarArquivados}_${currentPage + 1}`)
                    .setLabel('Próximo ➡️')
                    .setStyle(ButtonStyle.Secondary)
                    .setDisabled(currentPage === totalPages)
            );

            components.push(row);
        }

        const payload = { embeds: [embed], components };
        if (isUpdate) {
            await interaction.update(payload);
        } else {
            await interaction.editReply(payload);
        }

    } catch (error) {
        console.error(`[handleCatalogoListar] Erro:`, error);
        const msg = '❌ Erro ao listar cursos.';
        if (interaction.deferred || interaction.replied) {
            await (interaction.isButton() ? interaction.followUp : interaction.editReply)({ content: msg, ephemeral: true });
        } else {
            await interaction.reply({ content: msg, ephemeral: true });
        }
    }
}

/**
 * Lógica do subcomando: /catalogo criar
 */
async function handleCatalogoCriar(interaction, ceobDb) {
    try {
        await interaction.deferReply({ ephemeral: false });

        // 1. Identifica o executor
        const executorDiscordId = interaction.user.id;
        const executorMilitar = await ceobDb.militares.getByDiscord(executorDiscordId);

        if (!executorMilitar) {
            return interaction.editReply('❌ Você não possui cadastro no sistema.');
        }

        // 2. Valida Permissões (DGP ou Comando Supremo)
        const pertenceDGP = await ceobDb.permissoes.pertenceAoOrgao(executorMilitar.id, 'DGP');
        const isSupremo = await ceobDb.permissoes.isComandoSupremo(executorMilitar.id);

        if (!pertenceDGP && !isSupremo) {
            return interaction.editReply('❌ **Permissão Negada**: Apenas membros da DGP ou Comando Supremo podem gerenciar o catálogo de cursos.');
        }

        // 3. Obtém os parâmetros
        const nomeArg = interaction.options.getString('nome');
        const siglaArg = interaction.options.getString('sigla');

        const nome = nomeArg.trim();
        const sigla = siglaArg.trim().toUpperCase();

        // 4. Verifica se a sigla já existe
        const cursoExistente = await ceobDb.catalogoCursos.getBySigla(sigla);

        if (cursoExistente) {
            if (cursoExistente.ativo) {
                return interaction.editReply(`❌ O curso **${cursoExistente.nome}** (\`${cursoExistente.sigla}\`) já existe e está **ativo** no catálogo.`);
            } else {
                return interaction.editReply(`❌ Já existe um curso **arquivado** com a sigla \`${sigla}\` (${cursoExistente.nome}). Utilize um comando de reativação (ex: \`/catalogo reativar\`) para restaurá-lo, ou escolha outra sigla.`);
            }
        }

        // 5. Cria o curso no banco
        const novoCurso = await ceobDb.catalogoCursos.criar({ nome, sigla });

        // 6. Confirma a criação
        let msgSucesso = `✅ **Curso Adicionado ao Catálogo!**\n\n`;
        msgSucesso += `**Nome:** ${novoCurso.nome}\n`;
        msgSucesso += `**Sigla:** ${novoCurso.sigla}\n`;

        return interaction.editReply(msgSucesso);

    } catch (error) {
        console.error(`[handleCatalogoCriar] Erro:`, error);
        if (interaction.deferred || interaction.replied) {
            await interaction.editReply('❌ Ocorreu um erro interno ao tentar registrar o curso no catálogo.');
        } else {
            await interaction.reply({ content: '❌ Erro interno.', ephemeral: true });
        }
    }
}

/**
 * Lógica do subcomando: /catalogo arquivar
 */
async function handleCatalogoArquivar(interaction, ceobDb) {
    try {
        await interaction.deferReply({ ephemeral: false });

        // 1. Identifica o executor
        const executorDiscordId = interaction.user.id;
        const executorMilitar = await ceobDb.militares.getByDiscord(executorDiscordId);

        if (!executorMilitar) {
            return interaction.editReply('❌ Você não possui cadastro no sistema.');
        }

        // 2. Valida Permissões (DGP ou Comando Supremo)
        const pertenceDGP = await ceobDb.permissoes.pertenceAoOrgao(executorMilitar.id, 'DGP');
        const isSupremo = await ceobDb.permissoes.isComandoSupremo(executorMilitar.id);

        if (!pertenceDGP && !isSupremo) {
            return interaction.editReply('❌ **Permissão Negada**: Apenas membros da DGP ou Comando Supremo podem gerenciar o catálogo de cursos.');
        }

        // 3. Obtém o parâmetro sigla
        const siglaInput = interaction.options.getString('sigla');
        const sigla = siglaInput.trim().toUpperCase();

        // 4. Busca o curso
        const curso = await ceobDb.catalogoCursos.getBySigla(sigla);

        if (!curso) {
            return interaction.editReply(`❌ Curso com sigla \`${sigla}\` não encontrado.`);
        }

        if (!curso.ativo) {
            return interaction.editReply(`⚠️ O curso **${curso.nome}** (\`${curso.sigla}\`) já está **arquivado**.`);
        }

        // 5. Verifica turmas ativas (PLANEJADO ou EM_ANDAMENTO)
        const temAtivas = await ceobDb.catalogoCursos.temTurmasAtivas(curso.id);

        if (temAtivas) {
            return interaction.editReply(`❌ **Não é possível arquivar**: O curso **${curso.nome}** possui turmas em aberto (Planejadas ou Em Andamento). Encerre todas as turmas antes de arquivar o curso.`);
        }

        // 6. Executa o arquivamento
        const cursoArquivado = await ceobDb.catalogoCursos.arquivar(curso.id);

        if (!cursoArquivado) {
            return interaction.editReply('❌ Falha ao tentar arquivar o curso.');
        }

        // 7. Confirmação
        return interaction.editReply(`✅ **Curso Arquivado com Sucesso!**\n\nO curso **${cursoArquivado.nome}** (\`${cursoArquivado.sigla}\`) foi desativado e não poderá mais receber novas turmas.`);

    } catch (error) {
        console.error(`[handleCatalogoArquivar] Erro:`, error);
        if (interaction.deferred || interaction.replied) {
            await interaction.editReply('❌ Ocorreu um erro interno ao tentar arquivar o curso.');
        } else {
            await interaction.reply({ content: '❌ Erro interno.', ephemeral: true });
        }
    }
}

/**
 * Lógica do subcomando: /catalogo reativar
 */
async function handleCatalogoReativar(interaction, ceobDb) {
    try {
        await interaction.deferReply({ ephemeral: false });

        // 1. Identifica o executor
        const executorDiscordId = interaction.user.id;
        const executorMilitar = await ceobDb.militares.getByDiscord(executorDiscordId);

        if (!executorMilitar) {
            return interaction.editReply('❌ Você não possui cadastro no sistema.');
        }

        // 2. Valida Permissões (DGP ou Comando Supremo)
        const pertenceDGP = await ceobDb.permissoes.pertenceAoOrgao(executorMilitar.id, 'DGP');
        const isSupremo = await ceobDb.permissoes.isComandoSupremo(executorMilitar.id);

        if (!pertenceDGP && !isSupremo) {
            return interaction.editReply('❌ **Permissão Negada**: Apenas membros da DGP ou Comando Supremo podem gerenciar o catálogo de cursos.');
        }

        // 3. Obtém o parâmetro sigla
        const siglaInput = interaction.options.getString('sigla');
        const sigla = siglaInput.trim().toUpperCase();

        // 4. Busca o curso (mesmo arquivado)
        const curso = await ceobDb.catalogoCursos.getBySigla(sigla);

        if (!curso) {
            return interaction.editReply(`❌ Curso com sigla \`${sigla}\` não encontrado no banco de dados.`);
        }

        if (curso.ativo) {
            return interaction.editReply(`⚠️ O curso **${curso.nome}** (\`${curso.sigla}\`) já está **ativo** no catálogo.`);
        }

        // 5. Executa a reativação
        const cursoReativado = await ceobDb.catalogoCursos.reativar(curso.id);

        if (!cursoReativado) {
            return interaction.editReply('❌ Falha ao tentar reativar o curso.');
        }

        // 6. Confirmação
        return interaction.editReply(`✅ **Curso Reativado com Sucesso!**\n\nO curso **${cursoReativado.nome}** (\`${cursoReativado.sigla}\`) foi restaurado ao catálogo e pode voltar a receber novas turmas.`);

    } catch (error) {
        console.error(`[handleCatalogoReativar] Erro:`, error);
        if (interaction.deferred || interaction.replied) {
            await interaction.editReply('❌ Ocorreu um erro interno ao tentar reativar o curso.');
        } else {
            await interaction.reply({ content: '❌ Erro interno.', ephemeral: true });
        }
    }
}

/**
 * Handler de Autocomplete para o comando /catalogo
 */
async function handleCatalogoAutocomplete(interaction, ceobDb) {
    try {
        const focusedValue = (interaction.options.getFocused() || '').toString().toUpperCase();
        const subcommand = interaction.options.getSubcommand();

        console.log(`[Autocomplete catalogo] sub=${subcommand} valor="${focusedValue}"`);

        // Busca todos os cursos, pois listar(true) traz só os ativos.
        // O método listar() retorna apenas ativos se true (padrão), 
        // mas se false, retorna todos.
        const todosCursos = await ceobDb.catalogoCursos.listar(false);

        // Define se buscamos cursos ativos (para arquivar) ou inativos (para reativar)
        const querAtivos = (subcommand === 'arquivar');

        const cursosFiltradosPeloStatus = todosCursos.filter(c => c.ativo === querAtivos);

        const filtered = cursosFiltradosPeloStatus
            .filter(c => {
                const sigla = (c.sigla || '').toUpperCase();
                const nome = (c.nome || '').toUpperCase();
                return sigla.includes(focusedValue) || nome.includes(focusedValue);
            })
            .slice(0, 25); // Limite do Discord

        await interaction.respond(
            filtered.map(c => ({ name: `[${c.sigla}] ${c.nome}`.substring(0, 100), value: c.sigla }))
        );

    } catch (error) {
        console.error(`[handleCatalogoAutocomplete] Erro:`, error);
        await interaction.respond([]).catch(() => { });
    }
}

module.exports = { handleCatalogo, handleCatalogoListar, handleCatalogoAutocomplete };
