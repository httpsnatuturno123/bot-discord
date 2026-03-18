const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { resolverUsuario } = require('../services/robloxService');

const CUSTOM_ID_PREFIX = 'modal_curso_aplicar_';

function isCursoAplicarModal(customId) {
    return customId.startsWith(CUSTOM_ID_PREFIX);
}

/**
 * Processa o envio do modal /curso aplicar
 * customId format: modal_curso_aplicar_{cursoSigla}_{coordenadorDiscordId}_{auxiliarDiscordId|null}
 */
async function handleCursoAplicarModal(interaction, ceobDb) {
    await interaction.deferReply({ ephemeral: true });

    try {
        // 1. Extrair dados do customId
        const parts = interaction.customId.replace(CUSTOM_ID_PREFIX, '').split('_');
        const cursoSigla = parts[0];              // CFC ou CFSD
        const coordenadorDiscordId = parts[1];
        const auxiliarDiscordId = parts[2] !== 'null' ? parts[2] : null;

        // 2. Extrair campos do modal
        const alunosParticipantesTxt = interaction.fields.getTextInputValue('alunos_participantes');
        const alunosAprovadosTxt = interaction.fields.getTextInputValue('alunos_aprovados');

        const separarLista = (texto) => texto.split(';').map(s => s.trim()).filter(s => s.length > 0);

        const listaParticipantes = separarLista(alunosParticipantesTxt);
        const listaAprovados = separarLista(alunosAprovadosTxt);

        // 3. Resolver militares (instrutor = executor, coordenador, auxiliar)
        const instrutor = await ceobDb.militares.getByDiscord(interaction.user.id);
        const coordenador = await ceobDb.militares.getByDiscord(coordenadorDiscordId);
        const auxiliar = auxiliarDiscordId ? await ceobDb.militares.getByDiscord(auxiliarDiscordId) : null;

        if (!instrutor || !coordenador) {
            return interaction.followUp({ content: '❌ Erro interno: Instrutor ou Coordenador não encontrados no banco de dados.', ephemeral: true });
        }

        // 4. Auto-criar o curso no catálogo se não existir
        let curso = await ceobDb.catalogoCursos.getBySigla(cursoSigla);
        if (!curso) {
            const nomesMap = {
                'CFC': 'Curso de Formação de Cabos',
                'CFSD': 'Curso de Formação de Soldados'
            };
            curso = await ceobDb.catalogoCursos.criar({
                nome: nomesMap[cursoSigla] || `Curso de ${cursoSigla}`,
                sigla: cursoSigla
            });
        }

        // 5. Criar a turma automaticamente
        const agora = new Date();
        const mesAno = agora.toLocaleDateString('pt-BR', { month: 'short', year: 'numeric' }).toUpperCase();

        // Verificar se já existe turma com esse identificador
        let turma = await ceobDb.turmas.getBySiglaETurma(cursoSigla, mesAno);

        if (!turma) {
            turma = await ceobDb.turmas.criar({
                cursoId: curso.id,
                identificadorTurma: mesAno,
                coordenadorId: coordenador.id,
                instrutorId: instrutor.id,
                auxiliarId: auxiliar ? auxiliar.id : null
            });

            // Colocar em EM_ANDAMENTO diretamente
            await ceobDb.turmas.atualizarStatus(turma.id, 'EM_ANDAMENTO');
        }

        // 6. Resolver e validar alunos
        const resultados = {
            validos: [],
            erros: [],
            aprovadosIds: []
        };

        for (const input of listaParticipantes) {
            try {
                const { userId, username } = await resolverUsuario(input);

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

        // 7. Reportar erros (se houver)
        if (resultados.erros.length > 0) {
            const erroMsg = `⚠️ **Avisos de Validação:**\n${resultados.erros.join('\n')}\n\n*Os demais alunos válidos foram processados. Corrija os erros acima em um novo requerimento se necessário.*`;
            await interaction.followUp({ content: erroMsg, ephemeral: true });
        }

        if (resultados.validos.length === 0) {
            return interaction.followUp({ content: '❌ Nenhum militar válido encontrado para prosseguir com o requerimento.', ephemeral: true });
        }

        // 8. Matricular todos os alunos e marcar aprovados/reprovados
        for (const aluno of resultados.validos) {
            await ceobDb.militarCursos.matricular(aluno.id, turma.id);

            const status = resultados.aprovadosIds.includes(aluno.id) ? 'APROVADO' : 'REPROVADO';
            await ceobDb.militarCursos.finalizarCurso(aluno.id, turma.id, status);
        }

        // 9. Montar embed do requerimento DGP
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

        const siglaNormalizada = cursoSigla === 'CFSD' ? 'CFSd' : cursoSigla;

        const embed = new EmbedBuilder()
            .setTitle(`📋 REQUERIMENTO DGP — Aplicação de ${siglaNormalizada}`)
            .setColor(0xE67E22)
            .addFields(
                { name: '📚 Curso / Turma', value: `**${siglaNormalizada}** — Turma "${mesAno}" (ID: \`${turma.id}\`)`, inline: false },
                { name: '👨‍✈️ Coordenador', value: `${coordenador.patente_abrev} ${coordenador.nome_guerra}`, inline: true },
                { name: '👨‍🏫 Instrutor', value: `${instrutor.patente_abrev} ${instrutor.nome_guerra}`, inline: true },
                { name: '🤝 Auxiliar', value: auxiliar ? `${auxiliar.patente_abrev} ${auxiliar.nome_guerra}` : '_Não Definido_', inline: true },
                { name: '👥 Alunos e Resultados', value: alunosStr || 'Nenhum' }
            )
            .setFooter({ text: `Enviado por ${instrutor.nome_guerra} • Aguardando aprovação do DGP` })
            .setTimestamp();

        // 10. Botões de Aprovação/Rejeição — reutiliza fluxo turmaencerrar
        const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
                .setCustomId(`turmaencerrar_confirmar_${turma.id}`)
                .setLabel('✅ Aprovar e Encerrar')
                .setStyle(ButtonStyle.Success),
            new ButtonBuilder()
                .setCustomId(`turmaencerrar_rejeitar_${turma.id}`)
                .setLabel('❌ Rejeitar Requerimento')
                .setStyle(ButtonStyle.Danger)
        );

        await dgpChannel.send({ embeds: [embed], components: [row] });

        await interaction.followUp({ content: `✅ Requerimento de **${siglaNormalizada}** enviado ao DGP com sucesso!\n🆔 Turma criada: \`#${turma.id}\` — "${mesAno}"`, ephemeral: true });

    } catch (error) {
        console.error('Erro ao processar modal de curso aplicar:', error);
        await interaction.followUp({ content: '❌ Erro crítico ao processar o requerimento.', ephemeral: true });
    }
}

module.exports = { isCursoAplicarModal, handleCursoAplicarModal };
