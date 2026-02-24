// src/interactions/modalHandler.js
const requerimentoService = require('../services/requerimentoService');
const boletimService = require('../services/boletimService');
const robloxService = require('../services/robloxService');
const { criarEmbedDecisao } = require('../utils/embedBuilder');

const PREFIXOS = {
    APROVAR: 'req_modal_APROVAR_',
    INDEFERIR: 'req_modal_INDEFERIR_'
};

/**
 * Verifica se o modal é de decisão de requerimento.
 */
function isRequerimentoModal(customId) {
    return customId.startsWith('req_modal_');
}

/**
 * Processa a decisão de um requerimento (aprovação ou indeferimento).
 */
async function handleRequerimentoModal(interaction, ceobDb) {
    try {
        const isAprovacao = interaction.customId.startsWith(PREFIXOS.APROVAR);
        const prefixo = isAprovacao ? PREFIXOS.APROVAR : PREFIXOS.INDEFERIR;
        const requerimentoId = interaction.customId.replace(prefixo, '');
        const statusFinal = isAprovacao ? 'APROVADO' : 'INDEFERIDO';

        await interaction.deferReply({ ephemeral: true });

        const motivoDecisao = interaction.fields.getTextInputValue('motivo_decisao');

        // ── Valida analista ──
        const analistaMilitar = await ceobDb.militares.getByDiscord(interaction.user.id);
        if (!analistaMilitar) {
            return interaction.editReply('❌ Você não possui cadastro no sistema.');
        }

        // ── Buscar requerimento antes de prosseguir ──
        const requerimentoPreview = await ceobDb.requerimentos.buscarPorId(requerimentoId);
        if (!requerimentoPreview) {
            return interaction.editReply('❌ Requerimento não encontrado no banco de dados.');
        }

        // ── Se aprovação: capturar novos campos e validar OM e Patente ──
        let nomeGuerraFinal = null;
        let omSiglaFinal = null;
        let patenteAbrevFinal = null;

        if (isAprovacao) {
            nomeGuerraFinal = interaction.fields.getTextInputValue('nome_guerra').trim();
            omSiglaFinal = interaction.fields.getTextInputValue('om_destino').trim().toUpperCase();

            try {
                patenteAbrevFinal = interaction.fields.getTextInputValue('patente').trim().toUpperCase();
            } catch (e) {
                // Em caso de ser modal antigo ou problema lendo o campo, cai para null
            }

            if (!nomeGuerraFinal) {
                return interaction.editReply('❌ O Nome de Guerra não pode estar vazio.');
            }

            if (!patenteAbrevFinal) {
                return interaction.editReply('❌ A Patente não pode estar vazia.');
            }

            // Validar que a OM e Patente existem no banco
            const omExiste = await ceobDb.organizacoes.getBySigla(omSiglaFinal);
            if (!omExiste) {
                return interaction.editReply(`❌ OM com sigla **"${omSiglaFinal}"** não encontrada no sistema. Verifique a sigla e tente novamente.`);
            }

            const patenteExiste = await ceobDb.patentes.getByAbreviacao(patenteAbrevFinal);
            if (!patenteExiste) {
                return interaction.editReply(`❌ Patente com abreviação **"${patenteAbrevFinal}"** não encontrada no sistema. Verifique a sigla e tente novamente.`);
            }

            // Atualizar o militar pendente com o novo nome de guerra, OM e Patente
            await ceobDb.connection.query(
                `UPDATE ceob.militares SET nome_guerra = $1, om_lotacao_id = $2, patente_id = $3, updated_at = NOW() WHERE id = $4`,
                [nomeGuerraFinal, omExiste.id, patenteExiste.id, requerimentoPreview.militar_alvo_id]
            );
        }

        // ── Atualiza requerimento ──
        const requerimento = await ceobDb.requerimentos.atualizar(requerimentoId, {
            status: statusFinal,
            analisadoPorId: analistaMilitar.id,
            motivoDecisao,
            timelineEventoId: null
        });

        if (!requerimento) {
            return interaction.editReply('❌ Falha ao atualizar o requerimento.');
        }

        // ── Busca dados do alvo (agora com OM atualizada) ──
        const dadosAlvo = await requerimentoService.buscarDadosMilitarAlvo(ceobDb, requerimento.militar_alvo_id);

        // ── Ativa militar se aprovado ──
        let feedbackRoblox = '';

        if (isAprovacao) {
            await requerimentoService.ativarMilitar(ceobDb, requerimento.militar_alvo_id);

            // ── Integração Roblox: aceitar em grupos ──
            try {
                const robloxUserId = dadosAlvo?.robloxUserId || requerimentoPreview.dados_extras?.roblox_user_id;

                if (robloxUserId) {
                    // Passa o rank da patente para o Roblox Service
                    let patenteRankNumber = null;
                    if (patenteAbrevFinal) {
                        const patenteFinal = await ceobDb.patentes.getByAbreviacao(patenteAbrevFinal);
                        patenteRankNumber = patenteFinal ? patenteFinal.ordem_precedencia : null;
                    }
                    const resultadoRoblox = await robloxService.aceitarEmGrupos(robloxUserId, omSiglaFinal, patenteRankNumber);

                    // Montar feedback detalhado por grupo
                    const linhasFeedback = resultadoRoblox.resultados.map(r => {
                        if (r.sucesso) {
                            return `✅ Grupo \`${r.grupo}\`: ${r.detalhe}`;
                        } else {
                            return `❌ Grupo \`${r.grupo}\`: ${r.detalhe}${r.erro ? ` — ${r.erro}` : ''}`;
                        }
                    });

                    const falhas = resultadoRoblox.resultados.filter(r => !r.sucesso);
                    if (falhas.length > 0) {
                        feedbackRoblox = `\n\n⚠️ **Atenção — Integração Roblox (falhas detectadas):**\n${linhasFeedback.join('\n')}`;
                        console.warn(`⚠️ Falhas na integração Roblox para requerimento #${requerimentoId}:`, falhas);
                    } else {
                        feedbackRoblox = `\n\n🟢 **Integração Roblox:**\n${linhasFeedback.join('\n')}`;
                    }
                } else {
                    feedbackRoblox = '\n\n⚠️ **Atenção:** Roblox User ID não encontrado nos dados do requerimento. A integração com grupos Roblox foi **pulada**.';
                    console.warn(`⚠️ Roblox User ID não encontrado nos dados extras do requerimento #${requerimentoId}. Integração com grupos pulada.`);
                }
            } catch (err) {
                feedbackRoblox = `\n\n❌ **Erro na integração Roblox:** ${err.message}`;
                console.error(`❌ Erro na integração Roblox (requerimento #${requerimentoId}):`, err);
            }
        }

        // ── Registra na timeline ──
        const timelineEvento = await requerimentoService.registrarTimelineRequerimento(ceobDb, {
            requerimentoId,
            requerimento,
            analistaId: analistaMilitar.id,
            nomeMilitarAlvo: dadosAlvo.nomeGuerra,
            motivoDecisao,
            isAprovacao
        });

        // ── Gera e publica boletim ──
        const conteudoBoletim = boletimService.gerarConteudoBoletim({
            isAprovacao,
            patenteNome: patenteAbrevFinal ? (await ceobDb.patentes.getByAbreviacao(patenteAbrevFinal)).nome : dadosAlvo.patenteNome,
            nomeGuerra: dadosAlvo.nomeGuerra,
            omSigla: dadosAlvo.omSigla,
            analistaMilitar,
            motivoDecisao
        });

        const boletim = await boletimService.criarEPublicarBoletim(ceobDb, interaction.client, {
            conteudo: conteudoBoletim,
            requerimentoId,
            timelineEventoId: timelineEvento.id,
            nomeMilitarAlvo: dadosAlvo.nomeGuerra,
            analistaMilitar,
            isAprovacao
        });

        // ── Atualiza embed original ──
        const embedAtualizado = criarEmbedDecisao({
            embedOriginal: interaction.message.embeds[0],
            analistaMilitar,
            motivoDecisao,
            boletim,
            isAprovacao
        });

        await interaction.message.edit({ embeds: [embedAtualizado], components: [] });

        // ── Limpa militar fantasma se indeferido ──
        if (!isAprovacao && requerimento.militar_alvo_id) {
            await requerimentoService.limparMilitarInativo(ceobDb, requerimentoId, requerimento.militar_alvo_id);
        }

        // ── Resposta final ──
        const verbo = isAprovacao ? 'aprovado' : 'indeferido';

        if (isAprovacao) {
            await interaction.editReply(
                `✅ Requerimento **#${requerimentoId}** ${verbo}. O militar **${dadosAlvo.nomeGuerra}** foi ativado na OM **${omSiglaFinal}**. Boletim **${boletim.numero}** publicado.${feedbackRoblox}`
            );
        } else {
            const complemento = 'O registro pendente foi removido';
            await interaction.editReply(
                `❌ Requerimento **#${requerimentoId}** ${verbo}. ${complemento} e o boletim **${boletim.numero}** foi publicado.`
            );
        }

    } catch (error) {
        console.error('Erro ao processar modal de requerimento:', error);
        try {
            if (interaction.deferred || interaction.replied) {
                await interaction.editReply('❌ Ocorreu um erro interno ao processar a decisão do requerimento.');
            } else {
                await interaction.reply({ content: '❌ Ocorreu um erro interno ao processar a decisão do requerimento.', ephemeral: true });
            }
        } catch (replyErr) {
            console.error('Falha ao enviar resposta de erro:', replyErr);
        }
    }
}

module.exports = { isRequerimentoModal, handleRequerimentoModal };