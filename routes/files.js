// إدارة الملفات والمرفقات
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
    cb(null, unique + path.extname(file.originalname));
  }
});
const upload = multer({ storage, limits: { fileSize: 50 * 1024 * 1024 } });

router.use(requireAuth);

router.post('/upload', requirePermission('files.upload'), upload.single('file'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'لم يتم رفع ملف' });
  const { report_id } = req.body;
  const info = db.prepare(`
    INSERT INTO files (report_id, filename, original_name, file_path, mime_type, size, uploaded_by)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(
    report_id || null, req.file.filename, req.file.originalname,
    req.file.path, req.file.mimetype, req.file.size, req.session.user.id
  );
  logAudit(req.session.user.id, 'upload_file', 'file', info.lastInsertRowid, req.file.originalname, req.ip);
  res.json({ success: true, id: info.lastInsertRowid, filename: req.file.filename });
});

router.get('/download/:id', requireAuth, (req, res) => {
  const file = db.prepare('SELECT * FROM files WHERE id = ?').get(req.params.id);
  if (!file) return res.status(404).send('غير موجود');
  res.download(file.file_path, file.original_name);
});

router.delete('/:id', requirePermission('files.delete'), (req, res) => {
  const file = db.prepare('SELECT * FROM files WHERE id = ?').get(req.params.id);
  if (file && fs.existsSync(file.file_path)) {
    try { fs.unlinkSync(file.file_path); } catch(e) {}
  }
  db.prepare('DELETE FROM files WHERE id = ?').run(req.params.id);
  logAudit(req.session.user.id, 'delete_file', 'file', req.params.id, 'حذف ملف', req.ip);
  res.json({ success: true });
});

module.exports = router;
