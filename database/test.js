const { db, initDatabase } = require("./database");

async function test() {

    await initDatabase();

    console.log("Database loaded successfully.");

    console.log(db.data);
}

test();
