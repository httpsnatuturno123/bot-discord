const { EmbedBuilder } = require('discord.js');
const { resolverUsuario } = require('../services/robloxService');

function isTurmaIntegrarModal(customId) {
    return customId.startsWith('modal_turma_matricular_') || customId.startsWith('modal_turma_finalizar_');
}

/**
 * Processa o envio do modal /turma integrar (Matricular ou Finalizar)
 */
async function handleTurmaIntegrarModal(interaction, ceobDb) {
    await interaction.deferReply({ ephemeral: false });

    try {
        const customId = interaction.customId;
        const parts = customId.split('_');
        const acao = parts[2]; // 'matricular' ou 'finalizar'
        const turmaIdStr = parts.pop();
        const turmaId = parseInt(turmaIdStr, 10);

        // 1. Busca e valida Turma
        const turma = await ceobDb.turmas.getById(turmaId);
        if (!turma) {
            return interaction.editReply('❌ Turma não encontrada no banco de dados.');
        }

        // 2. Extrai os Textos do Modal
        const alunosParticipantesTxt = interaction.fields.getTextInputValue('alunos_participantes');

        let alunosAprovadosTxt = '';
        let notasFinaisTxt = '';

        if (acao === 'finalizar') {
            try { alunosAprovadosTxt = interaction.fields.getTextInputValue('alunos_aprovados') || ''; } catch (e) { }
            try { notasFinaisTxt = interaction.fields.getTextInputValue('notas_finais') || ''; } catch (e) { }
        }

        const separarLista = (texto) => texto.split(';').map(s => s.trim()).filter(s => s.length > 0);

        const listaParticipantes = separarLista(alunosParticipantesTxt);
        const listaAprovados = separarLista(alunosAprovadosTxt);

        // Parse de Notas (Formato esperado: Nome:Nota; Nome:Nota)
        const notasMap = new Map();
        if (notasFinaisTxt) {
            const itensNotas = separarLista(notasFinaisTxt);
            for (const item of itensNotas) {
                const [nome, notaStr] = item.split(':').map(s => s.trim());
                if (nome && notaStr) {
                    const notaNum = parseFloat(notaStr.replace(',', '.'));
                    if (!isNaN(notaNum)) {
                        notasMap.set(nome.toLowerCase(), notaNum);
                    }
                }
            }
        }

        if (listaParticipantes.length === 0) {
            return interaction.editReply('❌ Você precisa informar pelo menos um aluno.');
        }

        const resultados = {
            validos: [],
            erros: []
        };

        // 3. Resolver e Validar Alunos (Fail-Fast)
        for (const input of listaParticipantes) {
            try {
                const { userId, username } = await resolverUsuario(input);

                // Busca no banco de dados CEOB
                const militar = await ceobDb.militares.getByRoblox(userId);

                if (!militar) {
                    resultados.erros.push(`Militar \`${input}\` não encontrado no banco de dados CEOB.`);
                    continue;
                }

                // Verifica se já possui o curso *Aprovado* nesta mesma turma (Bloqueio)
                // NOTA: mc.curso_id retornado por getDoMilitar é o turmas.id (não catalogo_cursos.id),
                // pois a FK militar_cursos.curso_id → turmas.id após migração 008.
                const militarCursos = await ceobDb.militarCursos.getDoMilitar(militar.id);
                const jaPossuiCurso = militarCursos.some(mc => mc.curso_id === turma.id && mc.status_aluno === 'APROVADO');

                if (jaPossuiCurso) {
                    resultados.erros.push(`O militar \`${militar.nome_guerra}\` (${username}) já possui este curso concluído/aprovado.`);
                    continue;
                }

                // Define as propriedades de finalização
                let statusFinal = 'CURSANDO';
                let notaFinal = null;

                if (acao === 'finalizar') {
                    const isAprovado = listaAprovados.some(a => a.toLowerCase() === username.toLowerCase() || a === userId);
                    statusFinal = isAprovado ? 'APROVADO' : 'REPROVADO';

                    // Tenta achar a nota
                    if (notasMap.has(username.toLowerCase())) {
                        notaFinal = notasMap.get(username.toLowerCase());
                    } else if (notasMap.has(userId)) {
                        notaFinal = notasMap.get(userId);
                    } else {
                        // Faz uma busca solta pelo nome de guerra
                        for (const [keyName, valNota] of notasMap.entries()) {
                            if (militar.nome_guerra.toLowerCase().includes(keyName) || keyName.includes(militar.nome_guerra.toLowerCase())) {
                                notaFinal = valNota;
                                break;
                            }
                        }
                    }
                }

                resultados.validos.push({
                    id: militar.id,
                    robloxId: userId,
                    nome: militar.nome_guerra,
                    patente: militar.patente_abrev,
                    username: username,
                    status: statusFinal,
                    nota: notaFinal
                });

            } catch (err) {
                resultados.erros.push(`Falha ao resolver \`${input}\` no Roblox.`);
            }
        }

        // 4. Fail-Fast: Aborta TUDO se houver QUALQUER erro
        if (resultados.erros.length > 0) {
            const erroMsg = `⚠️ **Integração Abortada:**\nForam encontrados erros na sua lista. Corrija os nomes/IDs abaixo e tente novamente:\n\n${resultados.erros.map(e => `• ${e}`).join('\n')}`;
            return interaction.editReply(erroMsg);
        }

        // Muda status da turma para EM_ANDAMENTO (se estava como PLANEJADO)
        if (turma.status === 'PLANEJADO') {
            await ceobDb.turmas.atualizarStatus(turma.id, 'EM_ANDAMENTO');
        }

        // 5. Inserir no Banco de Dados
        // NOTA: militar_cursos.curso_id referencia turmas.id (após migração 008),
        // portanto deve-se passar turma.id, e NÃO turma.curso_id (que é o ID do catálogo).
        for (const militarInfo of resultados.validos) {
            // 5a. Garante que está matriculado
            await ceobDb.militarCursos.matricular(militarInfo.id, turma.id);

            // 5b. Se for finalizar, define status e nota
            if (acao === 'finalizar' && militarInfo.status !== 'CURSANDO') {
                await ceobDb.militarCursos.finalizarCurso(militarInfo.id, turma.id, militarInfo.status, militarInfo.nota);
            }
        }

        // 6. Resumo FInal (Embed de Confirmação)
        const tituloAcao = acao === 'matricular' ? '📘 Alunos Matriculados (Cursando)' : '🏆 Alunos Processados e Finalizados';
        const color = acao === 'matricular' ? 0x3498DB : 0x2ECC71;

        const alunosStr = resultados.validos.map(m => {
            let label = `• ${m.patente} **${m.nome}** (${m.username})`;
            if (acao === 'finalizar') {
                const badge = m.status === 'APROVADO' ? '✅' : '❌';
                const notaStr = m.nota !== null ? ` (Nota: ${m.nota})` : '';
                label += ` — ${badge} ${m.status}${notaStr}`;
            }
            return label;
        }).join('\n');

        const embed = new EmbedBuilder()
            .setTitle(`✅ Integração Concluída na Turma #${turma.id}`)
            .setColor(color)
            .setDescription(`**Curso:** ${turma.sigla} - ${turma.identificador_turma}\n**Ação:** ${tituloAcao}\n\n**Lista de Alunos:**\n${alunosStr}`)
            .setFooter({ text: 'CEOB System', iconURL: interaction.client.user.displayAvatarURL() })
            .setTimestamp();

        return interaction.editReply({ content: '', embeds: [embed] });

    } catch (error) {
        console.error('[handleTurmaIntegrarModal] Erro:', error);
        if (interaction.deferred || interaction.replied) {
            await interaction.editReply('❌ Ocorreu um erro interno ao processar a integração.');
        } else {
            await interaction.reply({ content: '❌ Erro interno.', ephemeral: true });
        }
    }
}

module.exports = { isTurmaIntegrarModal, handleTurmaIntegrarModal };
