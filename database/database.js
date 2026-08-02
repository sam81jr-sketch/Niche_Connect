const { Low } = require("lowdb");
const { JSONFile } = require("lowdb/node");
const path = require("path");
const fs = require("fs");

// ==========================================
// DATABASE FILE
// ==========================================

const dbDirectory = __dirname;
const dbFile = path.join(dbDirectory, "db.json");

// Make sure database folder exists
if (!fs.existsSync(dbDirectory)) {
    fs.mkdirSync(dbDirectory, {
        recursive: true
    });
}

// ==========================================
// DEFAULT DATABASE
// ==========================================

const defaultData = {
    users: [],
    messages: [],
    reports: [],
    bans: [],
    rooms: [],
    calls: []
};

// ==========================================
// LOWDB
// ==========================================

const adapter = new JSONFile(dbFile);

const db = new Low(
    adapter,
    defaultData
);

// ==========================================
// INITIALIZE DATABASE
// ==========================================

async function initDatabase() {

    await db.read();

    if (!db.data) {
        db.data = {
            users: [],
            messages: [],
            reports: [],
            bans: [],
            rooms: [],
            calls: []
        };
    }

    // Protect old database files
    if (!Array.isArray(db.data.users)) {
        db.data.users = [];
    }

    if (!Array.isArray(db.data.messages)) {
        db.data.messages = [];
    }

    if (!Array.isArray(db.data.reports)) {
        db.data.reports = [];
    }

    if (!Array.isArray(db.data.bans)) {
        db.data.bans = [];
    }

    if (!Array.isArray(db.data.rooms)) {
        db.data.rooms = [];
    }

    if (!Array.isArray(db.data.calls)) {
        db.data.calls = [];
    }

    await db.write();

    console.log("Database initialized successfully.");
    console.log("Database:", dbFile);
}

module.exports = {
    db,
    initDatabase
};
