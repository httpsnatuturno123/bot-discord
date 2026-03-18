const { EmbedBuilder } = require('discord.js');

/**
 * Constrói os embeds visuais da ficha de um militar (Paginação).
 * @param {Object} ficha - Objeto retornado por ceobDb.getFichaCompleta()
 * @returns {Array<EmbedBuilder>} Array de Embeds do Discord
 */
function buildFichaEmbed(ficha) {
    const m = ficha.militar;
    if (!m) {
        return [new EmbedBuilder().setTitle('❌ Militar não encontrado').setColor(0xFF0000)];
    }

    const color = 0x1B4332;

    // --- PÁGINA 1: PERFIL GERAL ---
    const funcoesStr = ficha.funcoes.length > 0
        ? ficha.funcoes.map(f => `• ${f.funcao_nome} (${f.om_sigla})`).join('\n')
        : 'Nenhuma função ativa';

    const embedPerfil = new EmbedBuilder()
        .setTitle(`📋 Ficha Militar — ${m.patente_abrev} ${m.nome_guerra}`)
        .setColor(color)
        .addFields(
            { name: 'Matrícula', value: m.matricula, inline: true },
            { name: 'Patente', value: `${m.patente_nome} (${m.patente_abrev})`, inline: true },
            { name: 'Situação', value: m.situacao_funcional, inline: true },
            { name: 'OM de Lotação', value: `${m.om_nome} (${m.om_sigla})`, inline: true },
            { name: 'Ingresso', value: new Date(m.data_ingresso).toLocaleDateString('pt-BR'), inline: true },
            { name: 'Roblox ID', value: String(m.roblox_user_id), inline: true },
            { name: '── Funções Ativas ──', value: funcoesStr, inline: false }
        )
        .setFooter({ text: `Página 1 de 3 | ID: ${m.id} | Círculo: ${m.circulo}` });

    // --- PÁGINA 2: HISTÓRICO PESSOAL (Cursos e Timeline) ---
    const cursosStr = ficha.cursos.length > 0
        ? ficha.cursos.map(c => {
            const statusIcon = c.status_aluno === 'APROVADO' ? '✅' : (c.status_aluno === 'REPROVADO' ? '❌' : '⏳');
            return `${statusIcon} **${c.curso_sigla}** (${c.turma})`;
        }).join('\n')
        : 'Nenhum curso concluído/em andamento';

    const timelineStr = ficha.timeline.slice(0, 5).map(t => {
        const data = new Date(t.created_at).toLocaleDateString('pt-BR');
        return `\`${data}\` **${t.tipo_evento}** — ${t.descricao}`;
    }).join('\n\n') || 'Sem eventos recentes';

    const embedHistoricoPessoal = new EmbedBuilder()
        .setTitle(`📚 Histórico Pessoal — ${m.patente_abrev} ${m.nome_guerra}`)
        .setColor(color)
        .addFields(
            { name: '── Cursos e Turmas ──', value: cursosStr, inline: false },
            { name: '── Últimos Eventos (Recebidos) ──', value: timelineStr, inline: false }
        )
        .setFooter({ text: `Página 2 de 3 | Eventos que o militar sofreu/recebeu` });

    // --- PÁGINA 3: HISTÓRICO DE AÇÕES (ações tomadas pelo militar) ---
    let acoesStr = 'Nenhuma ação registrada.';
    if (ficha.historicoAcoes && ficha.historicoAcoes.length > 0) {
        acoesStr = ficha.historicoAcoes.slice(0, 5).map(a => {
            const data = new Date(a.created_at).toLocaleDateString('pt-BR');
            const alvoStr = a.alvo_nome ? ` em **${a.alvo_nome}**` : '';
            return `\`${data}\` **${a.tipo_evento}**${alvoStr}\n↳ ${a.descricao}`;
        }).join('\n\n');
    }

    const embedHistoricoAcoes = new EmbedBuilder()
        .setTitle(`⚖️ Histórico de Ações — ${m.patente_abrev} ${m.nome_guerra}`)
        .setColor(color)
        .setDescription('Últimas ações executadas ou autorizadas por este militar no sistema.')
        .addFields(
            { name: '── Ações Executadas ──', value: acoesStr, inline: false }
        )
        .setFooter({ text: `Página 3 de 3 | Eventos executados pelo militar` });


    return [embedPerfil, embedHistoricoPessoal, embedHistoricoAcoes];
}

module.exports = buildFichaEmbed;
