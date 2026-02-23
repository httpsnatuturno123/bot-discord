// src/services/requerimentoService.js

/**
 * Busca dados completos do militar alvo pelo ID.
 */
async function buscarDadosMilitarAlvo(db, militarAlvoId) {
    const { rows } = await db.connection.query(
        `SELECT m.nome_guerra, m.matricula, om.sigla AS om_sigla, p.nome AS patente_nome
         FROM ceob.militares m
         JOIN ceob.organizacoes_militares om ON m.om_lotacao_id = om.id
         JOIN ceob.patentes p ON m.patente_id = p.id
         WHERE m.id = $1`,
        [militarAlvoId]
    );

    if (rows.length > 0) {
        return {
            nomeGuerra: rows[0].nome_guerra,
            omSigla: rows[0].om_sigla,
            patenteNome: rows[0].patente_nome
        };
    }

    return {
        nomeGuerra: `ID #${militarAlvoId}`,
        omSigla: '',
        patenteNome: 'Recruta'
    };
}

/**
 * Ativa um militar (marca como ativo).
 */
async function ativarMilitar(db, militarId) {
    await db.connection.query(
        `UPDATE ceob.militares SET ativo = true, updated_at = NOW() WHERE id = $1`,
        [militarId]
    );
}

/**
 * Remove militar fantasma (inativo) e desvincula do requerimento.
 */
async function limparMilitarInativo(db, requerimentoId, militarAlvoId) {
    try {
        await db.connection.query(
            `UPDATE ceob.requerimentos SET militar_alvo_id = NULL WHERE id = $1`,
            [requerimentoId]
        );
        await db.connection.query(
            `DELETE FROM ceob.militares WHERE id = $1 AND ativo = false`,
            [militarAlvoId]
        );
    } catch (err) {
        console.error('⚠️ Erro ao limpar militar inativo após indeferimento:', err);
    }
}

/**
 * Registra evento na timeline e vincula ao requerimento.
 */
async function registrarTimelineRequerimento(db, {
    requerimentoId,
    requerimento,
    analistaId,
    nomeMilitarAlvo,
    motivoDecisao,
    isAprovacao
}) {
    const tipoEvento = isAprovacao ? 'INGRESSO' : 'OBSERVACAO';
    const statusFinal = isAprovacao ? 'APROVADO' : 'INDEFERIDO';

    const timelineMilitarId = isAprovacao
        ? requerimento.militar_alvo_id
        : (requerimento.solicitante_id === requerimento.militar_alvo_id
            ? requerimento.militar_alvo_id
            : requerimento.solicitante_id);

    const descricao = isAprovacao
        ? `Ingresso no CEOB aprovado via Requerimento #${requerimentoId}. Justificativa: ${motivoDecisao}`
        : `Requerimento de ingresso #${requerimentoId} para "${nomeMilitarAlvo}" foi indeferido. Motivo: ${motivoDecisao}`;

    const evento = await db.timeline.registrarEvento({
        militarId: timelineMilitarId,
        tipoEvento,
        descricao,
        executadoPorId: analistaId,
        dadosExtras: { requerimento_id: requerimentoId, decisao: statusFinal }
    });

    await db.connection.query(
        `UPDATE ceob.requerimentos SET timeline_evento_id = $1 WHERE id = $2`,
        [evento.id, requerimentoId]
    );

    return evento;
}

module.exports = {
    buscarDadosMilitarAlvo,
    ativarMilitar,
    limparMilitarInativo,
    registrarTimelineRequerimento
};