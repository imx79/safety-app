// اتصال قاعدة البيانات المشترك
const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

const DB_PATH = path.join(__dirname, 'safety.db');

// إذا لم تكن قاعدة البيانات موجودة، شغّل التهيئة
if (!fs.existsSync(DB_PATH)) {
  console.log('⚠️  قاعدة البيانات غير موجودة. شغّل: npm run init-db');
}

const db = new Database(DB_PATH);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

module.exports = db;
