// خادم Express الرئيسي
const express = require('express');
const session = require('express-session');
const bodyParser = require('body-parser');
const cookieParser = require('cookie-parser');
const path = require('path');
const fs = require('fs');

const PORT = process.env.PORT || 3000;
const SESSION_SECRET = process.env.SESSION_SECRET || 'safety-app-secret-change-me';

// تشغيل التهيئة إذا لم تكن قاعدة البيانات موجودة
const DATA_DIR = process.env.DATA_DIR || __dirname;
const DB_PATH = path.join(DATA_DIR, 'db', 'safety.db');
if (!fs.existsSync(DB_PATH)) {
  console.log('🆕 قاعدة البيانات غير موجودة - يتم التهيئة...');
  require('./db/init');
}

// إضافة جدول استعادة كلمة المرور إن لم يكن موجوداً
const db = require('./db/connection');
db.exec(`
  CREATE TABLE IF NOT EXISTS password_resets (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    code TEXT NOT NULL,
    expires_at DATETIME NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  )
`);

// إضافة أعمدة جديدة لقوالب التقارير (تحديث تدريجي)
['page_settings_json', 'template_file_path'].forEach(col => {
  try { db.exec(`ALTER TABLE templates ADD COLUMN ${col} TEXT`); } catch(e) {}
});

// جدول مكتبة النماذج والخطابات
db.exec(`
  CREATE TABLE IF NOT EXISTS document_library (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name_ar TEXT NOT NULL,
    name_en TEXT,
    category TEXT NOT NULL DEFAULT 'general',
    description TEXT,
    file_path TEXT NOT NULL,
    file_type TEXT NOT NULL,
    original_name TEXT NOT NULL,
    file_size INTEGER DEFAULT 0,
    version INTEGER DEFAULT 1,
    tags TEXT,
    is_active INTEGER DEFAULT 1,
    created_by INTEGER,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (created_by) REFERENCES users(id)
  )
`);

const app = express();

app.use(bodyParser.json({ limit: '10mb' }));
app.use(bodyParser.urlencoded({ extended: true, limit: '10mb' }));
app.use(cookieParser());
app.use(session({
  secret: SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
  cookie: {
    httpOnly: true,
    maxAge: 1000 * 60 * 60 * 8 // 8 ساعات
  }
}));

// مسارات API
app.use('/api/auth', require('./routes/auth'));
app.use('/api/users', require('./routes/users'));
app.use('/api/departments', require('./routes/departments'));
app.use('/api/templates', require('./routes/templates'));
app.use('/api/reports', require('./routes/reports'));
app.use('/api/files', require('./routes/files'));
app.use('/api/settings', require('./routes/settings'));
app.use('/api/dashboard', require('./routes/dashboard'));
app.use('/api/documents', require('./routes/documents'));

// ملفات ثابتة
const UPLOADS_DIR = process.env.UPLOADS_DIR || path.join(__dirname, 'uploads');
if (!fs.existsSync(UPLOADS_DIR)) fs.mkdirSync(UPLOADS_DIR, { recursive: true });
app.use('/uploads', express.static(UPLOADS_DIR));
app.use(express.static(path.join(__dirname, 'public')));

// إعادة التوجيه للصفحة الرئيسية
app.get('/', (req, res) => {
  if (req.session.user) {
    res.redirect('/app.html');
  } else {
    res.redirect('/login.html');
  }
});

// معالجة الأخطاء
app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ error: err.message || 'خطأ في الخادم' });
});

app.listen(PORT, () => {
  console.log('');
  console.log('╔════════════════════════════════════════╗');
  console.log('║  نظام إدارة الأمن والسلامة - يعمل الآن ║');
  console.log('╠════════════════════════════════════════╣');
  console.log(`║  العنوان: http://localhost:${PORT}        ║`);
  console.log('║  المستخدم: admin / admin123            ║');
  console.log('╚════════════════════════════════════════╝');
});
