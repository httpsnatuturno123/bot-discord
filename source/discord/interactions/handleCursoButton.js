const { EmbedBuilder } = require('discord.js');
const { promoverMembro, PATENTE_ROBLOX_RANK_MAP } = require('../services/robloxService');

const CUSTOM_ID_PREFIX = 'curso_';

function isCursoButton(customId) {
    return customId.startsWith(CUSTOM_ID_PREFIX);
}

/**
 * Processa cliques nos botões de Aprovar/Rejeitar do DGP
 */
async function handleCursoButton(interaction, ceobDb) {
    const [_, acao, instrutorDiscordId, cursoSigla] = interaction.customId.split('_');

    if (acao === 'rejeitar') {
        return interaction.update({
            content: `❌ Requerimento rejeitado por **${interaction.user.username}**.`,
            embeds: interaction.message.embeds.map(e => EmbedBuilder.from(e).setColor(0xFF0000)),
            components: []
        });
    }

    if (acao === 'confirmar') {
        await interaction.deferUpdate();

        try {
            const embedOriginal = interaction.message.embeds[0];
            const alunosStr = embedOriginal.fields.find(f => f.name === '👥 Alunos e Resultados').value;

            // Parse dos alunos do Embed
            const linhas = alunosStr.split('\n');
            const aprovados = [];
            const reprovados = [];

            for (const linha of linhas) {
                // Regex para extrair Patente, NomeGuerra e Username
                const match = linha.match(/• (\w+) \*\*(.+)\*\* \((.+)\) - (✅|❌)/);
                if (match) {
                    const [_, patenteAbrev, nomeGuerra, username, icon] = match;
                    if (icon === '✅') {
                        aprovados.push({ patenteAbrev, nomeGuerra, username });
                    } else {
                        reprovados.push({ patenteAbrev, nomeGuerra, username });
                    }
                }
            }

            // 1. Criar ou Buscar Turma Automática
            const agora = new Date();
            const mesAno = agora.toLocaleDateString('pt-BR', { month: 'short', year: 'numeric' }).toUpperCase();
            const turmaNome = `${cursoSigla} [${mesAno}]`;

            // Garante que o instrutor existe (pelo Discord ID salvo no customId)
            const instrutor = await ceobDb.militares.getByDiscord(instrutorDiscordId);

            let curso = (await ceobDb.cursos.listar()).find(c => c.sigla === cursoSigla && c.turma === mesAno);

            if (!curso) {
                curso = await ceobDb.cursos.criar({
                    nome: `Curso de ${cursoSigla} - Automatizado`,
                    sigla: cursoSigla,
                    turma: mesAno,
                    coordenadorId: instrutor.id,
                    instrutorId: instrutor.id,
                    auxiliarId: instrutor.id,
                    status: 'ENCERRADO'
                });
            }

            const logsResumo = [];

            // 2. Processar Aprovados
            for (const aluno of aprovados) {
                const militar = await ceobDb.militares.getByNomeGuerra(aluno.nomeGuerra);
                if (!militar) continue;

                // Matrícula e Finalização
                await ceobDb.militarCursos.matricular(militar.id, curso.id);
                await ceobDb.militarCursos.finalizarCurso(militar.id, curso.id, 'APROVADO');

                // Registro na Timeline
                await ceobDb.timeline.create({
                    militarId: militar.id,
                    tipoEvento: 'CONCLUSAO_CURSO',
                    descricao: `Concluiu com aproveitamento o ${cursoSigla} (${mesAno}). Instrutor: ${instrutor.nome_guerra}.`,
                    autorId: instrutor.id
                });

                // Promoção Automática
                let novaPatente = null;
                if (cursoSigla === 'CFSd' && militar.patente_abrev === 'REC') {
                    novaPatente = await ceobDb.patentes.getByAbreviacao('SD');
                } else if (cursoSigla === 'CFC' && militar.patente_abrev === 'SD') {
                    novaPatente = await ceobDb.patentes.getByAbreviacao('CB');
                }

                if (novaPatente) {
                    // Update DB
                    await ceobDb.militares.updatePatente(militar.id, novaPatente.id);

                    // Update Roblox
                    const robloxRank = PATENTE_ROBLOX_RANK_MAP[novaPatente.ordem_precedencia];
                    if (robloxRank) {
                        try {
                            await promoverMembro(militar.roblox_user_id, robloxRank);
                            logsResumo.push(`✅ **${militar.nome_guerra}**: Promovido a ${novaPatente.abreviacao} (Roblox OK)`);
                        } catch (err) {
                            logsResumo.push(`⚠️ **${militar.nome_guerra}**: Promovido no DB a ${novaPatente.abreviacao}, mas erro no Roblox: ${err.message}`);
                        }
                    }
                } else {
                    logsResumo.push(`✅ **${militar.nome_guerra}**: Curso registrado.`);
                }
            }

            // 3. Processar Reprovados
            for (const aluno of reprovados) {
                const militar = await ceobDb.militares.getByNomeGuerra(aluno.nomeGuerra);
                if (!militar) continue;

                await ceobDb.militarCursos.matricular(militar.id, curso.id);
                await ceobDb.militarCursos.finalizarCurso(militar.id, curso.id, 'REPROVADO');
                logsResumo.push(`❌ **${militar.nome_guerra}**: Reprovado.`);
            }

            // 4. Postar no Boletim
            const boletimChannelId = process.env.CANAL_BOLETIM_ID;
            const boletimChannel = await interaction.client.channels.fetch(boletimChannelId);
            if (boletimChannel) {
                const boletimEmbed = new EmbedBuilder()
                    .setTitle(`📢 BOLETIM INTERNO — CONCLUSÃO DE ${cursoSigla}`)
                    .setColor(0x2ECC71)
                    .setDescription(`Publicação oficial de resultados da instrução aplicada em ${mesAno}.`)
                    .addFields(
                        { name: '📚 Turma', value: mesAno, inline: true },
                        { name: '👨‍🏫 Instrutor', value: instrutor.nome_guerra, inline: true },
                        { name: '✍️ Homologado por', value: interaction.user.username, inline: true },
                        { name: '🏆 Aprovados', value: aprovados.map(a => `• ${a.nomeGuerra}`).join('\n') || 'Nenhum' }
                    )
                    .setTimestamp();
                await boletimChannel.send({ embeds: [boletimEmbed] });
            }

            // 5. Finalizar interação Original
            await interaction.editReply({
                content: `✅ Requerimento aprovado e integrado por **${interaction.user.username}**.\n\n**Resumo do Processamento:**\n${logsResumo.join('\n')}`,
                embeds: interaction.message.embeds.map(e => EmbedBuilder.from(e).setColor(0x2ECC71)),
                components: []
            });

        } catch (error) {
            console.error('Erro ao aprovar curso:', error);
            await interaction.followUp({ content: '❌ Erro crítico ao processar aprovação do curso.', ephemeral: true });
        }
    }
}

module.exports = { isCursoButton, handleCursoButton };
