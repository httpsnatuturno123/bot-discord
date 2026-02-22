/**
 * Constrói o embed visual da ficha de um militar.
 * @param {Object} ficha - Objeto retornado por ceobDb.getFichaCompleta()
 * @returns {Object} Embed do Discord
 */
function buildFichaEmbed(ficha) {
    const m = ficha.militar;
    if (!m) {
        return { title: '❌ Militar não encontrado', color: 0xFF0000 };
    }

    const funcoesStr = ficha.funcoes.length > 0
        ? ficha.funcoes.map(f => `${f.funcao_nome} (${f.om_sigla})`).join('\n')
        : 'Nenhuma';

    const timelineStr = ficha.timeline.slice(0, 5).map(t => {
        const data = new Date(t.created_at).toLocaleDateString('pt-BR');
        return `\`${data}\` ${t.tipo_evento} — ${t.descricao}`;
    }).join('\n') || 'Sem eventos';

    return {
        title: `📋 Ficha Militar — ${m.patente_abrev} ${m.nome_guerra}`,
        color: 0x1B4332,
        fields: [
            { name: 'Matrícula', value: m.matricula, inline: true },
            { name: 'Patente', value: `${m.patente_nome} (${m.patente_abrev})`, inline: true },
            { name: 'Situação', value: m.situacao_funcional, inline: true },
            { name: 'OM de Lotação', value: `${m.om_nome} (${m.om_sigla})`, inline: true },
            { name: 'Ingresso', value: new Date(m.data_ingresso).toLocaleDateString('pt-BR'), inline: true },
            { name: 'Roblox ID', value: String(m.roblox_user_id), inline: true },
            { name: '── Funções Ativas ──', value: funcoesStr, inline: false },
            { name: '── Últimos Eventos ──', value: timelineStr, inline: false },
        ],
        footer: { text: `ID interno: ${m.id} | Círculo: ${m.circulo}` }
    };
}

module.exports = buildFichaEmbed;
