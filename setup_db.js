const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
});

async function run() {
    try {
        console.log("Connecting to Supabase...");
        await pool.query(`
        CREATE TABLE IF NOT EXISTS vaults (
            id SERIAL PRIMARY KEY,
            title VARCHAR(255) NOT NULL,
            content TEXT,
            url VARCHAR(2048),
            item_type VARCHAR(20),
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
        `);
        console.log("Database schema created successfully!");
    } catch(err) {
        console.error("Error creating schema:", err);
    } finally {
        pool.end();
    }
}
run();
