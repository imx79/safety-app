// Middleware للتحقق من تسجيل الدخول والصلاحيات
const db = require('../db/connection');

function requireAuth(req, res, next) {
  if (!req.session || !req.session.user) {
    if (req.path.startsWith('/api/')) {
      return res.status(401).json({ error: 'يجب تسجيل الدخول' });
    }
    return res.redirect('/login.html');
  }
  next();
}

function getUserPermissions(userId) {
  // صلاحيات الدور
  const rolePerms = db.prepare(`
    SELECT p.code FROM permissions p
    JOIN role_permissions rp ON rp.permission_id = p.id
    JOIN users u ON u.role_id = rp.role_id
    WHERE u.id = ?
  `).all(userId).map(r => r.code);

  // صلاحيات إضافية مخصصة (granted=1) ومسحوبة (granted=0)
  const userPerms = db.prepare(`
    SELECT p.code, up.granted FROM user_permissions up
    JOIN permissions p ON p.id = up.permission_id
    WHERE up.user_id = ?
  `).all(userId);

  const perms = new Set(rolePerms);
  userPerms.forEach(up => {
    if (up.granted === 1) perms.add(up.code);
    else perms.delete(up.code);
  });
  return Array.from(perms);
}

function requirePermission(...codes) {
  return (req, res, next) => {
    if (!req.session || !req.session.user) {
      return res.status(401).json({ error: 'يجب تسجيل الدخول' });
    }
    const userPerms = getUserPermissions(req.session.user.id);
    const hasPermission = codes.some(c => userPerms.includes(c));
    if (!hasPermission) {
      return res.status(403).json({ error: 'ليس لديك الصلاحية للقيام بهذا الإجراء' });
    }
    next();
  };
}

function logAudit(userId, action, entityType, entityId, details, ip) {
  try {
    db.prepare(`
      INSERT INTO audit_log (user_id, action, entity_type, entity_id, details, ip_address)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(userId, action, entityType, entityId, details, ip);
  } catch (e) {
    console.error('Audit log error:', e);
  }
}

module.exports = { requireAuth, requirePermission, getUserPermissions, logAudit };
