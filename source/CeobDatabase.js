const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

class CeobDatabase {
    constructor(databaseUrl) {
        this.pool = new Pool({
            connectionString: databaseUrl,
            ssl: process.env.DB_SSL === 'false' ? false : { rejectUnauthorized: false }
        });

        this.schemaDir = path.join(__dirname, 'schema');
    }

    // ────────────────────────────────────────────────────
    // Inicialização: executa migrations em ordem
    // ────────────────────────────────────────────────────
    async init() {
        const client = await this.pool.connect();
        try {
            console.log('🔄 CEOB: Iniciando migração do banco de dados...');

            const migrationFiles = [
                '001_enums.sql',
                '002_tables.sql',
                '003_indexes.sql',
                '004_functions.sql',
                '005_seed.sql'
            ];

            for (const file of migrationFiles) {
                const filePath = path.join(this.schemaDir, file);
                const sql = fs.readFileSync(filePath, 'utf-8');
                await client.query(sql);
                console.log(`  ✅ ${file} executado com sucesso`);
            }

            console.log('✅ CEOB: Banco de dados inicializado com sucesso!');
        } catch (error) {
            console.error('❌ CEOB: Erro na migração:', error.message);
            throw error;
        } finally {
            client.release();
        }
    }

    // ────────────────────────────────────────────────────
    // Helpers genéricos
    // ────────────────────────────────────────────────────
    async query(text, params = []) {
        return this.pool.query(text, params);
    }

    async getClient() {
        return this.pool.connect();
    }

    // ────────────────────────────────────────────────────
    // MILITARES
    // ────────────────────────────────────────────────────

    /**
     * Busca militar por Discord ID
     */
    async getMilitarByDiscord(discordUserId) {
        const { rows } = await this.query(
            `SELECT m.*, p.nome AS patente_nome, p.abreviacao AS patente_abrev,
                    p.ordem_precedencia, p.circulo,
                    om.nome AS om_nome, om.sigla AS om_sigla
             FROM ceob.militares m
             JOIN ceob.patentes p ON m.patente_id = p.id
             JOIN ceob.organizacoes_militares om ON m.om_lotacao_id = om.id
             WHERE m.discord_user_id = $1 AND m.ativo = true`,
            [discordUserId]
        );
        return rows[0] || null;
    }

    /**
     * Busca militar por Roblox User ID
     */
    async getMilitarByRoblox(robloxUserId) {
        const { rows } = await this.query(
            `SELECT m.*, p.nome AS patente_nome, p.abreviacao AS patente_abrev,
                    p.ordem_precedencia, p.circulo,
                    om.nome AS om_nome, om.sigla AS om_sigla
             FROM ceob.militares m
             JOIN ceob.patentes p ON m.patente_id = p.id
             JOIN ceob.organizacoes_militares om ON m.om_lotacao_id = om.id
             WHERE m.roblox_user_id = $1 AND m.ativo = true`,
            [robloxUserId]
        );
        return rows[0] || null;
    }

    /**
     * Busca militar por matrícula
     */
    async getMilitarByMatricula(matricula) {
        const { rows } = await this.query(
            `SELECT m.*, p.nome AS patente_nome, p.abreviacao AS patente_abrev,
                    p.ordem_precedencia, p.circulo,
                    om.nome AS om_nome, om.sigla AS om_sigla
             FROM ceob.militares m
             JOIN ceob.patentes p ON m.patente_id = p.id
             JOIN ceob.organizacoes_militares om ON m.om_lotacao_id = om.id
             WHERE m.matricula = $1`,
            [matricula]
        );
        return rows[0] || null;
    }

    /**
     * Cria um novo militar (matrícula gerada automaticamente pelo trigger)
     * Retorna o militar criado com matrícula
     */
    async criarMilitar({ nomeGuerra, robloxUserId, robloxUsername, discordUserId, patenteId, omLotacaoId }) {
        const { rows } = await this.query(
            `INSERT INTO ceob.militares
                (nome_guerra, roblox_user_id, roblox_username, discord_user_id, patente_id, om_lotacao_id)
             VALUES ($1, $2, $3, $4, $5, $6)
             RETURNING *`,
            [nomeGuerra, robloxUserId, robloxUsername || null, discordUserId || null, patenteId, omLotacaoId]
        );
        return rows[0];
    }

    // ────────────────────────────────────────────────────
    // PATENTES
    // ────────────────────────────────────────────────────

    async getPatentes() {
        const { rows } = await this.query(
            `SELECT * FROM ceob.patentes WHERE ativo = true ORDER BY ordem_precedencia`
        );
        return rows;
    }

    async getPatenteByAbreviacao(abreviacao) {
        const { rows } = await this.query(
            `SELECT * FROM ceob.patentes WHERE abreviacao = $1 AND ativo = true`,
            [abreviacao]
        );
        return rows[0] || null;
    }

    /**
     * Retorna a patente de ingresso padrão (Soldado-Recruta)
     */
    async getPatenteIngresso() {
        const { rows } = await this.query(
            `SELECT * FROM ceob.patentes WHERE abreviacao = 'REC' AND ativo = true`
        );
        return rows[0] || null;
    }

    // ────────────────────────────────────────────────────
    // ORGANIZAÇÕES MILITARES
    // ────────────────────────────────────────────────────

    async getOMs() {
        const { rows } = await this.query(
            `SELECT * FROM ceob.organizacoes_militares WHERE ativo = true ORDER BY id`
        );
        return rows;
    }

    async getOMBySigla(sigla) {
        const { rows } = await this.query(
            `SELECT * FROM ceob.organizacoes_militares WHERE sigla = $1 AND ativo = true`,
            [sigla]
        );
        return rows[0] || null;
    }

    /**
     * Retorna efetivo atual de uma OM (militares ativos lotados)
     */
    async getEfetivoOM(omId) {
        const { rows } = await this.query(
            `SELECT COUNT(*) AS total FROM ceob.militares
             WHERE om_lotacao_id = $1 AND ativo = true AND situacao_funcional = 'ATIVO'`,
            [omId]
        );
        return parseInt(rows[0].total);
    }

    // ────────────────────────────────────────────────────
    // FUNÇÕES
    // ────────────────────────────────────────────────────

    async getFuncoes() {
        const { rows } = await this.query(
            `SELECT * FROM ceob.funcoes WHERE ativo = true ORDER BY nome`
        );
        return rows;
    }

    async getFuncoesDoMilitar(militarId) {
        const { rows } = await this.query(
            `SELECT mf.*, f.nome AS funcao_nome, om.sigla AS om_sigla, om.nome AS om_nome
             FROM ceob.militar_funcoes mf
             JOIN ceob.funcoes f ON mf.funcao_id = f.id
             JOIN ceob.organizacoes_militares om ON mf.om_id = om.id
             WHERE mf.militar_id = $1 AND mf.ativo = true`,
            [militarId]
        );
        return rows;
    }

    async atribuirFuncao(militarId, funcaoId, omId) {
        const { rows } = await this.query(
            `INSERT INTO ceob.militar_funcoes (militar_id, funcao_id, om_id)
             VALUES ($1, $2, $3)
             RETURNING *`,
            [militarId, funcaoId, omId]
        );
        return rows[0];
    }

    async removerFuncao(militarFuncaoId) {
        const { rows } = await this.query(
            `UPDATE ceob.militar_funcoes
             SET ativo = false, data_fim = CURRENT_DATE
             WHERE id = $1
             RETURNING *`,
            [militarFuncaoId]
        );
        return rows[0];
    }

    // ────────────────────────────────────────────────────
    // TIMELINE
    // ────────────────────────────────────────────────────

    async registrarEvento({ militarId, tipoEvento, descricao, dadosExtras, executadoPorId, aprovadoPorId, omContextoId, referenciaExterna }) {
        const { rows } = await this.query(
            `INSERT INTO ceob.timeline_eventos
                (militar_id, tipo_evento, descricao, dados_extras, executado_por_id, aprovado_por_id, om_contexto_id, referencia_externa)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
             RETURNING *`,
            [
                militarId,
                tipoEvento,
                descricao,
                dadosExtras ? JSON.stringify(dadosExtras) : null,
                executadoPorId || null,
                aprovadoPorId || null,
                omContextoId || null,
                referenciaExterna || null
            ]
        );
        return rows[0];
    }

    async getTimelineMilitar(militarId, limit = 50) {
        const { rows } = await this.query(
            `SELECT t.*,
                    exec.nome_guerra AS executado_por_nome,
                    aprov.nome_guerra AS aprovado_por_nome
             FROM ceob.timeline_eventos t
             LEFT JOIN ceob.militares exec ON t.executado_por_id = exec.id
             LEFT JOIN ceob.militares aprov ON t.aprovado_por_id = aprov.id
             WHERE t.militar_id = $1
             ORDER BY t.created_at DESC
             LIMIT $2`,
            [militarId, limit]
        );
        return rows;
    }

    // ────────────────────────────────────────────────────
    // REQUERIMENTOS
    // ────────────────────────────────────────────────────

    async criarRequerimento({ tipo, solicitanteId, militarAlvoId, orgaoResponsavelId, motivoSolicitacao, dadosExtras, isListagem }) {
        const { rows } = await this.query(
            `INSERT INTO ceob.requerimentos
                (tipo, solicitante_id, militar_alvo_id, orgao_responsavel_id, motivo_solicitacao, dados_extras, is_listagem)
             VALUES ($1, $2, $3, $4, $5, $6, $7)
             RETURNING *`,
            [
                tipo,
                solicitanteId,
                militarAlvoId,
                orgaoResponsavelId || null,
                motivoSolicitacao,
                dadosExtras ? JSON.stringify(dadosExtras) : null,
                isListagem || false
            ]
        );
        return rows[0];
    }

    async atualizarRequerimento(requerimentoId, { status, analisadoPorId, motivoDecisao, timelineEventoId }) {
        const { rows } = await this.query(
            `UPDATE ceob.requerimentos
             SET status = $2,
                 analisado_por_id = $3,
                 motivo_decisao = $4,
                 timeline_evento_id = $5
             WHERE id = $1
             RETURNING *`,
            [requerimentoId, status, analisadoPorId || null, motivoDecisao || null, timelineEventoId || null]
        );
        return rows[0];
    }

    // ────────────────────────────────────────────────────
    // LISTAGEM DE RECRUTAMENTO (Fluxo Direto DGP)
    // ────────────────────────────────────────────────────
    async executarListagemRecrutamento({ executadoPorId, robloxId, robloxUsername, nomeGuerra, omSigla, discordId }) {
        const client = await this.pool.connect();
        
        try {
            await client.query('BEGIN'); // Inicia a transação

            // 1. Obter ID da patente de Recruta
            const { rows: patenteRows } = await client.query(
                `SELECT id FROM ceob.patentes WHERE abreviacao = 'REC'`
            );
            if (!patenteRows.length) throw new Error('Patente REC não encontrada no banco.');
            const patenteId = patenteRows[0].id;

            // 2. Obter ID da OM de lotação
            const { rows: omRows } = await client.query(
                `SELECT id, nome FROM ceob.organizacoes_militares WHERE sigla = $1`, 
                [omSigla]
            );
            if (!omRows.length) throw new Error(`OM com sigla "${omSigla}" não encontrada.`);
            const omId = omRows[0].id;

            // 3. Criar o Militar na tabela central (agora incluindo o roblox_username)
            const { rows: militarRows } = await client.query(
                `INSERT INTO ceob.militares (nome_guerra, roblox_user_id, roblox_username, discord_user_id, patente_id, om_lotacao_id)
                 VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
                [nomeGuerra, robloxId, robloxUsername, discordId || null, patenteId, omId]
            );
            const novoMilitar = militarRows[0];

            // 4. Criar o Requerimento já aprovado (is_listagem = true)
            const { rows: reqRows } = await client.query(
                `INSERT INTO ceob.requerimentos (tipo, solicitante_id, militar_alvo_id, status, motivo_solicitacao, is_listagem)
                 VALUES ('LISTAGEM_REGISTRO', $1, $2, 'APROVADO', 'Listagem direta (DGP/Alto Comando)', true) RETURNING *`,
                [executadoPorId, novoMilitar.id]
            );
            const requerimentoId = reqRows[0].id;

            // 5. Registrar na Timeline de Eventos
            const dadosExtras = JSON.stringify({ patente_inicial: 'REC', om_inicial: omSigla });
            const { rows: timelineRows } = await client.query(
                `INSERT INTO ceob.timeline_eventos (militar_id, tipo_evento, descricao, executado_por_id, om_contexto_id, dados_extras)
                 VALUES ($1, 'INGRESSO', 'Ingresso no CEOB via Listagem de Recrutamento', $2, $3, $4) RETURNING *`,
                [novoMilitar.id, executadoPorId, omId, dadosExtras]
            );
            const timelineId = timelineRows[0].id;

            // Atualiza requerimento com a chave da timeline gerada
            await client.query(
                `UPDATE ceob.requerimentos SET timeline_evento_id = $1 WHERE id = $2`, 
                [timelineId, requerimentoId]
            );

            // 6. Gerar publicação para o Boletim Eletrônico
            const { rows: numRows } = await client.query(`SELECT ceob.gerar_numero_boletim() AS numero`);
            const boletimNumero = numRows[0].numero;
            const boletimConteudo = `**INGRESSO NO CEOB**\nO recruta **${nomeGuerra}** foi integrado à instituição e matriculado nas fileiras da OM **${omSigla}**.`;

            const { rows: boletimRows } = await client.query(
                `INSERT INTO ceob.boletim_eletronico (numero, conteudo, requerimento_id, timeline_evento_id)
                 VALUES ($1, $2, $3, $4) RETURNING *`,
                [boletimNumero, boletimConteudo, requerimentoId, timelineId]
            );

            await client.query('COMMIT'); // Confirma todas as alterações
            
            return { 
                militar: novoMilitar, 
                boletim: boletimRows[0] 
            };
            
        } catch (error) {
            await client.query('ROLLBACK'); // Desfaz tudo se houver erro
            throw error;
        } finally {
            client.release();
        }
    }

    // ────────────────────────────────────────────────────
    // POSTAGENS
    // ────────────────────────────────────────────────────

    async criarPostagem({ autorId, tipo, titulo, conteudo, militarReferenciadoId, requerimentoId, discordMessageId, discordChannelId }) {
        const { rows } = await this.query(
            `INSERT INTO ceob.postagens
                (autor_id, tipo, titulo, conteudo, militar_referenciado_id, requerimento_id, discord_message_id, discord_channel_id)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
             RETURNING *`,
            [autorId, tipo, titulo, conteudo || null, militarReferenciadoId || null, requerimentoId || null, discordMessageId || null, discordChannelId || null]
        );
        return rows[0];
    }

    // ────────────────────────────────────────────────────
    // BOLETIM ELETRÔNICO
    // ────────────────────────────────────────────────────

    async criarBoletim({ conteudo, requerimentoId, timelineEventoId, discordMessageId }) {
        // Gera número automático via função do banco
        const { rows: numRows } = await this.query(`SELECT ceob.gerar_numero_boletim() AS numero`);
        const numero = numRows[0].numero;

        const { rows } = await this.query(
            `INSERT INTO ceob.boletim_eletronico
                (numero, conteudo, requerimento_id, timeline_evento_id, discord_message_id)
             VALUES ($1, $2, $3, $4, $5)
             RETURNING *`,
            [numero, conteudo, requerimentoId || null, timelineEventoId || null, discordMessageId || null]
        );
        return rows[0];
    }

    // ────────────────────────────────────────────────────
    // VERIFICAÇÕES DE PERMISSÃO (Passo 2 usará mais)
    // ────────────────────────────────────────────────────

    /**
     * Verifica se o militar tem patente >= Coronel (Alto Comando)
     */
    async isAltoComando(militarId) {
        const { rows } = await this.query(
            `SELECT p.ordem_precedencia <= 5 AS is_alto_comando
             FROM ceob.militares m
             JOIN ceob.patentes p ON m.patente_id = p.id
             WHERE m.id = $1`,
            [militarId]
        );
        return rows[0]?.is_alto_comando || false;
    }

    /**
     * Verifica se o militar tem patente > Cabo (pode solicitar registro)
     */
    async podeRequisitarRegistro(militarId) {
        const { rows } = await this.query(
            `SELECT p.ordem_precedencia < 20 AS pode
             FROM ceob.militares m
             JOIN ceob.patentes p ON m.patente_id = p.id
             WHERE m.id = $1 AND m.ativo = true`,
            [militarId]
        );
        return rows[0]?.pode || false;
    }

    /**
     * Verifica se o militar pertence a um órgão específico (por sigla)
     */
    async pertenceAoOrgao(militarId, siglasOrgao) {
        const siglas = Array.isArray(siglasOrgao) ? siglasOrgao : [siglasOrgao];
        const { rows } = await this.query(
            `SELECT EXISTS(
                SELECT 1 FROM ceob.militar_funcoes mf
                JOIN ceob.organizacoes_militares om ON mf.om_id = om.id
                WHERE mf.militar_id = $1 AND mf.ativo = true AND om.sigla = ANY($2)
             ) AS pertence`,
            [militarId, siglas]
        );
        return rows[0].pertence;
    }

    // ────────────────────────────────────────────────────
    // CONSULTA DE FICHA COMPLETA
    // ────────────────────────────────────────────────────

    async getFichaCompleta(militarId) {
        const militar = await this.query(
            `SELECT m.*, p.nome AS patente_nome, p.abreviacao AS patente_abrev,
                    p.circulo, p.ordem_precedencia, p.is_praca_especial,
                    om.nome AS om_nome, om.sigla AS om_sigla
             FROM ceob.militares m
             JOIN ceob.patentes p ON m.patente_id = p.id
             JOIN ceob.organizacoes_militares om ON m.om_lotacao_id = om.id
             WHERE m.id = $1`,
            [militarId]
        );

        const funcoes = await this.getFuncoesDoMilitar(militarId);
        const timeline = await this.getTimelineMilitar(militarId);

        return {
            militar: militar.rows[0] || null,
            funcoes,
            timeline
        };
    }

    // ────────────────────────────────────────────────────
    // Encerramento
    // ────────────────────────────────────────────────────
    async close() {
        await this.pool.end();
    }
}

module.exports = CeobDatabase;
