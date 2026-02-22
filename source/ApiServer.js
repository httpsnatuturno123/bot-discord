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

        // NOVA ROTA POST: O Roblox vai enviar dados para cá
        this.app.post('/logs', async (req, res) => {
            try {
                // 1. Verifica a segurança (API KEY)
                if (req.headers["x-api-key"] !== this.apiKey) {
                    return res.status(403).json({ error: "Acesso negado" });
                }

                // 2. Extrai os dados que o Roblox enviou no "corpo" (body) da requisição
                const { userId, action } = req.body;

                if (!userId || !action) {
                    return res.status(400).json({ error: "Faltam parâmetros (userId ou action)" });
                }

                // 3. Salva no banco de dados
                await this.db.addGameLog(userId, action);
                
                console.log(`📥 API: Log recebido do Roblox -> Usuário ${userId} fez: ${action}`);
                
                // 4. Responde ao Roblox que deu tudo certo
                res.status(201).json({ message: "Log salvo com sucesso!" });

            } catch (err) {
                console.error("❌ Erro no POST /logs:", err);
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