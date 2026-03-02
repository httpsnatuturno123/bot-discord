const { EmbedBuilder } = require('discord.js');

const SELECT_ID = 'select_turma_gerenciar';

function isTurmaGerenciarSelect(customId) {
    return customId === SELECT_ID;
}

/**
 * Processa a seleção de uma turma no select menu do /turma gerenciar
 */
async function handleTurmaGerenciarSelect(interaction, ceobDb) {
    try {
        await interaction.deferUpdate();

        const turmaId = parseInt(interaction.values[0], 10);
        const turma = await ceobDb.turmas.getById(turmaId);

        if (!turma) {
            return interaction.followUp({ content: `❌ Turma #${turmaId} não encontrada.`, ephemeral: true });
        }

        const alunos = await ceobDb.militarCursos.getAlunosDoCurso(turma.id);

        // Reutiliza a mesma lógica de embed
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

        const embed = new EmbedBuilder()
            .setTitle(`📋 ${turma.sigla} — Turma "${turma.identificador_turma}"`)
            .setColor(turma.status === 'EM_ANDAMENTO' ? 0x2ECC71 : turma.status === 'PLANEJADO' ? 0xF1C40F : 0x95A5A6)
            .setDescription(descricao)
            .setTimestamp();

        return interaction.editReply({ embeds: [embed], components: [] });

    } catch (error) {
        console.error('[handleTurmaGerenciarSelect] Erro:', error);
        await interaction.followUp({ content: '❌ Erro ao carregar informações da turma.', ephemeral: true }).catch(() => { });
    }
}

module.exports = { isTurmaGerenciarSelect, handleTurmaGerenciarSelect };
