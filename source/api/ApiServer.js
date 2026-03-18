const express = require('express');
const serverTracker = require('../discord/services/serverTrackerService');

class ApiServer {
    constructor(port, apiKey, db) {
        this.port = port;
        this.apiKey = apiKey;
        this.db = db;
        this.app = express();

        this.app.use(express.json());
        this.setupRoutes();
    }

    setupRoutes() {
        this.app.get('/', (req, res) => {
            res.status(200).send("API online.");
        });

        this.app.get('/pending-bans', async (req, res) => {
            try {
                if (req.headers["x-api-key"] !== this.apiKey) {
                    console.log("❌ API: Tentativa de acesso negada (chave inválida).");
                    return res.status(403).json({ error: "Acesso negado" });
                }

                if (!this.db) {
                    return res.status(503).json({ error: "Banco legado não configurado" });
                }

                const bans = await this.db.getAndClearBans();
                console.log(`📤 API: Enviando ${bans.length} bans para o Roblox.`);
                res.json(bans);

            } catch (err) {
                console.error("❌ Erro na API:", err);
                res.status(500).json({ error: "Erro interno" });
            }
        });

        this.app.post('/logs', async (req, res) => {
            try {
                if (req.headers["x-api-key"] !== this.apiKey) {
                    return res.status(403).json({ error: "Acesso negado" });
                }

                if (!this.db) {
                    return res.status(503).json({ error: "Banco legado não configurado" });
                }

                const { userId, action } = req.body;

                if (!userId || !action) {
                    return res.status(400).json({ error: "Faltam parâmetros (userId ou action)" });
                }

                await this.db.addGameLog(userId, action);

                console.log(`📥 API: Log recebido do Roblox -> Usuário ${userId} fez: ${action}`);

                res.status(201).json({ message: "Log salvo com sucesso!" });

            } catch (err) {
                console.error("❌ Erro no POST /logs:", err);
                res.status(500).json({ error: "Erro interno do servidor" });
            }
        });

        // ═══════════════════════════════════════════════════════
        // ENDPOINTS DE MONITORAMENTO DE SERVIDORES ROBLOX
        // ═══════════════════════════════════════════════════════

        // POST /server-start → Roblox avisa que o servidor iniciou
        this.app.post('/server-start', async (req, res) => {
            try {
                if (req.headers["x-api-key"] !== this.apiKey) {
                    return res.status(403).json({ error: "Acesso negado" });
                }

                const { jobId, placeId, serverName } = req.body;

                if (!jobId) {
                    return res.status(400).json({ error: "Falta parâmetro: jobId" });
                }

                await serverTracker.handleServerStart({
                    jobId,
                    placeId: placeId || 'N/A',
                    serverName: serverName || 'Servidor CEOB',
                });

                console.log(`📡 API: Servidor iniciado → JobId: ${jobId}`);
                res.status(201).json({ message: "Servidor registrado com sucesso!" });

            } catch (err) {
                console.error("❌ Erro no POST /server-start:", err);
                res.status(500).json({ error: "Erro interno do servidor" });
            }
        });

        // POST /player-join → Roblox avisa que um player entrou
        this.app.post('/player-join', async (req, res) => {
            try {
                if (req.headers["x-api-key"] !== this.apiKey) {
                    return res.status(403).json({ error: "Acesso negado" });
                }

                const { jobId, playerId, nickname, displayName } = req.body;

                if (!jobId || !playerId) {
                    return res.status(400).json({ error: "Faltam parâmetros: jobId, playerId" });
                }

                await serverTracker.handlePlayerJoin({
                    jobId,
                    playerId,
                    nickname: nickname || 'Desconhecido',
                    displayName: displayName || nickname || 'Desconhecido',
                });

                res.status(201).json({ message: "Player join registrado!" });

            } catch (err) {
                console.error("❌ Erro no POST /player-join:", err);
                res.status(500).json({ error: "Erro interno do servidor" });
            }
        });

        // POST /player-leave → Roblox avisa que um player saiu
        this.app.post('/player-leave', async (req, res) => {
            try {
                if (req.headers["x-api-key"] !== this.apiKey) {
                    return res.status(403).json({ error: "Acesso negado" });
                }

                const { jobId, playerId, nickname } = req.body;

                if (!jobId || !playerId) {
                    return res.status(400).json({ error: "Faltam parâmetros: jobId, playerId" });
                }

                await serverTracker.handlePlayerLeave({
                    jobId,
                    playerId,
                    nickname: nickname || 'Desconhecido',
                });

                res.status(200).json({ message: "Player leave registrado!" });

            } catch (err) {
                console.error("❌ Erro no POST /player-leave:", err);
                res.status(500).json({ error: "Erro interno do servidor" });
            }
        });

        // POST /server-stop → Roblox avisa que o servidor encerrou
        this.app.post('/server-stop', async (req, res) => {
            try {
                if (req.headers["x-api-key"] !== this.apiKey) {
                    return res.status(403).json({ error: "Acesso negado" });
                }

                const { jobId } = req.body;

                if (!jobId) {
                    return res.status(400).json({ error: "Falta parâmetro: jobId" });
                }

                await serverTracker.handleServerStop({ jobId });

                res.status(200).json({ message: "Servidor encerrado registrado!" });

            } catch (err) {
                console.error("❌ Erro no POST /server-stop:", err);
                res.status(500).json({ error: "Erro interno do servidor" });
            }
        });

        // GET /servers → Lista todos os servidores ativos
        this.app.get('/servers', (req, res) => {
            try {
                if (req.headers["x-api-key"] !== this.apiKey) {
                    return res.status(403).json({ error: "Acesso negado" });
                }

                const servers = serverTracker.getActiveServers();
                res.json({ count: servers.length, servers });

            } catch (err) {
                console.error("❌ Erro no GET /servers:", err);
                res.status(500).json({ error: "Erro interno do servidor" });
            }
        });
    }

    start() {
        this.app.listen(this.port, '0.0.0.0', () => {
            console.log(`🚀 API: Servidor Express rodando na porta ${this.port}`);
        });
    }
}

module.exports = ApiServer;

