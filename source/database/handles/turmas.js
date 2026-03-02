class TurmasHandle {
    constructor(connection) {
        this.connection = connection;
    }

    /**
     * Cria uma nova turma vinculada a um curso do catálogo.
     */
    async criar({ cursoId, identificadorTurma, coordenadorId, instrutorId, auxiliarId, omId = null }) {
        const { rows } = await this.connection.query(
            `INSERT INTO ceob.turmas 
                (curso_id, identificador_turma, coordenador_id, instrutor_id, auxiliar_id, om_id)
             VALUES ($1, $2, $3, $4, $5, $6)
             RETURNING *`,
            [cursoId, identificadorTurma, coordenadorId, instrutorId, auxiliarId, omId]
        );
        return rows[0];
    }

    /**
     * Retorna todas as turmas ativas, opcionalmente filtradas por OM, com JOIN no catálogo.
     */
    async listar(omId = null) {
        let query = `
            SELECT t.*, cc.nome AS nome, cc.sigla AS sigla, om.sigla AS om_sigla,
                   coord.nome_guerra AS coordenador_nome,
                   inst.nome_guerra AS instrutor_nome,
                   aux.nome_guerra AS auxiliar_nome
            FROM ceob.turmas t
            JOIN ceob.catalogo_cursos cc ON t.curso_id = cc.id
            LEFT JOIN ceob.organizacoes_militares om ON t.om_id = om.id
            JOIN ceob.militares coord ON t.coordenador_id = coord.id
            LEFT JOIN ceob.militares inst ON t.instrutor_id = inst.id
            LEFT JOIN ceob.militares aux ON t.auxiliar_id = aux.id
            WHERE t.ativo = true
        `;
        const params = [];

        if (omId) {
            query += ` AND (t.om_id = $1 OR t.om_id IS NULL)`;
            params.push(omId);
        }

        query += ` ORDER BY t.created_at DESC`;

        const { rows } = await this.connection.query(query, params);
        return rows;
    }

    /**
     * Busca uma turma específica pelo ID com JOIN no catálogo.
     */
    async getById(id) {
        const { rows } = await this.connection.query(
            `SELECT t.*, cc.nome AS nome, cc.sigla AS sigla, om.sigla AS om_sigla,
                    coord.nome_guerra AS coordenador_nome,
                    inst.nome_guerra AS instrutor_nome,
                    aux.nome_guerra AS auxiliar_nome
             FROM ceob.turmas t
             JOIN ceob.catalogo_cursos cc ON t.curso_id = cc.id
             LEFT JOIN ceob.organizacoes_militares om ON t.om_id = om.id
             JOIN ceob.militares coord ON t.coordenador_id = coord.id
             LEFT JOIN ceob.militares inst ON t.instrutor_id = inst.id
             LEFT JOIN ceob.militares aux ON t.auxiliar_id = aux.id
             WHERE t.id = $1`,
            [id]
        );
        return rows[0] || null;
    }

    /**
     * Busca turma por sigla do catálogo + identificador da turma.
     */
    async getBySiglaETurma(sigla, identificadorTurma) {
        const { rows } = await this.connection.query(
            `SELECT t.*
             FROM ceob.turmas t
             JOIN ceob.catalogo_cursos cc ON t.curso_id = cc.id
             WHERE cc.sigla = $1 AND t.identificador_turma = $2`,
            [sigla, identificadorTurma]
        );
        return rows[0] || null;
    }

    /**
     * Atualiza o status de uma turma (PLANEJADO, EM_ANDAMENTO, ENCERRADO).
     */
    async atualizarStatus(id, novoStatus) {
        const { rows } = await this.connection.query(
            `UPDATE ceob.turmas 
             SET status = $1, 
                 data_encerramento = CASE WHEN $1 = 'ENCERRADO' THEN NOW() ELSE data_encerramento END,
                 updated_at = NOW() 
             WHERE id = $2 RETURNING *`,
            [novoStatus, id]
        );
        return rows[0];
    }

    /**
     * Congela a turma (status=ENCERRADO, data_encerramento=NOW).
     */
    async encerrar(id) {
        const { rows } = await this.connection.query(
            `UPDATE ceob.turmas 
             SET status = 'ENCERRADO', data_encerramento = NOW(), updated_at = NOW() 
             WHERE id = $1 RETURNING *`,
            [id]
        );
        return rows[0];
    }

    /**
     * Desativa uma turma (Soft Delete).
     */
    async desativar(id) {
        const { rows } = await this.connection.query(
            `UPDATE ceob.turmas SET ativo = false, updated_at = NOW() WHERE id = $1 RETURNING *`,
            [id]
        );
        return rows[0];
    }

    /**
     * Lista turmas ativas por sigla do curso (para o select menu do /turma gerenciar).
     */
    async listarPorSigla(sigla) {
        const { rows } = await this.connection.query(
            `SELECT t.*, cc.nome AS nome, cc.sigla AS sigla, om.sigla AS om_sigla,
                    coord.nome_guerra AS coordenador_nome,
                    inst.nome_guerra AS instrutor_nome,
                    aux.nome_guerra AS auxiliar_nome
             FROM ceob.turmas t
             JOIN ceob.catalogo_cursos cc ON t.curso_id = cc.id
             LEFT JOIN ceob.organizacoes_militares om ON t.om_id = om.id
             JOIN ceob.militares coord ON t.coordenador_id = coord.id
             LEFT JOIN ceob.militares inst ON t.instrutor_id = inst.id
             LEFT JOIN ceob.militares aux ON t.auxiliar_id = aux.id
             WHERE cc.sigla = $1 AND t.ativo = true
             ORDER BY t.created_at DESC`,
            [sigla]
        );
        return rows;
    }
}

module.exports = TurmasHandle;
