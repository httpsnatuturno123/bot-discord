const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, StringSelectMenuBuilder } = require('discord.js');

/**
 * Handler central do comando /turma
 * @param {import('discord.js').ChatInputCommandInteraction} interaction
 * @param {import('../../database/CeobDatabase')} ceobDb
 */
async function handleTurma(interaction, ceobDb) {
    const subcommand = interaction.options.getSubcommand();

    if (subcommand === 'abrir') {
        return handleTurmaAbrir(interaction, ceobDb);
    }

    if (subcommand === 'integrar') {
        return handleTurmaIntegrar(interaction, ceobDb);
    }

    if (subcommand === 'encerrar') {
        return handleTurmaEncerrar(interaction, ceobDb);
    }

    if (subcommand === 'gerenciar') {
        return handleTurmaGerenciar(interaction, ceobDb);
    }
}

/**
 * Lógica do subcomando: /turma abrir
 */
async function handleTurmaAbrir(interaction, ceobDb) {
    try {
        await interaction.deferReply({ ephemeral: false });

        // 1. Identifica o executor
        const executorDiscordId = interaction.user.id;
        const executorMilitar = await ceobDb.militares.getByDiscord(executorDiscordId);

        if (!executorMilitar) {
            return interaction.editReply('❌ Você não possui cadastro no sistema.');
        }

        if (executorMilitar.situacao_funcional !== 'ATIVO') {
            return interaction.editReply('❌ Apenas militares em situação **ATIVA** podem abrir turmas.');
        }

        // 2. Valida Permissões (Oficial, DGP ou Comando Supremo)
        const isOficial = executorMilitar.is_oficial;
        const pertenceDGP = await ceobDb.permissoes.pertenceAoOrgao(executorMilitar.id, 'DGP');
        const isSupremo = await ceobDb.permissoes.isComandoSupremo(executorMilitar.id);

        if (!isOficial && !pertenceDGP && !isSupremo) {
            return interaction.editReply('❌ **Permissão Negada**: Apenas **Oficiais**, membros da **DGP** ou do **Comando Supremo** podem abrir turmas.');
        }

        // 3. Obtém os parâmetros
        const siglaCurso = interaction.options.getString('sigla_curso').trim().toUpperCase();
        const nomeTurma = interaction.options.getString('nome_turma').trim();
        const coordenadorUser = interaction.options.getUser('coordenador');
        const instrutorUser = interaction.options.getUser('instrutor');
        const auxiliarUser = interaction.options.getUser('auxiliar');
        const omSigla = interaction.options.getString('om');

        // 4. Busca o curso no catálogo
        const curso = await ceobDb.catalogoCursos.getBySigla(siglaCurso);

        if (!curso) {
            return interaction.editReply(`❌ Curso com sigla \`${siglaCurso}\` não encontrado no catálogo.`);
        }

        if (!curso.ativo) {
            return interaction.editReply(`❌ O curso **${curso.nome}** (\`${curso.sigla}\`) está **arquivado** e não pode receber novas turmas.`);
        }

        // 5. Verifica unicidade do nome da turma
        const turmaExistente = await ceobDb.turmas.getBySiglaETurma(siglaCurso, nomeTurma);

        if (turmaExistente) {
            return interaction.editReply(`❌ Já existe uma turma **${nomeTurma}** para o curso \`${siglaCurso}\`. Escolha outro nome.`);
        }

        // 6. Resolve os militares (coordenador, instrutor, auxiliar)
        const coordenador = await ceobDb.militares.getByDiscord(coordenadorUser.id);
        const instrutor = instrutorUser ? await ceobDb.militares.getByDiscord(instrutorUser.id) : null;
        const auxiliar = auxiliarUser ? await ceobDb.militares.getByDiscord(auxiliarUser.id) : null;

        if (!coordenador) {
            return interaction.editReply('❌ O **coordenador** mencionado não possui cadastro no sistema.');
        }
        if (instrutorUser && !instrutor) {
            return interaction.editReply('❌ O **instrutor** mencionado não possui cadastro no sistema.');
        }
        if (auxiliarUser && !auxiliar) {
            return interaction.editReply('❌ O **auxiliar** mencionado não possui cadastro no sistema.');
        }

        // 7. Resolve a OM (obrigatória)
        const omInfo = await ceobDb.organizacoes.getBySigla(omSigla.trim().toUpperCase());
        if (!omInfo) {
            return interaction.editReply(`❌ Organização Militar com sigla \`${omSigla}\` não encontrada.`);
        }
        const omId = omInfo.id;

        // 8. Cria a turma no banco
        const novaTurma = await ceobDb.turmas.criar({
            cursoId: curso.id,
            identificadorTurma: nomeTurma,
            coordenadorId: coordenador.id,
            instrutorId: instrutor ? instrutor.id : null,
            auxiliarId: auxiliar ? auxiliar.id : null,
            omId
        });

        // 9. Embed de confirmação
        const embed = new EmbedBuilder()
            .setTitle(`📋 Turma Aberta com Sucesso!`)
            .setColor(0x283618)
            .setDescription(
                `**${curso.sigla}** — Turma \"${nomeTurma}\"\n` +
                `━━━━━━━━━━━━━━━━━━━━━\n` +
                `📌 **Status:** 🟡 Planejado\n` +
                `🆔 **ID da Turma:** \`${novaTurma.id}\`\n` +
                `━━━━━━━━━━━━━━━━━━━━━\n` +
                `👨‍✈️ **Coordenador:** ${coordenador.patente_abrev} ${coordenador.nome_guerra}\n` +
                `👨‍🏫 **Instrutor:** ${instrutor ? `${instrutor.patente_abrev} ${instrutor.nome_guerra}` : '_Não Definido_'}\n` +
                `🤝 **Auxiliar:** ${auxiliar ? `${auxiliar.patente_abrev} ${auxiliar.nome_guerra}` : '_Não Definido_'}\n` +
                `🏛️ **OM:** ${omInfo.sigla}\n` +
                `━━━━━━━━━━━━━━━━━━━━━`
            )
            .setTimestamp();

        return interaction.editReply({ embeds: [embed] });

    } catch (error) {
        console.error(`[handleTurmaAbrir] Erro:`, error);
        if (interaction.deferred || interaction.replied) {
            await interaction.editReply('❌ Ocorreu um erro interno ao tentar abrir a turma.');
        } else {
            await interaction.reply({ content: '❌ Erro interno.', ephemeral: true });
        }
    }
}

/**
 * Lógica do subcomando: /turma integrar
 */
async function handleTurmaIntegrar(interaction, ceobDb) {
    try {
        await interaction.deferReply({ ephemeral: true });

        // 1. Identifica o executor
        const executorDiscordId = interaction.user.id;
        const executorMilitar = await ceobDb.militares.getByDiscord(executorDiscordId);

        if (!executorMilitar || executorMilitar.situacao_funcional !== 'ATIVO') {
            return interaction.editReply('❌ Apenas militares em situação **ATIVA** e com cadastro no sistema podem usar este comando.');
        }

        // 2. Obtém o ID da turma
        const turmaIdStr = interaction.options.getString('turma_id');
        const turmaId = parseInt(turmaIdStr, 10);

        if (isNaN(turmaId)) {
            return interaction.editReply('❌ ID da turma inválido. Use as opções sugeridas (autocomplete).');
        }

        // 3. Busca a turma e verifica existência
        const turma = await ceobDb.turmas.getById(turmaId);
        if (!turma) {
            return interaction.editReply(`❌ Turma com ID \`#${turmaId}\` não encontrada.`);
        }

        // 4. Valida se a turma pode receber alunos (Status)
        if (turma.status !== 'PLANEJADO' && turma.status !== 'EM_ANDAMENTO') {
            return interaction.editReply(`❌ A turma \`${turma.sigla} - ${turma.identificador_turma}\` está **${turma.status}** e não pode receber atualizações.`);
        }

        // 5. Valida Permissões
        const isCoordenador = turma.coordenador_id === executorMilitar.id;
        const pertenceDGP = await ceobDb.permissoes.pertenceAoOrgao(executorMilitar.id, 'DGP');
        const isSupremo = await ceobDb.permissoes.isComandoSupremo(executorMilitar.id);

        if (!isCoordenador && !pertenceDGP && !isSupremo) {
            return interaction.editReply('❌ **Permissão Negada**: Apenas o **Coordenador** da turma, membros da **DGP** ou do **Comando Supremo** podem integrar alunos.');
        }

        // 6. Monta os botões de Ação
        const embed = new EmbedBuilder()
            .setTitle(`⚙️ Integração: ${turma.sigla} - Turma "${turma.identificador_turma}"`)
            .setColor(0x3498DB)
            .setDescription(`Escolha a ação desejada para esta turma (ID: \`${turma.id}\`):\n\n` +
                `📘 **Matricular (Cursando)**: Insere novos alunos sem definir nota ou aprovação.\n` +
                `🏆 **Finalizar Curso**: Define Aprovados/Reprovados (e notas opcionais) para alunos consolidados.`);

        const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
                .setCustomId(`btn_turma_matricular_${turma.id}`)
                .setLabel('📘 Matricular (Cursando)')
                .setStyle(ButtonStyle.Primary),
            new ButtonBuilder()
                .setCustomId(`btn_turma_finalizar_${turma.id}`)
                .setLabel('🏆 Finalizar Curso')
                .setStyle(ButtonStyle.Success)
        );

        return interaction.editReply({ embeds: [embed], components: [row] });

    } catch (error) {
        console.error(`[handleTurmaIntegrar] Erro:`, error);
        await interaction.editReply('❌ Ocorreu um erro interno ao tentar processar a integração.').catch(() => { });
    }
}

/**
 * Lógica do subcomando: /turma encerrar
 */
async function handleTurmaEncerrar(interaction, ceobDb) {
    try {
        await interaction.deferReply({ ephemeral: false });

        // 1. Identifica o executor
        const executorDiscordId = interaction.user.id;
        const executorMilitar = await ceobDb.militares.getByDiscord(executorDiscordId);

        if (!executorMilitar || executorMilitar.situacao_funcional !== 'ATIVO') {
            return interaction.editReply('❌ Apenas militares em situação **ATIVA** e com cadastro no sistema podem usar este comando.');
        }

        // 2. Obtém o ID da turma
        const turmaIdStr = interaction.options.getString('turma_id');
        const turmaId = parseInt(turmaIdStr, 10);
        const motivo = interaction.options.getString('motivo') || 'Nenhum motivo fornecido.';

        if (isNaN(turmaId)) {
            return interaction.editReply('❌ ID da turma inválido. Use as opções sugeridas (autocomplete).');
        }

        // 3. Busca a turma e verifica existência
        const turma = await ceobDb.turmas.getById(turmaId);
        if (!turma) {
            return interaction.editReply(`❌ Turma com ID \`#${turmaId}\` não encontrada.`);
        }

        // 4. Valida se a turma pode ser encerrada
        if (turma.status === 'ENCERRADO' || turma.status === 'CANCELADO') {
            return interaction.editReply(`❌ A turma \`${turma.sigla} - ${turma.identificador_turma}\` já está **${turma.status}**.`);
        }

        // 5. Valida Permissões
        const isCoordenador = turma.coordenador_id === executorMilitar.id;
        const pertenceDGP = await ceobDb.permissoes.pertenceAoOrgao(executorMilitar.id, 'DGP');
        const isSupremo = await ceobDb.permissoes.isComandoSupremo(executorMilitar.id);

        if (!isCoordenador && !pertenceDGP && !isSupremo) {
            return interaction.editReply('❌ **Permissão Negada**: Apenas o **Coordenador** da turma, membros da **DGP** ou do **Comando Supremo** podem encerrar turmas.');
        }

        // 6. Resumo dos Alunos
        const todosAlunos = await ceobDb.militarCursos.getAlunosDoCurso(turmaId);
        const aprovados = todosAlunos.filter(a => a.status_aluno === 'APROVADO');
        const reprovados = todosAlunos.filter(a => a.status_aluno === 'REPROVADO');
        const cursando = todosAlunos.filter(a => a.status_aluno === 'CURSANDO');

        let avisoCursando = '';
        if (cursando.length > 0) {
            avisoCursando = `\n⚠️ **Atenção:** Há ${cursando.length} aluno(s) ainda cursando. Eles serão finalizados ou ignorados no encerramento (verifique as diretrizes).`;
        }

        // 7. Monta os botões de Ação
        const embed = new EmbedBuilder()
            .setTitle(`🛑 Confirmação de Encerramento: ${turma.sigla} "${turma.identificador_turma}"`)
            .setColor(0xE74C3C)
            .setDescription(
                `Você está prestes a encerrar a turma (ID: \`${turma.id}\`).\n\n` +
                `**Status Atual:** ${turma.status}\n` +
                `**Motivo / Obs:** ${motivo}\n\n` +
                `**Resumo de Alunos:**\n` +
                `🏆 Aprovados: ${aprovados.length}\n` +
                `❌ Reprovados: ${reprovados.length}` +
                avisoCursando + `\n\n` +
                (turma.status === 'EM_ANDAMENTO'
                    ? `⚠️ **Aviso:** Será gerado um requerimento para o DGP efetivar o encerramento e as promoções devidas.`
                    : `⚠️ **Aviso:** Como a turma está \`PLANEJADO\`, o status será alterado diretamente para \`CANCELADO\` e não irá ao DGP.`)
            );

        const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
                .setCustomId(`btn_turma_encerrar_confirm_${turma.id}`)
                .setLabel('✅ Confirmar Encerramento')
                .setStyle(ButtonStyle.Danger),
            new ButtonBuilder()
                .setCustomId(`btn_turma_encerrar_cancel_${turma.id}`)
                .setLabel('❌ Cancelar')
                .setStyle(ButtonStyle.Secondary)
        );

        return interaction.editReply({ embeds: [embed], components: [row] });

    } catch (error) {
        console.error(`[handleTurmaEncerrar] Erro:`, error);
        await interaction.editReply('❌ Ocorreu um erro interno ao tentar processar o encerramento.').catch(() => { });
    }
}

/**
 * Lógica do subcomando: /turma gerenciar
 */
async function handleTurmaGerenciar(interaction, ceobDb) {
    try {
        await interaction.deferReply({ ephemeral: false });

        // 1. Identifica o executor
        const executorMilitar = await ceobDb.militares.getByDiscord(interaction.user.id);

        if (!executorMilitar || executorMilitar.situacao_funcional !== 'ATIVO') {
            return interaction.editReply('❌ Apenas militares em situação **ATIVA** podem consultar turmas.');
        }

        const turmaIdStr = interaction.options.getString('turma_id');
        const siglaCurso = interaction.options.getString('sigla_curso');

        // 2. Se turma_id foi fornecido, buscar direto
        if (turmaIdStr) {
            const turmaId = parseInt(turmaIdStr, 10);
            if (isNaN(turmaId)) {
                return interaction.editReply('❌ ID da turma inválido.');
            }

            const turma = await ceobDb.turmas.getById(turmaId);
            if (!turma) {
                return interaction.editReply(`❌ Turma com ID \`#${turmaId}\` não encontrada.`);
            }

            const alunos = await ceobDb.militarCursos.getAlunosDoCurso(turma.id);
            const embed = buildTurmaEmbed(turma, alunos);
            return interaction.editReply({ embeds: [embed] });
        }

        // 3. Se sigla_curso foi fornecido, listar turmas daquele curso com select menu
        if (siglaCurso) {
            const sigla = siglaCurso.trim().toUpperCase();
            const turmas = await ceobDb.turmas.listarPorSigla(sigla);

            if (turmas.length === 0) {
                return interaction.editReply(`❌ Não há turmas ativas para o curso \`${sigla}\`.`);
            }

            // Se só tem uma turma, mostrar direto
            if (turmas.length === 1) {
                const turma = await ceobDb.turmas.getById(turmas[0].id);
                const alunos = await ceobDb.militarCursos.getAlunosDoCurso(turma.id);
                const embed = buildTurmaEmbed(turma, alunos);
                return interaction.editReply({ embeds: [embed] });
            }

            // Múltiplas turmas — select menu
            const statusIcon = { 'PLANEJADO': '🟡', 'EM_ANDAMENTO': '🟢', 'ENCERRADO': '🔴', 'CANCELADO': '⚫' };

            const selectMenu = new StringSelectMenuBuilder()
                .setCustomId('select_turma_gerenciar')
                .setPlaceholder('Selecione uma turma...')
                .addOptions(
                    turmas.slice(0, 25).map(t => ({
                        label: `${t.sigla} "${t.identificador_turma}" (${t.status})`,
                        description: `Coord: ${t.coordenador_nome} | ID: ${t.id}`,
                        value: t.id.toString(),
                        emoji: statusIcon[t.status] || '❓'
                    }))
                );

            const row = new ActionRowBuilder().addComponents(selectMenu);
            const embed = new EmbedBuilder()
                .setTitle(`📋 Turmas de ${sigla}`)
                .setColor(0x3498DB)
                .setDescription(`Foram encontradas **${turmas.length}** turma(s) para o curso \`${sigla}\`. Selecione uma abaixo para ver os detalhes.`);

            return interaction.editReply({ embeds: [embed], components: [row] });
        }

        // 4. Nenhum parâmetro informado
        return interaction.editReply('❌ Você precisa informar **turma_id** ou **sigla_curso** para consultar uma turma.');

    } catch (error) {
        console.error(`[handleTurmaGerenciar] Erro:`, error);
        await interaction.editReply('❌ Ocorreu um erro interno ao consultar a turma.').catch(() => { });
    }
}

/**
 * Constrói o Embed completo de uma turma com seus alunos.
 */
function buildTurmaEmbed(turma, alunos) {
    const statusIcon = { 'PLANEJADO': '🟡 Planejado', 'EM_ANDAMENTO': '🟢 Em Andamento', 'ENCERRADO': '🔴 Encerrado', 'CANCELADO': '⚫ Cancelado' };
    const statusText = statusIcon[turma.status] || turma.status;

    const aprovados = alunos.filter(a => a.status_aluno === 'APROVADO');
    const reprovados = alunos.filter(a => a.status_aluno === 'REPROVADO');
    const cursando = alunos.filter(a => a.status_aluno === 'CURSANDO');

    const dataAbertura = turma.created_at
        ? new Date(turma.created_at).toLocaleDateString('pt-BR')
        : 'N/A';
    const dataEncerramento = turma.data_encerramento
        ? new Date(turma.data_encerramento).toLocaleDateString('pt-BR')
        : null;

    let descricao =
        `📌 **Status:** ${statusText}\n` +
        `🆔 **ID:** \`${turma.id}\`\n` +
        `━━━━━━━━━━━━━━━━━━━━━\n` +
        `👨‍✈️ **Coordenador:** ${turma.coordenador_nome}\n` +
        `👨‍🏫 **Instrutor:** ${turma.instrutor_nome || '_Não Definido_'}\n` +
        `🤝 **Auxiliar:** ${turma.auxiliar_nome || '_Não Definido_'}\n` +
        (turma.om_sigla ? `🏠 **OM:** ${turma.om_sigla}\n` : '') +
        `📅 **Abertura:** ${dataAbertura}\n` +
        (dataEncerramento ? `📅 **Encerramento:** ${dataEncerramento}\n` : '') +
        `━━━━━━━━━━━━━━━━━━━━━`;

    if (aprovados.length > 0) {
        descricao += `\n🏆 **Aprovados (${aprovados.length}):**\n` +
            aprovados.map(a => `  • ${a.patente_abrev} ${a.nome_guerra}`).join('\n');
    }
    if (reprovados.length > 0) {
        descricao += `\n❌ **Reprovados (${reprovados.length}):**\n` +
            reprovados.map(a => `  • ${a.patente_abrev} ${a.nome_guerra}`).join('\n');
    }
    if (cursando.length > 0) {
        descricao += `\n⏳ **Cursando (${cursando.length}):**\n` +
            cursando.map(a => `  • ${a.patente_abrev} ${a.nome_guerra}`).join('\n');
    }
    if (alunos.length === 0) {
        descricao += `\n\n_Nenhum aluno matriculado nesta turma._`;
    }

    return new EmbedBuilder()
        .setTitle(`📋 ${turma.sigla} — Turma "${turma.identificador_turma}"`)
        .setColor(turma.status === 'EM_ANDAMENTO' ? 0x2ECC71 : turma.status === 'PLANEJADO' ? 0xF1C40F : 0x95A5A6)
        .setDescription(descricao)
        .setTimestamp();
}

/**
 * Resolve um militar: se um User do Discord foi mencionado, busca no banco;
 * caso contrário, usa o executor como fallback.
 */
async function resolverMilitar(ceobDb, discordUser, fallbackMilitar) {
    if (!discordUser) {
        return fallbackMilitar;
    }
    return ceobDb.militares.getByDiscord(discordUser.id);
}

/**
 * Handler de Autocomplete para o comando /turma
 */
async function handleTurmaAutocomplete(interaction, ceobDb) {
    try {
        const focusedOption = interaction.options.getFocused(true);
        const focusedValue = (focusedOption.value || '').toString().toUpperCase();

        console.log(`[Autocomplete turma] campo=${focusedOption.name} valor="${focusedValue}"`);

        if (focusedOption.name === 'sigla_curso') {
            // Autocomplete: cursos ativos do catálogo
            const cursosAtivos = await ceobDb.catalogoCursos.listar(true);

            const filtered = cursosAtivos
                .filter(c => {
                    const sigla = (c.sigla || '').toUpperCase();
                    const nome = (c.nome || '').toUpperCase();
                    return sigla.includes(focusedValue) || nome.includes(focusedValue);
                })
                .slice(0, 25);

            await interaction.respond(
                filtered.map(c => ({ name: `[${c.sigla}] ${c.nome}`.substring(0, 100), value: c.sigla }))
            );
        } else if (focusedOption.name === 'om') {
            // Autocomplete: OMs ativas
            const todasOMs = await ceobDb.organizacoes.getAll();

            const filtered = todasOMs
                .filter(om => {
                    const sigla = (om.sigla || '').toUpperCase();
                    const nome = (om.nome || '').toUpperCase();
                    return sigla.includes(focusedValue) || nome.includes(focusedValue);
                })
                .slice(0, 25);

            await interaction.respond(
                filtered.map(om => ({ name: `[${om.sigla}] ${om.nome}`.substring(0, 100), value: om.sigla }))
            );
        } else if (focusedOption.name === 'turma_id') {
            // Autocomplete: turmas PLANEJADO ou EM_ANDAMENTO ativas
            const todasTurmas = await ceobDb.turmas.listar();

            const turmasValidas = todasTurmas.filter(t => t.status === 'PLANEJADO' || t.status === 'EM_ANDAMENTO');

            const filtered = turmasValidas
                .filter(t => {
                    const idStr = (t.id || '').toString();
                    const sigla = (t.sigla || '').toUpperCase();
                    const identificador = (t.identificador_turma || '').toUpperCase();
                    return idStr.includes(focusedValue) || sigla.includes(focusedValue) || identificador.includes(focusedValue);
                })
                .slice(0, 25);

            await interaction.respond(
                filtered.map(t => ({
                    name: `[ID:${t.id}] ${t.sigla || '?'} ${t.identificador_turma || '?'} (${t.status})`.substring(0, 100),
                    value: t.id.toString()
                }))
            );
        } else {
            console.log(`[Autocomplete turma] Campo não reconhecido: ${focusedOption.name}`);
            await interaction.respond([]);
        }

    } catch (error) {
        console.error(`[handleTurmaAutocomplete] Erro no campo "${interaction.options.getFocused(true)?.name}":`, error);
        await interaction.respond([]).catch(() => { });
    }
}

module.exports = { handleTurma, handleTurmaAutocomplete };
