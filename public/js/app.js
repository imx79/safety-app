// التطبيق الرئيسي - SPA Router & Helpers
let currentUser = null;
let publicSettings = {};

// =========== Helpers ===========
async function api(url, options = {}) {
  const opts = {
    headers: { 'Content-Type': 'application/json' },
    ...options
  };
  if (opts.body && typeof opts.body !== 'string') opts.body = JSON.stringify(opts.body);
  const res = await fetch(url, opts);
  if (res.status === 401) {
    window.location.href = '/login.html';
    return;
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || 'فشل الطلب');
  return data;
}

function toast(msg, type = 'success') {
  const div = document.createElement('div');
  div.className = `toast ${type}`;
  div.textContent = msg;
  document.body.appendChild(div);
  setTimeout(() => div.remove(), 3000);
}

function showModal(title, bodyHTML, footerHTML = '', size = '') {
  document.getElementById('modal').className = 'modal ' + size;
  document.getElementById('modalTitle').textContent = title;
  document.getElementById('modalBody').innerHTML = bodyHTML;
  document.getElementById('modalFooter').innerHTML = footerHTML || `<button class="btn" onclick="closeModal()" data-i18n="cancel">إلغاء</button>`;
  document.getElementById('modalOverlay').classList.add('active');
}

function closeModal() {
  document.getElementById('modalOverlay').classList.remove('active');
}

function hasPermission(code) {
  if (!currentUser) return false;
  return currentUser.permissions && currentUser.permissions.includes(code);
}

function formatDate(d) {
  if (!d) return '-';
  const date = new Date(d);
  return date.toLocaleString(currentLang === 'ar' ? 'ar-SA' : 'en-US');
}

function formatDateOnly(d) {
  if (!d) return '-';
  const date = new Date(d);
  return date.toLocaleDateString(currentLang === 'ar' ? 'ar-SA' : 'en-US');
}

function statusBadge(status) {
  const map = {
    'draft': ['secondary', 'مسودة'],
    'submitted': ['info', 'مقدم'],
    'approved': ['success', 'معتمد'],
    'rejected': ['danger', 'مرفوض'],
    'closed': ['secondary', 'مغلق'],
    'in_progress': ['warning', 'قيد التنفيذ']
  };
  const [cls, label] = map[status] || ['secondary', status];
  return `<span class="badge badge-${cls}">${label}</span>`;
}

async function logout() {
  await api('/api/auth/logout', { method: 'POST' });
  window.location.href = '/login.html';
}

// =========== Router ===========
const routes = {
  dashboard:  () => renderDashboard(),
  reports:    () => renderReports(),
  templates:  () => renderTemplates(),
  departments:() => renderDepartments(),
  users:      () => renderUsers(),
  settings:   () => renderSettings(),
  audit:      () => renderAudit(),
  evaluations:() => renderEvaluations(),
  documents:  () => renderDocuments()
};

function navigate(page) {
  document.querySelectorAll('.nav-item').forEach(el => el.classList.remove('active'));
  const navItem = document.querySelector(`.nav-item[data-page="${page}"]`);
  if (navItem) navItem.classList.add('active');
  document.getElementById('pageTitle').textContent = t(page) || page;
  window.location.hash = page;
  document.getElementById('sidebar').classList.remove('open');
  if (routes[page]) routes[page]();
}

window.addEventListener('hashchange', () => {
  const page = window.location.hash.replace('#', '') || 'dashboard';
  navigate(page);
});

document.addEventListener('click', e => {
  const link = e.target.closest('.nav-item a');
  if (link) {
    e.preventDefault();
    const page = link.closest('.nav-item').dataset.page;
    navigate(page);
  }
});

// =========== Init ===========
async function init() {
  try {
    currentUser = await api('/api/auth/me');
    publicSettings = await api('/api/settings/public');

    // عرض اسم المستخدم
    document.getElementById('userName').textContent = currentUser.full_name;
    document.getElementById('userRole').textContent = currentUser.role_name_ar;
    document.getElementById('userAvatar').textContent = currentUser.full_name.charAt(0);

    // تطبيق عنوان الشريط الجانبي
    const sidebarHeader = document.querySelector('.sidebar-header');
    if (sidebarHeader) {
      const titleEl = document.getElementById('appName');
      const subtitleEl = sidebarHeader.querySelector('p');
      if (publicSettings.sidebar_title_ar && titleEl)
        titleEl.textContent = '🛡️ ' + publicSettings.sidebar_title_ar;
      else if (publicSettings.site_name_ar && titleEl)
        titleEl.textContent = '🛡️ ' + publicSettings.site_name_ar;
      if (publicSettings.sidebar_subtitle_en && subtitleEl)
        subtitleEl.textContent = publicSettings.sidebar_subtitle_en;
    }

    // عرض شعار الموقع في الشريط الجانبي
    if (publicSettings.logo_path) {
      const sidebarHeader2 = document.querySelector('.sidebar-header');
      if (sidebarHeader2) {
        const img = document.createElement('img');
        img.id = 'sidebarLogoImg';
        img.className = 'sidebar-logo-img';
        img.src = publicSettings.logo_path;
        img.alt = 'شعار';
        sidebarHeader2.insertBefore(img, sidebarHeader2.firstChild);
      }
    }

    // تطبيق الألوان
    if (publicSettings.primary_color)
      document.documentElement.style.setProperty('--primary', publicSettings.primary_color);
    if (publicSettings.accent_color)
      document.documentElement.style.setProperty('--accent', publicSettings.accent_color);

    // إخفاء عناصر القائمة بناءً على الصلاحيات وإعدادات الواجهة
    const navVisMap = {
      dashboard: publicSettings.nav_show_dashboard,
      reports: publicSettings.nav_show_reports,
      templates: publicSettings.nav_show_templates,
      departments: publicSettings.nav_show_departments,
      users: publicSettings.nav_show_users,
      evaluations: publicSettings.nav_show_evaluations,
      audit: publicSettings.nav_show_audit,
    };
    document.querySelectorAll('.nav-item').forEach(item => {
      const perm = item.dataset.perm;
      const page = item.dataset.page;
      if (perm && !hasPermission(perm)) { item.style.display = 'none'; return; }
      if (page && navVisMap[page] === '0') item.style.display = 'none';
    });

    const page = window.location.hash.replace('#', '') || 'dashboard';
    navigate(page);
  } catch (e) {
    window.location.href = '/login.html';
  }
}

init();
