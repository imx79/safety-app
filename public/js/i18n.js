// نظام الترجمة - دعم العربية والإنجليزية
const translations = {
  ar: {
    // عام
    login: 'دخول',
    logout: 'خروج',
    username: 'اسم المستخدم',
    password: 'كلمة المرور',
    save: 'حفظ',
    cancel: 'إلغاء',
    delete: 'حذف',
    edit: 'تعديل',
    add: 'إضافة',
    search: 'بحث',
    print: 'طباعة',
    export: 'تصدير',
    share: 'مشاركة',
    actions: 'إجراءات',
    name: 'الاسم',
    description: 'الوصف',
    status: 'الحالة',
    date: 'التاريخ',
    yes: 'نعم',
    no: 'لا',
    confirm: 'تأكيد',
    confirmDelete: 'هل أنت متأكد من الحذف؟',
    // القوائم
    dashboard: 'لوحة التحكم',
    reports: 'التقارير',
    templates: 'القوالب',
    users: 'المستخدمون',
    departments: 'الأقسام',
    files: 'الملفات',
    settings: 'الإعدادات',
    evaluations: 'التقييمات',
    audit_log: 'سجل التدقيق',
    // أخرى
    welcome: 'مرحباً',
    total_reports: 'إجمالي التقارير',
    total_users: 'المستخدمون',
    total_departments: 'الأقسام',
    total_templates: 'القوالب',
    new_report: 'تقرير جديد',
    new_template: 'قالب جديد',
    new_user: 'مستخدم جديد',
    new_department: 'قسم جديد',
    role: 'الدور',
    permissions: 'الصلاحيات',
    department: 'القسم',
    title: 'العنوان',
    category: 'الفئة',
    priority: 'الأولوية',
    created_by: 'بواسطة',
    created_at: 'تاريخ الإنشاء',
    last_login: 'آخر دخول',
    active: 'نشط',
    inactive: 'غير نشط',
    draft: 'مسودة',
    submitted: 'مقدم',
    approved: 'معتمد',
    rejected: 'مرفوض',
    closed: 'مغلق',
    incidents: 'الحوادث',
    inspections: 'الجولات التفتيشية',
    training: 'التدريب',
    equipment: 'المعدات'
  },
  en: {
    login: 'Login',
    logout: 'Logout',
    username: 'Username',
    password: 'Password',
    save: 'Save',
    cancel: 'Cancel',
    delete: 'Delete',
    edit: 'Edit',
    add: 'Add',
    search: 'Search',
    print: 'Print',
    export: 'Export',
    share: 'Share',
    actions: 'Actions',
    name: 'Name',
    description: 'Description',
    status: 'Status',
    date: 'Date',
    yes: 'Yes',
    no: 'No',
    confirm: 'Confirm',
    confirmDelete: 'Are you sure you want to delete?',
    dashboard: 'Dashboard',
    reports: 'Reports',
    templates: 'Templates',
    users: 'Users',
    departments: 'Departments',
    files: 'Files',
    settings: 'Settings',
    evaluations: 'Evaluations',
    audit_log: 'Audit Log',
    welcome: 'Welcome',
    total_reports: 'Total Reports',
    total_users: 'Users',
    total_departments: 'Departments',
    total_templates: 'Templates',
    new_report: 'New Report',
    new_template: 'New Template',
    new_user: 'New User',
    new_department: 'New Department',
    role: 'Role',
    permissions: 'Permissions',
    department: 'Department',
    title: 'Title',
    category: 'Category',
    priority: 'Priority',
    created_by: 'Created By',
    created_at: 'Created At',
    last_login: 'Last Login',
    active: 'Active',
    inactive: 'Inactive',
    draft: 'Draft',
    submitted: 'Submitted',
    approved: 'Approved',
    rejected: 'Rejected',
    closed: 'Closed',
    incidents: 'Incidents',
    inspections: 'Inspections',
    training: 'Training',
    equipment: 'Equipment'
  }
};

let currentLang = localStorage.getItem('lang') || 'ar';

function t(key) {
  return (translations[currentLang] && translations[currentLang][key]) || key;
}

function setLang(lang) {
  currentLang = lang;
  localStorage.setItem('lang', lang);
  document.documentElement.lang = lang;
  document.documentElement.dir = lang === 'ar' ? 'rtl' : 'ltr';
  document.body.dir = lang === 'ar' ? 'rtl' : 'ltr';
  applyTranslations();
}

function applyTranslations() {
  document.querySelectorAll('[data-i18n]').forEach(el => {
    const key = el.getAttribute('data-i18n');
    el.textContent = t(key);
  });
  document.querySelectorAll('[data-i18n-placeholder]').forEach(el => {
    const key = el.getAttribute('data-i18n-placeholder');
    el.placeholder = t(key);
  });
}

// تطبيق عند التحميل
document.addEventListener('DOMContentLoaded', () => {
  setLang(currentLang);
  document.querySelectorAll('.btn-lang').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.btn-lang').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      setLang(btn.dataset.lang);
    });
  });
});
