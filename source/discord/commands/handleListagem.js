/**
 * Handler do comando /listagem
 * @param {import('discord.js').ChatInputCommandInteraction} interaction
 * @param {import('../../database/CeobDatabase')} ceobDb
 */
async function handleListagem(interaction, ceobDb) {
    try {
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
                const robloxInfo = m.roblox_username ? `${m.roblox_username} (${m.roblox_user_id})` : `(${m.roblox_user_id})`;
                const dataRef = m.data_ultima_promocao || m.data_ingresso;
                const dataStr = dataRef ? new Date(dataRef).toISOString().split('T')[0].split('-').reverse().join('/') : '—';

                descricao += `> \`${m.matricula}\` - ${m.nome_guerra} - ${m.om_sigla} - ${robloxInfo} - ${m.patente_nome} - ${dataStr}\n`;
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
    } catch (error) {
        console.error('Erro no comando listagem:', error);
        try {
            if (interaction.deferred || interaction.replied) {
                await interaction.editReply('❌ Ocorreu um erro interno ao gerar a listagem.');
            } else {
                await interaction.reply({ content: '❌ Ocorreu um erro interno ao gerar a listagem.', ephemeral: true });
            }
        } catch (replyErr) {
            console.error('Falha ao enviar resposta de erro:', replyErr);
        }
    }
}

module.exports = handleListagem;
