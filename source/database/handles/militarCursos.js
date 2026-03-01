class MilitarCursosHandle {
    constructor(connection) {
        this.connection = connection;
    }

    /**
     * Matricula um militar em um curso.
     */
    async matricular(militarId, cursoId) {
        const { rows } = await this.connection.query(
            `INSERT INTO ceob.militar_cursos (militar_id, curso_id)
             VALUES ($1, $2)
             ON CONFLICT (militar_id, curso_id) DO UPDATE SET updated_at = NOW()
             RETURNING *`,
            [militarId, cursoId]
        );
        return rows[0];
    }

    /**
     * Atualiza a situação de um aluno em um curso específica (APROVADO, REPROVADO, etc).
     */
    async finalizarCurso(militarId, cursoId, status, nota = null) {
        const { rows } = await this.connection.query(
            `UPDATE ceob.militar_cursos 
             SET status_aluno = $1, 
                 nota_final = $2, 
                 data_conclusao = CASE WHEN $1 = 'APROVADO' THEN CURRENT_DATE ELSE data_conclusao END,
                 updated_at = NOW()
             WHERE militar_id = $3 AND curso_id = $4
             RETURNING *`,
            [status, nota, militarId, cursoId]
        );
        return rows[0];
    }

    /**
     * Lista todos os cursos de um militar com detalhes das turmas.
     */
    async getDoMilitar(militarId) {
        const { rows } = await this.connection.query(
            `SELECT mc.*, c.nome AS curso_nome, c.sigla AS curso_sigla, c.turma,
                    coord.nome_guerra AS coordenador_nome
             FROM ceob.militar_cursos mc
             JOIN ceob.cursos c ON mc.curso_id = c.id
             JOIN ceob.militares coord ON c.coordenador_id = coord.id
             WHERE mc.militar_id = $1
             ORDER BY mc.created_at DESC`,
            [militarId]
        );
        return rows;
    }

    /**
     * Lista todos os alunos de uma turma específica.
     */
    async getAlunosDoCurso(cursoId) {
        const { rows } = await this.connection.query(
            `SELECT mc.*, m.nome_guerra, m.matricula, p.abreviacao AS patente_abrev
             FROM ceob.militar_cursos mc
             JOIN ceob.militares m ON mc.militar_id = m.id
             JOIN ceob.patentes p ON m.patente_id = p.id
             WHERE mc.curso_id = $1
             ORDER BY p.ordem_precedencia ASC, m.nome_guerra ASC`,
            [cursoId]
        );
        return rows;
    }
}

module.exports = MilitarCursosHandle;
