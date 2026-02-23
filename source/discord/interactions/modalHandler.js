// src/interactions/modalHandler.js
const requerimentoService = require('../services/requerimentoService');
const boletimService = require('../services/boletimService');
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

    // ── Atualiza requerimento ──
    const requerimento = await ceobDb.requerimentos.atualizar(requerimentoId, {
        status: statusFinal,
        analisadoPorId: analistaMilitar.id,
        motivoDecisao,
        timelineEventoId: null
    });

    if (!requerimento) {
        return interaction.editReply('❌ Requerimento não encontrado no banco de dados.');
    }

    // ── Busca dados do alvo ──
    const dadosAlvo = await requerimentoService.buscarDadosMilitarAlvo(ceobDb, requerimento.militar_alvo_id);

    // ── Ativa militar se aprovado ──
    if (isAprovacao) {
        await requerimentoService.ativarMilitar(ceobDb, requerimento.militar_alvo_id);
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
    const complemento = isAprovacao
        ? 'O militar foi ativado'
        : 'O registro pendente foi removido';

    await interaction.editReply(
        `${isAprovacao ? '✅' : '❌'} Requerimento **#${requerimentoId}** ${verbo}. ${complemento} e o boletim **${boletim.numero}** foi publicado.`
    );
}

module.exports = { isRequerimentoModal, handleRequerimentoModal };