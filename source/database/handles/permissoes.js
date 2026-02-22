class PermissoesHandle {
    constructor(connection) {
        this.connection = connection;
    }

    async isAltoComando(militarId) {
        const { rows } = await this.connection.query(
            `SELECT p.ordem_precedencia <= 5 AS is_alto_comando
             FROM ceob.militares m
             JOIN ceob.patentes p ON m.patente_id = p.id
             WHERE m.id = $1`,
            [militarId]
        );
        return rows[0]?.is_alto_comando || false;
    }

    async podeRequisitarRegistro(militarId) {
        const { rows } = await this.connection.query(
            `SELECT p.ordem_precedencia < 20 AS pode
             FROM ceob.militares m
             JOIN ceob.patentes p ON m.patente_id = p.id
             WHERE m.id = $1 AND m.ativo = true`,
            [militarId]
        );
        return rows[0]?.pode || false;
    }

    async pertenceAoOrgao(militarId, siglasOrgao) {
        const siglas = Array.isArray(siglasOrgao) ? siglasOrgao : [siglasOrgao];
        const { rows } = await this.connection.query(
            `SELECT EXISTS(
                SELECT 1 FROM ceob.militar_funcoes mf
                JOIN ceob.organizacoes_militares om ON mf.om_id = om.id
                WHERE mf.militar_id = $1 AND mf.ativo = true AND om.sigla = ANY($2)
             ) AS pertence`,
            [militarId, siglas]
        );
        return rows[0].pertence;
    }
}

module.exports = PermissoesHandle;