const { Pool } = require('pg');

class ConnectionHandle {
    constructor(databaseUrl) {
        this.pool = new Pool({
            connectionString: databaseUrl,
            ssl: process.env.DB_SSL === 'false' ? false : { rejectUnauthorized: false }
        });
    }

    async query(text, params = []) {
        return this.pool.query(text, params);
    }

    async getClient() {
        return this.pool.connect();
    }

    async close() {
        await this.pool.end();
    }
}

module.exports = ConnectionHandle;