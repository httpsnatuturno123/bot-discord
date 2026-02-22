class FichaHandle {
    constructor(connection, funcoesHandle, timelineHandle) {
        this.connection = connection;
        this.funcoesHandle = funcoesHandle;
        this.timelineHandle = timelineHandle;
    }

    async getCompleta(militarId) {
        const { rows } = await this.connection.query(
            `SELECT m.*, p.nome AS patente_nome, p.abreviacao AS patente_abrev,
                    p.circulo, p.ordem_precedencia, p.is_praca_especial,
                    om.nome AS om_nome, om.sigla AS om_sigla
             FROM ceob.militares m
             JOIN ceob.patentes p ON m.patente_id = p.id
             JOIN ceob.organizacoes_militares om ON m.om_lotacao_id = om.id
             WHERE m.id = $1`,
            [militarId]
        );

        const funcoes = await this.funcoesHandle.getDoMilitar(militarId);
        const timeline = await this.timelineHandle.getDoMilitar(militarId);

        return {
            militar: rows[0] || null,
            funcoes,
            timeline
        };
    }
}

module.exports = FichaHandle;