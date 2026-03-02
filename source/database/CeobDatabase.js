const ConnectionHandle = require('./handles/connection');
const MigrationHandle = require('./handles/migration');
const MilitaresHandle = require('./handles/militares');
const PatentesHandle = require('./handles/patentes');
const OrganizacoesHandle = require('./handles/organizacoes');
const FuncoesHandle = require('./handles/funcoes');
const TimelineHandle = require('./handles/timeline');
const RequerimentosHandle = require('./handles/requerimentos');
const ListagemHandle = require('./handles/listagem');
const PostagensHandle = require('./handles/postagens');
const BoletimHandle = require('./handles/boletim');
const PermissoesHandle = require('./handles/permissoes');
const FichaHandle = require('./handles/ficha');
const RequerimentoRecrutamentoHandle = require('./handles/requerimentoRecrutamento');
const RequerimentoListagemHandle = require('./handles/requerimentoListagem');
const CatalogoCursosHandle = require('./handles/catalogoCursos');
const TurmasHandle = require('./handles/turmas');
const MilitarCursosHandle = require('./handles/militarCursos');

class CeobDatabase {
    constructor(databaseUrl) {
        this.connection = new ConnectionHandle(databaseUrl);
        this.migration = new MigrationHandle(this.connection);
        this.militares = new MilitaresHandle(this.connection);
        this.patentes = new PatentesHandle(this.connection);
        this.organizacoes = new OrganizacoesHandle(this.connection);
        this.funcoes = new FuncoesHandle(this.connection);
        this.timeline = new TimelineHandle(this.connection);
        this.requerimentos = new RequerimentosHandle(this.connection);
        this.listagem = new ListagemHandle(this.connection);
        this.postagens = new PostagensHandle(this.connection);
        this.boletim = new BoletimHandle(this.connection);
        this.permissoes = new PermissoesHandle(this.connection);
        this.ficha = new FichaHandle(this.connection, this.funcoes, this.timeline);
        this.requerimentoRecrutamento = new RequerimentoRecrutamentoHandle(this.connection);
        this.requerimentoListagem = new RequerimentoListagemHandle(this.connection);
        this.catalogoCursos = new CatalogoCursosHandle(this.connection);
        this.turmas = new TurmasHandle(this.connection);
        this.cursos = this.turmas; // Alias de retrocompatibilidade
        this.militarCursos = new MilitarCursosHandle(this.connection);
    }

    async init() {
        return this.migration.init();
    }

    async query(text, params = []) {
        return this.connection.query(text, params);
    }

    async getClient() {
        return this.connection.getClient();
    }

    async close() {
        return this.connection.close();
    }
}

module.exports = CeobDatabase;