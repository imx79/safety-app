// محرر القوالب البصري - تصميم النماذج لتناسب المنشأة
async function renderTemplates() {
  try {
    const templates = await api('/api/templates');
    content().innerHTML = `
      <div class="page-header">
        <h2 class="page-title">📝 قوالب التقارير</h2>
        ${hasPermission('templates.create') ? `<button class="btn btn-primary" onclick="builderOpen()">➕ قالب جديد</button>` : ''}
      </div>
      <div class="card">
        <p class="text-muted mb-3">يمكنك تصميم قوالب مخصصة بحقول متنوعة وإضافة شعار ورأس وذيل ليناسب نماذج منشأتك</p>
        <div class="table-wrapper">
          <table class="data-table">
            <thead><tr><th>الاسم</th><th>الفئة</th><th>الوصف</th><th>عدد الحقول</th><th>الاستخدام</th><th>المنشئ</th><th>إجراءات</th></tr></thead>
            <tbody>
              ${templates.map(t => `
                <tr>
                  <td><strong>${t.name_ar}</strong></td>
                  <td><span class="badge badge-info">${t.category}</span></td>
                  <td>${t.description || '-'}</td>
                  <td>${(t.fields || []).length}</td>
                  <td><span class="badge badge-secondary">${t.usage_count}</span></td>
                  <td>${t.creator_name || '-'}</td>
                  <td>
                    ${hasPermission('templates.edit') ? `<button class="btn btn-sm btn-info" onclick="builderOpen(${t.id})">🎨 تصميم</button>` : ''}
                    ${hasPermission('templates.delete') ? `<button class="btn btn-sm btn-danger" onclick="deleteTemplate(${t.id})">🗑️</button>` : ''}
                  </td>
                </tr>
              `).join('') || '<tr><td colspan="7" class="text-center text-muted">لا توجد قوالب</td></tr>'}
            </tbody>
          </table>
        </div>
      </div>
    `;
  } catch (e) {
    content().innerHTML = `<div class="empty-state"><div class="icon">⚠️</div><p>${e.message}</p></div>`;
  }
}

let builderTemplate = {
  name_ar: '', name_en: '', category: 'incidents', description: '',
  fields: [], header_html: '', footer_html: '',
  logo_path: '', template_file_path: '', template_file_type: '',
  page_settings: {
    border_style: 'none', border_color: '#1e3a5f', border_width: 2,
    border_sides: 'all', header_bg: '', header_color: '',
    show_logo: true, logo_position: 'center', logo_size: 80,
    margin_top: 40, margin_sides: 40
  }
};
let selectedFieldIdx = -1;

async function builderOpen(id = null) {
  if (id) {
    builderTemplate = await api('/api/templates/' + id);
    builderTemplate.id = id;
    // ضمان وجود page_settings كاملة
    builderTemplate.page_settings = Object.assign({
      border_style: 'none', border_color: '#1e3a5f', border_width: 2,
      border_sides: 'all', header_bg: '', header_color: '',
      show_logo: true, logo_position: 'center', logo_size: 80,
      margin_top: 40, margin_sides: 40
    }, builderTemplate.page_settings || {});
    builderTemplate.template_file_type = builderTemplate.template_file_type || '';
  } else {
    builderTemplate = {
      name_ar: '', name_en: '', category: 'incidents', description: '',
      fields: [], header_html: '', footer_html: '',
      logo_path: '', template_file_path: '', template_file_type: '',
      page_settings: {
        border_style: 'none', border_color: '#1e3a5f', border_width: 2,
        border_sides: 'all', header_bg: '', header_color: '',
        show_logo: true, logo_position: 'center', logo_size: 80,
        margin_top: 40, margin_sides: 40
      }
    };
  }
  selectedFieldIdx = -1;
  renderBuilder();
}

function renderBuilder() {
  const fieldTypes = [
    { type: 'text', label: 'نص قصير', icon: '📝' },
    { type: 'textarea', label: 'نص طويل', icon: '📄' },
    { type: 'number', label: 'رقم', icon: '🔢' },
    { type: 'date', label: 'تاريخ', icon: '📅' },
    { type: 'time', label: 'وقت', icon: '⏰' },
    { type: 'select', label: 'قائمة منسدلة', icon: '📋' },
    { type: 'email', label: 'بريد', icon: '📧' },
    { type: 'tel', label: 'هاتف', icon: '📞' }
  ];

  const ps = builderTemplate.page_settings;

  const html = `
    <div class="page-header">
      <h2 class="page-title">🎨 محرر القوالب</h2>
      <div class="flex gap-2">
        <button class="btn" onclick="navigate('templates')">↩️ رجوع</button>
        <button class="btn btn-success" onclick="saveTemplate()">💾 حفظ القالب</button>
      </div>
    </div>

    <div class="card mb-3">
      <div class="form-grid">
        <div class="form-group">
          <label>اسم القالب (عربي) <span class="required">*</span></label>
          <input id="tplName" value="${builderTemplate.name_ar || ''}" oninput="builderTemplate.name_ar = this.value">
        </div>
        <div class="form-group">
          <label>اسم القالب (إنجليزي)</label>
          <input id="tplNameEn" value="${builderTemplate.name_en || ''}" oninput="builderTemplate.name_en = this.value">
        </div>
        <div class="form-group">
          <label>الفئة <span class="required">*</span></label>
          <select onchange="builderTemplate.category = this.value">
            <option value="incidents" ${builderTemplate.category === 'incidents' ? 'selected' : ''}>الحوادث</option>
            <option value="inspections" ${builderTemplate.category === 'inspections' ? 'selected' : ''}>الجولات التفتيشية</option>
            <option value="training" ${builderTemplate.category === 'training' ? 'selected' : ''}>التدريب</option>
            <option value="equipment" ${builderTemplate.category === 'equipment' ? 'selected' : ''}>المعدات</option>
            <option value="general" ${builderTemplate.category === 'general' ? 'selected' : ''}>عام</option>
          </select>
        </div>
        <div class="form-group full">
          <label>الوصف</label>
          <textarea oninput="builderTemplate.description = this.value">${builderTemplate.description || ''}</textarea>
        </div>
      </div>

      <!-- ===== قسم الشعار ===== -->
      <details class="builder-section" open>
        <summary>🖼️ شعار المنشأة (صورة أو PDF)</summary>
        <div class="logo-upload-area">
          <div class="logo-preview-box" id="logoPreviewBox">
            ${builderTemplate.logo_path
              ? `<img src="${builderTemplate.logo_path}" class="logo-preview-img" alt="شعار">`
              : `<div class="logo-placeholder"><span>🏢</span><p>لا يوجد شعار</p></div>`}
          </div>
          <div class="logo-upload-controls">
            <label class="btn btn-info" style="cursor:pointer">
              📤 رفع صورة شعار
              <input type="file" accept="image/*" style="display:none" onchange="uploadLogo(this)">
            </label>
            ${builderTemplate.logo_path ? `<button class="btn btn-danger btn-sm" onclick="removeLogo()">🗑️ إزالة الشعار</button>` : ''}
            <small class="text-muted d-block mt-2">يدعم: PNG, JPG, SVG, GIF — الحد الأقصى 5 ميجا</small>
          </div>
        </div>
        <div class="form-grid mt-3">
          <div class="form-group">
            <label>موضع الشعار في التقرير</label>
            <select onchange="builderTemplate.page_settings.logo_position = this.value">
              <option value="center" ${ps.logo_position === 'center' ? 'selected' : ''}>منتصف</option>
              <option value="right" ${ps.logo_position === 'right' ? 'selected' : ''}>يمين</option>
              <option value="left" ${ps.logo_position === 'left' ? 'selected' : ''}>يسار</option>
            </select>
          </div>
          <div class="form-group">
            <label>حجم الشعار (بكسل)</label>
            <input type="number" min="30" max="300" value="${ps.logo_size || 80}"
              oninput="builderTemplate.page_settings.logo_size = +this.value">
          </div>
        </div>
      </details>

      <!-- ===== قسم ملف القالب الأساسي ===== -->
      <details class="builder-section">
        <summary>📄 ملف القالب الأساسي (PDF أو صورة)</summary>
        <p class="text-muted mb-3" style="font-size:13px">
          ارفع نموذج PDF أو صورة يمثل الشكل الرسمي للنموذج — سيظهر كخلفية خلف بيانات التقرير عند الطباعة.
        </p>
        <div class="template-file-area" id="templateFileArea">
          ${renderTemplateFilePreview()}
        </div>
        <label class="btn btn-warning mt-2" style="cursor:pointer">
          📎 رفع ملف القالب (PDF / صورة)
          <input type="file" accept=".pdf,.png,.jpg,.jpeg,.docx" style="display:none" onchange="uploadTemplateFile(this)">
        </label>
        ${builderTemplate.template_file_path ? `
          <button class="btn btn-danger btn-sm mt-2" onclick="removeTemplateFile()">🗑️ إزالة الملف</button>
        ` : ''}
        <small class="text-muted d-block mt-2">يدعم: PDF, PNG, JPG — الحد الأقصى 20 ميجا</small>
      </details>

      <!-- ===== قسم التحكم في الإطار ===== -->
      <details class="builder-section">
        <summary>🔲 إطار وتنسيق صفحة التقرير</summary>
        <div class="form-grid mt-3">
          <div class="form-group">
            <label>نوع الإطار</label>
            <select onchange="builderTemplate.page_settings.border_style = this.value; updateBorderPreview()">
              <option value="none" ${ps.border_style === 'none' ? 'selected' : ''}>بدون إطار</option>
              <option value="solid" ${ps.border_style === 'solid' ? 'selected' : ''}>خط ثابت</option>
              <option value="dashed" ${ps.border_style === 'dashed' ? 'selected' : ''}>خط متقطع</option>
              <option value="dotted" ${ps.border_style === 'dotted' ? 'selected' : ''}>نقاط</option>
              <option value="double" ${ps.border_style === 'double' ? 'selected' : ''}>خط مزدوج</option>
            </select>
          </div>
          <div class="form-group">
            <label>لون الإطار</label>
            <div class="color-input-wrap">
              <input type="color" value="${ps.border_color || '#1e3a5f'}"
                oninput="builderTemplate.page_settings.border_color = this.value; updateBorderPreview()">
              <span id="borderColorHex">${ps.border_color || '#1e3a5f'}</span>
            </div>
          </div>
          <div class="form-group">
            <label>سُمك الإطار (بكسل)</label>
            <input type="range" min="1" max="10" value="${ps.border_width || 2}"
              oninput="builderTemplate.page_settings.border_width = +this.value; document.getElementById('borderWidthVal').textContent = this.value + 'px'; updateBorderPreview()">
            <span id="borderWidthVal">${ps.border_width || 2}px</span>
          </div>
          <div class="form-group">
            <label>جوانب الإطار</label>
            <select onchange="builderTemplate.page_settings.border_sides = this.value; updateBorderPreview()">
              <option value="all" ${ps.border_sides === 'all' ? 'selected' : ''}>جميع الجوانب</option>
              <option value="tb" ${ps.border_sides === 'tb' ? 'selected' : ''}>أعلى وأسفل فقط</option>
              <option value="lr" ${ps.border_sides === 'lr' ? 'selected' : ''}>يمين ويسار فقط</option>
              <option value="top" ${ps.border_sides === 'top' ? 'selected' : ''}>أعلى فقط</option>
              <option value="bottom" ${ps.border_sides === 'bottom' ? 'selected' : ''}>أسفل فقط</option>
            </select>
          </div>
          <div class="form-group">
            <label>لون خلفية الرأس</label>
            <div class="color-input-wrap">
              <input type="color" value="${ps.header_bg || '#1e3a5f'}"
                oninput="builderTemplate.page_settings.header_bg = this.value">
              <span>خلفية</span>
            </div>
          </div>
          <div class="form-group">
            <label>لون نص الرأس</label>
            <div class="color-input-wrap">
              <input type="color" value="${ps.header_color || '#ffffff'}"
                oninput="builderTemplate.page_settings.header_color = this.value">
              <span>النص</span>
            </div>
          </div>
          <div class="form-group">
            <label>الهامش العلوي والسفلي (بكسل)</label>
            <input type="number" min="10" max="100" value="${ps.margin_top || 40}"
              oninput="builderTemplate.page_settings.margin_top = +this.value">
          </div>
          <div class="form-group">
            <label>الهامش الجانبي (بكسل)</label>
            <input type="number" min="10" max="100" value="${ps.margin_sides || 40}"
              oninput="builderTemplate.page_settings.margin_sides = +this.value">
          </div>
        </div>
        <!-- معاينة الإطار -->
        <div class="border-preview-wrap">
          <p class="text-muted mb-2" style="font-size:12px">معاينة الإطار:</p>
          <div id="borderPreview" class="border-preview" style="${buildBorderStyle(ps)}">
            <div style="text-align:center; color:#999; font-size:13px">معاينة شكل الإطار</div>
          </div>
        </div>
      </details>

      <!-- ===== قسم الرأس والذيل ===== -->
      <details class="builder-section" open>
        <summary>🎯 تخصيص الرأس والذيل</summary>
        <div class="rte-sections mt-3">
          <div class="form-group full">
            <label class="form-label-bold">📋 رأس التقرير</label>
            ${renderRichEditor('headerEditor', 'header_html', builderTemplate.header_html)}
          </div>
          <div class="form-group full mt-3">
            <label class="form-label-bold">📋 ذيل التقرير</label>
            ${renderRichEditor('footerEditor', 'footer_html', builderTemplate.footer_html)}
          </div>
        </div>
      </details>
    </div>

    <div class="builder-grid">
      <div class="builder-panel">
        <h4 style="margin-bottom: 12px; color: var(--primary)">⚡ أنواع الحقول</h4>
        <div class="field-types">
          ${fieldTypes.map(f => `
            <div class="field-type-item" onclick="addField('${f.type}')">${f.icon} ${f.label}</div>
          `).join('')}
        </div>
        <hr class="mt-3 mb-3">
        <small class="text-muted">انقر على أي حقل لإضافته. يمكنك سحب الحقول لإعادة ترتيبها.</small>
      </div>

      <div class="builder-panel">
        <h4 style="margin-bottom: 12px; color: var(--primary)">📋 الحقول (${builderTemplate.fields.length})</h4>
        <div class="canvas-area" id="canvasArea">
          ${builderTemplate.fields.length === 0 ? '<div class="empty-state"><div class="icon">📭</div><p>لا توجد حقول. اضغط على نوع حقل من اليمين لإضافته</p></div>' :
            builderTemplate.fields.map((f, i) => `
              <div class="canvas-field ${selectedFieldIdx === i ? 'selected' : ''}" onclick="selectField(${i})">
                <div class="field-actions" onclick="event.stopPropagation()">
                  ${i > 0 ? `<button class="btn btn-sm btn-ghost" onclick="moveField(${i}, -1)">⬆️</button>` : ''}
                  ${i < builderTemplate.fields.length - 1 ? `<button class="btn btn-sm btn-ghost" onclick="moveField(${i}, 1)">⬇️</button>` : ''}
                  <button class="btn btn-sm btn-danger" onclick="removeField(${i})">×</button>
                </div>
                <div class="field-label">${f.label_ar || '(بدون عنوان)'} ${f.required ? '<span class="required">*</span>' : ''}</div>
                <div class="field-meta">النوع: ${f.type} | المعرف: ${f.id} ${f.options ? '| الخيارات: ' + f.options.length : ''}</div>
              </div>
            `).join('')
          }
        </div>
      </div>

      <div class="builder-panel">
        <h4 style="margin-bottom: 12px; color: var(--primary)">⚙️ خصائص الحقل</h4>
        <div id="fieldEditor">
          ${selectedFieldIdx === -1 ? '<p class="text-muted">اختر حقلاً للتعديل</p>' : renderFieldEditor()}
        </div>
      </div>
    </div>
  `;

  content().innerHTML = html;
}

// ===== محرر النص الغني (Rich Text Editor) =====
function renderRichEditor(editorId, fieldName, initialHTML) {
  return `
    <div class="rte-wrap">
      <div class="rte-toolbar">
        <button type="button" class="rte-btn" title="عريض" onclick="rte('${editorId}','bold')"><b>B</b></button>
        <button type="button" class="rte-btn" title="مائل" onclick="rte('${editorId}','italic')"><i>I</i></button>
        <button type="button" class="rte-btn" title="تحته خط" onclick="rte('${editorId}','underline')"><u>U</u></button>
        <span class="rte-sep"></span>
        <button type="button" class="rte-btn" title="محاذاة يمين" onclick="rte('${editorId}','justifyRight')">&#8677;</button>
        <button type="button" class="rte-btn" title="توسيط" onclick="rte('${editorId}','justifyCenter')">&#8801;</button>
        <button type="button" class="rte-btn" title="محاذاة يسار" onclick="rte('${editorId}','justifyLeft')">&#8676;</button>
        <span class="rte-sep"></span>
        <select class="rte-select" title="حجم الخط" onchange="rte('${editorId}','fontSize',this.value); this.selectedIndex=0">
          <option value="" disabled selected>حجم</option>
          <option value="1">8pt</option>
          <option value="2">10pt</option>
          <option value="3">12pt — عادي</option>
          <option value="4">14pt</option>
          <option value="5">18pt</option>
          <option value="6">24pt</option>
          <option value="7">36pt</option>
        </select>
        <select class="rte-select" title="نوع الخط" onchange="rte('${editorId}','fontName',this.value); this.selectedIndex=0">
          <option value="" disabled selected>خط</option>
          <option value="Cairo, Arial">Cairo</option>
          <option value="Arial">Arial</option>
          <option value="Times New Roman">Times New Roman</option>
          <option value="Tahoma">Tahoma</option>
          <option value="Courier New">Courier New</option>
        </select>
        <span class="rte-sep"></span>
        <label class="rte-color-btn" title="لون النص">
          <span>A</span>
          <input type="color" value="#000000" oninput="rte('${editorId}','foreColor',this.value)">
        </label>
        <label class="rte-color-btn" title="لون الخلفية" style="background:#fff3;">
          <span style="background:linear-gradient(to bottom,transparent 60%,#ff0 60%)">A</span>
          <input type="color" value="#ffff00" oninput="rte('${editorId}','hiliteColor',this.value)">
        </label>
        <span class="rte-sep"></span>
        <label class="rte-btn rte-upload-btn" title="إدراج صورة">
          🖼️
          <input type="file" accept="image/*" style="display:none"
            onchange="rteInsertFile('${editorId}','${fieldName}',this,'image')">
        </label>
        <label class="rte-btn rte-upload-btn" title="إدراج PDF">
          📄
          <input type="file" accept="application/pdf" style="display:none"
            onchange="rteInsertFile('${editorId}','${fieldName}',this,'pdf')">
        </label>
        <span class="rte-sep"></span>
        <button type="button" class="rte-btn" title="فاصل أفقي" onclick="rte('${editorId}','insertHorizontalRule')">—</button>
        <button type="button" class="rte-btn" title="مسح التنسيق" onclick="rte('${editorId}','removeFormat')" style="font-size:11px">مسح تنسيق</button>
        <button type="button" class="rte-btn rte-btn-danger" title="حذف المحتوى" onclick="rteClear('${editorId}','${fieldName}')">🗑️</button>
      </div>
      <div class="rte-content"
           id="${editorId}"
           contenteditable="true"
           dir="rtl"
           oninput="syncRte('${editorId}','${fieldName}')"
           onfocus="rteActive='${editorId}'"
           data-placeholder="اكتب هنا أو أدرج صورة / PDF..."
           >${initialHTML || ''}</div>
    </div>
  `;
}

let rteActive = null;

function rte(editorId, cmd, val) {
  const el = document.getElementById(editorId);
  if (!el) return;
  el.focus();
  document.execCommand(cmd, false, val !== undefined ? val : null);
  syncRte(editorId, editorId === 'headerEditor' ? 'header_html' : 'footer_html');
}

function syncRte(editorId, fieldName) {
  const el = document.getElementById(editorId);
  if (el) builderTemplate[fieldName] = el.innerHTML;
}

function rteClear(editorId, fieldName) {
  if (!confirm('هل تريد حذف محتوى هذا القسم؟')) return;
  const el = document.getElementById(editorId);
  if (el) el.innerHTML = '';
  builderTemplate[fieldName] = '';
}

async function rteInsertFile(editorId, fieldName, input, type) {
  const file = input.files[0];
  if (!file) return;
  const fd = new FormData();
  const endpoint = type === 'pdf' ? '/api/templates/upload-template-file' : '/api/templates/upload-logo';
  fd.append(type === 'pdf' ? 'template_file' : 'logo', file);
  try {
    toast('جاري الرفع...', 'info');
    const res = await fetch(endpoint, { method: 'POST', body: fd, credentials: 'same-origin' });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'فشل الرفع');

    const el = document.getElementById(editorId);
    if (!el) return;
    el.focus();

    if (type === 'pdf') {
      const html = `<div style="display:inline-flex;align-items:center;gap:8px;padding:8px 14px;background:#fee2e2;border:1px solid #fca5a5;border-radius:6px;margin:4px 0;">
        <span style="font-size:20px">📄</span>
        <a href="${data.path}" target="_blank" style="color:#dc2626;font-weight:600;text-decoration:none;">${file.name}</a>
      </div><br>`;
      document.execCommand('insertHTML', false, html);
    } else {
      const html = `<img src="${data.path}" style="max-width:100%;max-height:150px;object-fit:contain;display:block;margin:4px 0;" alt="صورة"><br>`;
      document.execCommand('insertHTML', false, html);
    }

    syncRte(editorId, fieldName);
    input.value = '';
    toast('تم الإدراج بنجاح');
  } catch (e) {
    toast(e.message, 'error');
  }
}

function renderTemplateFilePreview() {
  if (!builderTemplate.template_file_path) {
    return `<div class="template-file-placeholder"><span>📄</span><p>لم يتم رفع ملف قالب بعد</p></div>`;
  }
  const fp = builderTemplate.template_file_path;
  const ft = builderTemplate.template_file_type || (fp.endsWith('.pdf') ? 'pdf' : 'image');
  if (ft === 'pdf') {
    return `
      <div class="template-file-info">
        <span class="file-type-badge pdf">PDF</span>
        <span>${fp.split('/').pop()}</span>
        <a href="${fp}" target="_blank" class="btn btn-sm btn-info">👁️ عرض</a>
      </div>`;
  }
  return `
    <div class="template-file-info">
      <img src="${fp}" style="max-height:100px; max-width:200px; object-fit:contain; border:1px solid var(--border); border-radius:4px;">
      <span>${fp.split('/').pop()}</span>
    </div>`;
}

function buildBorderStyle(ps) {
  if (!ps || ps.border_style === 'none') return '';
  const bw = (ps.border_width || 2) + 'px';
  const bc = ps.border_color || '#1e3a5f';
  const bs = ps.border_style || 'solid';
  const border = `${bw} ${bs} ${bc}`;
  if (ps.border_sides === 'all') return `border: ${border};`;
  if (ps.border_sides === 'tb') return `border-top: ${border}; border-bottom: ${border};`;
  if (ps.border_sides === 'lr') return `border-left: ${border}; border-right: ${border};`;
  if (ps.border_sides === 'top') return `border-top: ${border};`;
  if (ps.border_sides === 'bottom') return `border-bottom: ${border};`;
  return `border: ${border};`;
}

function updateBorderPreview() {
  const preview = document.getElementById('borderPreview');
  if (preview) preview.style.cssText = buildBorderStyle(builderTemplate.page_settings) + ' padding:20px; border-radius:4px; min-height:60px;';
  const hex = document.getElementById('borderColorHex');
  if (hex) hex.textContent = builderTemplate.page_settings.border_color;
}

// رفع الشعار
async function uploadLogo(input) {
  const file = input.files[0];
  if (!file) return;
  const fd = new FormData();
  fd.append('logo', file);
  try {
    toast('جاري الرفع...', 'info');
    const res = await fetch('/api/templates/upload-logo', {
      method: 'POST', body: fd,
      credentials: 'same-origin'
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'فشل الرفع');
    builderTemplate.logo_path = data.path;
    toast('تم رفع الشعار بنجاح');
    // تحديث المعاينة
    const box = document.getElementById('logoPreviewBox');
    if (box) box.innerHTML = `<img src="${data.path}" class="logo-preview-img" alt="شعار">`;
  } catch (e) { toast(e.message, 'error'); }
}

function removeLogo() {
  builderTemplate.logo_path = '';
  const box = document.getElementById('logoPreviewBox');
  if (box) box.innerHTML = `<div class="logo-placeholder"><span>🏢</span><p>لا يوجد شعار</p></div>`;
  toast('تم إزالة الشعار');
}

// رفع ملف القالب الأساسي
async function uploadTemplateFile(input) {
  const file = input.files[0];
  if (!file) return;
  const fd = new FormData();
  fd.append('template_file', file);
  try {
    toast('جاري رفع الملف...', 'info');
    const res = await fetch('/api/templates/upload-template-file', {
      method: 'POST', body: fd,
      credentials: 'same-origin'
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'فشل الرفع');
    builderTemplate.template_file_path = data.path;
    builderTemplate.template_file_type = data.type;
    toast('تم رفع الملف بنجاح');
    const area = document.getElementById('templateFileArea');
    if (area) area.innerHTML = renderTemplateFilePreview();
  } catch (e) { toast(e.message, 'error'); }
}

function removeTemplateFile() {
  builderTemplate.template_file_path = '';
  builderTemplate.template_file_type = '';
  const area = document.getElementById('templateFileArea');
  if (area) area.innerHTML = renderTemplateFilePreview();
  toast('تم إزالة ملف القالب');
}

function renderFieldEditor() {
  if (selectedFieldIdx === -1) return '';
  const f = builderTemplate.fields[selectedFieldIdx];
  return `
    <div class="form-group">
      <label>معرف الحقل (إنجليزي، فريد)</label>
      <input value="${f.id}" oninput="updateField('id', this.value)">
    </div>
    <div class="form-group">
      <label>عنوان الحقل (عربي)</label>
      <input value="${f.label_ar || ''}" oninput="updateField('label_ar', this.value)">
    </div>
    <div class="form-group">
      <label>عنوان الحقل (إنجليزي)</label>
      <input value="${f.label_en || ''}" oninput="updateField('label_en', this.value)">
    </div>
    <div class="form-group">
      <label>نوع الحقل</label>
      <select onchange="updateField('type', this.value); renderBuilder()">
        <option value="text" ${f.type==='text'?'selected':''}>نص</option>
        <option value="textarea" ${f.type==='textarea'?'selected':''}>نص طويل</option>
        <option value="number" ${f.type==='number'?'selected':''}>رقم</option>
        <option value="date" ${f.type==='date'?'selected':''}>تاريخ</option>
        <option value="time" ${f.type==='time'?'selected':''}>وقت</option>
        <option value="select" ${f.type==='select'?'selected':''}>قائمة منسدلة</option>
        <option value="email" ${f.type==='email'?'selected':''}>بريد</option>
        <option value="tel" ${f.type==='tel'?'selected':''}>هاتف</option>
      </select>
    </div>
    <div class="form-group">
      <label><input type="checkbox" ${f.required?'checked':''} onchange="updateField('required', this.checked)"> حقل إلزامي</label>
    </div>
    ${f.type === 'select' ? `
      <div class="form-group">
        <label>الخيارات (واحد في كل سطر)</label>
        <textarea oninput="updateField('options', this.value.split('\\n').filter(x => x.trim()))">${(f.options || []).join('\n')}</textarea>
      </div>
    ` : ''}
    <div class="form-group">
      <label>قيمة افتراضية</label>
      <input value="${f.default || ''}" oninput="updateField('default', this.value)">
    </div>
    <div class="form-group">
      <label>نص المساعدة</label>
      <input value="${f.help || ''}" oninput="updateField('help', this.value)">
    </div>
  `;
}

function addField(type) {
  const id = type + '_' + Date.now().toString(36);
  builderTemplate.fields.push({
    id,
    label_ar: 'حقل جديد',
    type,
    required: false,
    options: type === 'select' ? ['خيار 1', 'خيار 2'] : undefined
  });
  selectedFieldIdx = builderTemplate.fields.length - 1;
  renderBuilder();
}

function selectField(i) {
  // مزامنة محرر النصوص قبل أي تحديث
  ['headerEditor', 'footerEditor'].forEach(id => {
    const el = document.getElementById(id);
    if (el) builderTemplate[id === 'headerEditor' ? 'header_html' : 'footer_html'] = el.innerHTML;
  });

  selectedFieldIdx = i;

  // تحديث تمييز الحقل المختار في اللوحة الوسطى
  document.querySelectorAll('.canvas-field').forEach((el, idx) => {
    el.classList.toggle('selected', idx === i);
  });

  // تحديث لوحة الخصائص فقط (اليمين) دون إعادة رسم كامل
  const editor = document.getElementById('fieldEditor');
  if (editor) {
    editor.innerHTML = renderFieldEditor();
  }
}

function updateField(key, value) {
  builderTemplate.fields[selectedFieldIdx][key] = value;
  const canvas = document.getElementById('canvasArea');
  if (canvas) {
    canvas.querySelectorAll('.canvas-field')[selectedFieldIdx].querySelector('.field-label').innerHTML =
      (builderTemplate.fields[selectedFieldIdx].label_ar || '(بدون عنوان)') +
      (builderTemplate.fields[selectedFieldIdx].required ? ' <span class="required">*</span>' : '');
  }
}

function removeField(i) {
  if (!confirm('حذف هذا الحقل؟')) return;
  builderTemplate.fields.splice(i, 1);
  if (selectedFieldIdx === i) selectedFieldIdx = -1;
  else if (selectedFieldIdx > i) selectedFieldIdx--;
  renderBuilder();
}

function moveField(i, dir) {
  const j = i + dir;
  if (j < 0 || j >= builderTemplate.fields.length) return;
  const tmp = builderTemplate.fields[i];
  builderTemplate.fields[i] = builderTemplate.fields[j];
  builderTemplate.fields[j] = tmp;
  if (selectedFieldIdx === i) selectedFieldIdx = j;
  else if (selectedFieldIdx === j) selectedFieldIdx = i;
  renderBuilder();
}

async function saveTemplate() {
  if (!builderTemplate.name_ar) return toast('اسم القالب مطلوب', 'error');
  if (builderTemplate.fields.length === 0) return toast('يجب إضافة حقل واحد على الأقل', 'error');

  const payload = {
    name_ar: builderTemplate.name_ar,
    name_en: builderTemplate.name_en,
    category: builderTemplate.category,
    description: builderTemplate.description,
    fields: builderTemplate.fields,
    header_html: builderTemplate.header_html,
    footer_html: builderTemplate.footer_html,
    logo_path: builderTemplate.logo_path || null,
    page_settings: builderTemplate.page_settings,
    template_file_path: builderTemplate.template_file_path || null
  };

  try {
    if (builderTemplate.id) {
      await api('/api/templates/' + builderTemplate.id, { method: 'PUT', body: payload });
    } else {
      await api('/api/templates', { method: 'POST', body: payload });
    }
    toast('تم حفظ القالب');
    navigate('templates');
  } catch (e) { toast(e.message, 'error'); }
}

async function deleteTemplate(id) {
  if (!confirm('هل أنت متأكد من حذف هذا القالب؟')) return;
  try {
    await api('/api/templates/' + id, { method: 'DELETE' });
    toast('تم الحذف');
    renderTemplates();
  } catch (e) { toast(e.message, 'error'); }
}
