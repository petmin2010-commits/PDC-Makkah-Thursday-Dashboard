const express = require('express');
const session = require('express-session');
const ExcelJS = require('exceljs');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = Number(process.env.PORT || 3000);
const PROD = process.env.NODE_ENV === 'production' || String(process.env.RENDER || '').toLowerCase() === 'true';
const SPREADSHEET_ID = process.env.SOURCE_SPREADSHEET_ID || '1LsWHMcYvzfURbgU9wZBR8uXY0mjoK1PYxqwWw_50KKM';
const SHEET_NAME = process.env.SOURCE_SHEET_NAME || 'الورقة2';
const USERS_SHEET = process.env.USERS_SHEET_NAME || 'dp users';
const CACHE_MS = Number(process.env.CACHE_SECONDS || 180) * 1000;
const PROJECT_NAME = 'إعداد أدلة إجراءات وسياسات التشغيل والصيانة لفرع المؤسسة العامة للري بالأحساء';
const CONTRACT_NO = '250301052116';

const loginAttempts = new Map();
let manualsCache = { at: 0, data: null };
let usersCache = [];
let refreshPromise = null;

app.disable('x-powered-by');
if (PROD) app.set('trust proxy', 1);
app.use(express.json({ limit: '64kb' }));
const SESSION_SECRET = process.env.SESSION_SECRET || crypto.randomBytes(48).toString('hex');

app.use(session({
  name: 'sio.sid',
  secret: SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
  cookie: { httpOnly: true, sameSite: 'lax', secure: 'auto', maxAge: 8 * 60 * 60 * 1000 }
}));
app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
  if (req.path.startsWith('/api/')) res.setHeader('Cache-Control', 'no-store');
  next();
});

function sha256(value) {
  return crypto.createHash('sha256').update(String(value)).digest('hex');
}

function expectedCredentials() {
  return {
    username: process.env.DASHBOARD_USERNAME || 'admin',
    passwordHash: process.env.DASHBOARD_PASSWORD_HASH || sha256(PROD ? 'SIO@Ahsa#2026!Manuals' : 'SIO-Local-2026!')
  };
}

function extractUrl(cell) {
  if (!cell) return '';
  if (cell.hyperlink) return String(cell.hyperlink);
  const value = cell.value;
  if (value && typeof value === 'object' && value.hyperlink) return String(value.hyperlink);
  if (typeof value === 'string' && /^https?:\/\//i.test(value.trim())) return value.trim();
  if (cell.formula) {
    const m = String(cell.formula).match(/HYPERLINK\(\s*"([^"]+)"/i);
    if (m) return m[1];
  }
  return '';
}

function languageFrom(header, col) {
  const h = String(header || '');
  if (/عرب/i.test(h)) return 'عربي';
  if (/انج|english/i.test(h)) return 'English';
  return col % 2 ? 'عربي' : 'English';
}

function fileNameFromCell(cell) {
  if (!cell) return '';
  const value = cell.value;
  if (value && typeof value === 'object' && typeof value.text === 'string') return value.text.trim();
  const text = String(cell.text || '').trim();
  return text === '[object Object]' ? '' : text;
}

function manualCategoryFromHeader(header) {
  const h = String(header || '').toLowerCase();
  if (/تشغيل|operation/.test(h)) return 'operation';
  if (/صيان|maintenance/.test(h)) return 'maintenance';
  return '';
}

async function fetchLiveWorkbook() {
  const exportUrl = `https://docs.google.com/spreadsheets/d/${SPREADSHEET_ID}/export?format=xlsx`;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 120000);

  try {
    const response = await fetch(exportUrl, {
      redirect: 'follow',
      cache: 'no-store',
      signal: controller.signal,
      headers: { 'User-Agent': 'SIO-Manuals-Dashboard/1.0' }
    });

    if (!response.ok) throw new Error(`Google Sheets export failed: ${response.status}`);

    const buffer = Buffer.from(await response.arrayBuffer());
    const book = new ExcelJS.Workbook();
    await book.xlsx.load(buffer);
    return book;
  } finally {
    clearTimeout(timer);
  }
}

function parseManualsFromWorkbook(book) {
  const sheet = book.getWorksheet(SHEET_NAME);
  if (!sheet) throw new Error(`Sheet not found: ${SHEET_NAME}`);

  const headers = [];
  for (let c = 1; c <= sheet.columnCount; c++) {
    headers[c] = String(sheet.getCell(1, c).text || '').trim();
  }

  const result = {
    operation: [],
    maintenance: [],
    source: 'live',
    fetchedAt: new Date().toISOString()
  };

  const seen = {
    operation: new Set(),
    maintenance: new Set()
  };

  let lastSector = '';

  for (let r = 2; r <= sheet.rowCount; r++) {
    const rowSector = String(sheet.getCell(r, 1).text || '').trim();
    if (rowSector) lastSector = rowSector;

    for (let c = 2; c <= sheet.columnCount; c++) {
      const category = manualCategoryFromHeader(headers[c]);
      if (!category) continue;

      const cell = sheet.getCell(r, c);
      const url = extractUrl(cell);
      if (!url || seen[category].has(url)) continue;

      const fileName = fileNameFromCell(cell);
      if (!fileName) continue;

      seen[category].add(url);

      const zeroCol = c - 1;
      result[category].push({
        sector: rowSector || lastSector || 'غير مصنف',
        language: languageFrom(headers[c], zeroCol),
        fileName,
        url,
        column: headers[c] || `عمود ${c}`,
        cell: cell.address
      });
    }
  }

  return result;
}

function parseUsersFromWorkbook(book) {
  const sheet = book.getWorksheet(USERS_SHEET);
  if (!sheet) return [];

  const users = [];
  for (let r = 2; r <= sheet.rowCount; r++) {
    const name = String(sheet.getCell(r, 1).text || '').trim();
    const role = String(sheet.getCell(r, 2).text || '').trim();
    const email = String(sheet.getCell(r, 3).text || '').trim().toLowerCase();
    const password = String(sheet.getCell(r, 4).text || '').trim();
    const active = String(sheet.getCell(r, 5).text || '').trim().toLowerCase();

    if (email) users.push({ name, role, email, password, active });
  }

  return users;
}

async function refreshAllData() {
  if (refreshPromise) return refreshPromise;

  refreshPromise = (async () => {
    const book = await fetchLiveWorkbook();
    const manuals = parseManualsFromWorkbook(book);
    const users = parseUsersFromWorkbook(book);

    manualsCache = { at: Date.now(), data: manuals };
    usersCache = users;

    console.log(
      `Live sheet cache refreshed: operation=${manuals.operation.length}, maintenance=${manuals.maintenance.length}, users=${users.length}`
    );

    return { manuals, users };
  })();

  try {
    return await refreshPromise;
  } finally {
    refreshPromise = null;
  }
}
function readFallback() {
  const fp = path.join(__dirname, 'fallback-manuals.json');
  const data = JSON.parse(fs.readFileSync(fp, 'utf8'));
  return { ...data, source: 'fallback', fetchedAt: new Date().toISOString() };
}

async function getManuals(force = false) {
  if (!manualsCache.data) {
    manualsCache = { at: Date.now(), data: readFallback() };
  }

  const stale = Date.now() - manualsCache.at >= CACHE_MS;

  if ((force || stale) && !refreshPromise) {
    refreshAllData().catch(error => {
      console.error('Background manuals refresh failed:', error.message);
    });
  }

  return {
    ...manualsCache.data,
    refreshing: !!refreshPromise
  };
}

function parseCsv_(text) {
  const rows = [];
  let row = [];
  let cell = '';
  let quoted = false;

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];

    if (quoted) {
      if (ch === '"' && text[i + 1] === '"') {
        cell += '"';
        i++;
      } else if (ch === '"') {
        quoted = false;
      } else {
        cell += ch;
      }
      continue;
    }

    if (ch === '"') {
      quoted = true;
    } else if (ch === ',') {
      row.push(cell);
      cell = '';
    } else if (ch === '\n') {
      row.push(cell.replace(/\r$/, ''));
      rows.push(row);
      row = [];
      cell = '';
    } else {
      cell += ch;
    }
  }

  if (cell.length || row.length) {
    row.push(cell.replace(/\r$/, ''));
    rows.push(row);
  }

  return rows;
}

async function readDashboardUsers_() {
  const url =
    `https://docs.google.com/spreadsheets/d/${SPREADSHEET_ID}/gviz/tq?` +
    `tqx=out:csv&sheet=${encodeURIComponent(USERS_SHEET)}&range=A1:E200`;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 15000);

  try {
    const response = await fetch(url, {
      redirect: 'follow',
      cache: 'no-store',
      signal: controller.signal,
      headers: { 'User-Agent': 'SIO-Manuals-Dashboard/1.0' }
    });

    if (!response.ok) {
      throw new Error(`Users sheet CSV failed: ${response.status}`);
    }

    const rows = parseCsv_(await response.text());

    return rows
      .slice(1)
      .map(r => ({
        name: String(r[0] || '').trim(),
        role: String(r[1] || '').trim(),
        email: String(r[2] || '').trim().toLowerCase(),
        password: String(r[3] || '').trim(),
        active: String(r[4] || '').trim().toLowerCase()
      }))
      .filter(u => u.email);
  } finally {
    clearTimeout(timer);
  }
}

function publicUser_(user) {
  return { name:user.name || '', role:user.role || '', email:user.email || '' };
}

function requireAuth(req, res, next) {
  if (req.session && req.session.authenticated) return next();
  return res.status(401).json({ ok: false, message: 'يلزم تسجيل الدخول' });
}

app.get('/api/meta', (req, res) => res.json({ projectName: PROJECT_NAME, contractNo: CONTRACT_NO, organization: 'المؤسسة العامة للري', location: 'الأحساء' }));
app.get('/api/auth/status', (req, res) => res.json({ authenticated: !!req.session?.authenticated, user: req.session?.user || null }));

app.post('/api/auth/login', async (req, res) => {
  const { username = '', password = '' } = req.body || {};
  const identifier = String(username).trim().toLowerCase();
  const key = `${req.ip}|${identifier}`;
  const now = Date.now();
  const attempt = loginAttempts.get(key) || { count: 0, first: now, blockedUntil: 0 };

  if (attempt.blockedUntil > now) {
    return res.status(429).json({ ok:false, message:'محاولات كثيرة. حاول مرة أخرى بعد قليل.' });
  }
  if (now - attempt.first > 15 * 60 * 1000) {
    attempt.count = 0;
    attempt.first = now;
  }

  try {
    const users = await readDashboardUsers_();
    const user = users.find(u => u.email === identifier);
    const active = !!user && user.active === 'active';
    const passwordOK = !!user && active && String(user.password || '').trim() === String(password);

    let authenticatedUser = null;

    if (passwordOK) {
      authenticatedUser = publicUser_(user);
    } else if (!user) {
      const fallback = expectedCredentials();
      if (identifier === fallback.username.trim().toLowerCase() && sha256(password) === fallback.passwordHash) {
        authenticatedUser = { name:'مدير النظام', role:'Administrator', email:fallback.username };
      }
    }

    if (!authenticatedUser) {
      attempt.count += 1;
      if (attempt.count >= 6) attempt.blockedUntil = now + 10 * 60 * 1000;
      loginAttempts.set(key, attempt);
      return res.status(401).json({ ok:false, message:'بيانات الدخول غير صحيحة أو الحساب غير نشط.' });
    }

    loginAttempts.delete(key);
    req.session.regenerate(err => {
      if (err) return res.status(500).json({ ok:false, message:'تعذر إنشاء جلسة الدخول.' });
      req.session.authenticated = true;
      req.session.user = authenticatedUser;
      req.session.save(saveErr => {
        if (saveErr) return res.status(500).json({ ok:false, message:'تعذر حفظ جلسة الدخول.' });
        res.json({ ok:true, user:authenticatedUser });
      });
    });
  } catch (error) {
    console.error('Login users-sheet error:', error.message);
    return res.status(503).json({ ok:false, message:'تعذر قراءة ورقة المستخدمين حاليًا.' });
  }
});

app.post('/api/auth/logout', (req, res) => {
  req.session.destroy(() => res.json({ ok: true }));
});

app.get('/api/manuals', requireAuth, async (req, res) => {
  const data = await getManuals(req.query.refresh === '1');
  res.json({ ok: true, ...data });
});

app.use(express.static(path.join(__dirname, 'public'), { maxAge: 0, etag: true }));
app.use((req, res, next) => {
  if (req.method === 'GET' && !req.path.startsWith('/api/')) return res.sendFile(path.join(__dirname, 'public', 'index.html'));
  next();
});

function startServer() {
  manualsCache = { at: Date.now(), data: readFallback() };

  app.listen(PORT, () => {
    console.log(`SIO Manuals Dashboard running on port ${PORT}`);
    console.log(
      `Manuals ready immediately from cache: operation=${manualsCache.data.operation.length}, maintenance=${manualsCache.data.maintenance.length}`
    );
    if (!PROD) console.log('Local login: admin / SIO-Local-2026!');
  });

  setTimeout(() => {
    refreshAllData().catch(error => {
      console.error('Initial background live refresh failed:', error.message);
    });
  }, 1000);

  setInterval(() => {
    refreshAllData().catch(error => {
      console.error('Scheduled live data refresh failed:', error.message);
    });
  }, Math.max(CACHE_MS, 10 * 60 * 1000));
}

startServer();
