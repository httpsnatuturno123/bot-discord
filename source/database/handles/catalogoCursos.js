class CatalogoCursosHandle {
    constructor(connection) {
        this.connection = connection;
    }

    /**
     * Insere um curso no catálogo ou retorna o existente
     */
    async criar({ nome, sigla }) {
        const { rows } = await this.connection.query(
            `INSERT INTO ceob.catalogo_cursos (nome, sigla)
             VALUES ($1, $2)
             ON CONFLICT (sigla) DO NOTHING
             RETURNING *`,
            [nome, sigla]
        );
        return rows[0] || await this.getBySigla(sigla);
    }

    /**
     * Lista cursos do catálogo
     */
    async listar(apenasAtivos = true) {
        let query = `
            SELECT *, 
                (SELECT COUNT(*) FROM ceob.turmas WHERE curso_id = ceob.catalogo_cursos.id) as total_turmas 
            FROM ceob.catalogo_cursos
        `;
        if (apenasAtivos) {
            query += ` WHERE ativo = true`;
        }
        query += ` ORDER BY nome ASC`;
        const { rows } = await this.connection.query(query);
        return rows;
    }

    /**
     * Busca curso no catálogo pela sigla
     */
    async getBySigla(sigla) {
        const { rows } = await this.connection.query(
            `SELECT * FROM ceob.catalogo_cursos WHERE sigla = $1`,
            [sigla]
        );
        return rows[0] || null;
    }

    /**
     * Busca por ID
     */
    async getById(id) {
        const { rows } = await this.connection.query(
            `SELECT * FROM ceob.catalogo_cursos WHERE id = $1`,
            [id]
        );
        return rows[0] || null;
    }

    /**
     * Soft-delete (ativo = false)
     */
    async arquivar(id) {
        const { rows } = await this.connection.query(
            `UPDATE ceob.catalogo_cursos SET ativo = false, updated_at = NOW() WHERE id = $1 RETURNING *`,
            [id]
        );
        return rows[0] || null;
    }

    /**
     * Reativa um curso (ativo = true)
     */
    async reativar(id) {
        const { rows } = await this.connection.query(
            `UPDATE ceob.catalogo_cursos SET ativo = true, updated_at = NOW() WHERE id = $1 RETURNING *`,
            [id]
        );
        return rows[0] || null;
    }

    /**
     * Verifica se existem turmas ativas vinculadas a este curso.
     * Turmas ativas são aquelas com status 'PLANEJADO' ou 'EM_ANDAMENTO'.
     */
    async temTurmasAtivas(cursoId) {
        const { rows } = await this.connection.query(
            `SELECT COUNT(*) as total 
             FROM ceob.turmas 
             WHERE curso_id = $1 AND status IN ('PLANEJADO', 'EM_ANDAMENTO')`,
            [cursoId]
        );
        return parseInt(rows[0].total) > 0;
    }
}

module.exports = CatalogoCursosHandle;
