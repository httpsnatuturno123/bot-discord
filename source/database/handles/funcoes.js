class FuncoesHandle {
    constructor(connection) {
        this.connection = connection;
    }

    async getAll() {
        // Retorna todas as funções ativas de todas as OMs (útil para admin geral)
        const { rows } = await this.connection.query(
            `SELECT f.*, om.sigla AS om_sigla, om.nome AS om_nome 
             FROM ceob.funcoes f
             JOIN ceob.organizacoes_militares om ON f.om_id = om.id
             WHERE f.ativo = true ORDER BY f.nome`
        );
        return rows;
    }

    async getByOm(omId) {
        // Retorna funções ativas de uma OM específica
        const { rows } = await this.connection.query(
            `SELECT * FROM ceob.funcoes WHERE ativo = true AND om_id = $1 ORDER BY nome`,
            [omId]
        );
        return rows;
    }

    async criar(nome, descricao, omId) {
        // Cria uma nova função atrelada a uma OM
        const { rows } = await this.connection.query(
            `INSERT INTO ceob.funcoes (nome, descricao, om_id)
             VALUES ($1, $2, $3)
             RETURNING *`,
            [nome, descricao, omId]
        );
        return rows[0];
    }

    async desativar(funcaoId) {
        // Soft delete de uma função
        const { rows } = await this.connection.query(
            `UPDATE ceob.funcoes
             SET ativo = false
             WHERE id = $1
             RETURNING *`,
            [funcaoId]
        );
        return rows[0];
    }

    async getDoMilitar(militarId) {
        const { rows } = await this.connection.query(
            `SELECT mf.*, f.nome AS funcao_nome, om.sigla AS om_sigla, om.nome AS om_nome
             FROM ceob.militar_funcoes mf
             JOIN ceob.funcoes f ON mf.funcao_id = f.id
             JOIN ceob.organizacoes_militares om ON mf.om_id = om.id
             WHERE mf.militar_id = $1 AND mf.ativo = true`,
            [militarId]
        );
        return rows;
    }

    async atribuir(militarId, funcaoId, omId) {
        const { rows } = await this.connection.query(
            `INSERT INTO ceob.militar_funcoes (militar_id, funcao_id, om_id)
             VALUES ($1, $2, $3)
             RETURNING *`,
            [militarId, funcaoId, omId]
        );
        return rows[0];
    }

    async remover(militarFuncaoId) {
        const { rows } = await this.connection.query(
            `UPDATE ceob.militar_funcoes
             SET ativo = false, data_fim = CURRENT_DATE
             WHERE id = $1
             RETURNING *`,
            [militarFuncaoId]
        );
        return rows[0];
    }

    async exonerarTodas(militarId) {
        const { rows } = await this.connection.query(
            `UPDATE ceob.militar_funcoes
             SET ativo = false, data_fim = CURRENT_DATE
             WHERE militar_id = $1 AND ativo = true
             RETURNING *`,
            [militarId]
        );
        return rows;
    }
}

module.exports = FuncoesHandle;