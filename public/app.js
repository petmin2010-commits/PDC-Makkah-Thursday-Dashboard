const state = {
  activeTab: 'operation',
  manuals: { operation: [], maintenance: [], other: [] },
  meta: null
};

const $ = (id) => document.getElementById(id);
const loginScreen = $('loginScreen');
const appShell = $('appShell');
const grid = $('documentGrid');
const emptyState = $('emptyState');

const labels = {
  operation: { ar: 'أدلة التشغيل', en: 'OPERATION MANUALS', type: 'دليل تشغيل' },
  maintenance: { ar: 'أدلة الصيانة', en: 'MAINTENANCE MANUALS', type: 'دليل صيانة' },
  other: { ar: 'ملفات أخرى', en: 'OTHER PROJECT FILES', type: 'ملف مشروع' }
};

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, ch => ({
    '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'
  })[ch]);
}

function humanDate(iso) {
  if (!iso) return '—';
  try {
    return new Intl.DateTimeFormat('ar-SA', { dateStyle:'medium', timeStyle:'short' }).format(new Date(iso));
  } catch { return iso; }
}
async function api(url, options = {}) {
  const res = await fetch(url, {
    headers: { 'Content-Type': 'application/json', ...(options.headers || {}) },
    credentials: 'same-origin',
    ...options
  });
  let body = {};
  try { body = await res.json(); } catch {}
  if (!res.ok) {
    const err = new Error(body.message || 'تعذر إتمام الطلب');
    err.status = res.status;
    throw err;
  }
  return body;
}

function setLoggedIn(on) {
  loginScreen.hidden = on;
  appShell.hidden = !on;
}

async function loadMeta() {
  try {
    const meta = await api('/api/meta');
    state.meta = meta;
    $('projectName').textContent = meta.projectName;
    $('loginProjectName').textContent = meta.projectName;
    $('contractNo').textContent = meta.contractNo;
  } catch {}
}

async function checkAuth() {
  const auth = await api('/api/auth/status');
  setLoggedIn(auth.authenticated);
  if (auth.authenticated) await loadManuals();
}
async function loadManuals(force = false) {
  $('sourceText').textContent = 'جاري قراءة المصدر...';
  $('refreshBtn').disabled = true;
  try {
    const data = await api('/api/manuals' + (force ? '?refresh=1' : ''));
    state.manuals.operation = data.operation || [];
    state.manuals.maintenance = data.maintenance || [];
    state.manuals.other = data.other || [];

    $('operationCount').textContent = state.manuals.operation.length;
    $('maintenanceCount').textContent = state.manuals.maintenance.length;
    $('otherCount').textContent = state.manuals.other.length;
    $('totalFiles').textContent = state.manuals.operation.length + state.manuals.maintenance.length + state.manuals.other.length;

    const sourceState = document.querySelector('.source-state');
    sourceState.classList.remove('live','fallback');
    sourceState.classList.add(data.source === 'live' ? 'live' : 'fallback');
    $('sourceText').textContent = data.source === 'live' ? 'متصل بالمصدر المباشر' : 'عرض النسخة الاحتياطية';
    $('lastUpdated').textContent = 'آخر تحديث: ' + humanDate(data.fetchedAt);
    render();
  } catch (err) {
    if (err.status === 401) return setLoggedIn(false);
    $('sourceText').textContent = 'تعذر تحميل الملفات';
    grid.innerHTML = '';
    emptyState.hidden = false;
  } finally {
    $('refreshBtn').disabled = false;
  }
}
function cardTitle(item, tab) {
  const lang = item.language === 'English' ? 'إنجليزي' : item.language;
  return `${labels[tab].type} — ${item.sector} — ${lang}`;
}

function render() {
  const tab = state.activeTab;
  const items = state.manuals[tab] || [];
  $('sectionTitle').textContent = labels[tab].ar;
  $('sectionEnglish').textContent = labels[tab].en;
  document.querySelectorAll('.tab').forEach(btn => btn.classList.toggle('active', btn.dataset.tab === tab));

  if (!items.length) {
    grid.innerHTML = '';
    emptyState.hidden = false;
    return;
  }
  emptyState.hidden = true;
  grid.innerHTML = items.map((item, index) => {
    const title = cardTitle(item, tab);
    const href = item.url ? escapeHtml(item.url) : '#';
    const linkClass = item.url ? 'open-link' : 'open-link disabled';
    return `
      <article class="doc-card">
        <button class="doc-info" type="button" data-info="${index}" aria-label="معلومات الملف">!</button>
        <div class="doc-type">${escapeHtml(labels[tab].type)} · ${escapeHtml(item.language || '')}</div>
        <h4>${escapeHtml(title)}</h4>
        <div class="doc-file" title="${escapeHtml(item.fileName)}">${escapeHtml(item.fileName)}</div>
        <a class="${linkClass}" href="${href}" target="_blank" rel="noopener noreferrer">
          <span>اضغط هنا لفتح الرابط</span><span>↗</span>
        </a>
      </article>`;
  }).join('');
}
function openInfo(index) {
  const item = (state.manuals[state.activeTab] || [])[Number(index)];
  if (!item) return;
  $('modalTitle').textContent = cardTitle(item, state.activeTab);
  const linkState = item.url ? 'الرابط متاح ومربوط بالملف.' : 'لا يوجد رابط محفوظ لهذا الملف حتى الآن.';
  $('modalText').textContent = `الملف: ${item.fileName} — القطاع: ${item.sector}. ${linkState} المصدر: ${item.column || 'الورقة2'}.`;
  $('infoModal').hidden = false;
}

$('loginForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const button = $('loginButton');
  const message = $('loginMessage');
  message.textContent = '';
  button.disabled = true;
  button.textContent = 'جاري التحقق...';
  try {
    await api('/api/auth/login', {
      method:'POST',
      body: JSON.stringify({ username: $('username').value.trim(), password: $('password').value })
    });
    $('password').value = '';
    setLoggedIn(true);
    await loadManuals();
  } catch (err) {
    message.textContent = err.message;
  } finally {
    button.disabled = false;
    button.textContent = 'تسجيل الدخول';
  }
});
$('togglePassword').addEventListener('click', () => {
  const input = $('password');
  input.type = input.type === 'password' ? 'text' : 'password';
});

$('logoutBtn').addEventListener('click', async () => {
  try { await api('/api/auth/logout', { method:'POST', body:'{}' }); } catch {}
  setLoggedIn(false);
});

$('refreshBtn').addEventListener('click', () => loadManuals(true));

document.querySelector('.tabs').addEventListener('click', (e) => {
  const btn = e.target.closest('.tab');
  if (!btn) return;
  state.activeTab = btn.dataset.tab;
  render();
});

grid.addEventListener('click', (e) => {
  const btn = e.target.closest('.doc-info');
  if (btn) openInfo(btn.dataset.info);
});

$('modalClose').addEventListener('click', () => $('infoModal').hidden = true);
$('infoModal').addEventListener('click', (e) => {
  if (e.target === $('infoModal')) $('infoModal').hidden = true;
});
document.addEventListener('keydown', e => {
  if (e.key === 'Escape') $('infoModal').hidden = true;
});

loadMeta().finally(() => checkAuth().catch(() => setLoggedIn(false)));
