const fs = require('fs');
const path = require('path');

class MigrationHandle {
    constructor(connection) {
        this.connection = connection;
        this.schemaDir = path.join(__dirname, '..', '..', 'schema');
    }

    async init() {
        const client = await this.connection.getClient();
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
}

module.exports = MigrationHandle;