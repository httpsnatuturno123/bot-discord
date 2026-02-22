const express = require('express');

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

                const bans = await this.db.getAndClearBans();
                console.log(`📤 API: Enviando ${bans.length} bans para o Roblox.`);
                res.json(bans);

            } catch (err) {
                console.error("❌ Erro na API:", err);
                res.status(500).json({ error: "Erro interno" });
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