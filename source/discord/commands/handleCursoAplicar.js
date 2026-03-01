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

        // 1. Validação do Instrutor: Deve ser ATIVO e possuir o curso CFS
        // Buscamos o militar executor pelo seu Discord ID
        const instrutor = await ceobDb.militares.getByDiscord(interaction.user.id);

        if (!instrutor) {
            return interaction.reply({ content: '❌ Você não está registrado como militar no sistema.', ephemeral: true });
        }

        if (instrutor.situacao_funcional !== 'ATIVO') {
            return interaction.reply({ content: '❌ Apenas militares em situação ATIVA podem aplicar cursos.', ephemeral: true });
        }

        // 2. Validação de Exceção: Comando Supremo ignora a trava de curso
        const isSupremo = await ceobDb.permissoes.isComandoSupremo(instrutor.id);

        // Verifica se possui o curso CFS (pela sigla na tabela estruturada ou pela descrição na timeline como fallback)
        const cursosMilitar = await ceobDb.militarCursos.getDoMilitar(instrutor.id);
        const temCfsEstruturado = cursosMilitar.some(c => c.curso_sigla === 'CFS' && c.status_aluno === 'APROVADO');

        // Fallback: Verifica na timeline por palavras-chave
        const timeline = await ceobDb.timeline.getDoMilitar(instrutor.id, 100);
        const temCfsTimeline = timeline.some(t =>
            t.tipo_evento === 'CONCLUSAO_CURSO' &&
            (t.descricao.toUpperCase().includes('CFS') || t.descricao.toUpperCase().includes('FORMAÇÃO DE SARGENTOS'))
        );

        if (!isSupremo && !temCfsEstruturado && !temCfsTimeline) {
            return interaction.reply({ content: '❌ Apenas militares com o curso **CFS** concluído (ou membros do Comando Supremo) podem aplicar cursos.', ephemeral: true });
        }

        // 2. Criação do Modal
        const modal = new ModalBuilder()
            .setCustomId('modal_curso_aplicar')
            .setTitle('Aplicação de Curso');

        // Campo 1: Alunos Participantes
        const alunosParticipantesInput = new TextInputBuilder()
            .setCustomId('alunos_participantes')
            .setLabel('Alunos Participantes')
            .setPlaceholder('Username ou UserID separados por ; (ex: user1; 12345; user2)')
            .setStyle(TextInputStyle.Paragraph)
            .setRequired(true);

        // Campo 2: Instrutor Responsável (pré-preenchido com o executor por padrão na descrição do campo ou deixado livre)
        const instrutorInput = new TextInputBuilder()
            .setCustomId('instrutor_nome')
            .setLabel('Instrutor Responsável')
            .setValue(`${instrutor.nome_guerra}`)
            .setStyle(TextInputStyle.Short)
            .setRequired(true);

        // Campo 3: Curso Aplicado
        const cursoInput = new TextInputBuilder()
            .setCustomId('curso_nome')
            .setLabel('Curso Aplicado (ex: CFC, CFSd)')
            .setPlaceholder('CFC ou CFSd')
            .setStyle(TextInputStyle.Short)
            .setRequired(true);

        // Campo 4: Alunos Aprovados
        const alunosAprovadosInput = new TextInputBuilder()
            .setCustomId('alunos_aprovados')
            .setLabel('Alunos Aprovados')
            .setPlaceholder('Username ou UserID dos aprovados separados por ;')
            .setStyle(TextInputStyle.Paragraph)
            .setRequired(true);

        // Adiciona as linhas
        modal.addComponents(
            new ActionRowBuilder().addComponents(alunosParticipantesInput),
            new ActionRowBuilder().addComponents(instrutorInput),
            new ActionRowBuilder().addComponents(cursoInput),
            new ActionRowBuilder().addComponents(alunosAprovadosInput)
        );

        await interaction.showModal(modal);

    } catch (error) {
        console.error('Erro no comando curso aplicar:', error);
        await interaction.reply({ content: '❌ Erro ao abrir formulário de aplicação.', ephemeral: true });
    }
}

module.exports = handleCursoAplicar;
