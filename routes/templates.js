// إدارة قوالب التقارير - تصميم النماذج لتناسب المنشأة
const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const db = require('../db/connection');
const { requireAuth, requirePermission, logAudit } = require('../middleware/auth');
const router = express.Router();

const UPLOAD_DIR = path.join(__dirname, '..', 'uploads');
if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR, { recursive: true });

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, UPLOAD_DIR),
  filename: (req, file, cb) => {
    const unique = Date.now() + '-' + Math.round(Math.random() * 1e9);
    cb(null, 'tpl-' + unique + path.extname(file.originalname));
  }
});

const uploadLogo = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowed = ['.png', '.jpg', '.jpeg', '.gif', '.svg', '.webp'];
    if (allowed.includes(path.extname(file.originalname).toLowerCase())) cb(null, true);
    else cb(new Error('صيغة الصورة غير مدعومة. المسموح: PNG, JPG, GIF, SVG'));
  }
});

const uploadTemplateFile = multer({
  storage,
  limits: { fileSize: 20 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowed = ['.pdf', '.png', '.jpg', '.jpeg', '.docx', '.xlsx'];
    if (allowed.includes(path.extname(file.originalname).toLowerCase())) cb(null, true);
    else cb(new Error('صيغة الملف غير مدعومة. المسموح: PDF, PNG, JPG, DOCX, XLSX'));
  }
});

router.use(requireAuth);

router.get('/', requirePermission('templates.view'), (req, res) => {
  const templates = db.prepare(`
    SELECT t.*, u.full_name as creator_name,
           (SELECT COUNT(*) FROM reports r WHERE r.template_id = t.id) as usage_count
    FROM templates t
    LEFT JOIN users u ON u.id = t.created_by
    WHERE t.is_active = 1
    ORDER BY t.created_at DESC
  `).all();
  templates.forEach(t => {
    try { t.fields = JSON.parse(t.fields_json); } catch(e) { t.fields = []; }
    try { t.page_settings = JSON.parse(t.page_settings_json); } catch(e) { t.page_settings = null; }
    delete t.fields_json;
    delete t.page_settings_json;
  });
  res.json(templates);
});

router.get('/:id', requirePermission('templates.view'), (req, res) => {
  const t = db.prepare('SELECT * FROM templates WHERE id = ?').get(req.params.id);
  if (!t) return res.status(404).json({ error: 'غير موجود' });
  try { t.fields = JSON.parse(t.fields_json); } catch(e) { t.fields = []; }
  try { t.page_settings = JSON.parse(t.page_settings_json); } catch(e) { t.page_settings = null; }
  delete t.fields_json;
  delete t.page_settings_json;
  res.json(t);
});

// رفع شعار (صورة) للقالب
router.post('/upload-logo', requirePermission('templates.create'), (req, res) => {
  uploadLogo.single('logo')(req, res, (err) => {
    if (err) return res.status(400).json({ error: err.message });
    if (!req.file) return res.status(400).json({ error: 'لم يتم رفع ملف' });
    res.json({ success: true, path: '/uploads/' + req.file.filename });
  });
});

// رفع ملف القالب (PDF أو صورة أساس النموذج)
router.post('/upload-template-file', requirePermission('templates.create'), (req, res) => {
  uploadTemplateFile.single('template_file')(req, res, (err) => {
    if (err) return res.status(400).json({ error: err.message });
    if (!req.file) return res.status(400).json({ error: 'لم يتم رفع ملف' });
    const ext = path.extname(req.file.originalname).toLowerCase();
    res.json({
      success: true,
      path: '/uploads/' + req.file.filename,
      original_name: req.file.originalname,
      type: ext === '.pdf' ? 'pdf' : ext === '.docx' ? 'docx' : ext === '.xlsx' ? 'xlsx' : 'image'
    });
  });
});

router.post('/', requirePermission('templates.create'), (req, res) => {
  const { name_ar, name_en, category, description, fields, header_html, footer_html, logo_path, page_settings, template_file_path } = req.body;
  if (!name_ar || !category) return res.status(400).json({ error: 'اسم وفئة القالب مطلوبان' });
  const info = db.prepare(`
    INSERT INTO templates (name_ar, name_en, category, description, fields_json, header_html, footer_html, logo_path, page_settings_json, template_file_path, created_by)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    name_ar, name_en || null, category, description || null,
    JSON.stringify(fields || []), header_html || null, footer_html || null,
    logo_path || null,
    page_settings ? JSON.stringify(page_settings) : null,
    template_file_path || null,
    req.session.user.id
  );
  logAudit(req.session.user.id, 'create_template', 'template', info.lastInsertRowid, `قالب: ${name_ar}`, req.ip);
  res.json({ success: true, id: info.lastInsertRowid });
});

router.put('/:id', requirePermission('templates.edit'), (req, res) => {
  const { name_ar, name_en, category, description, fields, header_html, footer_html, logo_path, page_settings, template_file_path } = req.body;
  db.prepare(`
    UPDATE templates SET name_ar=?, name_en=?, category=?, description=?, fields_json=?,
                         header_html=?, footer_html=?, logo_path=?, page_settings_json=?,
                         template_file_path=?, updated_at=CURRENT_TIMESTAMP
    WHERE id = ?
  `).run(
    name_ar, name_en || null, category, description || null,
    JSON.stringify(fields || []), header_html || null, footer_html || null,
    logo_path || null,
    page_settings ? JSON.stringify(page_settings) : null,
    template_file_path || null,
    req.params.id
  );
  logAudit(req.session.user.id, 'edit_template', 'template', req.params.id, 'تعديل قالب', req.ip);
  res.json({ success: true });
});

router.delete('/:id', requirePermission('templates.delete'), (req, res) => {
  db.prepare('UPDATE templates SET is_active = 0 WHERE id = ?').run(req.params.id);
  logAudit(req.session.user.id, 'delete_template', 'template', req.params.id, 'حذف قالب', req.ip);
  res.json({ success: true });
});

module.exports = router;
