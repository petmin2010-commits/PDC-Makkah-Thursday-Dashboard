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
const CACHE_MS = Number(process.env.CACHE_SECONDS || 180) * 1000;
const PROJECT_NAME = 'إعداد أدلة إجراءات وسياسات التشغيل والصيانة لفرع المؤسسة العامة للري بالأحساء';
const CONTRACT_NO = '250301052116';

const loginAttempts = new Map();
let manualsCache = { at: 0, data: null };

app.disable('x-powered-by');
app.use(express.json({ limit: '64kb' }));
const SESSION_SECRET = process.env.SESSION_SECRET || crypto.randomBytes(48).toString('hex');

app.use(session({
  secret: SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
  cookie: { httpOnly: true, sameSite: 'lax', secure: PROD, maxAge: 8 * 60 * 60 * 1000 }
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
async function readLiveManuals() {
  const exportUrl = `https://docs.google.com/spreadsheets/d/${SPREADSHEET_ID}/export?format=xlsx`;
  const response = await fetch(exportUrl, { redirect: 'follow', headers: { 'User-Agent': 'SIO-Manuals-Dashboard/1.0' } });
  if (!response.ok) throw new Error(`Google Sheets export failed: ${response.status}`);
  const buffer = Buffer.from(await response.arrayBuffer());
  const book = new ExcelJS.Workbook();
  await book.xlsx.load(buffer);
  const sheet = book.getWorksheet(SHEET_NAME);
  if (!sheet) throw new Error(`Sheet not found: ${SHEET_NAME}`);

  const headers = [];
  for (let c = 1; c <= sheet.columnCount; c++) {
    headers[c] = String(sheet.getCell(1, c).text || '').trim();
  }

  const result = { operation: [], maintenance: [], other: [], source: 'live', fetchedAt: new Date().toISOString() };
  for (let r = 2; r <= sheet.rowCount; r++) {
    const sector = String(sheet.getCell(r, 1).text || '').trim();
    for (let c = 2; c <= sheet.columnCount; c++) {
      const cell = sheet.getCell(r, c);
      const fileName = String(cell.text || '').trim();
      if (!fileName) continue;
      const zeroCol = c - 1;
      const item = { sector: sector || 'غير مصنف', language: languageFrom(headers[c], zeroCol), fileName, url: extractUrl(cell), column: headers[c] || `عمود ${c}` };
      if (c === 2 || c === 3) result.operation.push(item);
      else if (c === 4 || c === 5) result.maintenance.push(item);
      else result.other.push(item);
    }
  }
  return result;
}
function readFallback() {
  const fp = path.join(__dirname, 'fallback-manuals.json');
  const data = JSON.parse(fs.readFileSync(fp, 'utf8'));
  return { ...data, source: 'fallback', fetchedAt: new Date().toISOString() };
}

async function getManuals(force = false) {
  if (!force && manualsCache.data && Date.now() - manualsCache.at < CACHE_MS) return manualsCache.data;
  try {
    const data = await readLiveManuals();
    manualsCache = { at: Date.now(), data };
    return data;
  } catch (error) {
    const fallback = readFallback();
    fallback.warning = error.message;
    manualsCache = { at: Date.now(), data: fallback };
    return fallback;
  }
}

function requireAuth(req, res, next) {
  if (req.session && req.session.authenticated) return next();
  return res.status(401).json({ ok: false, message: 'يلزم تسجيل الدخول' });
}

app.get('/api/meta', (req, res) => res.json({ projectName: PROJECT_NAME, contractNo: CONTRACT_NO, organization: 'المؤسسة العامة للري', location: 'الأحساء' }));
app.get('/api/auth/status', (req, res) => res.json({ authenticated: !!req.session?.authenticated, username: req.session?.username || '' }));
app.post('/api/auth/login', (req, res) => {
  const { username = '', password = '' } = req.body || {};
  const expected = expectedCredentials();
  if (!expected.username || !expected.passwordHash) return res.status(503).json({ ok: false, message: 'بيانات الدخول لم تُضبط على الخادم بعد.' });

  const key = `${req.ip}|${String(username).toLowerCase()}`;
  const now = Date.now();
  const attempt = loginAttempts.get(key) || { count: 0, first: now, blockedUntil: 0 };
  if (attempt.blockedUntil > now) return res.status(429).json({ ok: false, message: 'محاولات كثيرة. حاول مرة أخرى بعد قليل.' });
  if (now - attempt.first > 15 * 60 * 1000) { attempt.count = 0; attempt.first = now; }

  const valid = String(username).trim().toLowerCase() === expected.username.trim().toLowerCase() && sha256(password) === expected.passwordHash;
  if (!valid) {
    attempt.count += 1;
    if (attempt.count >= 6) attempt.blockedUntil = now + 10 * 60 * 1000;
    loginAttempts.set(key, attempt);
    return res.status(401).json({ ok: false, message: 'اسم المستخدم أو كلمة المرور غير صحيحة.' });
  }

  loginAttempts.delete(key);
  req.session.authenticated = true;
  req.session.username = String(username).trim();
  return res.json({ ok: true });
});

app.post('/api/auth/logout', (req, res) => {
  req.session.destroy(() => res.json({ ok: true }));
});

app.get('/api/manuals', requireAuth, async (req, res) => {
  const data = await getManuals(req.query.refresh === '1');
  res.json({ ok: true, ...data });
});

app.use(express.static(path.join(__dirname, 'public'), { maxAge: PROD ? '1h' : 0 }));
app.use((req, res, next) => {
  if (req.method === 'GET' && !req.path.startsWith('/api/')) return res.sendFile(path.join(__dirname, 'public', 'index.html'));
  next();
});

app.listen(PORT, () => {
  console.log(`SIO Manuals Dashboard running on port ${PORT}`);
  if (!PROD) console.log('Local login: admin / SIO-Local-2026!');
});
