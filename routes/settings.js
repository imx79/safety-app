// إعدادات النظام الشاملة
const express = require('express');
const db = require('../db/connection');
const { requireAuth, requirePermission, logAudit } = require('../middleware/auth');
const router = express.Router();

router.use(requireAuth);

// جلب كل الإعدادات
router.get('/', requirePermission('settings.view'), (req, res) => {
  const rows = db.prepare('SELECT * FROM settings').all();
  const obj = {};
  rows.forEach(r => obj[r.key] = { value: r.value, description: r.description });
  res.json(obj);
});

// الإعدادات العامة (متاحة للجميع لقراءة شعار/أسماء الموقع)
router.get('/public', (req, res) => {
  const keys = ['site_name_ar', 'site_name_en', 'company_name', 'logo_path', 'primary_color', 'accent_color', 'default_lang'];
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
