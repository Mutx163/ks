const Database = require('better-sqlite3');
const db = new Database('/opt/ks-api/data/ks.db');

const banks = db.prepare('SELECT id, questions_json FROM banks').all();
for (const bank of banks) {
    if (!bank.questions_json) continue;
    
    try {
        JSON.parse(bank.questions_json);
        console.log(bank.id + ': OK');
    } catch(e) {
        // The stored JSON has literal backslash-quote (\\") which is invalid JSON
        // We need to replace \\" with just "
        let fixed = bank.questions_json.replace(/\\"/g, '"');
        try {
            JSON.parse(fixed);
            db.prepare('UPDATE banks SET questions_json = ? WHERE id = ?').run(fixed, bank.id);
            console.log(bank.id + ': FIXED');
        } catch(e2) {
            console.error(bank.id + ': STILL BROKEN - ' + e2.message);
        }
    }
}
db.close();
console.log('Done!');
