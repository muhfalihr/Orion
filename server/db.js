const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

const dbPath = process.env.DATABASE_URL || path.join(__dirname, '../data/builder.db');

// Ensure data directory exists
const dataDir = path.dirname(dbPath);
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

const db = new Database(dbPath);

// Initialize DB with multi-repo support
db.exec(`
  CREATE TABLE IF NOT EXISTS tags (
    repo TEXT,
    tag TEXT,
    status TEXT,
    deb_path TEXT,
    rpm_path TEXT,
    docker_image TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (repo, tag)
  );
`);

// Migration: Add docker_image column if it doesn't exist
try {
  db.exec('ALTER TABLE tags ADD COLUMN docker_image TEXT');
} catch (e) {
  // Column might already exist, ignore error
}

module.exports = db;
