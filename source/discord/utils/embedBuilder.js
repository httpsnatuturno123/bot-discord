// src/utils/embedBuilder.js

/**
 * Cria embed do boletim para envio no canal.
 */
function criarEmbedBoletim({ boletim, requerimentoId, nomeMilitarAlvo, analistaMilitar, conteudo, isAprovacao }) {
    const cor = isAprovacao ? 0x2ECC71 : 0xE74C3C;
    const sufixo = isAprovacao ? 'Aprovação' : 'Indeferimento';

    return {
        title: `📄 Boletim Interno — ${boletim.numero} (${sufixo})`,
        description: conteudo,
        color: cor,
        fields: [
            { name: '🆔 Protocolo', value: `#${requerimentoId}`, inline: true },
            { name: '🎖️ Militar', value: nomeMilitarAlvo, inline: true },
            { name: '✍️ Analisado por', value: `${analistaMilitar.patente_abrev} ${analistaMilitar.nome_guerra}`, inline: true }
        ],
        footer: { text: 'DGP — Departamento Geral do Pessoal' },
        timestamp: new Date().toISOString()
    };
}

/**
 * Cria embed atualizado para a mensagem original do requerimento.
 */
function criarEmbedDecisao({ embedOriginal, analistaMilitar, motivoDecisao, boletim, isAprovacao }) {
    const cor = isAprovacao ? 0x2ECC71 : 0xE74C3C;
    const statusTexto = isAprovacao ? '✅ APROVADO' : '❌ INDEFERIDO';

    return {
        ...embedOriginal.data,
        color: cor,
        footer: {
            text: `${statusTexto} por ${analistaMilitar.patente_abrev} ${analistaMilitar.nome_guerra}`
        },
        fields: [
            ...embedOriginal.fields,
            { name: '📋 Decisão', value: `**${statusTexto}**`, inline: true },
            { name: '💬 Justificativa', value: motivoDecisao, inline: false },
            { name: '📄 Boletim', value: `${boletim.numero}`, inline: true }
        ]
    };
}

module.exports = { criarEmbedBoletim, criarEmbedDecisao };