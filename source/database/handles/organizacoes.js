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
    async getListaEfetivo(omId) {
        const { rows } = await this.connection.query(
            `SELECT m.id, m.matricula, m.nome_guerra, m.roblox_user_id, m.roblox_username,
                    m.data_ingresso, m.data_ultima_promocao,
                    p.nome AS patente_nome, p.ordem_precedencia,
                    f.nome AS funcao_nome
             FROM ceob.militares m
             JOIN ceob.patentes p ON m.patente_id = p.id
             LEFT JOIN ceob.militar_funcoes mf ON m.id = mf.militar_id AND mf.ativo = true
             LEFT JOIN ceob.funcoes f ON mf.funcao_id = f.id
             WHERE m.om_lotacao_id = $1 AND m.ativo = true AND m.situacao_funcional = 'ATIVO'
             ORDER BY p.ordem_precedencia ASC, m.nome_guerra ASC`,
            [omId]
        );
        return rows;
    }
}

module.exports = OrganizacoesHandle;