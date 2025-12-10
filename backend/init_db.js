// backend/init_db.js
const { pool } = require('./db');
const fs = require('fs');
const path = require('path');

async function init() {
    const client = await pool.connect();
    try {
        console.log("⏳ Beginning Database Migration...");
        
        // List your schema files here in order
        const schemaFiles = [
            'modules/auth/schema.sql',
            'modules/loans/schema.sql',
            'modules/payments/schema.sql',
            'modules/deposits/schema.sql',
            'modules/settings/schema.sql',
            'modules/notifications/schema.sql'
        ];

        for (const file of schemaFiles) {
            const filePath = path.join(__dirname, file);
            if (fs.existsSync(filePath)) {
                const sql = fs.readFileSync(filePath, 'utf8');
                await client.query(sql);
                console.log(`✅ Executed: ${file}`);
            }
        }
        console.log("🚀 Database is ready for Client Testing!");
    } catch (err) {
        console.error("❌ Migration Failed:", err);
    } finally {
        client.release();
        pool.end();
    }
}

init();