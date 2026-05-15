// Database Initialization Script - يقوم بإنشاء الجداول والبيانات الافتراضية
const Database = require('better-sqlite3');
const bcrypt = require('bcryptjs');
const path = require('path');
const fs = require('fs');

const DATA_DIR = process.env.DATA_DIR ? path.join(process.env.DATA_DIR, 'db') : __dirname;
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
const DB_PATH = path.join(DATA_DIR, 'safety.db');

// حذف قاعدة البيانات القديمة إذا كانت موجودة (اختياري)
// if (fs.existsSync(DB_PATH)) fs.unlinkSync(DB_PATH);

const db = new Database(DB_PATH);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

console.log('🔧 بدء تهيئة قاعدة البيانات...');

// إنشاء الجداول
db.exec(`
  -- جدول الأقسام
  CREATE TABLE IF NOT EXISTS departments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name_ar TEXT NOT NULL,
    name_en TEXT,
    description TEXT,
    parent_id INTEGER,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (parent_id) REFERENCES departments(id) ON DELETE SET NULL
  );

  -- جدول الأدوار
  CREATE TABLE IF NOT EXISTS roles (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT UNIQUE NOT NULL,
    name_ar TEXT NOT NULL,
    description TEXT,
    is_system INTEGER DEFAULT 0
  );

  -- جدول الصلاحيات
  CREATE TABLE IF NOT EXISTS permissions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    code TEXT UNIQUE NOT NULL,
    name_ar TEXT NOT NULL,
    category TEXT
  );

  -- علاقة الأدوار بالصلاحيات
  CREATE TABLE IF NOT EXISTS role_permissions (
    role_id INTEGER NOT NULL,
    permission_id INTEGER NOT NULL,
    PRIMARY KEY (role_id, permission_id),
    FOREIGN KEY (role_id) REFERENCES roles(id) ON DELETE CASCADE,
    FOREIGN KEY (permission_id) REFERENCES permissions(id) ON DELETE CASCADE
  );

  -- جدول المستخدمين
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE NOT NULL,
    full_name TEXT NOT NULL,
    email TEXT,
    phone TEXT,
    password_hash TEXT NOT NULL,
    role_id INTEGER NOT NULL,
    department_id INTEGER,
    is_active INTEGER DEFAULT 1,
    last_login DATETIME,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (role_id) REFERENCES roles(id),
    FOREIGN KEY (department_id) REFERENCES departments(id) ON DELETE SET NULL
  );

  -- صلاحيات إضافية مخصصة لكل مستخدم
  CREATE TABLE IF NOT EXISTS user_permissions (
    user_id INTEGER NOT NULL,
    permission_id INTEGER NOT NULL,
    granted INTEGER DEFAULT 1,
    PRIMARY KEY (user_id, permission_id),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (permission_id) REFERENCES permissions(id) ON DELETE CASCADE
  );

  -- قوالب التقارير (يمكن تصميمها لتناسب نماذج المنشأة)
  CREATE TABLE IF NOT EXISTS templates (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name_ar TEXT NOT NULL,
    name_en TEXT,
    category TEXT NOT NULL,
    description TEXT,
    fields_json TEXT NOT NULL,
    header_html TEXT,
    footer_html TEXT,
    logo_path TEXT,
    is_active INTEGER DEFAULT 1,
    created_by INTEGER,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (created_by) REFERENCES users(id)
  );

  -- التقارير الفعلية المعبأة
  CREATE TABLE IF NOT EXISTS reports (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    template_id INTEGER NOT NULL,
    title TEXT NOT NULL,
    reference_no TEXT,
    department_id INTEGER,
    data_json TEXT NOT NULL,
    status TEXT DEFAULT 'draft',
    priority TEXT DEFAULT 'normal',
    created_by INTEGER NOT NULL,
    assigned_to INTEGER,
    report_date DATE,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (template_id) REFERENCES templates(id),
    FOREIGN KEY (department_id) REFERENCES departments(id) ON DELETE SET NULL,
    FOREIGN KEY (created_by) REFERENCES users(id),
    FOREIGN KEY (assigned_to) REFERENCES users(id)
  );

  -- الملفات والمرفقات
  CREATE TABLE IF NOT EXISTS files (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    report_id INTEGER,
    filename TEXT NOT NULL,
    original_name TEXT NOT NULL,
    file_path TEXT NOT NULL,
    mime_type TEXT,
    size INTEGER,
    uploaded_by INTEGER NOT NULL,
    uploaded_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (report_id) REFERENCES reports(id) ON DELETE CASCADE,
    FOREIGN KEY (uploaded_by) REFERENCES users(id)
  );

  -- مشاركة التقارير
  CREATE TABLE IF NOT EXISTS shares (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    report_id INTEGER NOT NULL,
    shared_with INTEGER NOT NULL,
    permission TEXT DEFAULT 'view',
    shared_by INTEGER NOT NULL,
    shared_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (report_id) REFERENCES reports(id) ON DELETE CASCADE,
    FOREIGN KEY (shared_with) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (shared_by) REFERENCES users(id)
  );

  -- إعدادات النظام
  CREATE TABLE IF NOT EXISTS settings (
    key TEXT PRIMARY KEY,
    value TEXT,
    description TEXT,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  -- سجل التدقيق
  CREATE TABLE IF NOT EXISTS audit_log (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER,
    action TEXT NOT NULL,
    entity_type TEXT,
    entity_id INTEGER,
    details TEXT,
    ip_address TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
  );

  -- تقييم الموظفين
  CREATE TABLE IF NOT EXISTS evaluations (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    employee_id INTEGER NOT NULL,
    evaluator_id INTEGER NOT NULL,
    period TEXT,
    score REAL,
    criteria_json TEXT,
    notes TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (employee_id) REFERENCES users(id),
    FOREIGN KEY (evaluator_id) REFERENCES users(id)
  );

  -- مؤشرات لوحة التحكم
  CREATE TABLE IF NOT EXISTS kpis (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name_ar TEXT NOT NULL,
    code TEXT UNIQUE NOT NULL,
    target_value REAL,
    current_value REAL DEFAULT 0,
    unit TEXT,
    period TEXT,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );
`);

console.log('✅ تم إنشاء الجداول');

// إدراج البيانات الأولية
const insertRole = db.prepare('INSERT OR IGNORE INTO roles (name, name_ar, description, is_system) VALUES (?, ?, ?, ?)');
const roles = [
  ['admin', 'مدير النظام', 'تحكم كامل بالنظام', 1],
  ['manager', 'مدير قسم', 'إدارة قسم محدد', 1],
  ['editor', 'محرر تقارير', 'إنشاء وتعديل التقارير', 1],
  ['viewer', 'مشاهد فقط', 'عرض التقارير والملفات', 1],
  ['operator', 'مشغل', 'تعبئة التقارير وطباعتها', 1]
];
roles.forEach(r => insertRole.run(...r));

const insertPerm = db.prepare('INSERT OR IGNORE INTO permissions (code, name_ar, category) VALUES (?, ?, ?)');
const permissions = [
  // المستخدمين
  ['users.view', 'عرض المستخدمين', 'users'],
  ['users.create', 'إنشاء مستخدم', 'users'],
  ['users.edit', 'تعديل مستخدم', 'users'],
  ['users.delete', 'حذف مستخدم', 'users'],
  // الأقسام
  ['departments.view', 'عرض الأقسام', 'departments'],
  ['departments.create', 'إنشاء قسم', 'departments'],
  ['departments.edit', 'تعديل قسم', 'departments'],
  ['departments.delete', 'حذف قسم', 'departments'],
  // التقارير
  ['reports.view', 'عرض التقارير', 'reports'],
  ['reports.create', 'إنشاء تقرير', 'reports'],
  ['reports.edit', 'تعديل تقرير', 'reports'],
  ['reports.delete', 'حذف تقرير', 'reports'],
  ['reports.print', 'طباعة تقرير', 'reports'],
  ['reports.share', 'مشاركة تقرير', 'reports'],
  ['reports.approve', 'اعتماد تقرير', 'reports'],
  // القوالب
  ['templates.view', 'عرض القوالب', 'templates'],
  ['templates.create', 'إنشاء قالب', 'templates'],
  ['templates.edit', 'تعديل قالب', 'templates'],
  ['templates.delete', 'حذف قالب', 'templates'],
  // الملفات
  ['files.upload', 'رفع ملفات', 'files'],
  ['files.delete', 'حذف ملفات', 'files'],
  // الإعدادات
  ['settings.view', 'عرض الإعدادات', 'settings'],
  ['settings.edit', 'تعديل الإعدادات', 'settings'],
  // اللوحة والمؤشرات
  ['dashboard.view', 'عرض لوحة التحكم', 'dashboard'],
  ['evaluations.view', 'عرض التقييمات', 'evaluations'],
  ['evaluations.create', 'إنشاء تقييم', 'evaluations'],
  ['audit.view', 'عرض سجل التدقيق', 'audit']
];
permissions.forEach(p => insertPerm.run(...p));

// تعيين الصلاحيات للأدوار
const assignPerm = db.prepare(`
  INSERT OR IGNORE INTO role_permissions (role_id, permission_id)
  SELECT ?, id FROM permissions WHERE code = ?
`);

// Admin - كل الصلاحيات
const adminRole = db.prepare('SELECT id FROM roles WHERE name = ?').get('admin');
const allPerms = db.prepare('SELECT id FROM permissions').all();
allPerms.forEach(p => {
  db.prepare('INSERT OR IGNORE INTO role_permissions (role_id, permission_id) VALUES (?, ?)').run(adminRole.id, p.id);
});

// Manager
const managerPerms = [
  'users.view', 'departments.view', 'reports.view', 'reports.create',
  'reports.edit', 'reports.print', 'reports.share', 'reports.approve',
  'templates.view', 'files.upload', 'dashboard.view',
  'evaluations.view', 'evaluations.create'
];
const managerRole = db.prepare('SELECT id FROM roles WHERE name = ?').get('manager');
managerPerms.forEach(code => assignPerm.run(managerRole.id, code));

// Editor
const editorPerms = [
  'reports.view', 'reports.create', 'reports.edit', 'reports.print',
  'templates.view', 'files.upload', 'dashboard.view', 'departments.view'
];
const editorRole = db.prepare('SELECT id FROM roles WHERE name = ?').get('editor');
editorPerms.forEach(code => assignPerm.run(editorRole.id, code));

// Viewer
const viewerPerms = ['reports.view', 'dashboard.view', 'reports.print', 'departments.view'];
const viewerRole = db.prepare('SELECT id FROM roles WHERE name = ?').get('viewer');
viewerPerms.forEach(code => assignPerm.run(viewerRole.id, code));

// Operator
const operatorPerms = [
  'reports.view', 'reports.create', 'reports.edit', 'reports.print',
  'templates.view', 'files.upload', 'dashboard.view'
];
const operatorRole = db.prepare('SELECT id FROM roles WHERE name = ?').get('operator');
operatorPerms.forEach(code => assignPerm.run(operatorRole.id, code));

console.log('✅ تم إنشاء الأدوار والصلاحيات');

// إنشاء الأقسام الافتراضية
const insertDept = db.prepare('INSERT OR IGNORE INTO departments (name_ar, name_en, description) VALUES (?, ?, ?)');
const depts = [
  ['الأمن والسلامة', 'Safety & Security', 'القسم الرئيسي'],
  ['الحماية المدنية', 'Civil Defense', 'فرع الحماية المدنية'],
  ['الصحة المهنية', 'Occupational Health', 'صحة وسلامة الموظفين'],
  ['البيئة', 'Environment', 'الصحة البيئية']
];
depts.forEach(d => insertDept.run(...d));

// إنشاء المستخدم الإداري الافتراضي
const adminExists = db.prepare('SELECT id FROM users WHERE username = ?').get('admin');
if (!adminExists) {
  const hash = bcrypt.hashSync('admin123', 10);
  db.prepare(`
    INSERT INTO users (username, full_name, email, password_hash, role_id, department_id)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run('admin', 'مدير النظام', 'admin@safety.local', hash, adminRole.id, 1);
  console.log('✅ تم إنشاء المستخدم الإداري - admin / admin123');
}

// إعدادات افتراضية
const defaultSettings = [
  ['site_name_ar', 'نظام إدارة الأمن والسلامة', 'اسم الموقع بالعربية'],
  ['site_name_en', 'Safety & Security Management', 'اسم الموقع بالإنجليزية'],
  ['company_name', 'المنشأة', 'اسم المنشأة'],
  ['logo_path', '', 'مسار الشعار'],
  ['primary_color', '#1e3a5f', 'اللون الرئيسي'],
  ['accent_color', '#d4a017', 'اللون المميز'],
  ['default_lang', 'ar', 'اللغة الافتراضية'],
  ['date_format', 'DD/MM/YYYY', 'صيغة التاريخ'],
  ['enable_audit', '1', 'تفعيل سجل التدقيق'],
  ['session_timeout', '60', 'مهلة الجلسة بالدقائق'],
  ['allow_registration', '0', 'السماح بالتسجيل الذاتي']
];
const insertSetting = db.prepare('INSERT OR IGNORE INTO settings (key, value, description) VALUES (?, ?, ?)');
defaultSettings.forEach(s => insertSetting.run(...s));

// قوالب افتراضية
const defaultTemplates = [
  {
    name_ar: 'تقرير حادث',
    category: 'incidents',
    description: 'نموذج تسجيل الحوادث والإصابات',
    fields: [
      { id: 'incident_date', label_ar: 'تاريخ الحادث', type: 'date', required: true },
      { id: 'incident_time', label_ar: 'وقت الحادث', type: 'time', required: true },
      { id: 'location', label_ar: 'الموقع', type: 'text', required: true },
      { id: 'severity', label_ar: 'درجة الخطورة', type: 'select', options: ['بسيط','متوسط','شديد','كارثي'], required: true },
      { id: 'injured_count', label_ar: 'عدد المصابين', type: 'number', required: false },
      { id: 'description', label_ar: 'وصف الحادث', type: 'textarea', required: true },
      { id: 'causes', label_ar: 'الأسباب', type: 'textarea', required: false },
      { id: 'actions_taken', label_ar: 'الإجراءات المتخذة', type: 'textarea', required: true },
      { id: 'recommendations', label_ar: 'التوصيات', type: 'textarea', required: false }
    ]
  },
  {
    name_ar: 'تقرير جولة تفتيشية',
    category: 'inspections',
    description: 'نموذج الجولات التفتيشية اليومية',
    fields: [
      { id: 'inspection_date', label_ar: 'تاريخ الجولة', type: 'date', required: true },
      { id: 'inspector', label_ar: 'اسم المفتش', type: 'text', required: true },
      { id: 'area', label_ar: 'المنطقة', type: 'text', required: true },
      { id: 'fire_extinguishers', label_ar: 'حالة طفايات الحريق', type: 'select', options: ['جيدة','تحتاج صيانة','معطلة'], required: true },
      { id: 'emergency_exits', label_ar: 'مخارج الطوارئ', type: 'select', options: ['سالكة','مغلقة','بحاجة تحسين'], required: true },
      { id: 'observations', label_ar: 'الملاحظات', type: 'textarea', required: false },
      { id: 'corrective_actions', label_ar: 'الإجراءات التصحيحية', type: 'textarea', required: false }
    ]
  },
  {
    name_ar: 'تقرير تدريب',
    category: 'training',
    description: 'نموذج تسجيل الدورات التدريبية',
    fields: [
      { id: 'training_name', label_ar: 'اسم الدورة', type: 'text', required: true },
      { id: 'trainer', label_ar: 'المدرب', type: 'text', required: true },
      { id: 'training_date', label_ar: 'تاريخ التدريب', type: 'date', required: true },
      { id: 'duration', label_ar: 'المدة (ساعات)', type: 'number', required: true },
      { id: 'attendees_count', label_ar: 'عدد الحضور', type: 'number', required: true },
      { id: 'topics', label_ar: 'الموضوعات', type: 'textarea', required: true },
      { id: 'certificate_issued', label_ar: 'منح شهادة؟', type: 'select', options: ['نعم','لا'], required: true }
    ]
  },
  {
    name_ar: 'تقرير معدات السلامة',
    category: 'equipment',
    description: 'فحص ومتابعة معدات السلامة',
    fields: [
      { id: 'equipment_type', label_ar: 'نوع المعدة', type: 'select', options: ['طفاية حريق','إنذار حريق','مرشات مياه','كاميرا مراقبة','بوابة أمنية'], required: true },
      { id: 'serial_no', label_ar: 'الرقم التسلسلي', type: 'text', required: false },
      { id: 'location', label_ar: 'الموقع', type: 'text', required: true },
      { id: 'inspection_date', label_ar: 'تاريخ الفحص', type: 'date', required: true },
      { id: 'next_inspection', label_ar: 'الفحص القادم', type: 'date', required: false },
      { id: 'status', label_ar: 'الحالة', type: 'select', options: ['سليمة','تحتاج صيانة','معطلة','مستبدلة'], required: true },
      { id: 'notes', label_ar: 'ملاحظات', type: 'textarea', required: false }
    ]
  }
];

const insertTpl = db.prepare(`
  INSERT OR IGNORE INTO templates (name_ar, category, description, fields_json, created_by)
  VALUES (?, ?, ?, ?, ?)
`);
const adminUser = db.prepare('SELECT id FROM users WHERE username = ?').get('admin');
defaultTemplates.forEach(t => {
  insertTpl.run(t.name_ar, t.category, t.description, JSON.stringify(t.fields), adminUser.id);
});

// مؤشرات افتراضية
const insertKpi = db.prepare('INSERT OR IGNORE INTO kpis (name_ar, code, target_value, current_value, unit, period) VALUES (?, ?, ?, ?, ?, ?)');
const kpis = [
  ['عدد الحوادث الشهرية', 'monthly_incidents', 0, 0, 'حادث', 'monthly'],
  ['أيام بدون حوادث', 'days_without_incident', 365, 0, 'يوم', 'continuous'],
  ['نسبة إنجاز الجولات', 'inspection_completion', 100, 0, '%', 'monthly'],
  ['ساعات التدريب', 'training_hours', 200, 0, 'ساعة', 'quarterly'],
  ['نسبة جاهزية المعدات', 'equipment_readiness', 100, 0, '%', 'monthly']
];
kpis.forEach(k => insertKpi.run(...k));

console.log('✅ تم إنشاء البيانات الافتراضية');
console.log('');
console.log('═══════════════════════════════════════');
console.log('🎉 اكتملت تهيئة قاعدة البيانات بنجاح');
console.log('═══════════════════════════════════════');
console.log('👤 اسم المستخدم: admin');
console.log('🔑 كلمة المرور: admin123');
console.log('═══════════════════════════════════════');

db.close();
