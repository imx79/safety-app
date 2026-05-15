// اتصال قاعدة البيانات المشترك
const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

// دعم مسار مخصص عبر متغير البيئة (مفيد للاستضافة السحابية)
const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, '..');
const DB_PATH = path.join(DATA_DIR, 'db', 'safety.db');

// تأكد من وجود مجلد db
const dbDir = path.dirname(DB_PATH);
if (!fs.existsSync(dbDir)) fs.mkdirSync(dbDir, { recursive: true });

if (!fs.existsSync(DB_PATH)) {
  console.log('⚠️  قاعدة البيانات غير موجودة. شغّل: npm run init-db');
}

const db = new Database(DB_PATH);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

module.exports = db;
