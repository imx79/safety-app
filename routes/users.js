// إدارة المستخدمين
const express = require('express');
const bcrypt = require('bcryptjs');
const db = require('../db/connection');
const { requireAuth, requirePermission, logAudit } = require('../middleware/auth');
const router = express.Router();

router.use(requireAuth);

// قائمة المستخدمين
router.get('/', requirePermission('users.view'), (req, res) => {
  const users = db.prepare(`
    SELECT u.id, u.username, u.full_name, u.email, u.phone, u.is_active, u.last_login, u.created_at,
           r.name as role_name, r.name_ar as role_name_ar, r.id as role_id,
           d.name_ar as department_name, d.id as department_id
    FROM users u
    LEFT JOIN roles r ON r.id = u.role_id
    LEFT JOIN departments d ON d.id = u.department_id
    ORDER BY u.created_at DESC
  `).all();
  res.json(users);
});

// تفاصيل مستخدم
router.get('/:id', requirePermission('users.view'), (req, res) => {
  const user = db.prepare(`
    SELECT u.id, u.username, u.full_name, u.email, u.phone, u.is_active,
           u.role_id, u.department_id, r.name_ar as role_name_ar
    FROM users u
    LEFT JOIN roles r ON r.id = u.role_id
    WHERE u.id = ?
  `).get(req.params.id);
  if (!user) return res.status(404).json({ error: 'غير موجود' });

  const customPerms = db.prepare(`
    SELECT p.code, up.granted FROM user_permissions up
    JOIN permissions p ON p.id = up.permission_id
    WHERE up.user_id = ?
  `).all(user.id);
  user.custom_permissions = customPerms;
  res.json(user);
});

// إنشاء مستخدم جديد
router.post('/', requirePermission('users.create'), (req, res) => {
  const { username, full_name, email, phone, password, role_id, department_id } = req.body;
  if (!username || !full_name || !password || !role_id) {
    return res.status(400).json({ error: 'حقول إلزامية ناقصة' });
  }
  const existing = db.prepare('SELECT id FROM users WHERE username = ?').get(username);
  if (existing) return res.status(400).json({ error: 'اسم المستخدم موجود مسبقاً' });

  const hash = bcrypt.hashSync(password, 10);
  const info = db.prepare(`
    INSERT INTO users (username, full_name, email, phone, password_hash, role_id, department_id)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(username, full_name, email || null, phone || null, hash, role_id, department_id || null);

  logAudit(req.session.user.id, 'create_user', 'user', info.lastInsertRowid, `إنشاء مستخدم: ${username}`, req.ip);
  res.json({ success: true, id: info.lastInsertRowid });
});

// تعديل مستخدم
router.put('/:id', requirePermission('users.edit'), (req, res) => {
  const { full_name, email, phone, role_id, department_id, is_active, password } = req.body;
  const fields = [];
  const values = [];
  if (full_name !== undefined) { fields.push('full_name = ?'); values.push(full_name); }
  if (email !== undefined) { fields.push('email = ?'); values.push(email); }
  if (phone !== undefined) { fields.push('phone = ?'); values.push(phone); }
  if (role_id !== undefined) { fields.push('role_id = ?'); values.push(role_id); }
  if (department_id !== undefined) { fields.push('department_id = ?'); values.push(department_id); }
  if (is_active !== undefined) { fields.push('is_active = ?'); values.push(is_active ? 1 : 0); }
  if (password) {
    fields.push('password_hash = ?');
    values.push(bcrypt.hashSync(password, 10));
  }
  if (fields.length === 0) return res.status(400).json({ error: 'لا توجد تعديلات' });
  values.push(req.params.id);
  db.prepare(`UPDATE users SET ${fields.join(', ')} WHERE id = ?`).run(...values);
  logAudit(req.session.user.id, 'edit_user', 'user', req.params.id, 'تعديل بيانات مستخدم', req.ip);
  res.json({ success: true });
});

// حذف مستخدم
router.delete('/:id', requirePermission('users.delete'), (req, res) => {
  if (parseInt(req.params.id) === req.session.user.id) {
    return res.status(400).json({ error: 'لا يمكن حذف حسابك الخاص' });
  }
  db.prepare('DELETE FROM users WHERE id = ?').run(req.params.id);
  logAudit(req.session.user.id, 'delete_user', 'user', req.params.id, 'حذف مستخدم', req.ip);
  res.json({ success: true });
});

// تحديث صلاحيات مستخدم مخصصة
router.put('/:id/permissions', requirePermission('users.edit'), (req, res) => {
  const { permissions } = req.body; // [{code, granted}]
  const userId = req.params.id;
  const allPerms = db.prepare('SELECT id, code FROM permissions').all();
  const permMap = Object.fromEntries(allPerms.map(p => [p.code, p.id]));

  db.prepare('DELETE FROM user_permissions WHERE user_id = ?').run(userId);
  const stmt = db.prepare('INSERT INTO user_permissions (user_id, permission_id, granted) VALUES (?, ?, ?)');
  permissions.forEach(p => {
    if (permMap[p.code]) stmt.run(userId, permMap[p.code], p.granted ? 1 : 0);
  });
  logAudit(req.session.user.id, 'update_permissions', 'user', userId, 'تحديث صلاحيات', req.ip);
  res.json({ success: true });
});

// الأدوار والصلاحيات
router.get('/meta/roles', (req, res) => {
  const roles = db.prepare('SELECT * FROM roles ORDER BY id').all();
  res.json(roles);
});

router.get('/meta/permissions', (req, res) => {
  const perms = db.prepare('SELECT * FROM permissions ORDER BY category, id').all();
  res.json(perms);
});

module.exports = router;
