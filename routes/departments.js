// إدارة الأقسام
const express = require('express');
const db = require('../db/connection');
const { requireAuth, requirePermission, logAudit } = require('../middleware/auth');
const router = express.Router();

router.use(requireAuth);

router.get('/', requirePermission('departments.view'), (req, res) => {
  const depts = db.prepare(`
    SELECT d.*, p.name_ar as parent_name,
           (SELECT COUNT(*) FROM users u WHERE u.department_id = d.id) as users_count,
           (SELECT COUNT(*) FROM reports r WHERE r.department_id = d.id) as reports_count
    FROM departments d
    LEFT JOIN departments p ON p.id = d.parent_id
    ORDER BY d.name_ar
  `).all();
  res.json(depts);
});

router.post('/', requirePermission('departments.create'), (req, res) => {
  const { name_ar, name_en, description, parent_id } = req.body;
  if (!name_ar) return res.status(400).json({ error: 'اسم القسم مطلوب' });
  const info = db.prepare(`
    INSERT INTO departments (name_ar, name_en, description, parent_id)
    VALUES (?, ?, ?, ?)
  `).run(name_ar, name_en || null, description || null, parent_id || null);
  logAudit(req.session.user.id, 'create_department', 'department', info.lastInsertRowid, `إنشاء قسم: ${name_ar}`, req.ip);
  res.json({ success: true, id: info.lastInsertRowid });
});

router.put('/:id', requirePermission('departments.edit'), (req, res) => {
  const { name_ar, name_en, description, parent_id } = req.body;
  db.prepare(`
    UPDATE departments SET name_ar=?, name_en=?, description=?, parent_id=?
    WHERE id = ?
  `).run(name_ar, name_en || null, description || null, parent_id || null, req.params.id);
  logAudit(req.session.user.id, 'edit_department', 'department', req.params.id, 'تعديل قسم', req.ip);
  res.json({ success: true });
});

router.delete('/:id', requirePermission('departments.delete'), (req, res) => {
  db.prepare('DELETE FROM departments WHERE id = ?').run(req.params.id);
  logAudit(req.session.user.id, 'delete_department', 'department', req.params.id, 'حذف قسم', req.ip);
  res.json({ success: true });
});

module.exports = router;
