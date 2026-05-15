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

// أنواع الملفات التي تدعم التعديل المباشر
const DIRECT_EDIT_EXTS = ['txt','html','htm','json','csv','md','jpg','jpeg','png','gif','webp','bmp','docx','xlsx'];

function docCard(d) {
  const t = docTypeInfo(d.file_type);
  const cat = docCatInfo(d.category);
  const canEdit = hasPermission('templates.edit');
  const canDel  = hasPermission('templates.delete');
  const safeName = (d.name_ar || '').replace(/'/g, "\\'");
  const ext = (d.original_name.split('.').pop() || '').toLowerCase();
  const canDirectEdit = canEdit && DIRECT_EDIT_EXTS.includes(ext);
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
        ${canDirectEdit ? `<button class="doc-action-btn info" title="تعديل المحتوى مباشرة" onclick="docDirectEdit(${d.id})">✏️ تعديل</button>` : ''}
        ${canEdit ? `<button class="doc-action-btn warning" title="رفع نسخة جديدة" onclick="docNewVersion(${d.id},'${safeName}')">🔄 إصدار</button>` : ''}
        ${canEdit ? `<button class="doc-action-btn" title="تعديل البيانات" onclick="docEditMeta(${d.id})">🏷️</button>` : ''}
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

// =========== تعديل مباشر ===========

// متغيرات محرر الصور
let _imgRotation = 0, _imgFlipH = false, _imgFlipV = false, _imgOriginalEl = null;

async function docDirectEdit(id) {
  let doc;
  try { doc = await api(`/api/documents/${id}`); }
  catch (e) { return toast(e.message, 'error'); }

  const ext = (doc.original_name.split('.').pop() || '').toLowerCase();
  if (['txt','html','htm','json','csv','md'].includes(ext))      docEditText(doc);
  else if (['jpg','jpeg','png','gif','webp','bmp'].includes(ext)) docEditImage(doc);
  else if (ext === 'docx')                                        docEditDocx(doc);
  else if (ext === 'xlsx')                                        docEditXlsx(doc);
  else toast('هذا النوع لا يدعم التعديل المباشر — استخدم "🔄 إصدار" لرفع نسخة معدّلة', 'info');
}

// ======= محرر النصوص =======
async function docEditText(doc) {
  let content = '', ext = 'txt';
  try {
    const r = await api(`/api/documents/${doc.id}/text-content`);
    content = r.content; ext = r.ext;
  } catch (e) { return toast(e.message, 'error'); }

  const isHtml = ['html', 'htm'].includes(ext);
  const escaped = content.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');

  showModal(`✏️ تعديل: ${doc.name_ar}`,
    `<div class="doc-edit-notice">💡 التعديلات ستُحفظ مباشرة على الملف المرفوع</div>
    ${isHtml ? `
      <div class="rte-wrap">
        <div class="rte-toolbar">
          <button class="rte-btn" onclick="rte('dTxtRte','bold')"><b>B</b></button>
          <button class="rte-btn" onclick="rte('dTxtRte','italic')"><i>I</i></button>
          <button class="rte-btn" onclick="rte('dTxtRte','underline')"><u>U</u></button>
          <span class="rte-sep"></span>
          <select class="rte-select" onchange="rte('dTxtRte','formatBlock',this.value)">
            <option value="p">فقرة</option><option value="h1">عنوان 1</option>
            <option value="h2">عنوان 2</option><option value="h3">عنوان 3</option>
          </select>
          <span class="rte-sep"></span>
          <button class="rte-btn" onclick="rte('dTxtRte','insertUnorderedList')">•</button>
          <button class="rte-btn" onclick="rte('dTxtRte','insertOrderedList')">1.</button>
          <span class="rte-sep"></span>
          <button class="rte-btn" onclick="rte('dTxtRte','justifyRight')">⇤</button>
          <button class="rte-btn" onclick="rte('dTxtRte','justifyCenter')">☰</button>
          <button class="rte-btn" onclick="rte('dTxtRte','justifyLeft')">⇥</button>
          <span class="rte-sep"></span>
          <input type="color" class="rte-color-btn" title="لون النص" onchange="rte('dTxtRte','foreColor',this.value)">
        </div>
        <div id="dTxtRte" class="rte-content" contenteditable="true" style="min-height:380px">${content}</div>
      </div>
    ` : `
      <textarea id="dTxtArea" style="width:100%;min-height:420px;font-family:monospace;font-size:13px;padding:10px;border:1px solid var(--border);border-radius:6px;resize:vertical;direction:ltr;background:var(--bg)">${escaped}</textarea>
    `}`,
    `<button class="btn btn-ghost" onclick="closeModal()">إلغاء</button>
     <button class="btn btn-primary" onclick="saveDocText(${doc.id},'${ext}')">💾 حفظ التغييرات</button>`,
    'modal-lg');
}

async function saveDocText(id, ext) {
  const isHtml = ['html','htm'].includes(ext);
  const content = isHtml
    ? document.getElementById('dTxtRte').innerHTML
    : document.getElementById('dTxtArea').value;
  try {
    await api(`/api/documents/${id}/text-content`, { method: 'PUT', body: { content } });
    toast('✅ تم حفظ التغييرات');
    closeModal(); renderDocuments();
  } catch (e) { toast(e.message, 'error'); }
}

// ======= محرر الصور =======
function docEditImage(doc) {
  _imgRotation = 0; _imgFlipH = false; _imgFlipV = false; _imgOriginalEl = null;

  showModal(`🖼️ تعديل الصورة: ${doc.name_ar}`,
    `<div class="doc-edit-notice">💡 يمكنك التدوير والقلب وتعديل الألوان ثم حفظ الصورة مباشرة</div>
    <div class="img-editor-wrap">
      <div class="img-editor-toolbar">
        <button class="btn btn-ghost btn-sm" onclick="imgRotate(-90)">↺ يسار</button>
        <button class="btn btn-ghost btn-sm" onclick="imgRotate(90)">↻ يمين</button>
        <button class="btn btn-ghost btn-sm" onclick="imgFlip('h')">⇄ أفقي</button>
        <button class="btn btn-ghost btn-sm" onclick="imgFlip('v')">⇅ رأسي</button>
        <button class="btn btn-ghost btn-sm" onclick="resetImgEditor()">↩️ إعادة</button>
      </div>
      <div class="img-editor-sliders">
        <label>☀️ السطوع</label>
        <input type="range" id="imgBrightness" min="50" max="200" value="100" oninput="applyImgFilter()">
        <label>◑ التباين</label>
        <input type="range" id="imgContrast" min="50" max="200" value="100" oninput="applyImgFilter()">
        <label>🎨 الإشباع</label>
        <input type="range" id="imgSaturate" min="0" max="200" value="100" oninput="applyImgFilter()">
      </div>
      <div style="text-align:center;overflow:auto">
        <canvas id="imgEdCanvas" style="max-width:100%;max-height:400px;border:1px solid var(--border);border-radius:8px"></canvas>
      </div>
      <img id="imgEdSrc" src="${doc.file_path}" crossorigin="anonymous" style="display:none" onload="initImgEditor()">
    </div>`,
    `<button class="btn btn-ghost" onclick="closeModal()">إلغاء</button>
     <button class="btn btn-primary" onclick="saveDocImage(${doc.id},'${doc.original_name}')">💾 حفظ الصورة</button>`,
    'modal-xl');
}

function initImgEditor() {
  _imgOriginalEl = document.getElementById('imgEdSrc');
  drawImgCanvas();
}

function drawImgCanvas() {
  const canvas = document.getElementById('imgEdCanvas');
  const img = _imgOriginalEl;
  if (!canvas || !img) return;
  const rot = ((_imgRotation % 360) + 360) % 360;
  const swapped = rot === 90 || rot === 270;
  const w = swapped ? img.naturalHeight : img.naturalWidth;
  const h = swapped ? img.naturalWidth  : img.naturalHeight;
  canvas.width = w; canvas.height = h;
  const ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, w, h);
  ctx.save();
  ctx.translate(w / 2, h / 2);
  ctx.rotate(_imgRotation * Math.PI / 180);
  ctx.scale(_imgFlipH ? -1 : 1, _imgFlipV ? -1 : 1);
  ctx.drawImage(img, -img.naturalWidth / 2, -img.naturalHeight / 2);
  ctx.restore();
  applyImgFilter();
}

function applyImgFilter() {
  const canvas = document.getElementById('imgEdCanvas');
  if (!canvas) return;
  const b = document.getElementById('imgBrightness')?.value || 100;
  const c = document.getElementById('imgContrast')?.value  || 100;
  const s = document.getElementById('imgSaturate')?.value  || 100;
  canvas.style.filter = `brightness(${b}%) contrast(${c}%) saturate(${s}%)`;
}

function imgRotate(deg) { _imgRotation += deg; drawImgCanvas(); }
function imgFlip(dir)   { if (dir === 'h') _imgFlipH = !_imgFlipH; else _imgFlipV = !_imgFlipV; drawImgCanvas(); }
function resetImgEditor() {
  _imgRotation = 0; _imgFlipH = false; _imgFlipV = false;
  ['imgBrightness','imgContrast','imgSaturate'].forEach(id => { const el = document.getElementById(id); if (el) el.value = 100; });
  drawImgCanvas();
}

async function saveDocImage(id, originalName) {
  const canvas = document.getElementById('imgEdCanvas');
  if (!canvas) return toast('لم يتم تحميل الصورة', 'error');

  // canvas مؤقت لدمج الفلاتر مع الصورة
  const b = document.getElementById('imgBrightness').value;
  const c = document.getElementById('imgContrast').value;
  const s = document.getElementById('imgSaturate').value;
  const fc = document.createElement('canvas');
  fc.width = canvas.width; fc.height = canvas.height;
  const fCtx = fc.getContext('2d');
  fCtx.filter = `brightness(${b}%) contrast(${c}%) saturate(${s}%)`;
  fCtx.drawImage(canvas, 0, 0);

  const ext = (originalName.split('.').pop() || 'png').toLowerCase();
  const mime = (ext === 'jpg' || ext === 'jpeg') ? 'image/jpeg' : 'image/png';

  fc.toBlob(async (blob) => {
    if (!blob) return toast('فشل تحويل الصورة', 'error');
    const fd = new FormData();
    fd.append('file', blob, originalName);
    try {
      toast('جاري الحفظ...', 'info');
      const res = await fetch(`/api/documents/${id}/overwrite`, { method: 'PUT', body: fd, credentials: 'same-origin' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'فشل الحفظ');
      toast('✅ تم حفظ الصورة بنجاح'); closeModal(); renderDocuments();
    } catch (e) { toast(e.message, 'error'); }
  }, mime, 0.92);
}

// ======= محرر Word (DOCX) =======
async function docEditDocx(doc) {
  if (typeof mammoth === 'undefined') {
    toast('⏳ جاري تحميل محرر Word، حاول مرة أخرى بعد لحظة...', 'info');
    return;
  }

  showModal(`📝 تعديل Word: ${doc.name_ar}`,
    `<div style="text-align:center;padding:48px"><div class="doc-spinner"></div><p style="margin-top:14px;color:var(--text-secondary)">جاري تحميل الوثيقة...</p></div>`,
    '', 'modal-xl');

  try {
    const resp = await fetch(doc.file_path);
    if (!resp.ok) throw new Error('فشل تحميل الملف');
    const ab = await resp.arrayBuffer();
    const { value: html, messages } = await mammoth.convertToHtml({ arrayBuffer: ab });

    document.getElementById('modalBody').innerHTML = `
      <div class="doc-edit-notice">💡 تعديل ملف Word — قد تتغير بعض التنسيقات المعقدة عند الحفظ</div>
      <div class="rte-wrap">
        <div class="rte-toolbar">
          <button class="rte-btn" onclick="rte('docxRte','bold')"><b>B</b></button>
          <button class="rte-btn" onclick="rte('docxRte','italic')"><i>I</i></button>
          <button class="rte-btn" onclick="rte('docxRte','underline')"><u>U</u></button>
          <span class="rte-sep"></span>
          <select class="rte-select" onchange="rte('docxRte','formatBlock',this.value)">
            <option value="p">فقرة</option><option value="h1">عنوان 1</option>
            <option value="h2">عنوان 2</option><option value="h3">عنوان 3</option>
          </select>
          <span class="rte-sep"></span>
          <button class="rte-btn" onclick="rte('docxRte','insertUnorderedList')">•</button>
          <button class="rte-btn" onclick="rte('docxRte','insertOrderedList')">1.</button>
          <span class="rte-sep"></span>
          <button class="rte-btn" onclick="rte('docxRte','justifyRight')">⇤</button>
          <button class="rte-btn" onclick="rte('docxRte','justifyCenter')">☰</button>
          <button class="rte-btn" onclick="rte('docxRte','justifyLeft')">⇥</button>
          <span class="rte-sep"></span>
          <input type="color" class="rte-color-btn" title="لون النص" onchange="rte('docxRte','foreColor',this.value)">
          <select class="rte-select" onchange="rte('docxRte','fontSize',this.value)">
            <option value="">حجم</option><option value="2">صغير</option>
            <option value="3">عادي</option><option value="4">كبير</option><option value="5">أكبر</option>
          </select>
        </div>
        <div id="docxRte" class="rte-content" contenteditable="true" style="min-height:420px;direction:rtl">${html}</div>
      </div>`;

    document.getElementById('modalFooter').innerHTML = `
      <button class="btn btn-ghost" onclick="closeModal()">إلغاء</button>
      <button class="btn btn-primary" onclick="saveDocDocx(${doc.id},'${doc.original_name}')">💾 حفظ كـ Word</button>`;
  } catch (e) {
    document.getElementById('modalBody').innerHTML =
      `<div class="empty-state"><div class="icon">⚠️</div><p>فشل تحميل الوثيقة: ${e.message}</p></div>`;
  }
}

async function saveDocDocx(id, originalName) {
  if (typeof htmlDocx === 'undefined') return toast('مكتبة تحويل Word غير محملة بعد', 'error');

  const html = document.getElementById('docxRte').innerHTML;
  const fullHtml = `<!DOCTYPE html><html dir="rtl"><head><meta charset="UTF-8">
    <style>body{font-family:Arial,sans-serif;font-size:12pt;direction:rtl;}
    table{border-collapse:collapse;width:100%}td,th{border:1px solid #ccc;padding:6px}</style>
    </head><body>${html}</body></html>`;
  try {
    const blob = htmlDocx.asBlob(fullHtml, { orientation: 'portrait', margins: { top: 720, right: 720, bottom: 720, left: 720 } });
    const fd = new FormData();
    fd.append('file', blob, originalName);
    toast('جاري الحفظ...', 'info');
    const res = await fetch(`/api/documents/${id}/overwrite`, { method: 'PUT', body: fd, credentials: 'same-origin' });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'فشل الحفظ');
    toast('✅ تم حفظ الوثيقة بنجاح'); closeModal(); renderDocuments();
  } catch (e) { toast(e.message, 'error'); }
}

// ======= محرر Excel (XLSX) =======
async function docEditXlsx(doc) {
  if (typeof XLSX === 'undefined') {
    toast('⏳ جاري تحميل محرر Excel، حاول مرة أخرى بعد لحظة...', 'info');
    return;
  }

  showModal(`📊 تعديل Excel: ${doc.name_ar}`,
    `<div style="text-align:center;padding:48px"><div class="doc-spinner"></div><p style="margin-top:14px;color:var(--text-secondary)">جاري تحميل جدول البيانات...</p></div>`,
    '', 'modal-xl');

  try {
    const resp = await fetch(doc.file_path);
    if (!resp.ok) throw new Error('فشل تحميل الملف');
    const ab = await resp.arrayBuffer();
    const wb = XLSX.read(ab, { type: 'array' });
    window._xlsxWb = wb;
    window._xlsxActiveSheet = 0;

    const sheetTabs = wb.SheetNames.map((n, i) =>
      `<button class="doc-cat-btn${i===0?' active':''}" onclick="loadXlsxSheet(${i})">${n}</button>`
    ).join('');

    const tableHtml = buildXlsxTable(XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { header:1, defval:'' }));

    document.getElementById('modalBody').innerHTML = `
      <div class="doc-edit-notice">💡 انقر على أي خلية لتعديلها مباشرة</div>
      ${wb.SheetNames.length > 1 ? `<div class="doc-cat-tabs" style="margin-bottom:10px">${sheetTabs}</div>` : ''}
      <div style="overflow:auto;max-height:460px;border:1px solid var(--border);border-radius:6px">
        <table id="xlsxTable" class="xlsx-edit-table">${tableHtml}</table>
      </div>`;

    document.getElementById('modalFooter').innerHTML = `
      <button class="btn btn-ghost" onclick="closeModal()">إلغاء</button>
      <button class="btn btn-primary" onclick="saveDocXlsx(${doc.id},'${doc.original_name}')">💾 حفظ كـ Excel</button>`;
  } catch (e) {
    document.getElementById('modalBody').innerHTML =
      `<div class="empty-state"><div class="icon">⚠️</div><p>فشل تحميل الجدول: ${e.message}</p></div>`;
  }
}

function buildXlsxTable(data) {
  if (!data || !data.length) return '<tr><td colspan="10" style="padding:20px;text-align:center;color:var(--text-muted)">جدول فارغ</td></tr>';
  const cols = Math.max(...data.map(r => (r || []).length), 1);
  let html = '<thead><tr><th class="xlsx-idx">#</th>';
  for (let c = 0; c < cols; c++)
    html += `<th contenteditable="true" data-r="0" data-c="${c}" class="xlsx-head">${data[0]?.[c] ?? ''}</th>`;
  html += '</tr></thead><tbody>';
  for (let r = 1; r < data.length; r++) {
    html += `<tr><td class="xlsx-idx">${r}</td>`;
    for (let c = 0; c < cols; c++)
      html += `<td contenteditable="true" data-r="${r}" data-c="${c}" class="xlsx-cell">${data[r]?.[c] ?? ''}</td>`;
    html += '</tr>';
  }
  return html + '</tbody>';
}

function loadXlsxSheet(index) {
  const wb = window._xlsxWb;
  if (!wb) return;
  window._xlsxActiveSheet = index;
  document.querySelectorAll('#modalBody .doc-cat-btn').forEach((b, i) => b.classList.toggle('active', i === index));
  const ws = wb.Sheets[wb.SheetNames[index]];
  const data = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' });
  document.getElementById('xlsxTable').innerHTML = buildXlsxTable(data);
}

async function saveDocXlsx(id, originalName) {
  const table = document.getElementById('xlsxTable');
  if (!table) return toast('لم يتم تحميل الجدول', 'error');

  const wb = window._xlsxWb;
  const si = window._xlsxActiveSheet || 0;
  const rows = [];
  table.querySelectorAll('tr').forEach(tr => {
    const cells = [];
    tr.querySelectorAll('[contenteditable]').forEach(td => cells.push(td.textContent));
    if (cells.length) rows.push(cells);
  });

  const ws = XLSX.utils.aoa_to_sheet(rows);
  wb.Sheets[wb.SheetNames[si]] = ws;
  const u8 = XLSX.write(wb, { type: 'array', bookType: 'xlsx' });
  const blob = new Blob([u8], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });

  const fd = new FormData();
  fd.append('file', blob, originalName);
  try {
    toast('جاري الحفظ...', 'info');
    const res = await fetch(`/api/documents/${id}/overwrite`, { method: 'PUT', body: fd, credentials: 'same-origin' });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'فشل الحفظ');
    toast('✅ تم حفظ الجدول بنجاح'); closeModal(); renderDocuments();
  } catch (e) { toast(e.message, 'error'); }
}
