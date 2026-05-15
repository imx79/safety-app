// مسارات المصادقة - تسجيل الدخول والخروج
const express = require('express');
const bcrypt = require('bcryptjs');
const db = require('../db/connection');
const { logAudit, getUserPermissions } = require('../middleware/auth');
const router = express.Router();

// تسجيل الدخول
router.post('/login', (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) {
    return res.status(400).json({ error: 'اسم المستخدم وكلمة المرور مطلوبان' });
  }

  const user = db.prepare(`
    SELECT u.*, r.name as role_name, r.name_ar as role_name_ar, d.name_ar as department_name
    FROM users u
    LEFT JOIN roles r ON r.id = u.role_id
    LEFT JOIN departments d ON d.id = u.department_id
    WHERE u.username = ? AND u.is_active = 1
  `).get(username);

  if (!user) {
    return res.status(401).json({ error: 'اسم المستخدم أو كلمة المرور غير صحيحة' });
  }

  if (!bcrypt.compareSync(password, user.password_hash)) {
    logAudit(user.id, 'failed_login', 'user', user.id, 'محاولة دخول فاشلة', req.ip);
    return res.status(401).json({ error: 'اسم المستخدم أو كلمة المرور غير صحيحة' });
  }

  db.prepare('UPDATE users SET last_login = CURRENT_TIMESTAMP WHERE id = ?').run(user.id);

  const permissions = getUserPermissions(user.id);

  req.session.user = {
    id: user.id,
    username: user.username,
    full_name: user.full_name,
    email: user.email,
    role_id: user.role_id,
    role_name: user.role_name,
    role_name_ar: user.role_name_ar,
    department_id: user.department_id,
    department_name: user.department_name,
    permissions
  };

  logAudit(user.id, 'login', 'user', user.id, 'تسجيل دخول ناجح', req.ip);
  res.json({ success: true, user: req.session.user });
});

// تسجيل الخروج
router.post('/logout', (req, res) => {
  if (req.session.user) {
    logAudit(req.session.user.id, 'logout', 'user', req.session.user.id, 'تسجيل خروج', req.ip);
  }
  req.session.destroy(() => {
    res.json({ success: true });
  });
});

// الحصول على بيانات المستخدم الحالي
router.get('/me', (req, res) => {
  if (!req.session.user) {
    return res.status(401).json({ error: 'غير مسجل' });
  }
  res.json(req.session.user);
});

// تغيير كلمة المرور
router.post('/change-password', (req, res) => {
  if (!req.session.user) return res.status(401).json({ error: 'غير مسجل' });
  const { old_password, new_password } = req.body;
  if (!old_password || !new_password || new_password.length < 6) {
    return res.status(400).json({ error: 'كلمة المرور الجديدة يجب أن تكون 6 أحرف على الأقل' });
  }
  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.session.user.id);
  if (!bcrypt.compareSync(old_password, user.password_hash)) {
    return res.status(400).json({ error: 'كلمة المرور القديمة غير صحيحة' });
  }
  const hash = bcrypt.hashSync(new_password, 10);
  db.prepare('UPDATE users SET password_hash = ? WHERE id = ?').run(hash, user.id);
  logAudit(user.id, 'change_password', 'user', user.id, 'تغيير كلمة المرور', req.ip);
  res.json({ success: true });
});

// طلب رمز استعادة كلمة المرور
router.post('/forgot-password', (req, res) => {
  const { username } = req.body;
  if (!username) return res.status(400).json({ error: 'اسم المستخدم مطلوب' });

  const user = db.prepare('SELECT id FROM users WHERE username = ? AND is_active = 1').get(username);
  if (!user) {
    // لا نكشف إن كان الحساب موجوداً أم لا
    return res.json({ success: true });
  }

  const code = Math.floor(100000 + Math.random() * 900000).toString();
  const expiresAt = new Date(Date.now() + 30 * 60 * 1000).toISOString();

  db.prepare('DELETE FROM password_resets WHERE user_id = ?').run(user.id);
  db.prepare('INSERT INTO password_resets (user_id, code, expires_at) VALUES (?, ?, ?)').run(user.id, code, expiresAt);

  res.json({ success: true });
});

// إعادة تعيين كلمة المرور بالرمز
router.post('/reset-password', (req, res) => {
  const { username, code, new_password } = req.body;
  if (!username || !code || !new_password) {
    return res.status(400).json({ error: 'جميع الحقول مطلوبة' });
  }
  if (new_password.length < 6) {
    return res.status(400).json({ error: 'كلمة المرور يجب أن تكون 6 أحرف على الأقل' });
  }

  const user = db.prepare('SELECT id FROM users WHERE username = ? AND is_active = 1').get(username);
  if (!user) return res.status(400).json({ error: 'بيانات غير صحيحة' });

  const reset = db.prepare('SELECT * FROM password_resets WHERE user_id = ? AND code = ?').get(user.id, code);
  if (!reset) return res.status(400).json({ error: 'الرمز غير صحيح' });

  if (new Date(reset.expires_at) < new Date()) {
    db.prepare('DELETE FROM password_resets WHERE user_id = ?').run(user.id);
    return res.status(400).json({ error: 'انتهت صلاحية الرمز (30 دقيقة). أعد الطلب.' });
  }

  const hash = bcrypt.hashSync(new_password, 10);
  db.prepare('UPDATE users SET password_hash = ? WHERE id = ?').run(hash, user.id);
  db.prepare('DELETE FROM password_resets WHERE user_id = ?').run(user.id);
  logAudit(user.id, 'reset_password', 'user', user.id, 'إعادة تعيين كلمة المرور', req.ip);

  res.json({ success: true });
});

// للمدير: عرض رموز الاستعادة المعلقة
router.get('/reset-tokens', (req, res) => {
  if (!req.session.user) return res.status(401).json({ error: 'غير مسجل' });
  const tokens = db.prepare(`
    SELECT pr.code, pr.expires_at, pr.created_at, u.username, u.full_name
    FROM password_resets pr
    JOIN users u ON u.id = pr.user_id
    ORDER BY pr.created_at DESC
  `).all();
  res.json(tokens);
});

module.exports = router;
