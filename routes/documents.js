// مكتبة النماذج والخطابات الجاهزة
const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const db = require('../db/connection');
const { requireAuth, requirePermission, logAudit } = require('../middleware/auth');
const router = express.Router();

const UPLOAD_DIR = process.env.UPLOADS_DIR || path.join(__dirname, '..', 'uploads');
if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR, { recursive: true });

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, UPLOAD_DIR),
  filename: (req, file, cb) => {
    const unique = Date.now() + '-' + Math.round(Math.random() * 1e9);
    cb(null, 'doc-' + unique + path.extname(file.originalname));
  }
});

const ALLOWED_EXTS = [
  '.pdf', '.doc', '.docx', '.xls', '.xlsx',
  '.ppt', '.pptx', '.txt', '.rtf',
  '.png', '.jpg', '.jpeg', '.gif', '.svg', '.webp'
];

const upload = multer({
  storage,
  limits: { fileSize: 50 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    if (ALLOWED_EXTS.includes(ext)) cb(null, true);
    else cb(new Error(`صيغة الملف غير مدعومة. المسموح: ${ALLOWED_EXTS.join(', ')}`));
  }
});

function detectType(filename) {
  const ext = path.extname(filename).toLowerCase();
  if (ext === '.pdf') return 'pdf';
  if (['.doc', '.docx', '.rtf'].includes(ext)) return 'word';
  if (['.xls', '.xlsx'].includes(ext)) return 'excel';
  if (['.ppt', '.pptx'].includes(ext)) return 'powerpoint';
  if (['.png', '.jpg', '.jpeg', '.gif', '.svg', '.webp'].includes(ext)) return 'image';
  if (ext === '.txt') return 'text';
  return 'other';
}

router.use(requireAuth);

// قائمة الوثائق
router.get('/', requirePermission('templates.view'), (req, res) => {
  const { category, search } = req.query;
  let sql = `
    SELECT d.*, u.full_name as creator_name
    FROM document_library d
    LEFT JOIN users u ON u.id = d.created_by
    WHERE d.is_active = 1
  `;
  const params = [];
  if (category) { sql += ' AND d.category = ?'; params.push(category); }
  if (search) { sql += ' AND (d.name_ar LIKE ? OR d.original_name LIKE ? OR d.tags LIKE ?)'; params.push(`%${search}%`, `%${search}%`, `%${search}%`); }
  sql += ' ORDER BY d.updated_at DESC';
  res.json(db.prepare(sql).all(...params));
});

// وثيقة واحدة
router.get('/:id', requirePermission('templates.view'), (req, res) => {
  const doc = db.prepare(`
    SELECT d.*, u.full_name as creator_name
    FROM document_library d LEFT JOIN users u ON u.id = d.created_by
    WHERE d.id = ? AND d.is_active = 1
  `).get(req.params.id);
  if (!doc) return res.status(404).json({ error: 'غير موجود' });
  res.json(doc);
});

// تحميل الملف
router.get('/:id/download', requireAuth, (req, res) => {
  const doc = db.prepare('SELECT * FROM document_library WHERE id = ? AND is_active = 1').get(req.params.id);
  if (!doc) return res.status(404).send('غير موجود');
  const fullPath = path.isAbsolute(doc.file_path)
    ? doc.file_path
    : path.join(__dirname, '..', doc.file_path.replace(/^\//, ''));
  if (!fs.existsSync(fullPath)) return res.status(404).send('الملف غير موجود على الخادم');
  res.download(fullPath, doc.original_name);
});

// رفع وثيقة جديدة
router.post('/upload', requirePermission('templates.create'), (req, res) => {
  upload.single('file')(req, res, (err) => {
    if (err) return res.status(400).json({ error: err.message });
    if (!req.file) return res.status(400).json({ error: 'لم يتم رفع ملف' });

    const { name_ar, name_en, category, description, tags } = req.body;
    if (!name_ar) return res.status(400).json({ error: 'اسم الوثيقة مطلوب' });

    const fileType = detectType(req.file.originalname);
    const info = db.prepare(`
      INSERT INTO document_library
        (name_ar, name_en, category, description, file_path, file_type, original_name, file_size, tags, created_by)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      name_ar, name_en || null,
      category || 'general', description || null,
      '/uploads/' + req.file.filename,
      fileType, req.file.originalname, req.file.size,
      tags || null, req.session.user.id
    );
    logAudit(req.session.user.id, 'upload_document', 'document', info.lastInsertRowid, name_ar, req.ip);
    res.json({ success: true, id: info.lastInsertRowid, file_type: fileType, path: '/uploads/' + req.file.filename });
  });
});

// رفع نسخة جديدة (تحديث الملف)
router.post('/:id/new-version', requirePermission('templates.edit'), (req, res) => {
  const doc = db.prepare('SELECT * FROM document_library WHERE id = ? AND is_active = 1').get(req.params.id);
  if (!doc) return res.status(404).json({ error: 'غير موجود' });

  upload.single('file')(req, res, (err) => {
    if (err) return res.status(400).json({ error: err.message });
    if (!req.file) return res.status(400).json({ error: 'لم يتم رفع ملف' });

    const fileType = detectType(req.file.originalname);
    db.prepare(`
      UPDATE document_library
      SET file_path=?, file_type=?, original_name=?, file_size=?, version=version+1, updated_at=CURRENT_TIMESTAMP
      WHERE id=?
    `).run('/uploads/' + req.file.filename, fileType, req.file.originalname, req.file.size, req.params.id);

    logAudit(req.session.user.id, 'update_document_version', 'document', req.params.id, `نسخة جديدة: ${doc.name_ar}`, req.ip);
    res.json({ success: true, file_type: fileType, path: '/uploads/' + req.file.filename, version: doc.version + 1 });
  });
});

// تعديل بيانات الوثيقة (بدون ملف)
router.put('/:id', requirePermission('templates.edit'), (req, res) => {
  const { name_ar, name_en, category, description, tags } = req.body;
  db.prepare(`
    UPDATE document_library
    SET name_ar=?, name_en=?, category=?, description=?, tags=?, updated_at=CURRENT_TIMESTAMP
    WHERE id=?
  `).run(name_ar, name_en || null, category || 'general', description || null, tags || null, req.params.id);
  logAudit(req.session.user.id, 'edit_document', 'document', req.params.id, name_ar, req.ip);
  res.json({ success: true });
});

// حذف
router.delete('/:id', requirePermission('templates.delete'), (req, res) => {
  db.prepare('UPDATE document_library SET is_active=0 WHERE id=?').run(req.params.id);
  logAudit(req.session.user.id, 'delete_document', 'document', req.params.id, 'حذف وثيقة', req.ip);
  res.json({ success: true });
});

// ===== تعديل مباشر =====

// دالة مساعدة لحل مسار الملف
function resolvePath(filePath) {
  return path.isAbsolute(filePath)
    ? filePath
    : path.join(__dirname, '..', filePath.replace(/^\//, ''));
}

// قراءة محتوى نصي مباشر
router.get('/:id/text-content', requirePermission('templates.view'), (req, res) => {
  const doc = db.prepare('SELECT * FROM document_library WHERE id = ? AND is_active = 1').get(req.params.id);
  if (!doc) return res.status(404).json({ error: 'غير موجود' });

  const TEXT_EXTS = ['.txt', '.html', '.htm', '.json', '.csv', '.md', '.rtf'];
  const ext = path.extname(doc.original_name).toLowerCase();
  if (!TEXT_EXTS.includes(ext))
    return res.status(400).json({ error: 'هذا النوع لا يدعم التعديل النصي المباشر' });

  const fullPath = resolvePath(doc.file_path);
  if (!fs.existsSync(fullPath)) return res.status(404).json({ error: 'الملف غير موجود على الخادم' });

  try {
    const content = fs.readFileSync(fullPath, 'utf8');
    res.json({ content, ext: ext.replace('.', '') });
  } catch (e) {
    res.status(500).json({ error: 'فشل قراءة الملف: ' + e.message });
  }
});

// حفظ محتوى نصي مباشر (يكتب على نفس الملف)
router.put('/:id/text-content', requirePermission('templates.edit'), (req, res) => {
  const { content } = req.body;
  if (content === undefined) return res.status(400).json({ error: 'المحتوى مطلوب' });

  const doc = db.prepare('SELECT * FROM document_library WHERE id = ? AND is_active = 1').get(req.params.id);
  if (!doc) return res.status(404).json({ error: 'غير موجود' });

  const fullPath = resolvePath(doc.file_path);
  try {
    fs.writeFileSync(fullPath, content, 'utf8');
    db.prepare('UPDATE document_library SET updated_at=CURRENT_TIMESTAMP WHERE id=?').run(doc.id);
    logAudit(req.session.user.id, 'edit_document_content', 'document', doc.id, doc.name_ar, req.ip);
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: 'فشل حفظ الملف: ' + e.message });
  }
});

// استبدال مباشر للملف (بدون رفع إصدار جديد)
router.put('/:id/overwrite', requirePermission('templates.edit'), (req, res) => {
  const doc = db.prepare('SELECT * FROM document_library WHERE id = ? AND is_active = 1').get(req.params.id);
  if (!doc) return res.status(404).json({ error: 'غير موجود' });

  upload.single('file')(req, res, (err) => {
    if (err) return res.status(400).json({ error: err.message });
    if (!req.file) return res.status(400).json({ error: 'لم يتم رفع ملف' });

    // حذف الملف القديم
    const oldPath = resolvePath(doc.file_path);
    if (fs.existsSync(oldPath)) { try { fs.unlinkSync(oldPath); } catch (e) {} }

    const fileType = detectType(req.file.originalname);
    db.prepare(`
      UPDATE document_library
      SET file_path=?, file_type=?, original_name=?, file_size=?, updated_at=CURRENT_TIMESTAMP
      WHERE id=?
    `).run('/uploads/' + req.file.filename, fileType, req.file.originalname, req.file.size, doc.id);

    logAudit(req.session.user.id, 'overwrite_document', 'document', doc.id, `تعديل مباشر: ${doc.name_ar}`, req.ip);
    res.json({ ok: true, file_type: fileType, path: '/uploads/' + req.file.filename });
  });
});

module.exports = router;
