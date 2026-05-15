// =========== مكتبة النماذج والخطابات ===========
const DOC_CATEGORIES = {
  general:    { label: 'عام',               icon: '📄' },
  report:     { label: 'تقارير',            icon: '📋' },
  letter:     { label: 'خطابات',            icon: '✉️'  },
  form:       { label: 'نماذج',             icon: '📝' },
  procedure:  { label: 'إجراءات وسياسات',  icon: '📖' },
  certificate:{ label: 'شهادات',            icon: '🏅' },
  other:      { label: 'أخرى',             icon: '📁' }
};

const DOC_TYPES = {
  pdf:        { label: 'PDF',        icon: '📄', color: '#dc2626', bg: '#fee2e2' },
  word:       { label: 'Word',       icon: '📝', color: '#1d4ed8', bg: '#dbeafe' },
  excel:      { label: 'Excel',      icon: '📊', color: '#15803d', bg: '#dcfce7' },
  powerpoint: { label: 'PowerPoint', icon: '📑', color: '#ea580c', bg: '#ffedd5' },
  image:      { label: 'صورة',       icon: '🖼️', color: '#7c3aed', bg: '#ede9fe' },
  text:       { label: 'نص',         icon: '📃', color: '#475569', bg: '#f1f5f9' },
  other:      { label: 'ملف',        icon: '📎', color: '#475569', bg: '#f1f5f9' }
};

function docTypeInfo(type) { return DOC_TYPES[type] || DOC_TYPES.other; }
function docCatInfo(cat)   { return DOC_CATEGORIES[cat] || DOC_CATEGORIES.other; }

function formatFileSize(bytes) {
  if (!bytes) return '-';
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
  return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
}

function detectDocType(filename) {
  const ext = (filename.split('.').pop() || '').toLowerCase();
  if (ext === 'pdf') return 'pdf';
  if (['doc','docx','rtf'].includes(ext)) return 'word';
  if (['xls','xlsx'].includes(ext)) return 'excel';
  if (['ppt','pptx'].includes(ext)) return 'powerpoint';
  if (['png','jpg','jpeg','gif','svg','webp'].includes(ext)) return 'image';
  if (ext === 'txt') return 'text';
  return 'other';
}

let _docFilter = { category: '', search: '' };

async function renderDocuments() {
  content().innerHTML = '<div class="empty-state"><div class="icon">⏳</div><p>جاري التحميل...</p></div>';
  try {
    const params = new URLSearchParams();
    if (_docFilter.category) params.set('category', _docFilter.category);
    if (_docFilter.search)   params.set('search',   _docFilter.search);
    const docs = await api('/api/documents?' + params.toString());

    const catOptions = Object.entries(DOC_CATEGORIES)
      .map(([v, c]) => `<option value="${v}">${c.icon} ${c.label}</option>`).join('');

    const catTabs = Object.entries(DOC_CATEGORIES).map(([v, c]) => {
      const cnt = docs.filter(d => d.category === v).length;
      if (!cnt) return '';
      return `<button class="doc-cat-btn ${_docFilter.category === v ? 'active' : ''}"
        onclick="_docFilter.category='${v}'; renderDocuments()">${c.icon} ${c.label} (${cnt})</button>`;
    }).join('');

    content().innerHTML = `
      <div class="page-header">
        <h2 class="page-title">📁 مكتبة النماذج والخطابات</h2>
        ${hasPermission('templates.create') ? '<button class="btn btn-primary" onclick="docUploadForm()">📤 رفع وثيقة جديدة</button>' : ''}
      </div>
      <div class="card mb-3">
        <div class="doc-filters">
          <input type="search" class="doc-search-input" placeholder="🔍 بحث بالاسم أو الوسوم..."
            value="${_docFilter.search}" oninput="_docFilter.search=this.value; renderDocuments()">
          <div class="doc-cat-tabs">
            <button class="doc-cat-btn ${!_docFilter.category ? 'active' : ''}"
              onclick="_docFilter.category=''; renderDocuments()">الكل (${docs.length})</button>
            ${catTabs}
          </div>
        </div>
      </div>
      <div class="doc-grid" id="docGrid">
        ${docs.length === 0
          ? '<div class="empty-state" style="grid-column:1/-1"><div class="icon">📭</div><p>لا توجد وثائق بعد. ارفع أول نموذج أو خطاب!</p></div>'
          : docs.map(d => docCard(d)).join('')}
      </div>`;
  } catch (e) {
    content().innerHTML = `<div class="empty-state"><div class="icon">⚠️</div><p>${e.message}</p></div>`;
  }
}

function docCard(d) {
  const t = docTypeInfo(d.file_type);
  const cat = docCatInfo(d.category);
  const canEdit = hasPermission('templates.edit');
  const canDel  = hasPermission('templates.delete');
  const safeName = (d.name_ar || '').replace(/'/g, "\\'");
  return `
    <div class="doc-card">
      <div class="doc-card-icon" style="background:${t.bg};color:${t.color}">${t.icon}</div>
      <div class="doc-card-body">
        <div class="doc-card-title">${d.name_ar}</div>
        <div class="doc-card-meta">
          <span class="doc-type-badge" style="background:${t.bg};color:${t.color}">${t.label}</span>
          <span class="doc-cat-badge">${cat.icon} ${cat.label}</span>
          ${d.version > 1 ? `<span class="doc-version-badge">v${d.version}</span>` : ''}
        </div>
        ${d.description ? `<div class="doc-card-desc">${d.description}</div>` : ''}
        ${d.tags ? `<div class="doc-card-tags">${d.tags.split(',').map(t => `<span class="doc-tag">${t.trim()}</span>`).join('')}</div>` : ''}
        <div class="doc-card-footer">
          <span class="text-muted">${formatFileSize(d.file_size)} · ${d.original_name}</span>
        </div>
      </div>
      <div class="doc-card-actions">
        <button class="doc-action-btn primary" title="معاينة" onclick="docPreview(${d.id})">👁️ عرض</button>
        <a class="doc-action-btn success" title="تحميل" href="/api/documents/${d.id}/download">⬇️ تحميل</a>
        ${canEdit ? `<button class="doc-action-btn warning" title="رفع نسخة جديدة" onclick="docNewVersion(${d.id},'${safeName}')">🔄 تحديث</button>` : ''}
        ${canEdit ? `<button class="doc-action-btn" title="تعديل البيانات" onclick="docEditMeta(${d.id})">✏️</button>` : ''}
        ${canDel  ? `<button class="doc-action-btn danger" title="حذف" onclick="docDelete(${d.id})">🗑️</button>` : ''}
      </div>
    </div>`;
}

// ---- معاينة ----
async function docPreview(id) {
  const d = await api('/api/documents/' + id);
  const t = docTypeInfo(d.file_type);
  let previewHTML = '';

  if (d.file_type === 'pdf') {
    previewHTML = `<iframe src="${d.file_path}" style="width:100%;height:72vh;border:none;border-radius:6px;"></iframe>`;
  } else if (d.file_type === 'image') {
    previewHTML = `<div style="text-align:center;"><img src="${d.file_path}" style="max-width:100%;max-height:72vh;object-fit:contain;border-radius:6px;box-shadow:var(--shadow-lg)"></div>`;
  } else if (d.file_type === 'text') {
    try {
      const r = await fetch(d.file_path);
      const text = await r.text();
      previewHTML = `<pre style="white-space:pre-wrap;font-size:13px;max-height:65vh;overflow:auto;background:var(--bg);padding:16px;border-radius:6px;direction:ltr">${text.replace(/</g,'&lt;')}</pre>`;
    } catch { previewHTML = '<p class="text-muted text-center">تعذّر تحميل الملف</p>'; }
  } else {
    previewHTML = `
      <div style="text-align:center;padding:48px 0;">
        <div style="font-size:72px;margin-bottom:20px">${t.icon}</div>
        <p style="font-size:18px;font-weight:700;margin-bottom:6px">${d.name_ar}</p>
        <p class="text-muted">${d.original_name}</p>
        <p class="text-muted">${t.label} · ${formatFileSize(d.file_size)} · النسخة ${d.version}</p>
        <div style="margin-top:24px;padding:16px;background:var(--bg);border-radius:8px;display:inline-block;">
          <p style="font-size:13px;color:var(--text-muted)">⬇️ حمّل الملف للتعديل عليه، ثم ارفع النسخة المعدَّلة</p>
        </div>
      </div>`;
  }

  const safeName = (d.name_ar || '').replace(/'/g, "\\'");
  showModal(`${t.icon} ${d.name_ar}`, previewHTML, `
    <a class="btn btn-primary" href="/api/documents/${id}/download">⬇️ تحميل للتعديل</a>
    ${hasPermission('templates.edit') ? `<button class="btn btn-warning" onclick="closeModal();docNewVersion(${id},'${safeName}')">🔄 رفع نسخة معدَّلة</button>` : ''}
    <button class="btn" onclick="closeModal()">إغلاق</button>
  `, 'modal-xl');
}

// ---- رفع وثيقة جديدة ----
function docUploadForm() {
  const catOptions = Object.entries(DOC_CATEGORIES)
    .map(([v, c]) => `<option value="${v}">${c.icon} ${c.label}</option>`).join('');

  showModal('📤 رفع وثيقة جديدة', `
    <div class="form-grid">
      <div class="form-group">
        <label>اسم الوثيقة (عربي) <span class="required">*</span></label>
        <input id="dUpNameAr" placeholder="مثال: نموذج تقرير حادث">
      </div>
      <div class="form-group">
        <label>الاسم (إنجليزي)</label>
        <input id="dUpNameEn" placeholder="Incident Report Form">
      </div>
      <div class="form-group">
        <label>التصنيف</label>
        <select id="dUpCat">${catOptions}</select>
      </div>
      <div class="form-group">
        <label>وسوم (مفصولة بفاصلة)</label>
        <input id="dUpTags" placeholder="سلامة، حوادث، نماذج">
      </div>
      <div class="form-group full">
        <label>الوصف</label>
        <textarea id="dUpDesc" placeholder="وصف مختصر للوثيقة..."></textarea>
      </div>
      <div class="form-group full">
        <label>الملف <span class="required">*</span></label>
        <div class="doc-drop-zone" id="dUpZone" onclick="document.getElementById('dUpFile').click()">
          <div id="dUpZoneContent">
            <span style="font-size:44px">📎</span>
            <p style="margin:8px 0;font-weight:600">انقر لاختيار ملف أو اسحبه هنا</p>
            <small class="text-muted">PDF · Word · Excel · PowerPoint · صور · نصوص — حتى 50 ميجا</small>
          </div>
          <input type="file" id="dUpFile" style="display:none"
            accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.rtf,.png,.jpg,.jpeg,.gif,.svg"
            onchange="dUpFileSelected(this)">
        </div>
      </div>
    </div>
  `, `
    <button class="btn btn-primary" onclick="dUpSubmit()">📤 رفع الوثيقة</button>
    <button class="btn" onclick="closeModal()">إلغاء</button>
  `, 'modal-lg');

  setTimeout(() => {
    const zone = document.getElementById('dUpZone');
    if (!zone) return;
    zone.addEventListener('dragover', e => { e.preventDefault(); zone.classList.add('drag-over'); });
    zone.addEventListener('dragleave', () => zone.classList.remove('drag-over'));
    zone.addEventListener('drop', e => {
      e.preventDefault(); zone.classList.remove('drag-over');
      const dt = e.dataTransfer;
      if (dt.files[0]) {
        const inp = document.getElementById('dUpFile');
        inp.files = dt.files;
        dUpFileSelected(inp);
      }
    });
  }, 150);
}

function dUpFileSelected(input) {
  const file = input.files[0];
  if (!file) return;
  const t = docTypeInfo(detectDocType(file.name));
  document.getElementById('dUpZoneContent').innerHTML = `
    <span style="font-size:40px">${t.icon}</span>
    <p style="margin:8px 0;font-weight:700;color:${t.color}">${file.name}</p>
    <small class="text-muted">${formatFileSize(file.size)} · ${t.label}</small>`;
  const na = document.getElementById('dUpNameAr');
  if (na && !na.value) na.value = file.name.replace(/\.[^.]+$/, '');
}

async function dUpSubmit() {
  const nameAr = document.getElementById('dUpNameAr').value.trim();
  const file   = document.getElementById('dUpFile').files[0];
  if (!nameAr) return toast('اسم الوثيقة مطلوب', 'error');
  if (!file)   return toast('يجب اختيار ملف', 'error');

  const fd = new FormData();
  fd.append('file',        file);
  fd.append('name_ar',     nameAr);
  fd.append('name_en',     document.getElementById('dUpNameEn').value);
  fd.append('category',    document.getElementById('dUpCat').value);
  fd.append('tags',        document.getElementById('dUpTags').value);
  fd.append('description', document.getElementById('dUpDesc').value);

  try {
    toast('جاري الرفع...', 'info');
    const res = await fetch('/api/documents/upload', { method: 'POST', body: fd, credentials: 'same-origin' });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'فشل الرفع');
    closeModal();
    toast('تم رفع الوثيقة بنجاح');
    renderDocuments();
  } catch (e) { toast(e.message, 'error'); }
}

// ---- رفع نسخة جديدة ----
function docNewVersion(id, name) {
  showModal(`🔄 رفع نسخة جديدة — ${name}`, `
    <div style="background:var(--bg);border-radius:8px;padding:12px 16px;margin-bottom:16px;font-size:13px;color:var(--text-muted)">
      💡 حمّل الملف الحالي، عدّله على جهازك، ثم ارفعه هنا كنسخة جديدة.
    </div>
    <div class="doc-drop-zone" id="dVerZone" onclick="document.getElementById('dVerFile').click()">
      <div id="dVerZoneContent">
        <span style="font-size:44px">🔄</span>
        <p style="margin:8px 0;font-weight:600">انقر لاختيار الملف المعدَّل</p>
        <small class="text-muted">نفس الصيغ المدعومة — حتى 50 ميجا</small>
      </div>
      <input type="file" id="dVerFile" style="display:none"
        accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.rtf,.png,.jpg,.jpeg,.gif,.svg"
        onchange="dVerFileSelected(this)">
    </div>
  `, `
    <button class="btn btn-warning" onclick="dVerSubmit(${id})">🔄 رفع النسخة الجديدة</button>
    <button class="btn" onclick="closeModal()">إلغاء</button>
  `);
}

function dVerFileSelected(input) {
  const file = input.files[0];
  if (!file) return;
  const t = docTypeInfo(detectDocType(file.name));
  document.getElementById('dVerZoneContent').innerHTML = `
    <span style="font-size:40px">${t.icon}</span>
    <p style="margin:8px 0;font-weight:700;color:${t.color}">${file.name}</p>
    <small class="text-muted">${formatFileSize(file.size)} · ${t.label}</small>`;
}

async function dVerSubmit(id) {
  const file = document.getElementById('dVerFile').files[0];
  if (!file) return toast('يجب اختيار ملف', 'error');
  const fd = new FormData();
  fd.append('file', file);
  try {
    toast('جاري الرفع...', 'info');
    const res = await fetch(`/api/documents/${id}/new-version`, { method: 'POST', body: fd, credentials: 'same-origin' });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'فشل الرفع');
    closeModal();
    toast(`تم رفع النسخة ${data.version} بنجاح`);
    renderDocuments();
  } catch (e) { toast(e.message, 'error'); }
}

// ---- تعديل بيانات ----
async function docEditMeta(id) {
  const d = await api('/api/documents/' + id);
  const catOptions = Object.entries(DOC_CATEGORIES)
    .map(([v, c]) => `<option value="${v}" ${d.category === v ? 'selected' : ''}>${c.icon} ${c.label}</option>`).join('');

  showModal('✏️ تعديل بيانات الوثيقة', `
    <div class="form-grid">
      <div class="form-group">
        <label>الاسم (عربي) <span class="required">*</span></label>
        <input id="dEdNameAr" value="${d.name_ar}">
      </div>
      <div class="form-group">
        <label>الاسم (إنجليزي)</label>
        <input id="dEdNameEn" value="${d.name_en || ''}">
      </div>
      <div class="form-group">
        <label>التصنيف</label>
        <select id="dEdCat">${catOptions}</select>
      </div>
      <div class="form-group">
        <label>الوسوم</label>
        <input id="dEdTags" value="${d.tags || ''}">
      </div>
      <div class="form-group full">
        <label>الوصف</label>
        <textarea id="dEdDesc">${d.description || ''}</textarea>
      </div>
    </div>
  `, `
    <button class="btn btn-primary" onclick="dEdSave(${id})">💾 حفظ</button>
    <button class="btn" onclick="closeModal()">إلغاء</button>
  `);
}

async function dEdSave(id) {
  const body = {
    name_ar:     document.getElementById('dEdNameAr').value,
    name_en:     document.getElementById('dEdNameEn').value,
    category:    document.getElementById('dEdCat').value,
    tags:        document.getElementById('dEdTags').value,
    description: document.getElementById('dEdDesc').value
  };
  if (!body.name_ar) return toast('الاسم مطلوب', 'error');
  try {
    await api(`/api/documents/${id}`, { method: 'PUT', body });
    closeModal(); toast('تم الحفظ'); renderDocuments();
  } catch (e) { toast(e.message, 'error'); }
}

async function docDelete(id) {
  if (!confirm('هل أنت متأكد من حذف هذه الوثيقة؟')) return;
  try {
    await api(`/api/documents/${id}`, { method: 'DELETE' });
    toast('تم الحذف');
    renderDocuments();
  } catch (e) { toast(e.message, 'error'); }
}
