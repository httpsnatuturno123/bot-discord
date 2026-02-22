const mysql = require('mysql2/promise');

class Database {
    constructor(databaseUrl) {
        this.pool = mysql.createPool(databaseUrl);
    }

    async init() {
        try {
            await this.pool.query(`
                CREATE TABLE IF NOT EXISTS pending_bans (
                    id INT AUTO_INCREMENT PRIMARY KEY,
                    user_id VARCHAR(255) NOT NULL,
                    reason TEXT
                );
            `);

            await this.pool.query(`
                CREATE TABLE IF NOT EXISTS game_logs (
                    id INT AUTO_INCREMENT PRIMARY KEY,
                    user_id VARCHAR(255) NOT NULL,
                    action TEXT,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                );`
            );

            console.log("✅ Legado: Tabelas 'pending_bans' e 'game_logs' prontas.");
        } catch (error) {
            console.error("❌ Legado: Erro ao inicializar o banco:", error);
        }
    }

    async addBan(userId, reason) {
        await this.pool.query(
            'INSERT INTO pending_bans (user_id, reason) VALUES (?, ?)',
            [userId, reason]
        );
    }

    async getAndClearBans() {
        const [rows] = await this.pool.query('SELECT * FROM pending_bans');
        if (rows.length > 0) {
            await this.pool.query('TRUNCATE TABLE pending_bans');
        }
        return rows;
    }

    async addGameLog(userId, action) {
        await this.pool.query(
            'INSERT INTO game_logs (user_id, action) VALUES (?, ?)',
            [userId, action]
        );
    }
}

module.exports = Database;
