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

        let requerimento = null;
        let dadosAlvo = null;

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

            const embed = interaction.message.embeds[0];
            const isRecrutamento = embed && embed.description && embed.description.includes('RECRUTAMENTO');

            try {
                patenteAbrevFinal = interaction.fields.getTextInputValue('patente').trim().toUpperCase();
            } catch (e) {
                if (isRecrutamento) {
                    patenteAbrevFinal = 'REC';
                }
            }

            if (!patenteAbrevFinal && isRecrutamento) {
                patenteAbrevFinal = 'REC';
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

        // ── Ativa militar e Integração Roblox (SE APROVADO) ──
        let feedbackRoblox = '';

        if (isAprovacao) {
            // ── Busca dados do alvo (agora com OM atualizada) ──
            dadosAlvo = await requerimentoService.buscarDadosMilitarAlvo(ceobDb, requerimentoPreview.militar_alvo_id);
            const robloxUserId = dadosAlvo?.robloxUserId || requerimentoPreview.dados_extras?.roblox_user_id;

            if (robloxUserId) {
                // Passa o rank da patente para o Roblox Service
                let patenteRankNumber = null;
                if (patenteAbrevFinal) {
                    const patenteFinal = await ceobDb.patentes.getByAbreviacao(patenteAbrevFinal);
                    patenteRankNumber = patenteFinal ? patenteFinal.ordem_precedencia : null;
                }

                const resultadoRoblox = await robloxService.aceitarEmGrupos(robloxUserId, omSiglaFinal, patenteRankNumber);

                const isRecrutamento = interaction.message.embeds[0]?.description?.includes('RECRUTAMENTO');

                // VALIDAÇÃO RIGOROSA: Se for recrutamento e falhou no grupo principal ou da OM por falta de solicitação
                if (isRecrutamento) {
                    const resPrincipal = resultadoRoblox.resultados.find(r => r.grupo === robloxService.GRUPO_PRINCIPAL);
                    if (resPrincipal && !resPrincipal.sucesso && resPrincipal.detalhe.includes('não enviou solicitação')) {
                        return interaction.editReply(`❌ **Aprovação Cancelada:** O recrutado ainda não solicitou entrada no grupo principal do Roblox (${robloxService.GRUPO_PRINCIPAL}).\nPeça para ele solicitar a entrada e tente aprovar novamente.`);
                    }

                    const grupoOmId = robloxService.OM_GRUPO_MAP[omSiglaFinal];
                    if (grupoOmId) {
                        const resOm = resultadoRoblox.resultados.find(r => r.grupo === String(grupoOmId));
                        if (resOm && !resOm.sucesso && resOm.detalhe.includes('não enviou solicitação')) {
                            return interaction.editReply(`❌ **Aprovação Cancelada:** O recrutado ainda não solicitou entrada no subgrupo da OM **${omSiglaFinal}** (${grupoOmId}).\nPeça para ele solicitar a entrada e tente aprovar novamente.`);
                        }
                    }
                }

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
                feedbackRoblox = '\n\n⚠️ **Atenção:** Roblox User ID não encontrado. A integração com grupos foi **pulada**.';
            }

            // Ativar apenas após passar pela validação do Roblox (se aplicável)
            await requerimentoService.ativarMilitar(ceobDb, requerimentoPreview.militar_alvo_id);
        }

        // ── Atualiza requerimento ──
        requerimento = await ceobDb.requerimentos.atualizar(requerimentoId, {
            status: statusFinal,
            analisadoPorId: analistaMilitar.id,
            motivoDecisao,
            timelineEventoId: null
        });

        if (!requerimento) {
            return interaction.editReply('❌ Falha ao atualizar o requerimento.');
        }

        // ── Busca dados finais do alvo ──
        const dadosAlvoFinais = await requerimentoService.buscarDadosMilitarAlvo(ceobDb, requerimento.militar_alvo_id);

        // ── Registra na timeline ──
        const timelineEvento = await requerimentoService.registrarTimelineRequerimento(ceobDb, {
            requerimentoId,
            requerimento,
            analistaId: analistaMilitar.id,
            nomeMilitarAlvo: dadosAlvoFinais.nomeGuerra,
            motivoDecisao,
            isAprovacao
        });

        // ── Gera e publica boletim ──
        const conteudoBoletim = boletimService.gerarConteudoBoletim({
            isAprovacao,
            patenteNome: patenteAbrevFinal ? (await ceobDb.patentes.getByAbreviacao(patenteAbrevFinal)).nome : dadosAlvoFinais.patenteNome,
            nomeGuerra: dadosAlvoFinais.nomeGuerra,
            omSigla: dadosAlvoFinais.omSigla,
            analistaMilitar,
            motivoDecisao
        });

        const boletim = await boletimService.criarEPublicarBoletim(ceobDb, interaction.client, {
            conteudo: conteudoBoletim,
            requerimentoId,
            timelineEventoId: timelineEvento.id,
            nomeMilitarAlvo: dadosAlvoFinais.nomeGuerra,
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
        if (isAprovacao) {
            await interaction.editReply(
                `✅ Requerimento **#${requerimentoId}** aprovado. O militar **${dadosAlvoFinais.nomeGuerra}** foi ativado na OM **${omSiglaFinal}**. Boletim **${boletim.numero}** publicado.${feedbackRoblox}`
            );
        } else {
            const complemento = 'O registro pendente foi removido';
            await interaction.editReply(
                `❌ Requerimento **#${requerimentoId}** indeferido. ${complemento} e o boletim **${boletim.numero}** foi publicado.`
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