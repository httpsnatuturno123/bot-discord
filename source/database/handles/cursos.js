class CursosHandle {
    constructor(connection) {
        this.connection = connection;
    }

    /**
     * Cria uma nova turma de curso.
     */
    async criar({ nome, sigla, turma, coordenadorId, instrutorId, auxiliarId, omId = null }) {
        const { rows } = await this.connection.query(
            `INSERT INTO ceob.cursos 
                (nome, sigla, turma, coordenador_id, instrutor_id, auxiliar_id, om_id)
             VALUES ($1, $2, $3, $4, $5, $6, $7)
             RETURNING *`,
            [nome, sigla, turma, coordenadorId, instrutorId, auxiliarId, omId]
        );
        return rows[0];
    }

    /**
     * Retorna todos os cursos ativos, opcionalmente filtrados por OM.
     */
    async listar(omId = null) {
        let query = `
            SELECT c.*, om.sigla AS om_sigla,
                   coord.nome_guerra AS coordenador_nome,
                   inst.nome_guerra AS instrutor_nome,
                   aux.nome_guerra AS auxiliar_nome
            FROM ceob.cursos c
            LEFT JOIN ceob.organizacoes_militares om ON c.om_id = om.id
            JOIN ceob.militares coord ON c.coordenador_id = coord.id
            JOIN ceob.militares inst ON c.instrutor_id = inst.id
            JOIN ceob.militares aux ON c.auxiliar_id = aux.id
            WHERE c.ativo = true
        `;
        const params = [];

        if (omId) {
            query += ` AND (c.om_id = $1 OR c.om_id IS NULL)`;
            params.push(omId);
        }

        query += ` ORDER BY c.created_at DESC`;

        const { rows } = await this.connection.query(query, params);
        return rows;
    }

    /**
     * Busca um curso específico pelo ID.
     */
    async getById(id) {
        const { rows } = await this.connection.query(
            `SELECT c.*, om.sigla AS om_sigla,
                    coord.nome_guerra AS coordenador_nome,
                    inst.nome_guerra AS instrutor_nome,
                    aux.nome_guerra AS auxiliar_nome
             FROM ceob.cursos c
             LEFT JOIN ceob.organizacoes_militares om ON c.om_id = om.id
             JOIN ceob.militares coord ON c.coordenador_id = coord.id
             JOIN ceob.militares inst ON c.instrutor_id = inst.id
             JOIN ceob.militares aux ON c.auxiliar_id = aux.id
             WHERE c.id = $1`,
            [id]
        );
        return rows[0] || null;
    }

    /**
     * Atualiza o status de um curso (PLANEJADO, EM_ANDAMENTO, ENCERRADO).
     */
    async atualizarStatus(id, novoStatus) {
        const { rows } = await this.connection.query(
            `UPDATE ceob.cursos SET status = $1, updated_at = NOW() WHERE id = $2 RETURNING *`,
            [novoStatus, id]
        );
        return rows[0];
    }

    /**
     * Desativa um curso (Soft Delete).
     */
    async desativar(id) {
        const { rows } = await this.connection.query(
            `UPDATE ceob.cursos SET ativo = false, updated_at = NOW() WHERE id = $1 RETURNING *`,
            [id]
        );
        return rows[0];
    }
}

module.exports = CursosHandle;
