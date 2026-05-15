// عرض الصفحات المختلفة
const content = () => document.getElementById('pageContent');

let chartInstances = {};

// =========== لوحة التحكم ===========
async function renderDashboard() {
  content().innerHTML = '<div class="empty-state"><div class="icon">⏳</div><p>جاري التحميل...</p></div>';
  try {
    const data = await api('/api/dashboard/stats');
    content().innerHTML = `
      <div class="stats-grid">
        <div class="stat-card">
          <div class="stat-icon">📋</div>
          <div class="stat-info">
            <div class="stat-value">${data.totals.reports}</div>
            <div class="stat-label">إجمالي التقارير</div>
          </div>
        </div>
        <div class="stat-card success">
          <div class="stat-icon">👥</div>
          <div class="stat-info">
            <div class="stat-value">${data.totals.users}</div>
            <div class="stat-label">المستخدمون</div>
          </div>
        </div>
        <div class="stat-card warning">
          <div class="stat-icon">🏢</div>
          <div class="stat-info">
            <div class="stat-value">${data.totals.departments}</div>
            <div class="stat-label">الأقسام</div>
          </div>
        </div>
        <div class="stat-card info">
          <div class="stat-icon">📝</div>
          <div class="stat-info">
            <div class="stat-value">${data.totals.templates}</div>
            <div class="stat-label">القوالب</div>
          </div>
        </div>
      </div>

      <div style="display: grid; grid-template-columns: 2fr 1fr; gap: 20px; margin-bottom: 20px;">
        <div class="card">
          <div class="card-header"><h3 class="card-title">📈 التقارير في آخر 30 يوم</h3></div>
          <div class="chart-container"><canvas id="dailyChart"></canvas></div>
        </div>
        <div class="card">
          <div class="card-header"><h3 class="card-title">📊 التقارير حسب الحالة</h3></div>
          <div class="chart-container"><canvas id="statusChart"></canvas></div>
        </div>
      </div>

      <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin-bottom: 20px;">
        <div class="card">
          <div class="card-header"><h3 class="card-title">🏷️ التقارير حسب الفئة</h3></div>
          <div class="chart-container"><canvas id="categoryChart"></canvas></div>
        </div>
        <div class="card">
          <div class="card-header"><h3 class="card-title">🏢 التقارير حسب القسم</h3></div>
          <div class="chart-container"><canvas id="deptChart"></canvas></div>
        </div>
      </div>

      <div class="card">
        <div class="card-header"><h3 class="card-title">🎯 مؤشرات الأداء</h3></div>
        <div class="stats-grid" id="kpisContainer"></div>
      </div>

      <div class="card">
        <div class="card-header"><h3 class="card-title">🕐 آخر التقارير</h3></div>
        <div class="table-wrapper">
          <table class="data-table">
            <thead>
              <tr>
                <th>العنوان</th>
                <th>الفئة</th>
                <th>القسم</th>
                <th>بواسطة</th>
                <th>الحالة</th>
                <th>التاريخ</th>
              </tr>
            </thead>
            <tbody>
              ${data.recent.map(r => `
                <tr style="cursor:pointer" onclick="viewReport(${r.id})">
                  <td><strong>${r.title}</strong></td>
                  <td>${r.category || '-'}</td>
                  <td>${r.department || '-'}</td>
                  <td>${r.creator || '-'}</td>
                  <td>${statusBadge(r.status)}</td>
                  <td>${formatDate(r.created_at)}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      </div>
    `;

    // Charts
    Object.values(chartInstances).forEach(c => c?.destroy());
    chartInstances = {};

    const primary = '#1e3a5f';
    const colors = ['#1e3a5f', '#d4a017', '#38a169', '#3182ce', '#e53e3e', '#805ad5', '#dd6b20'];

    if (data.daily.length) {
      chartInstances.daily = new Chart(document.getElementById('dailyChart'), {
        type: 'line',
        data: {
          labels: data.daily.map(d => d.day),
          datasets: [{ label: 'التقارير', data: data.daily.map(d => d.count), borderColor: primary, backgroundColor: 'rgba(30,58,95,0.1)', tension: 0.3, fill: true }]
        },
        options: { responsive: true, maintainAspectRatio: false }
      });
    }

    if (data.by_status.length) {
      chartInstances.status = new Chart(document.getElementById('statusChart'), {
        type: 'doughnut',
        data: { labels: data.by_status.map(s => s.status), datasets: [{ data: data.by_status.map(s => s.count), backgroundColor: colors }] },
        options: { responsive: true, maintainAspectRatio: false }
      });
    }

    if (data.by_category.length) {
      chartInstances.cat = new Chart(document.getElementById('categoryChart'), {
        type: 'bar',
        data: { labels: data.by_category.map(s => s.category), datasets: [{ data: data.by_category.map(s => s.count), backgroundColor: colors }] },
        options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } } }
      });
    }

    if (data.by_department.length) {
      chartInstances.dept = new Chart(document.getElementById('deptChart'), {
        type: 'bar',
        data: { labels: data.by_department.map(s => s.name), datasets: [{ data: data.by_department.map(s => s.count), backgroundColor: '#d4a017' }] },
        options: { responsive: true, maintainAspectRatio: false, indexAxis: 'y', plugins: { legend: { display: false } } }
      });
    }

    // KPIs
    const kpisHTML = data.kpis.map(k => {
      const pct = k.target_value ? Math.min(100, Math.round(k.current_value / k.target_value * 100)) : 0;
      return `
        <div class="stat-card ${pct >= 80 ? 'success' : pct >= 50 ? 'warning' : 'danger'}">
          <div class="stat-icon">📈</div>
          <div class="stat-info" style="flex:1">
            <div class="stat-label">${k.name_ar}</div>
            <div class="stat-value">${k.current_value} <small style="font-size:13px;color:var(--text-muted)">/ ${k.target_value} ${k.unit||''}</small></div>
            <div style="height: 6px; background: var(--bg); border-radius: 3px; margin-top: 6px; overflow: hidden;">
              <div style="height: 100%; width: ${pct}%; background: var(--primary);"></div>
            </div>
          </div>
        </div>`;
    }).join('');
    document.getElementById('kpisContainer').innerHTML = kpisHTML;

  } catch (e) {
    content().innerHTML = `<div class="empty-state"><div class="icon">⚠️</div><p>${e.message}</p></div>`;
  }
}

// =========== المستخدمون ===========
async function renderUsers() {
  try {
    const users = await api('/api/users');
    const roles = await api('/api/users/meta/roles');
    const depts = await api('/api/departments');

    content().innerHTML = `
      <div class="page-header">
        <h2 class="page-title">👥 المستخدمون</h2>
        <div class="flex gap-2">
          <button class="btn btn-warning" onclick="showResetTokens()">🔑 رموز الاستعادة</button>
          ${hasPermission('users.create') ? `<button class="btn btn-primary" onclick="userForm()">➕ إضافة مستخدم</button>` : ''}
        </div>
      </div>
      <div class="card">
        <div class="table-wrapper">
          <table class="data-table">
            <thead>
              <tr>
                <th>الاسم</th><th>اسم المستخدم</th><th>البريد</th><th>الدور</th><th>القسم</th>
                <th>الحالة</th><th>آخر دخول</th><th>إجراءات</th>
              </tr>
            </thead>
            <tbody>
              ${users.map(u => `
                <tr>
                  <td><strong>${u.full_name}</strong></td>
                  <td>${u.username}</td>
                  <td>${u.email || '-'}</td>
                  <td><span class="badge badge-info">${u.role_name_ar}</span></td>
                  <td>${u.department_name || '-'}</td>
                  <td>${u.is_active ? '<span class="badge badge-success">نشط</span>' : '<span class="badge badge-secondary">معطل</span>'}</td>
                  <td>${formatDate(u.last_login)}</td>
                  <td>
                    ${hasPermission('users.edit') ? `<button class="btn btn-sm btn-info" onclick='userForm(${u.id})'>✏️</button>` : ''}
                    ${hasPermission('users.edit') ? `<button class="btn btn-sm btn-warning" onclick='userPermissions(${u.id})'>🔐</button>` : ''}
                    ${hasPermission('users.delete') && u.id !== currentUser.id ? `<button class="btn btn-sm btn-danger" onclick='deleteUser(${u.id})'>🗑️</button>` : ''}
                  </td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      </div>
    `;

    window._roles = roles;
    window._depts = depts;
  } catch (e) {
    content().innerHTML = `<div class="empty-state"><div class="icon">⚠️</div><p>${e.message}</p></div>`;
  }
}

async function showResetTokens() {
  try {
    const tokens = await api('/api/auth/reset-tokens');
    const rows = tokens.length ? tokens.map(t => {
      const expired = new Date(t.expires_at) < new Date();
      return `
        <tr>
          <td><strong>${t.full_name}</strong><br><small class="text-muted">${t.username}</small></td>
          <td style="font-size:22px; letter-spacing:6px; font-weight:700; color:var(--primary)">${t.code}</td>
          <td>${expired ? '<span class="badge badge-danger">منتهي</span>' : '<span class="badge badge-success">فعّال</span>'}</td>
          <td><small>${formatDate(t.expires_at)}</small></td>
        </tr>`;
    }).join('') : '<tr><td colspan="4" class="text-center text-muted">لا توجد طلبات معلقة</td></tr>';

    showModal('🔑 رموز استعادة كلمة المرور', `
      <p class="text-muted" style="margin-bottom:12px">أعطِ الرمز للمستخدم حتى يتمكن من إعادة تعيين كلمة مروره خلال 30 دقيقة.</p>
      <div class="table-wrapper">
        <table class="data-table">
          <thead><tr><th>المستخدم</th><th>الرمز</th><th>الحالة</th><th>ينتهي في</th></tr></thead>
          <tbody>${rows}</tbody>
        </table>
      </div>
    `, `<button class="btn" onclick="closeModal()">إغلاق</button>`, 'modal-lg');
  } catch (e) {
    toast(e.message, 'error');
  }
}

function userForm(id = null) {
  const isEdit = id !== null;
  const roles = window._roles || [];
  const depts = window._depts || [];

  const loadUser = async () => {
    let u = {};
    if (isEdit) u = await api('/api/users/' + id);
    const html = `
      <form id="userForm">
        <div class="form-grid">
          <div class="form-group">
            <label>اسم المستخدم <span class="required">*</span></label>
            <input name="username" required value="${u.username || ''}" ${isEdit ? 'disabled' : ''}>
          </div>
          <div class="form-group">
            <label>الاسم الكامل <span class="required">*</span></label>
            <input name="full_name" required value="${u.full_name || ''}">
          </div>
          <div class="form-group">
            <label>البريد الإلكتروني</label>
            <input type="email" name="email" value="${u.email || ''}">
          </div>
          <div class="form-group">
            <label>الهاتف</label>
            <input name="phone" value="${u.phone || ''}">
          </div>
          <div class="form-group">
            <label>الدور <span class="required">*</span></label>
            <select name="role_id" required>
              ${roles.map(r => `<option value="${r.id}" ${u.role_id == r.id ? 'selected' : ''}>${r.name_ar}</option>`).join('')}
            </select>
          </div>
          <div class="form-group">
            <label>القسم</label>
            <select name="department_id">
              <option value="">--</option>
              ${depts.map(d => `<option value="${d.id}" ${u.department_id == d.id ? 'selected' : ''}>${d.name_ar}</option>`).join('')}
            </select>
          </div>
          <div class="form-group">
            <label>كلمة المرور ${isEdit ? '(اتركه فارغاً لعدم التغيير)' : '<span class="required">*</span>'}</label>
            <input type="password" name="password" ${isEdit ? '' : 'required'}>
          </div>
          ${isEdit ? `
          <div class="form-group">
            <label>الحالة</label>
            <select name="is_active">
              <option value="1" ${u.is_active ? 'selected':''}>نشط</option>
              <option value="0" ${!u.is_active ? 'selected':''}>معطل</option>
            </select>
          </div>` : ''}
        </div>
      </form>
    `;
    const footer = `
      <button class="btn" onclick="closeModal()">إلغاء</button>
      <button class="btn btn-primary" onclick="saveUser(${id})">حفظ</button>
    `;
    showModal(isEdit ? 'تعديل مستخدم' : 'مستخدم جديد', html, footer);
  };
  loadUser();
}

async function saveUser(id) {
  const form = document.getElementById('userForm');
  const fd = new FormData(form);
  const data = Object.fromEntries(fd);
  if (data.is_active !== undefined) data.is_active = parseInt(data.is_active);
  if (data.role_id) data.role_id = parseInt(data.role_id);
  if (data.department_id) data.department_id = parseInt(data.department_id) || null;
  if (id && !data.password) delete data.password;
  try {
    if (id) await api('/api/users/' + id, { method: 'PUT', body: data });
    else await api('/api/users', { method: 'POST', body: data });
    closeModal();
    toast('تم الحفظ');
    renderUsers();
  } catch (e) { toast(e.message, 'error'); }
}

async function deleteUser(id) {
  if (!confirm('هل أنت متأكد من حذف هذا المستخدم؟')) return;
  try {
    await api('/api/users/' + id, { method: 'DELETE' });
    toast('تم الحذف');
    renderUsers();
  } catch (e) { toast(e.message, 'error'); }
}

async function userPermissions(id) {
  const user = await api('/api/users/' + id);
  const allPerms = await api('/api/users/meta/permissions');
  const userOverrides = {};
  (user.custom_permissions || []).forEach(p => userOverrides[p.code] = p.granted);

  const grouped = {};
  allPerms.forEach(p => {
    if (!grouped[p.category]) grouped[p.category] = [];
    grouped[p.category].push(p);
  });

  const html = `
    <p class="text-muted mb-3">صلاحيات إضافية مخصصة لهذا المستخدم (تتجاوز صلاحيات الدور)</p>
    <form id="permForm">
      ${Object.entries(grouped).map(([cat, perms]) => `
        <div class="card" style="background: var(--bg); margin-bottom: 12px;">
          <strong style="color: var(--primary)">${cat}</strong>
          <div style="margin-top: 8px;">
            ${perms.map(p => `
              <label style="display: block; margin-bottom: 6px; font-weight: normal;">
                <input type="checkbox" name="${p.code}" ${userOverrides[p.code] === 1 ? 'checked' : ''}>
                ${p.name_ar}
              </label>
            `).join('')}
          </div>
        </div>
      `).join('')}
    </form>
  `;
  showModal(`صلاحيات ${user.full_name}`, html, `
    <button class="btn" onclick="closeModal()">إلغاء</button>
    <button class="btn btn-primary" onclick="savePermissions(${id})">حفظ</button>
  `, 'modal-lg');
}

async function savePermissions(id) {
  const form = document.getElementById('permForm');
  const allPerms = await api('/api/users/meta/permissions');
  const permissions = allPerms.map(p => ({ code: p.code, granted: form.elements[p.code]?.checked ? 1 : 0 }))
    .filter(p => p.granted === 1); // فقط الممنوحة الإضافية
  try {
    await api('/api/users/' + id + '/permissions', { method: 'PUT', body: { permissions } });
    closeModal();
    toast('تم حفظ الصلاحيات');
  } catch (e) { toast(e.message, 'error'); }
}

// =========== الأقسام ===========
async function renderDepartments() {
  try {
    const depts = await api('/api/departments');
    content().innerHTML = `
      <div class="page-header">
        <h2 class="page-title">🏢 الأقسام</h2>
        ${hasPermission('departments.create') ? `<button class="btn btn-primary" onclick="departmentForm()">➕ قسم جديد</button>` : ''}
      </div>
      <div class="card">
        <div class="table-wrapper">
          <table class="data-table">
            <thead>
              <tr><th>الاسم</th><th>الاسم بالإنجليزية</th><th>الوصف</th><th>القسم الأب</th><th>المستخدمون</th><th>التقارير</th><th>إجراءات</th></tr>
            </thead>
            <tbody>
              ${depts.map(d => `
                <tr>
                  <td><strong>${d.name_ar}</strong></td>
                  <td>${d.name_en || '-'}</td>
                  <td>${d.description || '-'}</td>
                  <td>${d.parent_name || '-'}</td>
                  <td><span class="badge badge-info">${d.users_count}</span></td>
                  <td><span class="badge badge-secondary">${d.reports_count}</span></td>
                  <td>
                    ${hasPermission('departments.edit') ? `<button class="btn btn-sm btn-info" onclick='departmentForm(${d.id})'>✏️</button>` : ''}
                    ${hasPermission('departments.delete') ? `<button class="btn btn-sm btn-danger" onclick='deleteDepartment(${d.id})'>🗑️</button>` : ''}
                  </td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      </div>
    `;
    window._depts = depts;
  } catch (e) {
    content().innerHTML = `<div class="empty-state"><div class="icon">⚠️</div><p>${e.message}</p></div>`;
  }
}

async function departmentForm(id = null) {
  const isEdit = id !== null;
  const depts = window._depts || await api('/api/departments');
  let d = {};
  if (isEdit) d = depts.find(x => x.id === id) || {};

  showModal(isEdit ? 'تعديل قسم' : 'قسم جديد', `
    <form id="deptForm">
      <div class="form-grid">
        <div class="form-group">
          <label>الاسم بالعربية <span class="required">*</span></label>
          <input name="name_ar" required value="${d.name_ar || ''}">
        </div>
        <div class="form-group">
          <label>الاسم بالإنجليزية</label>
          <input name="name_en" value="${d.name_en || ''}">
        </div>
        <div class="form-group">
          <label>القسم الأب</label>
          <select name="parent_id">
            <option value="">--</option>
            ${depts.filter(x => x.id !== id).map(x => `<option value="${x.id}" ${d.parent_id == x.id ? 'selected' : ''}>${x.name_ar}</option>`).join('')}
          </select>
        </div>
        <div class="form-group full">
          <label>الوصف</label>
          <textarea name="description">${d.description || ''}</textarea>
        </div>
      </div>
    </form>
  `, `
    <button class="btn" onclick="closeModal()">إلغاء</button>
    <button class="btn btn-primary" onclick="saveDepartment(${id})">حفظ</button>
  `);
}

async function saveDepartment(id) {
  const fd = new FormData(document.getElementById('deptForm'));
  const data = Object.fromEntries(fd);
  if (data.parent_id) data.parent_id = parseInt(data.parent_id) || null;
  try {
    if (id) await api('/api/departments/' + id, { method: 'PUT', body: data });
    else await api('/api/departments', { method: 'POST', body: data });
    closeModal();
    toast('تم الحفظ');
    renderDepartments();
  } catch (e) { toast(e.message, 'error'); }
}

async function deleteDepartment(id) {
  if (!confirm('هل أنت متأكد من حذف هذا القسم؟')) return;
  try {
    await api('/api/departments/' + id, { method: 'DELETE' });
    toast('تم الحذف');
    renderDepartments();
  } catch (e) { toast(e.message, 'error'); }
}

// =========== التقارير ===========
async function renderReports() {
  try {
    const reports = await api('/api/reports');
    const templates = await api('/api/templates');
    const depts = await api('/api/departments');

    content().innerHTML = `
      <div class="page-header">
        <h2 class="page-title">📋 التقارير</h2>
        ${hasPermission('reports.create') ? `<button class="btn btn-primary" onclick="reportForm()">➕ تقرير جديد</button>` : ''}
      </div>
      <div class="card">
        <div class="toolbar">
          <input class="search" placeholder="🔍 بحث..." id="reportsSearch" oninput="filterReports()">
          <select id="filterStatus" onchange="filterReports()">
            <option value="">كل الحالات</option>
            <option value="draft">مسودة</option>
            <option value="submitted">مقدم</option>
            <option value="approved">معتمد</option>
            <option value="rejected">مرفوض</option>
            <option value="closed">مغلق</option>
          </select>
          <select id="filterCategory" onchange="filterReports()">
            <option value="">كل الفئات</option>
            <option value="incidents">الحوادث</option>
            <option value="inspections">الجولات التفتيشية</option>
            <option value="training">التدريب</option>
            <option value="equipment">المعدات</option>
          </select>
        </div>
        <div class="table-wrapper">
          <table class="data-table" id="reportsTable">
            <thead>
              <tr>
                <th>#</th><th>العنوان</th><th>القالب</th><th>القسم</th>
                <th>بواسطة</th><th>الحالة</th><th>تاريخ</th><th>إجراءات</th>
              </tr>
            </thead>
            <tbody>
              ${reports.map(r => `
                <tr data-status="${r.status}" data-category="${r.category || ''}">
                  <td>#${r.id}</td>
                  <td><strong>${r.title}</strong>${r.reference_no ? `<br><small class="text-muted">${r.reference_no}</small>` : ''}</td>
                  <td>${r.template_name || '-'}</td>
                  <td>${r.department_name || '-'}</td>
                  <td>${r.creator_name || '-'}</td>
                  <td>${statusBadge(r.status)}</td>
                  <td>${formatDateOnly(r.report_date || r.created_at)}</td>
                  <td>
                    <button class="btn btn-sm btn-info" onclick="viewReport(${r.id})">👁️</button>
                    ${hasPermission('reports.edit') ? `<button class="btn btn-sm btn-warning" onclick="reportForm(${r.id})">✏️</button>` : ''}
                    ${hasPermission('reports.print') ? `<button class="btn btn-sm" onclick="printReport(${r.id})">🖨️</button>` : ''}
                    ${hasPermission('reports.delete') ? `<button class="btn btn-sm btn-danger" onclick="deleteReport(${r.id})">🗑️</button>` : ''}
                  </td>
                </tr>
              `).join('') || '<tr><td colspan="8" class="text-center text-muted">لا توجد تقارير</td></tr>'}
            </tbody>
          </table>
        </div>
      </div>
    `;

    window._templates = templates;
    window._depts = depts;
  } catch (e) {
    content().innerHTML = `<div class="empty-state"><div class="icon">⚠️</div><p>${e.message}</p></div>`;
  }
}

function filterReports() {
  const search = document.getElementById('reportsSearch').value.toLowerCase();
  const status = document.getElementById('filterStatus').value;
  const category = document.getElementById('filterCategory').value;
  document.querySelectorAll('#reportsTable tbody tr').forEach(tr => {
    const text = tr.textContent.toLowerCase();
    const matchS = !status || tr.dataset.status === status;
    const matchC = !category || tr.dataset.category === category;
    const matchT = !search || text.includes(search);
    tr.style.display = (matchS && matchC && matchT) ? '' : 'none';
  });
}

async function reportForm(id = null) {
  const isEdit = id !== null;
  const templates = window._templates || await api('/api/templates');
  const depts = window._depts || await api('/api/departments');

  let report = { data: {} };
  let template = null;
  if (isEdit) {
    report = await api('/api/reports/' + id);
    template = templates.find(t => t.id === report.template_id);
  }

  const templateOpts = templates.map(t => `<option value="${t.id}" ${report.template_id == t.id ? 'selected' : ''}>${t.name_ar}</option>`).join('');

  const renderFields = (tpl, data = {}) => {
    if (!tpl || !tpl.fields) return '';
    return tpl.fields.map(f => {
      const val = data[f.id] || '';
      const req = f.required ? '<span class="required">*</span>' : '';
      let input = '';
      if (f.type === 'textarea') input = `<textarea name="${f.id}" ${f.required?'required':''}>${val}</textarea>`;
      else if (f.type === 'select') input = `<select name="${f.id}" ${f.required?'required':''}><option value="">--</option>${(f.options||[]).map(o => `<option ${val===o?'selected':''}>${o}</option>`).join('')}</select>`;
      else input = `<input type="${f.type}" name="${f.id}" value="${val}" ${f.required?'required':''}>`;
      return `<div class="form-group ${f.type === 'textarea' ? 'full' : ''}"><label>${f.label_ar} ${req}</label>${input}</div>`;
    }).join('');
  };

  const html = `
    <form id="reportForm">
      <div class="form-grid">
        <div class="form-group">
          <label>القالب <span class="required">*</span></label>
          <select name="template_id" required onchange="onTemplateChange(this.value)" ${isEdit ? 'disabled' : ''}>
            <option value="">--</option>${templateOpts}
          </select>
        </div>
        <div class="form-group">
          <label>عنوان التقرير <span class="required">*</span></label>
          <input name="title" required value="${report.title || ''}">
        </div>
        <div class="form-group">
          <label>رقم المرجع</label>
          <input name="reference_no" value="${report.reference_no || ''}">
        </div>
        <div class="form-group">
          <label>القسم</label>
          <select name="department_id">
            <option value="">--</option>
            ${depts.map(d => `<option value="${d.id}" ${report.department_id == d.id ? 'selected' : ''}>${d.name_ar}</option>`).join('')}
          </select>
        </div>
        <div class="form-group">
          <label>تاريخ التقرير</label>
          <input type="date" name="report_date" value="${report.report_date || ''}">
        </div>
        <div class="form-group">
          <label>الحالة</label>
          <select name="status">
            <option value="draft" ${report.status==='draft'?'selected':''}>مسودة</option>
            <option value="submitted" ${report.status==='submitted'?'selected':''}>مقدم</option>
            <option value="approved" ${report.status==='approved'?'selected':''}>معتمد</option>
            <option value="rejected" ${report.status==='rejected'?'selected':''}>مرفوض</option>
            <option value="closed" ${report.status==='closed'?'selected':''}>مغلق</option>
          </select>
        </div>
        <div class="form-group">
          <label>الأولوية</label>
          <select name="priority">
            <option value="low">منخفضة</option>
            <option value="normal" selected>عادية</option>
            <option value="high">عالية</option>
            <option value="urgent">عاجلة</option>
          </select>
        </div>
      </div>
      <hr class="mt-3 mb-3">
      <div id="templateFields">
        <div class="form-grid">
          ${renderFields(template, report.data)}
        </div>
      </div>
    </form>
  `;

  showModal(isEdit ? 'تعديل تقرير' : 'تقرير جديد', html, `
    <button class="btn" onclick="closeModal()">إلغاء</button>
    <button class="btn btn-primary" onclick="saveReport(${id})">حفظ</button>
  `, 'modal-lg');
}

async function onTemplateChange(tid) {
  if (!tid) return;
  const tpl = await api('/api/templates/' + tid);
  const html = `<div class="form-grid">${tpl.fields.map(f => {
    const req = f.required ? '<span class="required">*</span>' : '';
    let input = '';
    if (f.type === 'textarea') input = `<textarea name="${f.id}" ${f.required?'required':''}></textarea>`;
    else if (f.type === 'select') input = `<select name="${f.id}" ${f.required?'required':''}><option value="">--</option>${(f.options||[]).map(o => `<option>${o}</option>`).join('')}</select>`;
    else input = `<input type="${f.type}" name="${f.id}" ${f.required?'required':''}>`;
    return `<div class="form-group ${f.type === 'textarea' ? 'full' : ''}"><label>${f.label_ar} ${req}</label>${input}</div>`;
  }).join('')}</div>`;
  document.getElementById('templateFields').innerHTML = html;
}

async function saveReport(id) {
  const form = document.getElementById('reportForm');
  const fd = new FormData(form);
  const standardFields = ['template_id','title','reference_no','department_id','report_date','status','priority'];
  const data = {};
  const customData = {};
  for (const [k, v] of fd.entries()) {
    if (standardFields.includes(k)) data[k] = v;
    else customData[k] = v;
  }
  data.data = customData;
  if (data.template_id) data.template_id = parseInt(data.template_id);
  if (data.department_id) data.department_id = parseInt(data.department_id) || null;
  try {
    if (id) await api('/api/reports/' + id, { method: 'PUT', body: data });
    else await api('/api/reports', { method: 'POST', body: data });
    closeModal();
    toast('تم الحفظ');
    renderReports();
  } catch (e) { toast(e.message, 'error'); }
}

function buildReportDocStyle(r) {
  const ps = r.page_settings || {};
  let style = '';
  const mt = ps.margin_top || 40;
  const ms = ps.margin_sides || 40;
  style += `padding: ${mt}px ${ms}px;`;
  if (ps.border_style && ps.border_style !== 'none') {
    const bw = (ps.border_width || 2) + 'px';
    const bc = ps.border_color || '#1e3a5f';
    const bs = ps.border_style;
    const border = `${bw} ${bs} ${bc}`;
    if (ps.border_sides === 'all' || !ps.border_sides) style += `border: ${border};`;
    else if (ps.border_sides === 'tb') style += `border-top: ${border}; border-bottom: ${border};`;
    else if (ps.border_sides === 'lr') style += `border-left: ${border}; border-right: ${border};`;
    else if (ps.border_sides === 'top') style += `border-top: ${border};`;
    else if (ps.border_sides === 'bottom') style += `border-bottom: ${border};`;
  }
  return style;
}

function buildReportHeaderHTML(r) {
  const ps = r.page_settings || {};
  const hBg = ps.header_bg || '';
  const hColor = ps.header_color || '';
  const headerStyle = (hBg || hColor)
    ? `background:${hBg || 'var(--primary)'}; color:${hColor || '#fff'}; padding:16px; margin-bottom:16px; border-radius:4px;`
    : '';

  if (r.header_html) {
    return headerStyle
      ? `<div style="${headerStyle}">${r.header_html}</div>`
      : r.header_html;
  }

  const logoHtml = r.logo_path
    ? `<img src="${r.logo_path}" style="height:${ps.logo_size || 80}px; max-width:200px; object-fit:contain; display:block; margin: 0 auto 8px;">`
    : '';

  const position = ps.logo_position || 'center';
  const textAlign = position === 'right' ? 'right' : position === 'left' ? 'left' : 'center';

  return `
    <div class="report-header" style="text-align:${textAlign};${headerStyle}">
      ${logoHtml}
      <h2>${publicSettings.company_name || 'المنشأة'}</h2>
      <h3>${r.template_name || ''}</h3>
    </div>`;
}

function buildTemplateBgHTML(r) {
  if (!r.template_file_path) return '';
  const ft = r.template_file_type || (r.template_file_path.endsWith('.pdf') ? 'pdf' : 'image');
  if (ft === 'pdf') {
    return `
      <div class="template-file-bg-notice no-print" style="background:#fff3cd;border:1px solid #ffc107;padding:8px 12px;border-radius:4px;margin-bottom:12px;font-size:13px;">
        📄 <a href="${r.template_file_path}" target="_blank">عرض ملف القالب الأساسي</a>
        — سيظهر مع بيانات التقرير عند الطباعة
      </div>
      <div class="template-file-bg-print" style="display:none">
        <div style="page-break-after:always; text-align:center;">
          <p style="margin-bottom:8px; font-weight:bold;">ملف القالب الأساسي:</p>
          <embed src="${r.template_file_path}" type="application/pdf" width="100%" height="600px">
        </div>
      </div>`;
  }
  return `<div style="text-align:center; margin-bottom:16px;">
    <img src="${r.template_file_path}" style="max-width:100%; max-height:300px; object-fit:contain; border:1px solid var(--border); border-radius:4px;">
  </div>`;
}

async function viewReport(id) {
  const r = await api('/api/reports/' + id);
  const fieldsHTML = (r.fields || []).map(f => `
    <div class="report-field">
      <div class="report-field-label">${f.label_ar}:</div>
      <div>${r.data[f.id] || '-'}</div>
    </div>
  `).join('');

  const docStyle = buildReportDocStyle(r);
  const headerHTML = buildReportHeaderHTML(r);
  const templateBgHTML = buildTemplateBgHTML(r);

  const html = `
    <div class="report-document" id="printArea" style="${docStyle}">
      ${templateBgHTML}
      ${headerHTML}
      <h3 style="margin-bottom: 16px;">${r.title}</h3>
      ${r.reference_no ? `<p class="text-muted">مرجع: ${r.reference_no}</p>` : ''}
      <hr class="mb-3 mt-3">
      ${fieldsHTML}
      <hr class="mt-3 mb-3">
      <div class="flex gap-3 text-muted" style="font-size: 12px;">
        <span>الحالة: ${statusBadge(r.status)}</span>
        <span>المنشئ: ${r.creator_name || '-'}</span>
        <span>التاريخ: ${formatDateOnly(r.report_date || r.created_at)}</span>
      </div>
      ${r.footer_html || ''}
    </div>
  `;

  showModal(r.title, html, `
    <button class="btn" onclick="closeModal()">إغلاق</button>
    ${hasPermission('reports.print') ? `<button class="btn btn-info" onclick="printElement('printArea')">🖨️ طباعة</button>` : ''}
    ${hasPermission('reports.edit') ? `<button class="btn btn-warning" onclick="closeModal();reportForm(${id})">✏️ تعديل</button>` : ''}
  `, 'modal-lg');
}

function printElement(elId) {
  const el = document.getElementById(elId);
  // إظهار عنصر PDF عند الطباعة
  const pdfPrint = el.querySelector('.template-file-bg-print');
  if (pdfPrint) pdfPrint.style.display = 'block';
  const w = window.open('', '_blank');
  w.document.write(`
    <html dir="rtl">
    <head>
      <title>طباعة</title>
      <link rel="stylesheet" href="/css/style.css">
      <style>
        body { font-family: 'Cairo', Arial; padding: 20px; }
        .no-print { display: none !important; }
        .template-file-bg-print { display: block !important; }
      </style>
    </head>
    <body>${el.outerHTML}</body>
    </html>
  `);
  w.document.close();
  if (pdfPrint) pdfPrint.style.display = 'none';
  setTimeout(() => { w.print(); w.close(); }, 300);
}

async function printReport(id) {
  await viewReport(id);
  setTimeout(() => printElement('printArea'), 300);
}

async function deleteReport(id) {
  if (!confirm('هل أنت متأكد من حذف هذا التقرير؟')) return;
  try {
    await api('/api/reports/' + id, { method: 'DELETE' });
    toast('تم الحذف');
    renderReports();
  } catch (e) { toast(e.message, 'error'); }
}

// =========== الإعدادات ===========
async function renderSettings() {
  try {
    const settings = await api('/api/settings');
    content().innerHTML = `
      <div class="page-header"><h2 class="page-title">⚙️ إعدادات النظام الشاملة</h2></div>

      <div class="tabs">
        <button class="tab active" onclick="switchSettingsTab('general', this)">عام</button>
        <button class="tab" onclick="switchSettingsTab('appearance', this)">المظهر</button>
        <button class="tab" onclick="switchSettingsTab('system', this)">النظام</button>
        <button class="tab" onclick="switchSettingsTab('security', this)">الأمان</button>
      </div>

      <div class="card" id="settingsGeneral">
        <h3 class="mb-3">الإعدادات العامة</h3>
        <div class="form-grid">
          <div class="form-group">
            <label>اسم الموقع (عربي)</label>
            <input data-setting="site_name_ar" value="${settings.site_name_ar?.value || ''}">
          </div>
          <div class="form-group">
            <label>اسم الموقع (إنجليزي)</label>
            <input data-setting="site_name_en" value="${settings.site_name_en?.value || ''}">
          </div>
          <div class="form-group">
            <label>اسم المنشأة</label>
            <input data-setting="company_name" value="${settings.company_name?.value || ''}">
          </div>
          <div class="form-group">
            <label>اللغة الافتراضية</label>
            <select data-setting="default_lang">
              <option value="ar" ${settings.default_lang?.value === 'ar' ? 'selected' : ''}>العربية</option>
              <option value="en" ${settings.default_lang?.value === 'en' ? 'selected' : ''}>English</option>
            </select>
          </div>
          <div class="form-group">
            <label>صيغة التاريخ</label>
            <select data-setting="date_format">
              <option value="DD/MM/YYYY" ${settings.date_format?.value === 'DD/MM/YYYY' ? 'selected' : ''}>DD/MM/YYYY</option>
              <option value="YYYY-MM-DD" ${settings.date_format?.value === 'YYYY-MM-DD' ? 'selected' : ''}>YYYY-MM-DD</option>
              <option value="MM/DD/YYYY" ${settings.date_format?.value === 'MM/DD/YYYY' ? 'selected' : ''}>MM/DD/YYYY</option>
            </select>
          </div>
        </div>
      </div>

      <div class="card hidden" id="settingsAppearance">
        <h3 class="mb-3">المظهر والألوان</h3>
        <div class="form-grid">
          <div class="form-group">
            <label>اللون الرئيسي</label>
            <input type="color" data-setting="primary_color" value="${settings.primary_color?.value || '#1e3a5f'}">
          </div>
          <div class="form-group">
            <label>اللون المميز</label>
            <input type="color" data-setting="accent_color" value="${settings.accent_color?.value || '#d4a017'}">
          </div>
          <div class="form-group full">
            <label>مسار الشعار</label>
            <input data-setting="logo_path" value="${settings.logo_path?.value || ''}" placeholder="/uploads/logo.png">
          </div>
        </div>
      </div>

      <div class="card hidden" id="settingsSystem">
        <h3 class="mb-3">إعدادات النظام</h3>
        <div class="form-grid">
          <div class="form-group">
            <label>مهلة الجلسة (دقائق)</label>
            <input type="number" data-setting="session_timeout" value="${settings.session_timeout?.value || 60}">
          </div>
          <div class="form-group">
            <label>السماح بالتسجيل الذاتي</label>
            <select data-setting="allow_registration">
              <option value="0" ${settings.allow_registration?.value === '0' ? 'selected' : ''}>لا</option>
              <option value="1" ${settings.allow_registration?.value === '1' ? 'selected' : ''}>نعم</option>
            </select>
          </div>
          <div class="form-group">
            <label>تفعيل سجل التدقيق</label>
            <select data-setting="enable_audit">
              <option value="1" ${settings.enable_audit?.value === '1' ? 'selected' : ''}>نعم</option>
              <option value="0" ${settings.enable_audit?.value === '0' ? 'selected' : ''}>لا</option>
            </select>
          </div>
        </div>
      </div>

      <div class="card hidden" id="settingsSecurity">
        <h3 class="mb-3">الأمان</h3>
        <p class="text-muted">تغيير كلمة المرور الخاصة بك</p>
        <form id="passwordForm" class="form-grid">
          <div class="form-group">
            <label>كلمة المرور القديمة</label>
            <input type="password" name="old_password" required>
          </div>
          <div class="form-group">
            <label>كلمة المرور الجديدة</label>
            <input type="password" name="new_password" required minlength="6">
          </div>
          <div class="form-group full">
            <button type="button" class="btn btn-primary" onclick="changePassword()">تغيير كلمة المرور</button>
          </div>
        </form>
      </div>

      <div class="card text-center">
        <button class="btn btn-primary btn-lg" onclick="saveSettings()">💾 حفظ كل الإعدادات</button>
      </div>
    `;
  } catch (e) {
    content().innerHTML = `<div class="empty-state"><div class="icon">⚠️</div><p>${e.message}</p></div>`;
  }
}

function switchSettingsTab(tab, btn) {
  document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
  btn.classList.add('active');
  ['General', 'Appearance', 'System', 'Security'].forEach(t => {
    document.getElementById('settings' + t).classList.add('hidden');
  });
  document.getElementById('settings' + tab.charAt(0).toUpperCase() + tab.slice(1)).classList.remove('hidden');
}

async function saveSettings() {
  const updates = {};
  document.querySelectorAll('[data-setting]').forEach(el => {
    updates[el.dataset.setting] = el.value;
  });
  try {
    await api('/api/settings', { method: 'PUT', body: updates });
    toast('تم حفظ الإعدادات');
  } catch (e) { toast(e.message, 'error'); }
}

async function changePassword() {
  const fd = new FormData(document.getElementById('passwordForm'));
  try {
    await api('/api/auth/change-password', { method: 'POST', body: Object.fromEntries(fd) });
    toast('تم تغيير كلمة المرور');
    document.getElementById('passwordForm').reset();
  } catch (e) { toast(e.message, 'error'); }
}

// =========== سجل التدقيق ===========
async function renderAudit() {
  try {
    const logs = await api('/api/settings/audit/log');
    content().innerHTML = `
      <div class="page-header"><h2 class="page-title">📜 سجل التدقيق</h2></div>
      <div class="card">
        <div class="table-wrapper">
          <table class="data-table">
            <thead><tr><th>التاريخ</th><th>المستخدم</th><th>الإجراء</th><th>النوع</th><th>التفاصيل</th><th>IP</th></tr></thead>
            <tbody>
              ${logs.map(l => `
                <tr>
                  <td>${formatDate(l.created_at)}</td>
                  <td>${l.full_name || l.username || '-'}</td>
                  <td><span class="badge badge-info">${l.action}</span></td>
                  <td>${l.entity_type || '-'}</td>
                  <td>${l.details || '-'}</td>
                  <td><small>${l.ip_address || '-'}</small></td>
                </tr>
              `).join('') || '<tr><td colspan="6" class="text-center text-muted">لا توجد سجلات</td></tr>'}
            </tbody>
          </table>
        </div>
      </div>
    `;
  } catch (e) {
    content().innerHTML = `<div class="empty-state"><div class="icon">⚠️</div><p>${e.message}</p></div>`;
  }
}

// =========== التقييمات ===========
async function renderEvaluations() {
  try {
    const evals = await api('/api/dashboard/evaluations');
    const users = await api('/api/users');
    content().innerHTML = `
      <div class="page-header">
        <h2 class="page-title">⭐ تقييمات الموظفين</h2>
        ${hasPermission('evaluations.create') ? `<button class="btn btn-primary" onclick="evaluationForm()">➕ تقييم جديد</button>` : ''}
      </div>
      <div class="card">
        <div class="table-wrapper">
          <table class="data-table">
            <thead><tr><th>الموظف</th><th>المُقيِّم</th><th>الفترة</th><th>الدرجة</th><th>التاريخ</th><th>ملاحظات</th></tr></thead>
            <tbody>
              ${evals.map(e => `
                <tr>
                  <td><strong>${e.employee_name}</strong></td>
                  <td>${e.evaluator_name}</td>
                  <td>${e.period || '-'}</td>
                  <td><span class="badge badge-${e.score >= 80 ? 'success' : e.score >= 50 ? 'warning' : 'danger'}">${e.score || 0}%</span></td>
                  <td>${formatDate(e.created_at)}</td>
                  <td>${e.notes || '-'}</td>
                </tr>
              `).join('') || '<tr><td colspan="6" class="text-center text-muted">لا توجد تقييمات</td></tr>'}
            </tbody>
          </table>
        </div>
      </div>
    `;
    window._users = users;
  } catch (e) {
    content().innerHTML = `<div class="empty-state"><div class="icon">⚠️</div><p>${e.message}</p></div>`;
  }
}

async function evaluationForm() {
  const users = window._users || await api('/api/users');
  showModal('تقييم جديد', `
    <form id="evalForm">
      <div class="form-grid">
        <div class="form-group">
          <label>الموظف <span class="required">*</span></label>
          <select name="employee_id" required>
            ${users.map(u => `<option value="${u.id}">${u.full_name}</option>`).join('')}
          </select>
        </div>
        <div class="form-group">
          <label>الفترة</label>
          <input name="period" placeholder="مثال: Q1-2026">
        </div>
        <div class="form-group">
          <label>الدرجة (0-100)</label>
          <input type="number" name="score" min="0" max="100" required>
        </div>
        <div class="form-group full">
          <label>ملاحظات</label>
          <textarea name="notes"></textarea>
        </div>
      </div>
    </form>
  `, `
    <button class="btn" onclick="closeModal()">إلغاء</button>
    <button class="btn btn-primary" onclick="saveEvaluation()">حفظ</button>
  `);
}

async function saveEvaluation() {
  const fd = new FormData(document.getElementById('evalForm'));
  const data = Object.fromEntries(fd);
  data.employee_id = parseInt(data.employee_id);
  data.score = parseFloat(data.score);
  try {
    await api('/api/dashboard/evaluations', { method: 'POST', body: data });
    closeModal();
    toast('تم الحفظ');
    renderEvaluations();
  } catch (e) { toast(e.message, 'error'); }
}
