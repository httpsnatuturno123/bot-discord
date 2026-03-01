const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { resolverUsuario } = require('../services/robloxService');

const CUSTOM_ID = 'modal_curso_aplicar';

function isCursoAplicarModal(customId) {
    return customId === CUSTOM_ID;
}

/**
 * Processa o envio do modal /curso aplicar
 */
async function handleCursoAplicarModal(interaction, ceobDb) {
    await interaction.deferReply({ ephemeral: true });

    try {
        const alunosParticipantesTxt = interaction.fields.getTextInputValue('alunos_participantes');
        const instrutorNome = interaction.fields.getTextInputValue('instrutor_nome');
        const cursoNome = interaction.fields.getTextInputValue('curso_nome');
        const alunosAprovadosTxt = interaction.fields.getTextInputValue('alunos_aprovados');

        const separarLista = (texto) => texto.split(';').map(s => s.trim()).filter(s => s.length > 0);

        const listaParticipantes = separarLista(alunosParticipantesTxt);
        const listaAprovados = separarLista(alunosAprovadosTxt);

        const resultados = {
            validos: [],
            erros: [],
            aprovadosIds: []
        };

        // 1. Resolver e Validar Alunos
        for (const input of listaParticipantes) {
            try {
                const { userId, username } = await resolverUsuario(input);

                // Busca no banco de dados CEOB
                const militar = await ceobDb.militares.getByRoblox(userId);

                if (militar) {
                    resultados.validos.push({
                        id: militar.id,
                        robloxId: userId,
                        nome: militar.nome_guerra,
                        patente: militar.patente_abrev,
                        username: username
                    });

                    // Verifica se este aluno está na lista de aprovados
                    const isAprovado = listaAprovados.some(a =>
                        a.toLowerCase() === username.toLowerCase() || a === userId
                    );
                    if (isAprovado) {
                        resultados.aprovadosIds.push(militar.id);
                    }
                } else {
                    resultados.erros.push(`Militar \`${username}\` (${userId}) não encontrado no banco de dados CEOB.`);
                }
            } catch (err) {
                resultados.erros.push(`Não foi possível encontrar o usuário \`${input}\` no Roblox.`);
            }
        }

        // 2. Reportar Erros (se houver) sem travar tudo (conforme pedido na regra A)
        if (resultados.erros.length > 0) {
            const erroMsg = `⚠️ **Avisos de Validação:**\n${resultados.erros.join('\n')}\n\n*Os demais alunos válidos foram processados. Corrija os erros acima em um novo requerimento se necessário.*`;
            await interaction.followUp({ content: erroMsg, ephemeral: true });
        }

        if (resultados.validos.length === 0) {
            return interaction.followUp({ content: '❌ Nenhum militar válido encontrado para prosseguir com o requerimento.', ephemeral: true });
        }

        // 3. Preparar Requerimento para o DGP
        const dgpChannelId = process.env.CANAL_REQUERIMENTOS_ID;
        const dgpChannel = await interaction.client.channels.fetch(dgpChannelId);

        if (!dgpChannel) {
            return interaction.followUp({ content: '❌ Canal do DGP não configurado ou inacessível.', ephemeral: true });
        }

        // Monta texto dos alunos para o Embed
        const alunosStr = resultados.validos.map(m => {
            const status = resultados.aprovadosIds.includes(m.id) ? '✅ Aprovado' : '❌ Reprovado';
            return `• ${m.patente} **${m.nome}** (${m.username}) - ${status}`;
        }).join('\n');

        const embed = new EmbedBuilder()
            .setTitle('📑 Requerimento de Aplicação de Curso')
            .setColor(0x3498DB)
            .setDescription(`O militar **${instrutorNome}** enviou um requerimento de finalização de curso.`)
            .addFields(
                { name: '📚 Curso', value: cursoNome, inline: true },
                { name: '👨‍🏫 Instrutor', value: instrutorNome, inline: true },
                { name: '👥 Alunos e Resultados', value: alunosStr || 'Nenhum' }
            )
            .setFooter({ text: 'DGP — Departamento Geral do Pessoal' })
            .setTimestamp();

        const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
                .setCustomId(`curso_confirmar_${interaction.user.id}_${cursoNome.substring(0, 60)}`)
                .setLabel('Aprovar e Integrar')
                .setStyle(ButtonStyle.Success),
            new ButtonBuilder()
                .setCustomId(`curso_rejeitar_${interaction.user.id}`)
                .setLabel('Rejeitar Requerimento')
                .setStyle(ButtonStyle.Danger)
        );

        // Salvar os dados temporariamente via CustomID do botão é inviável para listas grandes.
        // Como o bot não tem um cache persistente simples aqui, vamos enviar os IDs dos aprovados e participantes no próprio Embed (campo oculto ou descrição) ou confiar no parse do embed na aprovação.
        // Vamos usar um truque: colocar os IDs no rodapé ou em um campo escondido se necessário, ou salvar em memória global (arriscado).
        // Melhor: O botão de confirmar terá um ID que referencia uma ação, e buscaremos os dados do Embed no momento do clique.

        await dgpChannel.send({ embeds: [embed], components: [row] });

        await interaction.followUp({ content: '✅ Requerimento enviado ao DGP com sucesso!', ephemeral: true });

    } catch (error) {
        console.error('Erro ao processar modal de curso:', error);
        await interaction.followUp({ content: '❌ Erro crítico ao processar o requerimento.', ephemeral: true });
    }
}

module.exports = { isCursoAplicarModal, handleCursoAplicarModal };
