class PatentesHandle {
    constructor(connection) {
        this.connection = connection;
    }

    async getAll() {
        const { rows } = await this.connection.query(
            `SELECT * FROM ceob.patentes WHERE ativo = true ORDER BY ordem_precedencia`
        );
        return rows;
    }

    async getByAbreviacao(abreviacao) {
        const { rows } = await this.connection.query(
            `SELECT * FROM ceob.patentes WHERE abreviacao = $1 AND ativo = true`,
            [abreviacao]
        );
        return rows[0] || null;
    }

    async getIngresso() {
        const { rows } = await this.connection.query(
            `SELECT * FROM ceob.patentes WHERE abreviacao = 'REC' AND ativo = true`
        );
        return rows[0] || null;
    }
}

module.exports = PatentesHandle;