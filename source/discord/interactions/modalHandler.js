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

    // ── Se aprovação: capturar novos campos e validar OM ──
    let nomeGuerraFinal = null;
    let omSiglaFinal = null;

    if (isAprovacao) {
        nomeGuerraFinal = interaction.fields.getTextInputValue('nome_guerra').trim();
        omSiglaFinal = interaction.fields.getTextInputValue('om_destino').trim().toUpperCase();

        if (!nomeGuerraFinal) {
            return interaction.editReply('❌ O Nome de Guerra não pode estar vazio.');
        }

        // Validar que a OM existe no banco
        const omExiste = await ceobDb.organizacoes.getBySigla(omSiglaFinal);
        if (!omExiste) {
            return interaction.editReply(`❌ OM com sigla **"${omSiglaFinal}"** não encontrada no sistema. Verifique a sigla e tente novamente.`);
        }

        // Atualizar o militar pendente com o novo nome de guerra e OM
        await ceobDb.connection.query(
            `UPDATE ceob.militares SET nome_guerra = $1, om_lotacao_id = $2, updated_at = NOW() WHERE id = $3`,
            [nomeGuerraFinal, omExiste.id, requerimentoPreview.militar_alvo_id]
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
    if (isAprovacao) {
        await requerimentoService.ativarMilitar(ceobDb, requerimento.militar_alvo_id);

        // ── Integração Roblox: aceitar em grupos ──
        try {
            const robloxUserId = requerimentoPreview.dados_extras?.roblox_user_id;

            if (robloxUserId) {
                const resultadoRoblox = await robloxService.aceitarEmGrupos(robloxUserId, omSiglaFinal);

                const falhas = resultadoRoblox.resultados.filter(r => !r.sucesso);
                if (falhas.length > 0) {
                    console.warn(`⚠️ Algumas integrações Roblox falharam para requerimento #${requerimentoId}:`, falhas);
                }
            } else {
                console.warn(`⚠️ Roblox User ID não encontrado nos dados extras do requerimento #${requerimentoId}. Integração com grupos pulada.`);
            }
        } catch (err) {
            console.error(`❌ Erro na integração Roblox (requerimento #${requerimentoId}):`, err);
            // Não bloqueia a aprovação — apenas loga o erro
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
        patenteNome: dadosAlvo.patenteNome,
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
            `✅ Requerimento **#${requerimentoId}** ${verbo}. O militar **${dadosAlvo.nomeGuerra}** foi ativado na OM **${omSiglaFinal}** e os grupos Roblox foram processados. Boletim **${boletim.numero}** publicado.`
        );
    } else {
        const complemento = 'O registro pendente foi removido';
        await interaction.editReply(
            `❌ Requerimento **#${requerimentoId}** ${verbo}. ${complemento} e o boletim **${boletim.numero}** foi publicado.`
        );
    }
}

module.exports = { isRequerimentoModal, handleRequerimentoModal };