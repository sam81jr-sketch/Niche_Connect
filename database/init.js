const Database = require("better-sqlite3");
const path = require("path");

const dbPath = path.join(__dirname, "campuschat.db");

const db = new Database(dbPath);

db.pragma("journal_mode = WAL");

db.exec(`

CREATE TABLE IF NOT EXISTS users (

    id INTEGER PRIMARY KEY AUTOINCREMENT,

    username TEXT UNIQUE NOT NULL,

    password TEXT NOT NULL,

    role TEXT DEFAULT 'user',

    strikes INTEGER DEFAULT 0,

    banned_until INTEGER DEFAULT NULL,

    created_at INTEGER DEFAULT (strftime('%s','now'))

);

CREATE TABLE IF NOT EXISTS messages (

    id INTEGER PRIMARY KEY AUTOINCREMENT,

    user_id INTEGER,

    message TEXT NOT NULL,

    created_at INTEGER DEFAULT (strftime('%s','now')),

    FOREIGN KEY(user_id) REFERENCES users(id)

);

CREATE TABLE IF NOT EXISTS reports (

    id INTEGER PRIMARY KEY AUTOINCREMENT,

    reporter_id INTEGER,

    reported_user_id INTEGER,

    message_id INTEGER,

    reason TEXT NOT NULL,

    status TEXT DEFAULT 'pending',

    created_at INTEGER DEFAULT (strftime('%s','now')),

    FOREIGN KEY(reporter_id) REFERENCES users(id),

    FOREIGN KEY(reported_user_id) REFERENCES users(id),

    FOREIGN KEY(message_id) REFERENCES messages(id)

);

`);

console.log("Database initialized successfully.");

db.close();
