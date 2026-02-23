// src/services/boletimService.js
const { criarEmbedBoletim } = require('../utils/embedBuilder');

/**
 * Gera conteúdo textual do boletim.
 */
function gerarConteudoBoletim({ isAprovacao, patenteNome, nomeGuerra, omSigla, analistaMilitar, motivoDecisao }) {
    if (isAprovacao) {
        return [
            `**INGRESSO NO CEOB (Via Requerimento)**`,
            `O ${patenteNome} **${nomeGuerra}** teve seu ingresso aprovado e foi integrado à OM **${omSigla}**.`,
            `**Aprovado por:** ${analistaMilitar.patente_abrev} ${analistaMilitar.nome_guerra}`,
            `**Justificativa:** ${motivoDecisao}`
        ].join('\n');
    }

    return [
        `**REQUERIMENTO INDEFERIDO**`,
        `O requerimento de ingresso do ${patenteNome} **${nomeGuerra}** foi indeferido.`,
        `**Indeferido por:** ${analistaMilitar.patente_abrev} ${analistaMilitar.nome_guerra}`,
        `**Motivo:** ${motivoDecisao}`
    ].join('\n');
}

/**
 * Cria boletim no banco e publica no canal do Discord.
 */
async function criarEPublicarBoletim(db, client, {
    conteudo,
    requerimentoId,
    timelineEventoId,
    nomeMilitarAlvo,
    analistaMilitar,
    isAprovacao
}) {
    const boletim = await db.boletim.criar({
        conteudo,
        requerimentoId: parseInt(requerimentoId),
        timelineEventoId
    });

    const canalBoletimId = process.env.CANAL_BOLETIM_ID;

    if (canalBoletimId) {
        try {
            const canal = await client.channels.fetch(canalBoletimId);

            const embed = criarEmbedBoletim({
                boletim,
                requerimentoId,
                nomeMilitarAlvo,
                analistaMilitar,
                conteudo,
                isAprovacao
            });

            const msg = await canal.send({ embeds: [embed] });

            await db.connection.query(
                `UPDATE ceob.boletim_eletronico SET discord_message_id = $1 WHERE id = $2`,
                [msg.id, boletim.id]
            );
        } catch (err) {
            console.error('❌ Erro ao enviar boletim para o canal:', err);
        }
    }

    return boletim;
}

module.exports = { gerarConteudoBoletim, criarEPublicarBoletim };