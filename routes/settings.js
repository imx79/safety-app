// إعدادات النظام الشاملة
const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const db = require('../db/connection');
const { requireAuth, requirePermission, logAudit } = require('../middleware/auth');
const router = express.Router();

const UPLOAD_DIR = path.join(__dirname, '..', 'uploads');
if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR, { recursive: true });

const uploadSiteLogo = multer({
  storage: multer.diskStorage({
    destination: (req, file, cb) => cb(null, UPLOAD_DIR),
    filename: (req, file, cb) => {
      const unique = Date.now() + '-' + Math.round(Math.random() * 1e9);
      cb(null, 'site-logo-' + unique + path.extname(file.originalname));
    }
  }),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowed = ['.png', '.jpg', '.jpeg', '.gif', '.svg', '.webp'];
    if (allowed.includes(path.extname(file.originalname).toLowerCase())) cb(null, true);
    else cb(new Error('صيغة الصورة غير مدعومة. المسموح: PNG, JPG, GIF, SVG, WebP'));
  }
});

router.use(requireAuth);

// رفع شعار الموقع
router.post('/upload-logo', requirePermission('settings.edit'), (req, res) => {
  uploadSiteLogo.single('logo')(req, res, (err) => {
    if (err) return res.status(400).json({ error: err.message });
    if (!req.file) return res.status(400).json({ error: 'لم يتم رفع ملف' });
    const logoPath = '/uploads/' + req.file.filename;
    db.prepare(`
      INSERT INTO settings (key, value, updated_at) VALUES (?, ?, CURRENT_TIMESTAMP)
      ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = CURRENT_TIMESTAMP
    `).run('logo_path', logoPath);
    logAudit(req.session.user.id, 'upload_logo', 'setting', null, 'رفع شعار الموقع', req.ip);
    res.json({ success: true, path: logoPath });
  });
});

// جلب كل الإعدادات
router.get('/', requirePermission('settings.view'), (req, res) => {
  const rows = db.prepare('SELECT * FROM settings').all();
  const obj = {};
  rows.forEach(r => obj[r.key] = { value: r.value, description: r.description });
  res.json(obj);
});

// الإعدادات العامة (متاحة للجميع لقراءة شعار/أسماء الموقع)
router.get('/public', (req, res) => {
  const keys = [
    'site_name_ar', 'site_name_en', 'company_name', 'logo_path',
    'primary_color', 'accent_color', 'default_lang',
    'sidebar_title_ar', 'sidebar_subtitle_en',
    'nav_show_dashboard', 'nav_show_reports', 'nav_show_templates',
    'nav_show_departments', 'nav_show_users', 'nav_show_evaluations', 'nav_show_audit'
  ];
  const rows = db.prepare(`SELECT key, value FROM settings WHERE key IN (${keys.map(()=>'?').join(',')})`).all(...keys);
  const obj = {};
  rows.forEach(r => obj[r.key] = r.value);
  res.json(obj);
});

// تحديث إعداد
router.put('/:key', requirePermission('settings.edit'), (req, res) => {
  const { value } = req.body;
  db.prepare(`
    INSERT INTO settings (key, value, updated_at) VALUES (?, ?, CURRENT_TIMESTAMP)
    ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = CURRENT_TIMESTAMP
  `).run(req.params.key, value);
  logAudit(req.session.user.id, 'update_setting', 'setting', null, `${req.params.key} = ${value}`, req.ip);
  res.json({ success: true });
});

// تحديث متعدد
router.put('/', requirePermission('settings.edit'), (req, res) => {
  const updates = req.body; // {key: value, ...}
  const stmt = db.prepare(`
    INSERT INTO settings (key, value, updated_at) VALUES (?, ?, CURRENT_TIMESTAMP)
    ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = CURRENT_TIMESTAMP
  `);
  Object.entries(updates).forEach(([k, v]) => stmt.run(k, v));
  logAudit(req.session.user.id, 'update_settings_bulk', 'setting', null, 'تحديث إعدادات', req.ip);
  res.json({ success: true });
});

// سجل التدقيق
router.get('/audit/log', requirePermission('audit.view'), (req, res) => {
  const rows = db.prepare(`
    SELECT a.*, u.full_name, u.username FROM audit_log a
    LEFT JOIN users u ON u.id = a.user_id
    ORDER BY a.created_at DESC LIMIT 500
  `).all();
  res.json(rows);
});

module.exports = router;
