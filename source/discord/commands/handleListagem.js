/**
 * Handler do comando /listagem
 * @param {import('discord.js').ChatInputCommandInteraction} interaction
 * @param {import('../../database/CeobDatabase')} ceobDb
 */
async function handleListagem(interaction, ceobDb) {
    await interaction.deferReply();

    // 1. Identifica e valida o executor
    const executorDiscordId = interaction.user.id;
    const executorMilitar = await ceobDb.militares.getByDiscord(executorDiscordId);

    if (!executorMilitar) {
        return interaction.editReply('❌ Você não possui cadastro no sistema.');
    }

    // 2. Busca todos os militares ativos, ordenados por patente
    const militares = await ceobDb.militares.listagem();

    if (!militares.length) {
        return interaction.editReply('⚠️ Nenhum militar ativo encontrado no sistema.');
    }

    // 3. Agrupa os militares por patente
    const grupos = {};
    for (const m of militares) {
        const chave = `${m.patente_abrev} — ${m.patente_nome}`;
        if (!grupos[chave]) grupos[chave] = [];
        grupos[chave].push(m);
    }

    // 4. Monta a descrição agrupada
    let descricao = '';
    for (const [patente, membros] of Object.entries(grupos)) {
        descricao += `\n**${patente}** (${membros.length})\n`;
        for (const m of membros) {
            const discord = m.discord_user_id ? `<@${m.discord_user_id}>` : '—';
            descricao += `> \`${m.matricula}\` ${m.nome_guerra} · ${m.om_sigla} · ${discord}\n`;
        }
    }

    // 5. O Discord limita embeds a 4096 caracteres na descrição.
    //    Se ultrapassar, divide em múltiplas embeds.
    const LIMITE = 4000;

    if (descricao.length <= LIMITE) {
        return interaction.editReply({
            embeds: [{
                title: `📋 Listagem Geral de Militares Ativos (${militares.length})`,
                description: descricao.trim(),
                color: 0x219EBC,
                footer: { text: 'Ordenado por hierarquia de patente' },
                timestamp: new Date()
            }]
        });
    }

    // Divide em múltiplas embeds se o conteúdo for grande
    const embeds = [];
    let blocoAtual = '';
    const linhas = descricao.split('\n');

    for (const linha of linhas) {
        if ((blocoAtual + '\n' + linha).length > LIMITE) {
            embeds.push({
                title: embeds.length === 0
                    ? `📋 Listagem Geral de Militares Ativos (${militares.length})`
                    : `📋 Listagem (cont.)`,
                description: blocoAtual.trim(),
                color: 0x219EBC
            });
            blocoAtual = '';
        }
        blocoAtual += linha + '\n';
    }

    if (blocoAtual.trim()) {
        embeds.push({
            title: embeds.length === 0
                ? `📋 Listagem Geral de Militares Ativos (${militares.length})`
                : `📋 Listagem (cont.)`,
            description: blocoAtual.trim(),
            color: 0x219EBC,
            footer: { text: 'Ordenado por hierarquia de patente' },
            timestamp: new Date()
        });
    }

    // Discord permite até 10 embeds por mensagem
    return interaction.editReply({ embeds: embeds.slice(0, 10) });
}

module.exports = handleListagem;
