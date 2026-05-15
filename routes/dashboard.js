// لوحة التحكم - الإحصاءات والمؤشرات
const express = require('express');
const db = require('../db/connection');
const { requireAuth, requirePermission } = require('../middleware/auth');
const router = express.Router();

router.use(requireAuth);

router.get('/stats', requirePermission('dashboard.view'), (req, res) => {
  const totalReports = db.prepare('SELECT COUNT(*) as c FROM reports').get().c;
  const totalUsers = db.prepare('SELECT COUNT(*) as c FROM users WHERE is_active = 1').get().c;
  const totalDepts = db.prepare('SELECT COUNT(*) as c FROM departments').get().c;
  const totalTemplates = db.prepare('SELECT COUNT(*) as c FROM templates WHERE is_active = 1').get().c;

  const byStatus = db.prepare(`
    SELECT status, COUNT(*) as count FROM reports GROUP BY status
  `).all();

  const byCategory = db.prepare(`
    SELECT t.category, COUNT(*) as count FROM reports r
    JOIN templates t ON t.id = r.template_id
    GROUP BY t.category
  `).all();

  const byDepartment = db.prepare(`
    SELECT d.name_ar as name, COUNT(r.id) as count FROM departments d
    LEFT JOIN reports r ON r.department_id = d.id
    GROUP BY d.id
    ORDER BY count DESC LIMIT 10
  `).all();

  // التقارير في آخر 30 يوم حسب اليوم
  const dailyReports = db.prepare(`
    SELECT DATE(created_at) as day, COUNT(*) as count
    FROM reports
    WHERE created_at >= datetime('now', '-30 days')
    GROUP BY DATE(created_at)
    ORDER BY day
  `).all();

  const recentReports = db.prepare(`
    SELECT r.id, r.title, r.status, r.created_at, u.full_name as creator,
           t.category, d.name_ar as department
    FROM reports r
    LEFT JOIN users u ON u.id = r.created_by
    LEFT JOIN templates t ON t.id = r.template_id
    LEFT JOIN departments d ON d.id = r.department_id
    ORDER BY r.created_at DESC LIMIT 10
  `).all();

  const kpis = db.prepare('SELECT * FROM kpis').all();

  res.json({
    totals: { reports: totalReports, users: totalUsers, departments: totalDepts, templates: totalTemplates },
    by_status: byStatus,
    by_category: byCategory,
    by_department: byDepartment,
    daily: dailyReports,
    recent: recentReports,
    kpis
  });
});

// تحديث مؤشر
router.put('/kpis/:id', requirePermission('settings.edit'), (req, res) => {
  const { current_value, target_value } = req.body;
  db.prepare('UPDATE kpis SET current_value=?, target_value=?, updated_at=CURRENT_TIMESTAMP WHERE id=?')
    .run(current_value, target_value, req.params.id);
  res.json({ success: true });
});

// تقييمات الموظفين
router.get('/evaluations', requirePermission('evaluations.view'), (req, res) => {
  const rows = db.prepare(`
    SELECT e.*, emp.full_name as employee_name, ev.full_name as evaluator_name
    FROM evaluations e
    JOIN users emp ON emp.id = e.employee_id
    JOIN users ev ON ev.id = e.evaluator_id
    ORDER BY e.created_at DESC
  `).all();
  res.json(rows);
});

router.post('/evaluations', requirePermission('evaluations.create'), (req, res) => {
  const { employee_id, period, score, criteria, notes } = req.body;
  const info = db.prepare(`
    INSERT INTO evaluations (employee_id, evaluator_id, period, score, criteria_json, notes)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(employee_id, req.session.user.id, period, score, JSON.stringify(criteria || {}), notes || null);
  res.json({ success: true, id: info.lastInsertRowid });
});

module.exports = router;
