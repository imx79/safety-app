// إدارة التقارير - الإنشاء والتعديل والمشاركة
const express = require('express');
const db = require('../db/connection');
const { requireAuth, requirePermission, logAudit } = require('../middleware/auth');
const router = express.Router();

router.use(requireAuth);

// قائمة التقارير
router.get('/', requirePermission('reports.view'), (req, res) => {
  const { status, department_id, template_id, search, from, to } = req.query;
  let sql = `
    SELECT r.id, r.title, r.reference_no, r.status, r.priority, r.report_date, r.created_at,
           r.template_id, t.name_ar as template_name, t.category,
           r.department_id, d.name_ar as department_name,
           r.created_by, u.full_name as creator_name,
           r.assigned_to, ua.full_name as assignee_name
    FROM reports r
    LEFT JOIN templates t ON t.id = r.template_id
    LEFT JOIN departments d ON d.id = r.department_id
    LEFT JOIN users u ON u.id = r.created_by
    LEFT JOIN users ua ON ua.id = r.assigned_to
    WHERE 1=1
  `;
  const params = [];
  if (status) { sql += ' AND r.status = ?'; params.push(status); }
  if (department_id) { sql += ' AND r.department_id = ?'; params.push(department_id); }
  if (template_id) { sql += ' AND r.template_id = ?'; params.push(template_id); }
  if (search) { sql += ' AND (r.title LIKE ? OR r.reference_no LIKE ?)'; params.push(`%${search}%`, `%${search}%`); }
  if (from) { sql += ' AND r.report_date >= ?'; params.push(from); }
  if (to) { sql += ' AND r.report_date <= ?'; params.push(to); }
  sql += ' ORDER BY r.created_at DESC LIMIT 200';
  const rows = db.prepare(sql).all(...params);
  res.json(rows);
});

// تفاصيل تقرير
router.get('/:id', requirePermission('reports.view'), (req, res) => {
  const report = db.prepare(`
    SELECT r.*, t.name_ar as template_name, t.fields_json, t.header_html, t.footer_html,
           t.logo_path, t.page_settings_json, t.template_file_path,
           d.name_ar as department_name, u.full_name as creator_name
    FROM reports r
    LEFT JOIN templates t ON t.id = r.template_id
    LEFT JOIN departments d ON d.id = r.department_id
    LEFT JOIN users u ON u.id = r.created_by
    WHERE r.id = ?
  `).get(req.params.id);
  if (!report) return res.status(404).json({ error: 'غير موجود' });
  try { report.data = JSON.parse(report.data_json); } catch(e) { report.data = {}; }
  try { report.fields = JSON.parse(report.fields_json || '[]'); } catch(e) { report.fields = []; }
  try { report.page_settings = JSON.parse(report.page_settings_json || 'null'); } catch(e) { report.page_settings = null; }
  delete report.data_json;
  delete report.fields_json;
  delete report.page_settings_json;

  const files = db.prepare(`
    SELECT f.*, u.full_name as uploader_name FROM files f
    LEFT JOIN users u ON u.id = f.uploaded_by
    WHERE f.report_id = ?
  `).all(report.id);
  report.files = files;

  res.json(report);
});

// إنشاء تقرير
router.post('/', requirePermission('reports.create'), (req, res) => {
  const { template_id, title, reference_no, department_id, data, status, priority, assigned_to, report_date } = req.body;
  if (!template_id || !title) return res.status(400).json({ error: 'القالب والعنوان مطلوبان' });
  const info = db.prepare(`
    INSERT INTO reports (template_id, title, reference_no, department_id, data_json, status, priority, created_by, assigned_to, report_date)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    template_id, title, reference_no || null, department_id || null,
    JSON.stringify(data || {}), status || 'draft', priority || 'normal',
    req.session.user.id, assigned_to || null, report_date || null
  );
  logAudit(req.session.user.id, 'create_report', 'report', info.lastInsertRowid, `تقرير: ${title}`, req.ip);
  res.json({ success: true, id: info.lastInsertRowid });
});

// تعديل تقرير
router.put('/:id', requirePermission('reports.edit'), (req, res) => {
  const { title, reference_no, department_id, data, status, priority, assigned_to, report_date } = req.body;
  db.prepare(`
    UPDATE reports SET title=?, reference_no=?, department_id=?, data_json=?,
                      status=?, priority=?, assigned_to=?, report_date=?, updated_at=CURRENT_TIMESTAMP
    WHERE id = ?
  `).run(
    title, reference_no || null, department_id || null,
    JSON.stringify(data || {}), status, priority,
    assigned_to || null, report_date || null, req.params.id
  );
  logAudit(req.session.user.id, 'edit_report', 'report', req.params.id, 'تعديل تقرير', req.ip);
  res.json({ success: true });
});

// حذف تقرير
router.delete('/:id', requirePermission('reports.delete'), (req, res) => {
  db.prepare('DELETE FROM reports WHERE id = ?').run(req.params.id);
  logAudit(req.session.user.id, 'delete_report', 'report', req.params.id, 'حذف تقرير', req.ip);
  res.json({ success: true });
});

// مشاركة تقرير
router.post('/:id/share', requirePermission('reports.share'), (req, res) => {
  const { user_ids, permission } = req.body;
  const stmt = db.prepare(`
    INSERT INTO shares (report_id, shared_with, permission, shared_by) VALUES (?, ?, ?, ?)
  `);
  user_ids.forEach(uid => stmt.run(req.params.id, uid, permission || 'view', req.session.user.id));
  logAudit(req.session.user.id, 'share_report', 'report', req.params.id, `مشاركة مع ${user_ids.length} مستخدم`, req.ip);
  res.json({ success: true });
});

module.exports = router;
