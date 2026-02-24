/**
 * Handler do comando /efetivo
 * @param {import('discord.js').ChatInputCommandInteraction} interaction
 * @param {import('../../database/CeobDatabase')} ceobDb
 */
async function handleEfetivo(interaction, ceobDb) {
    await interaction.deferReply();
    const sigla = interaction.options.getString('sigla').toUpperCase();
    const om = await ceobDb.organizacoes.getBySigla(sigla);

    if (!om) {
        return interaction.editReply({ content: `❌ OM com sigla "${sigla}" não encontrada.`, ephemeral: true });
    }

    const max = om.efetivo_maximo ? ` / ${om.efetivo_maximo}` : '';
    const militares = await ceobDb.organizacoes.getListaEfetivo(om.id);

    if (!militares.length) {
        return interaction.editReply({
            embeds: [{
                title: `📊 Efetivo — ${om.sigla}`,
                description: `**${om.nome}**\n\nNenhum militar ativo encontrado nesta OM.`,
                color: 0x40916C
            }]
        });
    }

    // Agrupa os militares por função
    const grupos = {};
    for (const m of militares) {
        let chave = m.funcao_nome || 'Sem Função';
        if (!grupos[chave]) grupos[chave] = [];
        grupos[chave].push(m);
    }

    // Monta a descrição agrupada
    let descricao = `**${om.nome}**\nMilitares ativos: **${militares.length}${max}**\n\n`;
    for (const [funcao, membros] of Object.entries(grupos)) {
        descricao += `**${funcao}** (${membros.length})\n`;
        for (const m of membros) {
            const robloxInfo = m.roblox_username ? `${m.roblox_username} (${m.roblox_user_id})` : `(${m.roblox_user_id})`;
            const dataRef = m.data_ultima_promocao || m.data_ingresso;
            const dataStr = dataRef ? new Date(dataRef).toISOString().split('T')[0].split('-').reverse().join('/') : '—';

            descricao += `> \`${m.matricula}\` - ${m.patente_nome} - ${m.nome_guerra} - ${robloxInfo} - ${dataStr}\n`;
        }
        descricao += `\n`;
    }

    // O Discord limita embeds a 4096 caracteres na descrição.
    const LIMITE = 4000;

    if (descricao.length <= LIMITE) {
        return interaction.editReply({
            embeds: [{
                title: `📊 Efetivo — ${om.sigla}`,
                description: descricao.trim(),
                color: 0x40916C,
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
                    ? `📊 Efetivo — ${om.sigla}`
                    : `📊 Efetivo — ${om.sigla} (cont.)`,
                description: blocoAtual.trim(),
                color: 0x40916C
            });
            blocoAtual = '';
        }
        blocoAtual += linha + '\n';
    }

    if (blocoAtual.trim()) {
        embeds.push({
            title: embeds.length === 0
                ? `📊 Efetivo — ${om.sigla}`
                : `📊 Efetivo — ${om.sigla} (cont.)`,
            description: blocoAtual.trim(),
            color: 0x40916C,
            timestamp: new Date()
        });
    }

    // Discord permite até 10 embeds por mensagem
    return interaction.editReply({ embeds: embeds.slice(0, 10) });
}

module.exports = handleEfetivo;
