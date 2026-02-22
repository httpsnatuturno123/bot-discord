class OrganizacoesHandle {
    constructor(connection) {
        this.connection = connection;
    }

    async getAll() {
        const { rows } = await this.connection.query(
            `SELECT * FROM ceob.organizacoes_militares WHERE ativo = true ORDER BY id`
        );
        return rows;
    }

    async getBySigla(sigla) {
        const { rows } = await this.connection.query(
            `SELECT * FROM ceob.organizacoes_militares WHERE sigla = $1 AND ativo = true`,
            [sigla]
        );
        return rows[0] || null;
    }

    async getEfetivo(omId) {
        const { rows } = await this.connection.query(
            `SELECT COUNT(*) AS total FROM ceob.militares
             WHERE om_lotacao_id = $1 AND ativo = true AND situacao_funcional = 'ATIVO'`,
            [omId]
        );
        return parseInt(rows[0].total);
    }
}

module.exports = OrganizacoesHandle;