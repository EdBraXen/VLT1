const express  = require('express');
const cors     = require('cors');
const path     = require('path');
const { Pool } = require('pg');
require('dotenv').config();

const app  = express();
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname)));

/* ── Database (Supabase / PostgreSQL) ────────── */
const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.NODE_ENV === 'production'
        ? { rejectUnauthorized: false }
        : false
});

/* Create table on first run */
pool.query(`
    CREATE TABLE IF NOT EXISTS vaults (
        id         SERIAL PRIMARY KEY,
        title      TEXT,
        content    TEXT,
        url        TEXT,
        item_type  TEXT DEFAULT 'note',
        created_at TIMESTAMPTZ DEFAULT NOW()
    )
`).catch(err => console.error('DB init error:', err.message));

/* ── API: Create ─────────────────────────────── */
app.post('/api/vaults', async (req, res) => {
    const { title, url, content, item_type } = req.body;
    try {
        const r = await pool.query(
            `INSERT INTO vaults (title, url, content, item_type)
             VALUES ($1, $2, $3, $4) RETURNING *`,
            [title, url, content, item_type || 'note']
        );
        res.json({ id: r.rows[0].id, success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

/* ── API: Read All ───────────────────────────── */
app.get('/api/vaults', async (req, res) => {
    try {
        const r = await pool.query(
            'SELECT * FROM vaults ORDER BY created_at DESC'
        );
        res.json(r.rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

/* ── API: Update ─────────────────────────────── */
app.put('/api/vaults/:id', async (req, res) => {
    const { id } = req.params;
    const { title, url, content, item_type } = req.body;
    try {
        await pool.query(
            `UPDATE vaults SET title=$1, url=$2, content=$3, item_type=$4
             WHERE id=$5`,
            [title, url, content, item_type || 'note', id]
        );
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

/* ── API: Delete ─────────────────────────────── */
app.delete('/api/vaults/:id', async (req, res) => {
    const { id } = req.params;
    try {
        await pool.query('DELETE FROM vaults WHERE id=$1', [id]);
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

/* ── Start Server ────────────────────────────── */
const PORT = process.env.PORT || 3000;
app.listen(PORT, () =>
    console.log(`✅ Server running → http://localhost:${PORT}`)
);

module.exports = app;
