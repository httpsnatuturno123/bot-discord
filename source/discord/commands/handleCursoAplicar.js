const { ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder } = require('discord.js');

/**
 * Handler do comando /curso aplicar
 * @param {import('discord.js').ChatInputCommandInteraction} interaction
 * @param {import('../../database/CeobDatabase')} ceobDb
 */
async function handleCursoAplicar(interaction, ceobDb) {
    try {
        const subcommand = interaction.options.getSubcommand();
        if (subcommand !== 'aplicar') return;

        // 1. Extrair parâmetros do slash command
        const cursoSigla = interaction.options.getString('curso').trim().toUpperCase();
        const coordenadorUser = interaction.options.getUser('coordenador');
        const auxiliarUser = interaction.options.getUser('auxiliar');

        // 2. Validação do curso (apenas CFC e CFSd)
        if (cursoSigla !== 'CFC' && cursoSigla !== 'CFSD') {
            return interaction.reply({ content: '❌ Este comando aceita apenas os cursos **CFC** e **CFSd**.', ephemeral: true });
        }

        // 3. Validação do Instrutor (executor): Deve ser ATIVO
        const instrutor = await ceobDb.militares.getByDiscord(interaction.user.id);

        if (!instrutor) {
            return interaction.reply({ content: '❌ Você não está registrado como militar no sistema.', ephemeral: true });
        }

        if (instrutor.situacao_funcional !== 'ATIVO') {
            return interaction.reply({ content: '❌ Apenas militares em situação ATIVA podem aplicar cursos.', ephemeral: true });
        }

        // 4. Validação de permissão: Oficial, CFS concluído ou Comando Supremo
        const isSupremo = await ceobDb.permissoes.isComandoSupremo(instrutor.id);

        const cursosMilitar = await ceobDb.militarCursos.getDoMilitar(instrutor.id);
        const temCfsEstruturado = cursosMilitar.some(c => c.curso_sigla === 'CFS' && c.status_aluno === 'APROVADO');

        // Fallback: Verifica na timeline por palavras-chave
        const timeline = await ceobDb.timeline.getDoMilitar(instrutor.id, 100);
        const temCfsTimeline = timeline.some(t =>
            t.tipo_evento === 'CONCLUSAO_CURSO' &&
            (t.descricao.toUpperCase().includes('CFS') || t.descricao.toUpperCase().includes('FORMAÇÃO DE SARGENTOS'))
        );

        if (!isSupremo && !instrutor.is_oficial && !temCfsEstruturado && !temCfsTimeline) {
            return interaction.reply({ content: '❌ Apenas **Oficiais** ou militares com o curso **CFS** concluído podem aplicar cursos.', ephemeral: true });
        }

        // 5. Validação do Coordenador: deve ser oficial
        const coordenador = await ceobDb.militares.getByDiscord(coordenadorUser.id);

        if (!coordenador) {
            return interaction.reply({ content: '❌ O **coordenador** mencionado não possui cadastro no sistema.', ephemeral: true });
        }

        if (!coordenador.is_oficial) {
            return interaction.reply({ content: '❌ O **coordenador** deve ser um **Oficial**. O militar informado não pertence ao oficialato.', ephemeral: true });
        }

        // 6. Validação do Auxiliar (se informado)
        let auxiliarDiscordId = 'null';
        if (auxiliarUser) {
            const auxiliar = await ceobDb.militares.getByDiscord(auxiliarUser.id);
            if (!auxiliar) {
                return interaction.reply({ content: '❌ O **auxiliar** mencionado não possui cadastro no sistema.', ephemeral: true });
            }
            auxiliarDiscordId = auxiliarUser.id;
        }

        // 7. Criação do Modal (apenas campos de alunos)
        // Codificamos os dados nos customId para recuperar no modal submit
        const modalCustomId = `modal_curso_aplicar_${cursoSigla}_${coordenadorUser.id}_${auxiliarDiscordId}`;

        const modal = new ModalBuilder()
            .setCustomId(modalCustomId)
            .setTitle(`Aplicação de ${cursoSigla}`);

        // Campo 1: Alunos Participantes
        const alunosParticipantesInput = new TextInputBuilder()
            .setCustomId('alunos_participantes')
            .setLabel('Alunos Participantes')
            .setPlaceholder('Username ou UserID separados por ; (ex: user1; 12345; user2)')
            .setStyle(TextInputStyle.Paragraph)
            .setRequired(true);

        // Campo 2: Alunos Aprovados
        const alunosAprovadosInput = new TextInputBuilder()
            .setCustomId('alunos_aprovados')
            .setLabel('Alunos Aprovados')
            .setPlaceholder('Username ou UserID dos aprovados separados por ;')
            .setStyle(TextInputStyle.Paragraph)
            .setRequired(true);

        modal.addComponents(
            new ActionRowBuilder().addComponents(alunosParticipantesInput),
            new ActionRowBuilder().addComponents(alunosAprovadosInput)
        );

        await interaction.showModal(modal);

    } catch (error) {
        console.error('Erro no comando curso aplicar:', error);
        if (!interaction.replied && !interaction.deferred) {
            await interaction.reply({ content: '❌ Erro ao abrir formulário de aplicação.', ephemeral: true });
        }
    }
}

/**
 * Handler de Autocomplete para o comando /curso
 * Retorna apenas CFC e CFSd como opções.
 */
async function handleCursoAutocomplete(interaction, ceobDb) {
    try {
        const focusedOption = interaction.options.getFocused(true);

        if (focusedOption.name === 'curso') {
            const cursos = [
                { name: '[CFC] Curso de Formação de Cabos', value: 'CFC' },
                { name: '[CFSd] Curso de Formação de Soldados', value: 'CFSd' }
            ];

            const focusedValue = (focusedOption.value || '').toUpperCase();
            const filtered = cursos.filter(c =>
                c.name.toUpperCase().includes(focusedValue) ||
                c.value.toUpperCase().includes(focusedValue)
            );

            await interaction.respond(filtered);
        } else {
            await interaction.respond([]);
        }
    } catch (error) {
        console.error('[handleCursoAutocomplete] Erro:', error);
        await interaction.respond([]).catch(() => { });
    }
}

module.exports = { handleCursoAplicar, handleCursoAutocomplete };
