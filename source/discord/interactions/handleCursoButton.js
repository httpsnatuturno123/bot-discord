const { EmbedBuilder } = require('discord.js');
const { promoverMembro, PATENTE_ROBLOX_RANK_MAP } = require('../services/robloxService');

const CUSTOM_ID_PREFIX = 'curso_';
const TURMA_ENCERRAR_PREFIX = 'turmaencerrar_';

function isCursoButton(customId) {
    return customId.startsWith(CUSTOM_ID_PREFIX) || customId.startsWith(TURMA_ENCERRAR_PREFIX);
}

/**
 * Processa cliques nos botões de Aprovar/Rejeitar do DGP
 */
async function handleCursoButton(interaction, ceobDb) {
    const customIdParts = interaction.customId.split('_');
    const tipoBotao = customIdParts[0]; // 'curso' ou 'turmaencerrar'
    const acao = customIdParts[1]; // 'confirmar' ou 'rejeitar'

    // O restante dos parâmetros muda dependendo da origem:
    // curso_: curso_acao_instrutorDiscordId_cursoSigla
    // turmaencerrar_: turmaencerrar_acao_turmaId
    const param3 = customIdParts[2];
    const param4 = customIdParts[3];

    if (acao === 'rejeitar') {
        const embedOriginal = interaction.message.embeds[0];

        // Se for encerramento de turma, talvez seja bom voltar a turma pra EM_ANDAMENTO
        // Porém como a turma só gera requerimento, ela ainda está EM_ANDAMENTO aguardando.
        // A rigor não precisa mudar status no banco, apenas avisar rejeição.

        return interaction.update({
            content: `❌ Requerimento rejeitado por **${interaction.user.username}**.`,
            embeds: [EmbedBuilder.from(embedOriginal).setColor(0xFF0000)],
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
                const match = linha.match(/• (.+?) \*\*(.+)\*\* \((.+)\) - (✅|❌)/);
                if (match) {
                    const [_, patenteAbrev, nomeGuerra, username, icon] = match;
                    if (icon === '✅') {
                        aprovados.push({ patenteAbrev, nomeGuerra, username });
                    } else {
                        reprovados.push({ patenteAbrev, nomeGuerra, username });
                    }
                }
            }

            // 1. Identificar Turma e Curso
            let turma = null;
            let curso = null;
            let instrutor = null;
            let mesAno = '';
            let cursoSigla = '';

            if (tipoBotao === 'turmaencerrar') {
                const turmaId = parseInt(param3, 10);
                turma = await ceobDb.turmas.getById(turmaId);

                if (!turma) {
                    return interaction.followUp({ content: `❌ Turma #${turmaId} não encontrada no banco de dados.`, ephemeral: true });
                }

                curso = await ceobDb.catalogoCursos.getBySigla(turma.sigla);
                instrutor = await ceobDb.militares.getById(turma.coordenador_id);
                mesAno = turma.identificador_turma;
                cursoSigla = turma.sigla;

            } else {
                // Fluxo Legado /curso aplicar
                const instrutorDiscordId = param3;
                cursoSigla = param4;

                const agora = new Date();
                mesAno = agora.toLocaleDateString('pt-BR', { month: 'short', year: 'numeric' }).toUpperCase();

                instrutor = await ceobDb.militares.getByDiscord(instrutorDiscordId);

                if (!instrutor) {
                    return interaction.followUp({ content: `❌ Instrutor original não encontrado.`, ephemeral: true });
                }

                curso = await ceobDb.catalogoCursos.getBySigla(cursoSigla);
                if (!curso) {
                    curso = await ceobDb.catalogoCursos.criar({
                        nome: `Curso de ${cursoSigla}`,
                        sigla: cursoSigla
                    });
                }

                turma = await ceobDb.turmas.getBySiglaETurma(cursoSigla, mesAno);

                if (!turma) {
                    turma = await ceobDb.turmas.criar({
                        cursoId: curso.id,
                        identificadorTurma: mesAno,
                        coordenadorId: instrutor.id,
                        instrutorId: instrutor.id,
                        auxiliarId: instrutor.id
                    });
                }
            }

            // Garante que a turma ficará como ENCERRADO
            if (turma.status !== 'ENCERRADO') {
                await ceobDb.turmas.encerrar(turma.id);
            }

            const logsResumo = [];

            // 2. Processar Aprovados
            for (const aluno of aprovados) {
                const militar = await ceobDb.militares.getByNomeGuerra(aluno.nomeGuerra);
                if (!militar) continue;

                // Matrícula e Finalização
                await ceobDb.militarCursos.matricular(militar.id, turma.id);
                await ceobDb.militarCursos.finalizarCurso(militar.id, turma.id, 'APROVADO');

                // Registro na Timeline
                await ceobDb.timeline.registrarEvento({
                    militarId: militar.id,
                    tipoEvento: 'CONCLUSAO_CURSO',
                    descricao: `Concluiu com aproveitamento o ${cursoSigla} (${mesAno}). Instrutor: ${instrutor.nome_guerra}.`,
                    executadoPorId: instrutor.id
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
                    await ceobDb.militares.atualizarPatente(militar.id, novaPatente.id);

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

                await ceobDb.militarCursos.matricular(militar.id, turma.id);
                await ceobDb.militarCursos.finalizarCurso(militar.id, turma.id, 'REPROVADO');
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
