import express, { Request, Response } from 'express';
import http from 'http';
import net from 'net';
import tls from 'tls';
import { WebSocketServer, WebSocket } from 'ws';
import path from 'path';
import fs from 'fs';
import crypto from 'crypto';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.set('trust proxy', 1);
const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;
const IS_PRODUCTION = process.env.NODE_ENV === 'production';
const INSTANCE_ID = `vyrn_${crypto.randomBytes(4).toString('hex')}`;

app.use(express.json({ limit: '10mb' }));
app.use((_req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
  next();
});

const UPLOADS_DIR = path.join(__dirname, 'uploads');
if (!fs.existsSync(UPLOADS_DIR)) {
  fs.mkdirSync(UPLOADS_DIR, { recursive: true });
}
app.use('/uploads', express.static(UPLOADS_DIR));

app.get('/favicon.ico', (_req: Request, res: Response) => {
  const svgIcon = path.join(__dirname, 'public', 'favicon.svg');
  if (fs.existsSync(svgIcon)) {
    res.setHeader('Content-Type', 'image/svg+xml');
    return res.sendFile(svgIcon);
  }
  return res.status(204).end();
});

// Persistence directory and file (data/vyrn_store.json is NEVER deleted or overwritten)
const DATA_DIR = path.join(__dirname, 'data');
const DB_FILE = path.join(DATA_DIR, 'vyrn_store.json');

if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

// Password hashing & verification helpers (scrypt with legacy SHA-256 migration support)
function legacyHashPassword(password: string): string {
  return crypto.createHash('sha256').update(password + '_vyrn_salt_2026').digest('hex');
}

function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString('hex');
  const derived = crypto.scryptSync(password, salt, 64).toString('hex');
  return `scrypt$${salt}$${derived}`;
}

function verifyPassword(password: string, storedHash: string): { valid: boolean; needsUpgrade: boolean } {
  if (!storedHash || typeof password !== 'string') {
    return { valid: false, needsUpgrade: false };
  }
  if (storedHash.startsWith('scrypt$')) {
    const parts = storedHash.split('$');
    if (parts.length !== 3) return { valid: false, needsUpgrade: false };
    const [, salt, expectedHex] = parts;
    const derived = crypto.scryptSync(password, salt, 64);
    const expected = Buffer.from(expectedHex, 'hex');
    if (derived.length !== expected.length) return { valid: false, needsUpgrade: false };
    return { valid: crypto.timingSafeEqual(derived, expected), needsUpgrade: false };
  }
  const legacyHex = legacyHashPassword(password);
  const a = Buffer.from(legacyHex, 'utf-8');
  const b = Buffer.from(storedHash, 'utf-8');
  const valid = a.length === b.length && crypto.timingSafeEqual(a, b);
  return { valid, needsUpgrade: valid };
}

// Signed HMAC-SHA256 session & domain-separated rewards authority secrets
const SESSION_SECRET = process.env.SESSION_SECRET || crypto.randomBytes(32).toString('hex');
const REWARDS_HMAC_SECRET =
  process.env.REWARDS_HMAC_SECRET ||
  crypto.createHmac('sha256', SESSION_SECRET).update('vyrn:rewards-authority:v2').digest('hex');
const SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000;
const REWARD_RECEIPT_TTL_MS = 120 * 1000;

if (IS_PRODUCTION && (!process.env.SESSION_SECRET || !process.env.REWARDS_HMAC_SECRET)) {
  console.warn(
    '[VYRN][Security] SESSION_SECRET or REWARDS_HMAC_SECRET is unset in production; ephemeral keys will rotate on restart/scale-out.'
  );
}

function createSessionToken(userId: string): string {
  const payload = Buffer.from(
    JSON.stringify({ uid: userId, exp: Date.now() + SESSION_TTL_MS }),
    'utf-8'
  ).toString('base64url');
  const sig = crypto.createHmac('sha256', SESSION_SECRET).update(payload).digest('base64url');
  return `${payload}.${sig}`;
}

function verifySessionToken(token: string): string | null {
  if (!token || typeof token !== 'string') return null;
  const parts = token.split('.');
  if (parts.length !== 2) return null;
  const [payload, sig] = parts;
  if (!payload || !sig) return null;
  const expectedSig = crypto.createHmac('sha256', SESSION_SECRET).update(payload).digest('base64url');
  const sigBuf = Buffer.from(sig, 'utf-8');
  const expectedBuf = Buffer.from(expectedSig, 'utf-8');
  if (sigBuf.length !== expectedBuf.length || !crypto.timingSafeEqual(sigBuf, expectedBuf)) {
    return null;
  }
  try {
    const decoded = JSON.parse(Buffer.from(payload, 'base64url').toString('utf-8'));
    if (!decoded?.uid || typeof decoded.exp !== 'number' || decoded.exp < Date.now()) {
      return null;
    }
    return String(decoded.uid);
  } catch {
    return null;
  }
}

// Seed data builder: Clean, Arabic-First, completely empty content collections
function getInitialDatabase() {
  const adminId = 'usr_admin_001';
  return {
    settings: {
      brandName: 'VYRN',
      brandTagline: 'عالم تصنعه بنفسك.',
      primaryAccent: '#FF5A1F',
      secondaryAccent: '#D7FF38',
      showIntroAnimation: true,
      allowGuestInteractions: true,
      commentModerationRequired: false,
      maintenanceMode: false,
    },
    users: [
      {
        id: adminId,
        username: 'boda',
        displayName: 'مدير المنصة (boda)',
        email: 'boda@vyrn.studio',
        passwordHash: hashPassword('abdo'),
        role: 'admin',
        avatarUrl: '',
        bio: 'المؤسس ومدير المحتوى لمنصة وعالم VYRN الإبداعي.',
        isApproved: true,
        mustChangePassword: false,
        createdAt: new Date().toISOString(),
        privacySettings: {
          showFavorites: true,
          showActivity: true,
        },
      },
    ],
    // Clean empty catalog as required: No sample games, apps, projects, books, or podcasts!
    items: [],
    // 5 Initial core sections ready for the administrator to populate
    sections: [
      {
        id: 'sec_games_01',
        slug: 'games',
        name: 'الألعاب',
        description: 'مساحة ألعابك وتجارب المحاكاة التفاعلية.',
        accentColor: '#FF5A1F',
        layoutType: 'bento',
        filterType: 'category',
        categoryTarget: 'game',
        sortOrder: 1,
        isEnabled: true,
        isDraft: false,
        audience: 'public',
      },
      {
        id: 'sec_apps_02',
        slug: 'apps',
        name: 'التطبيقات',
        description: 'الأدوات البرمجية والتطبيقات الرقمية المبتكرة.',
        accentColor: '#D7FF38',
        layoutType: 'carousel',
        filterType: 'category',
        categoryTarget: 'app',
        sortOrder: 2,
        isEnabled: true,
        isDraft: false,
        audience: 'public',
      },
      {
        id: 'sec_projects_03',
        slug: 'projects',
        name: 'المشاريع',
        description: 'المشاريع الهندسية والبرمجية مفتوحة المصدر.',
        accentColor: '#FF5A1F',
        layoutType: 'grid',
        filterType: 'category',
        categoryTarget: 'project',
        sortOrder: 3,
        isEnabled: true,
        isDraft: false,
        audience: 'public',
      },
      {
        id: 'sec_books_04',
        slug: 'books',
        name: 'الكتب والمنشورات',
        description: 'المنشورات المعمارية والأبحاث والمقالات التصميمية.',
        accentColor: '#F2EBDD',
        layoutType: 'grid',
        filterType: 'category',
        categoryTarget: 'book',
        sortOrder: 4,
        isEnabled: true,
        isDraft: false,
        audience: 'public',
      },
      {
        id: 'sec_podcasts_05',
        slug: 'podcasts',
        name: 'البودكاست',
        description: 'الحلقات الصوتية والتسجيلات الإبداعية الاستكشافية.',
        accentColor: '#D7FF38',
        layoutType: 'media_showcase',
        filterType: 'category',
        categoryTarget: 'podcast',
        sortOrder: 5,
        isEnabled: true,
        isDraft: false,
        audience: 'public',
      },
    ],
    comments: [],
    likes: [],
    favorites: [],
    notifications: [],
    categories: [
      { id: 'cat_g1', type: 'game', name: 'ألعاب الأكشن والسرعة', slug: 'action-games', description: 'ألعاب قتالية وسريعة' },
      { id: 'cat_g2', type: 'game', name: 'المحاكاة والتجارب التفاعلية', slug: 'simulation-games', description: 'محاكيات واقعية وتجارب فيزيائية' },
      { id: 'cat_g3', type: 'game', name: 'الخيال العلمي والمستقبل', slug: 'scifi-games', description: 'عوالم مستقبلية وفضاء سيبراني' },
      { id: 'cat_g4', type: 'game', name: 'الألغاز والتحدي الذهني', slug: 'puzzle-games', description: 'تحديات ذكاء واستراتيجية' },
      { id: 'cat_g5', type: 'game', name: 'ألعاب متصفح خفيفة', slug: 'web-arcade', description: 'تشغيل مباشر وخفيف' },
    ],
  };
}

// Database helper functions
function readDb() {
  if (!fs.existsSync(DB_FILE)) {
    const initial = getInitialDatabase();
    fs.writeFileSync(DB_FILE, JSON.stringify(initial, null, 2), 'utf-8');
    return initial;
  }
  try {
    const raw = fs.readFileSync(DB_FILE, 'utf-8');
    const parsed = JSON.parse(raw);
    if (!parsed.categories) {
      parsed.categories = [
        { id: 'cat_g1', type: 'game', name: 'ألعاب الأكشن والسرعة', slug: 'action-games', description: 'ألعاب قتالية وسريعة' },
        { id: 'cat_g2', type: 'game', name: 'المحاكاة والتجارب التفاعلية', slug: 'simulation-games', description: 'محاكيات واقعية وتجارب فيزيائية' },
        { id: 'cat_g3', type: 'game', name: 'الخيال العلمي والمستقبل', slug: 'scifi-games', description: 'عوالم مستقبلية وفضاء سيبراني' },
        { id: 'cat_g4', type: 'game', name: 'الألغاز والتحدي الذهني', slug: 'puzzle-games', description: 'تحديات ذكاء واستراتيجية' },
        { id: 'cat_g5', type: 'game', name: 'ألعاب متصفح خفيفة', slug: 'web-arcade', description: 'تشغيل مباشر وخفيف' },
      ];
      writeDb(parsed);
    }
    return parsed;
  } catch (e) {
    console.error('Error reading DB file, recreating seed:', e);
    const initial = getInitialDatabase();
    fs.writeFileSync(DB_FILE, JSON.stringify(initial, null, 2), 'utf-8');
    return initial;
  }
}

// ======================= FIREBASE CONFIG & TOKEN VERIFICATION =======================
const BOOTSTRAPPED_ADMIN_EMAIL = 'bidamohammed412@gmail.com';
const firebaseConfigPath = path.join(__dirname, 'firebase-applet-config.json');
let firebaseProjectId = '';
let firebaseDatabaseId = '';

if (fs.existsSync(firebaseConfigPath)) {
  try {
    const rawConfig = fs.readFileSync(firebaseConfigPath, 'utf-8');
    const firebaseConfig = JSON.parse(rawConfig);
    firebaseProjectId = String(firebaseConfig.projectId || '');
    firebaseDatabaseId = String(firebaseConfig.firestoreDatabaseId || '');
    console.log('[Firebase] Configured for project:', firebaseProjectId, 'DB:', firebaseDatabaseId);
  } catch (err: any) {
    console.warn('[Firebase] Config read warning:', err?.message || err);
  }
}

let cachedGoogleCerts: { certs: Record<string, string>; expiresAt: number } | null = null;

async function getGoogleSecureTokenCerts(): Promise<Record<string, string>> {
  if (cachedGoogleCerts && Date.now() < cachedGoogleCerts.expiresAt) {
    return cachedGoogleCerts.certs;
  }
  const resp = await fetch(
    'https://www.googleapis.com/robot/v1/metadata/x509/securetoken@system.gserviceaccount.com'
  );
  if (!resp.ok) {
    throw new Error('Failed to fetch Google public certificates');
  }
  const certs = (await resp.json()) as Record<string, string>;
  const cacheControl = resp.headers.get('cache-control') || '';
  const maxAgeMatch = cacheControl.match(/max-age=(\d+)/i);
  const maxAgeMs = maxAgeMatch ? parseInt(maxAgeMatch[1], 10) * 1000 : 3600 * 1000;
  cachedGoogleCerts = { certs, expiresAt: Date.now() + maxAgeMs };
  return certs;
}

async function verifyFirebaseIdToken(idToken: string): Promise<{
  uid: string;
  email: string;
  emailVerified: boolean;
  signInProvider: string;
  name?: string;
  picture?: string;
} | null> {
  if (!firebaseProjectId || !idToken || typeof idToken !== 'string') return null;
  const parts = idToken.split('.');
  if (parts.length !== 3) return null;

  try {
    const [headerB64, payloadB64, sigB64] = parts;
    const header = JSON.parse(Buffer.from(headerB64, 'base64url').toString('utf-8'));
    const payload = JSON.parse(Buffer.from(payloadB64, 'base64url').toString('utf-8'));

    if (header.alg !== 'RS256' || !header.kid) return null;

    const certs = await getGoogleSecureTokenCerts();
    const certPem = certs[header.kid];
    if (!certPem) return null;

    const verifier = crypto.createVerify('RSA-SHA256');
    verifier.update(`${headerB64}.${payloadB64}`);
    verifier.end();
    const isValidSig = verifier.verify(certPem, Buffer.from(sigB64, 'base64url'));
    if (!isValidSig) return null;

    const nowSec = Math.floor(Date.now() / 1000);
    if (payload.aud !== firebaseProjectId) return null;
    if (payload.iss !== `https://securetoken.google.com/${firebaseProjectId}`) return null;
    if (!payload.sub || typeof payload.sub !== 'string') return null;
    if (typeof payload.exp !== 'number' || payload.exp <= nowSec) return null;
    if (typeof payload.iat !== 'number' || payload.iat > nowSec + 300) return null;

    const signInProvider =
      typeof payload.firebase?.sign_in_provider === 'string' ? payload.firebase.sign_in_provider : '';

    return {
      uid: payload.sub,
      email: String(payload.email || '').toLowerCase(),
      emailVerified: Boolean(payload.email_verified),
      signInProvider,
      name: typeof payload.name === 'string' ? payload.name : undefined,
      picture: typeof payload.picture === 'string' ? payload.picture : undefined,
    };
  } catch {
    return null;
  }
}

function writeDb(data: any) {
  fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2), 'utf-8');
}

// Helper to sanitize user object
function sanitizeUser(u: any) {
  if (!u) return null;
  const { passwordHash, ...rest } = u;
  return rest;
}

// Helper auth middleware (verifies signed HMAC session token)
function getAuthUser(req: Request) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) return null;
  const token = authHeader.slice(7).trim();
  const userId = verifySessionToken(token);
  if (!userId) return null;
  const db = readDb();
  const user = db.users.find((u: any) => u.id === userId);
  return user || null;
}

// ======================= REST API ROUTES =======================

// --- Settings ---
app.get('/api/settings', (req: Request, res: Response) => {
  const db = readDb();
  res.json(db.settings);
});

app.put('/api/settings', (req: Request, res: Response) => {
  const authUser = getAuthUser(req);
  if (!authUser || authUser.role !== 'admin') {
    return res.status(403).json({ error: 'صلاحيات الإدارة مطلوبة لتعديل إعدادات المنصة.' });
  }
  const db = readDb();
  db.settings = { ...db.settings, ...req.body };
  writeDb(db);
  res.json(db.settings);
});

// --- Auth Routes ---
app.post('/api/auth/login', (req: Request, res: Response) => {
  if (IS_PRODUCTION) {
    return res.status(403).json({
      error: 'تم تعطيل تسجيل الدخول المحلي في بيئة الإنتاج. يرجى تسجيل الدخول عبر Firebase Authentication أو Google.',
    });
  }
  const { identifier, password } = req.body;
  if (!identifier || !password || typeof identifier !== 'string' || typeof password !== 'string') {
    return res.status(400).json({ error: 'اسم المستخدم أو البريد الإلكتروني وكلمة المرور مطلوبة.' });
  }

  const db = readDb();
  const normalizedId = identifier.trim().toLowerCase();
  const user = db.users.find(
    (u: any) =>
      u.username.toLowerCase() === normalizedId ||
      u.email.toLowerCase() === normalizedId
  );

  if (!user || !user.passwordHash) {
    return res.status(401).json({ error: 'اسم المستخدم أو كلمة المرور غير صحيحة.' });
  }

  const check = verifyPassword(password, user.passwordHash);
  if (!check.valid) {
    return res.status(401).json({ error: 'اسم المستخدم أو كلمة المرور غير صحيحة.' });
  }

  if (check.needsUpgrade) {
    user.passwordHash = hashPassword(password);
    writeDb(db);
  }

  res.json({
    token: createSessionToken(user.id),
    user: sanitizeUser(user),
  });
});

app.post('/api/auth/firebase', async (req: Request, res: Response) => {
  const { idToken } = req.body;
  if (!idToken || typeof idToken !== 'string') {
    return res.status(400).json({ error: 'رمز التحقق من Firebase مطلوب.' });
  }

  const verified = await verifyFirebaseIdToken(idToken);
  if (!verified || !verified.email || (!verified.emailVerified && verified.signInProvider !== 'password')) {
    return res.status(401).json({ error: 'تعذر التحقق من جلسة Google / Firebase.' });
  }

  const db = readDb();
  const isBootstrappedAdmin =
    verified.emailVerified &&
    verified.email.toLowerCase() === BOOTSTRAPPED_ADMIN_EMAIL.toLowerCase();
  let user = db.users.find(
    (u: any) =>
      u.firebaseUid === verified.uid ||
      u.email.toLowerCase() === verified.email.toLowerCase()
  );

  if (!user) {
    const baseUsername = verified.email.split('@')[0].replace(/[^a-zA-Z0-9_\-]/g, '_') || 'member';
    const uniqueUsername = db.users.some((u: any) => u.username.toLowerCase() === baseUsername.toLowerCase())
      ? `${baseUsername}_${Math.random().toString(36).slice(2, 6)}`
      : baseUsername;

    user = {
      id: `usr_fb_${verified.uid.replace(/[^a-zA-Z0-9_\-]/g, '_').slice(0, 48)}`,
      firebaseUid: verified.uid,
      username: uniqueUsername,
      displayName: verified.name || uniqueUsername,
      email: verified.email,
      passwordHash: '',
      role: isBootstrappedAdmin ? 'admin' : 'member',
      avatarUrl: verified.picture || '',
      bio: '',
      isApproved: isBootstrappedAdmin,
      mustChangePassword: false,
      createdAt: new Date().toISOString(),
      privacySettings: {
        showFavorites: true,
        showActivity: true,
      },
    };
    db.users.push(user);
    writeDb(db);
  } else {
    user.firebaseUid = verified.uid;
    if (isBootstrappedAdmin && user.role !== 'admin') {
      user.role = 'admin';
      user.isApproved = true;
    }
    if (!user.avatarUrl && verified.picture) {
      user.avatarUrl = verified.picture;
    }
    writeDb(db);
  }

  res.json({
    token: createSessionToken(user.id),
    user: sanitizeUser(user),
  });
});

app.post('/api/auth/register', (req: Request, res: Response) => {
  if (IS_PRODUCTION) {
    return res.status(403).json({
      error: 'تم تعطيل التسجيل المحلي في بيئة الإنتاج. يرجى إنشاء حسابك عبر Firebase Authentication.',
    });
  }
  const { username, email, password, displayName } = req.body;
  if (
    !username ||
    !email ||
    !password ||
    typeof username !== 'string' ||
    typeof email !== 'string' ||
    typeof password !== 'string'
  ) {
    return res.status(400).json({ error: 'اسم المستخدم، البريد الإلكتروني، وكلمة المرور كلها حقول مطلوبة.' });
  }
  if (password.length < 6) {
    return res.status(400).json({ error: 'يجب ألا تقل كلمة المرور عن 6 أحرف.' });
  }

  const db = readDb();
  if (db.users.some((u: any) => u.username.toLowerCase() === username.trim().toLowerCase())) {
    return res.status(400).json({ error: 'اسم المستخدم هذا مسجل مسبقاً.' });
  }
  if (db.users.some((u: any) => u.email.toLowerCase() === email.trim().toLowerCase())) {
    return res.status(400).json({ error: 'البريد الإلكتروني هذا مسجل مسبقاً.' });
  }

  const newUser = {
    id: `usr_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
    username: username.trim().slice(0, 50),
    displayName: (typeof displayName === 'string' && displayName.trim() ? displayName.trim() : username.trim()).slice(0, 100),
    email: email.trim().toLowerCase().slice(0, 200),
    passwordHash: hashPassword(password),
    role: 'member',
    avatarUrl: '',
    bio: '',
    isApproved: true,
    mustChangePassword: false,
    createdAt: new Date().toISOString(),
    privacySettings: {
      showFavorites: true,
      showActivity: true,
    },
  };

  db.users.push(newUser);
  writeDb(db);

  res.status(201).json({
    token: createSessionToken(newUser.id),
    user: sanitizeUser(newUser),
  });
});

app.get('/api/auth/me', (req: Request, res: Response) => {
  const authUser = getAuthUser(req);
  if (!authUser) {
    return res.status(401).json({ error: 'الجلسة غير صالحة أو غير مسجل الدخول.' });
  }
  res.json(sanitizeUser(authUser));
});

app.post('/api/auth/change-password', (req: Request, res: Response) => {
  const authUser = getAuthUser(req);
  if (!authUser) {
    return res.status(401).json({ error: 'يجب تسجيل الدخول أولاً.' });
  }
  const { currentPassword, newPassword } = req.body;
  if (!newPassword || typeof newPassword !== 'string' || newPassword.length < 6) {
    return res.status(400).json({ error: 'يجب أن تتكون كلمة المرور الجديدة من 6 أحرف على الأقل.' });
  }

  const db = readDb();
  const user = db.users.find((u: any) => u.id === authUser.id);
  if (!user) {
    return res.status(404).json({ error: 'المستخدم غير موجود.' });
  }

  if (!user.mustChangePassword && user.passwordHash) {
    if (!currentPassword || typeof currentPassword !== 'string') {
      return res.status(400).json({ error: 'يرجى إدخال كلمة المرور الحالية.' });
    }
    const check = verifyPassword(currentPassword, user.passwordHash);
    if (!check.valid) {
      return res.status(400).json({ error: 'كلمة المرور الحالية غير صحيحة.' });
    }
  }

  user.passwordHash = hashPassword(newPassword);
  user.mustChangePassword = false;
  writeDb(db);

  res.json({ message: 'تم تحديث كلمة المرور بنجاح.', user: sanitizeUser(user) });
});

app.put('/api/auth/profile', (req: Request, res: Response) => {
  const authUser = getAuthUser(req);
  if (!authUser) {
    return res.status(401).json({ error: 'يجب تسجيل الدخول أولاً.' });
  }
  const db = readDb();
  const user = db.users.find((u: any) => u.id === authUser.id);
  if (!user) {
    return res.status(404).json({ error: 'المستخدم غير موجود.' });
  }

  const { displayName, bio, avatarUrl, privacySettings } = req.body;
  if (displayName) user.displayName = displayName.trim();
  if (bio !== undefined) user.bio = bio.trim();
  if (avatarUrl !== undefined) user.avatarUrl = avatarUrl.trim();
  if (privacySettings) {
    user.privacySettings = { ...user.privacySettings, ...privacySettings };
  }

  writeDb(db);
  res.json(sanitizeUser(user));
});

app.get('/api/users', (req: Request, res: Response) => {
  const authUser = getAuthUser(req);
  if (!authUser || authUser.role !== 'admin') {
    return res.status(403).json({ error: 'صلاحيات الإدارة مطلوبة.' });
  }
  const db = readDb();
  res.json(db.users.map(sanitizeUser));
});

app.put('/api/users/:id/role', (req: Request, res: Response) => {
  const authUser = getAuthUser(req);
  if (!authUser || authUser.role !== 'admin') {
    return res.status(403).json({ error: 'صلاحيات الإدارة مطلوبة.' });
  }
  const { id } = req.params;
  const { role, isApproved } = req.body;

  const db = readDb();
  const target = db.users.find((u: any) => u.id === id);
  if (!target) return res.status(404).json({ error: 'المستخدم غير موجود.' });

  if (target.id === authUser.id && role && role !== 'admin') {
    return res.status(400).json({ error: 'لا يمكنك سحب صلاحيات الإدارة من حسابك الحالي.' });
  }

  if (role) target.role = role;
  if (isApproved !== undefined) target.isApproved = isApproved;

  writeDb(db);
  res.json(sanitizeUser(target));
});

// --- Content Items ---
app.get('/api/content', (req: Request, res: Response) => {
  const authUser = getAuthUser(req);
  const db = readDb();
  const { type, category, status, search, audience, sort } = req.query;

  let items = [...db.items];

  // Access rules: public visitors see public only. Members see public + members. Approved / Admins see approved.
  items = items.filter((item: any) => {
    if (authUser?.role === 'admin') return true;
    if (item.status !== 'published') return false;

    if (item.audience === 'public') return true;
    if (item.audience === 'members' && authUser) return true;
    if (item.audience === 'approved' && authUser && (authUser.role === 'approved' || authUser.isApproved)) return true;

    return false;
  });

  if (type && type !== 'all') {
    items = items.filter((i: any) => i.type === type);
  }
  if (category) {
    items = items.filter((i: any) => i.category.toLowerCase().includes(String(category).toLowerCase()));
  }
  if (status && authUser?.role === 'admin') {
    items = items.filter((i: any) => i.status === status);
  }
  if (search) {
    const q = String(search).toLowerCase();
    items = items.filter(
      (i: any) =>
        i.title.toLowerCase().includes(q) ||
        i.description.toLowerCase().includes(q) ||
        i.summary.toLowerCase().includes(q) ||
        i.tags.some((t: string) => t.toLowerCase().includes(q))
    );
  }

  // Sort
  if (sort === 'newest') {
    items.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  } else if (sort === 'popular') {
    items.sort((a, b) => (b.likesCount || 0) + (b.viewsCount || 0) - ((a.likesCount || 0) + (a.viewsCount || 0)));
  } else if (sort === 'downloads') {
    items.sort((a, b) => (b.downloadsCount || 0) - (a.downloadsCount || 0));
  }

  res.json(items);
});

app.get('/api/content/:id', (req: Request, res: Response) => {
  const { id } = req.params;
  const authUser = getAuthUser(req);
  const db = readDb();

  const item = db.items.find((i: any) => i.id === id || i.slug === id);
  if (!item) {
    return res.status(404).json({ error: 'المحتوى المطلوب غير موجود.' });
  }

  // Access checks
  if (item.status !== 'published' && authUser?.role !== 'admin') {
    return res.status(403).json({ error: 'هذا العنصر غير منشور بعد.' });
  }
  if (item.audience === 'members' && !authUser) {
    return res.status(403).json({ error: 'يتطلب تسجيل الدخول للوصول إلى هذا المحتوى.' });
  }
  if (item.audience === 'approved' && (!authUser || (authUser.role !== 'admin' && !authUser.isApproved))) {
    return res.status(403).json({ error: 'يتطلب حساباً معتمداً للوصول إلى هذا المحتوى.' });
  }

  item.viewsCount = (item.viewsCount || 0) + 1;
  writeDb(db);

  res.json(item);
});

app.post('/api/content', (req: Request, res: Response) => {
  const authUser = getAuthUser(req);
  if (!authUser || authUser.role !== 'admin') {
    return res.status(403).json({ error: 'صلاحيات الإدارة مطلوبة لإضافة المحتوى.' });
  }

  const { title, type, category, description, summary } = req.body;
  if (!title || !type || !category) {
    return res.status(400).json({ error: 'العنوان، النوع، والتصنيف حقول مطلوبة.' });
  }

  const db = readDb();
  const slug = req.body.slug || title.toLowerCase().replace(/[^a-z0-9\u0600-\u06FF]+/g, '-').replace(/(^-|-$)+/g, '');
  const now = new Date().toISOString();

  const newItem = {
    ...req.body,
    id: `item_${type}_${Date.now()}`,
    slug,
    title: String(title).trim(),
    type,
    category: String(category).trim(),
    description: description || '',
    summary: summary || description?.slice(0, 100) || '',
    coverImage: req.body.coverImage || '',
    galleryImages: Array.isArray(req.body.galleryImages) ? req.body.galleryImages : [],
    bannerImage: req.body.bannerImage || '',
    status: req.body.status || 'published',
    createdAt: now,
    updatedAt: now,
    creator: req.body.creator || authUser.displayName,
    isFeatured: !!req.body.isFeatured,
    isEditorsPick: !!req.body.isEditorsPick,
    audience: req.body.audience || 'public',
    tags: Array.isArray(req.body.tags) ? req.body.tags : [],
    likesCount: 0,
    viewsCount: 0,
    downloadsCount: 0,
    commentsEnabled: req.body.commentsEnabled !== false,
    newBadge: req.body.newBadge || { enabled: false, label: 'جديد' },
    customFields: req.body.customFields || {},
    gameConfig: req.body.gameConfig,
    appConfig: req.body.appConfig,
    projectConfig: req.body.projectConfig,
    bookConfig: req.body.bookConfig,
    podcastConfig: req.body.podcastConfig,
  };

  db.items.unshift(newItem);

  // If published, trigger in-app notification
  if (newItem.status === 'published') {
    const notif = {
      id: `notif_${Date.now()}`,
      userId: 'all',
      title: `إصدار جديد: ${newItem.title}`,
      message: `تمت إضافة "${newItem.title}" في قسم ${newItem.category}.`,
      linkUrl: `#item/${newItem.id}`,
      type: 'release',
      isRead: false,
      createdAt: now,
    };
    db.notifications.unshift(notif);
  }

  writeDb(db);
  res.status(201).json(newItem);
});

app.put('/api/content/:id', (req: Request, res: Response) => {
  const authUser = getAuthUser(req);
  if (!authUser || authUser.role !== 'admin') {
    return res.status(403).json({ error: 'صلاحيات الإدارة مطلوبة.' });
  }

  const { id } = req.params;
  const db = readDb();
  const index = db.items.findIndex((i: any) => i.id === id);
  if (index === -1) {
    return res.status(404).json({ error: 'عنصر المحتوى غير موجود.' });
  }

  const { id: _ignoreId, createdAt: _ignoreCreatedAt, ...safePatch } = req.body || {};
  db.items[index] = {
    ...db.items[index],
    ...safePatch,
    id: db.items[index].id,
    createdAt: db.items[index].createdAt,
    updatedAt: new Date().toISOString(),
  };

  writeDb(db);
  res.json(db.items[index]);
});

app.delete('/api/content/:id', (req: Request, res: Response) => {
  const authUser = getAuthUser(req);
  if (!authUser || authUser.role !== 'admin') {
    return res.status(403).json({ error: 'صلاحيات الإدارة مطلوبة.' });
  }

  const { id } = req.params;
  const db = readDb();
  db.items = db.items.filter((i: any) => i.id !== id);
  db.comments = db.comments.filter((c: any) => c.contentId !== id);
  db.favorites = db.favorites.filter((f: any) => f.contentId !== id);
  db.likes = db.likes.filter((l: any) => l.contentId !== id);

  writeDb(db);
  res.json({ message: 'تم حذف المحتوى بنجاح.' });
});

// Download / Launch tracking
app.post('/api/content/:id/launch', (req: Request, res: Response) => {
  const { id } = req.params;
  const db = readDb();
  const item = db.items.find((i: any) => i.id === id);
  if (item) {
    item.downloadsCount = (item.downloadsCount || 0) + 1;
    writeDb(db);
  }
  res.json({ success: true, count: item?.downloadsCount || 0 });
});

// --- Categories Management ---
app.get('/api/categories', (req: Request, res: Response) => {
  const db = readDb();
  const { type } = req.query;
  let categories = [...(db.categories || [])];
  if (type) {
    categories = categories.filter((c: any) => c.type === type);
  }
  const authUser = getAuthUser(req);
  const items = db.items || [];
  const results = categories.map((cat: any) => {
    const count = items.filter((i: any) => {
      if (authUser?.role !== 'admin' && i.status !== 'published') return false;
      return i.category === cat.name || i.category === cat.slug;
    }).length;
    return { ...cat, itemCount: count };
  });
  res.json(results);
});

app.post('/api/categories', (req: Request, res: Response) => {
  const authUser = getAuthUser(req);
  if (!authUser || authUser.role !== 'admin') {
    return res.status(403).json({ error: 'صلاحيات الإدارة مطلوبة لإضافة التصنيفات.' });
  }
  const { name, type = 'game', description } = req.body;
  if (!name || !name.trim()) {
    return res.status(400).json({ error: 'اسم التصنيف مطلوب.' });
  }
  const db = readDb();
  if (!db.categories) db.categories = [];
  const trimmedName = name.trim();
  if (db.categories.some((c: any) => c.name.toLowerCase() === trimmedName.toLowerCase() && c.type === type)) {
    return res.status(400).json({ error: 'هذا التصنيف موجود بالفعل.' });
  }
  const newCat = {
    id: `cat_${Date.now()}`,
    name: trimmedName,
    slug: trimmedName.toLowerCase().replace(/[^a-z0-9\u0600-\u06FF]+/g, '-').replace(/(^-|-$)+/g, ''),
    type,
    description: description?.trim() || '',
  };
  db.categories.push(newCat);
  writeDb(db);
  res.status(201).json(newCat);
});

app.put('/api/categories/:id', (req: Request, res: Response) => {
  const authUser = getAuthUser(req);
  if (!authUser || authUser.role !== 'admin') {
    return res.status(403).json({ error: 'صلاحيات الإدارة مطلوبة لتعديل التصنيفات.' });
  }
  const { id } = req.params;
  const { name, description } = req.body;
  const db = readDb();
  if (!db.categories) db.categories = [];
  const cat = db.categories.find((c: any) => c.id === id);
  if (!cat) {
    return res.status(404).json({ error: 'التصنيف غير موجود.' });
  }
  if (name && name.trim()) {
    cat.name = name.trim();
    cat.slug = cat.name.toLowerCase().replace(/[^a-z0-9\u0600-\u06FF]+/g, '-').replace(/(^-|-$)+/g, '');
  }
  if (description !== undefined) {
    cat.description = description.trim();
  }
  writeDb(db);
  res.json(cat);
});

app.delete('/api/categories/:id', (req: Request, res: Response) => {
  const authUser = getAuthUser(req);
  if (!authUser || authUser.role !== 'admin') {
    return res.status(403).json({ error: 'صلاحيات الإدارة مطلوبة لحذف التصنيفات.' });
  }
  const { id } = req.params;
  const db = readDb();
  if (!db.categories) db.categories = [];
  db.categories = db.categories.filter((c: any) => c.id !== id && c.name !== id);
  writeDb(db);
  res.json({ message: 'تم حذف التصنيف بنجاح.' });
});

// ImageKit upload endpoint. The private key is only read by the server and is never sent to the browser.
app.post('/api/upload', async (req: Request, res: Response) => {
  const authUser = getAuthUser(req);
  if (!authUser || authUser.role !== 'admin') {
    return res.status(403).json({ error: 'صلاحيات الإدارة مطلوبة لرفع الصور.' });
  }

  const privateKey = process.env.IMAGEKIT_PRIVATE_KEY;
  if (!privateKey) {
    return res.status(503).json({
      error: 'خدمة رفع الصور غير مهيأة بعد. أضف IMAGEKIT_PRIVATE_KEY إلى إعدادات Secrets على الخادم.',
    });
  }

  const { dataUrl, filename, folder } = req.body || {};
  if (typeof dataUrl !== 'string') {
    return res.status(400).json({ error: 'لم يتم توفير بيانات الصورة.' });
  }
  const matches = dataUrl.match(/^data:(image\/(?:png|jpeg|jpg|webp|gif));base64,([A-Za-z0-9+/=]+)$/i);
  if (!matches || matches.length !== 3) {
    return res.status(400).json({ error: 'صيغة الصورة غير مدعومة. الصيغ المسموحة: PNG, JPG, WebP, GIF.' });
  }

  const mime = matches[1].toLowerCase() === 'image/jpg' ? 'image/jpeg' : matches[1].toLowerCase();
  const buffer = Buffer.from(matches[2], 'base64');
  if (!buffer.length || buffer.length > 5 * 1024 * 1024) {
    return res.status(400).json({ error: 'حجم الصورة يجب أن يكون أقل من 5 ميجابايت.' });
  }
  const extMap: Record<string, string> = {
    'image/png': 'png', 'image/jpeg': 'jpg', 'image/webp': 'webp', 'image/gif': 'gif',
  };
  const safeFolder = folder === 'gallery' ? 'gallery' : 'covers';
  const baseName = typeof filename === 'string' ? filename : 'image';
  const safeBaseName = baseName
    .replace(/\.[^/.]+$/, '')
    .replace(/[^a-zA-Z0-9_-]/g, '_')
    .slice(0, 48) || 'image';
  const uploadName = `${safeBaseName}_${Date.now()}.${extMap[mime]}`;

  try {
    const form = new FormData();
    form.append('file', new Blob([new Uint8Array(buffer)], { type: mime }), uploadName);
    form.append('fileName', uploadName);
    form.append('folder', `/vyrn/${safeFolder}`);
    form.append('useUniqueFileName', 'true');

    const imageKitResponse = await fetch('https://upload.imagekit.io/api/v1/files/upload', {
      method: 'POST',
      headers: {
        Authorization: `Basic ${Buffer.from(`${privateKey}:`, 'utf8').toString('base64')}`,
      },
      body: form,
    });
    const imageKitResult: any = await imageKitResponse.json().catch(() => ({}));
    if (!imageKitResponse.ok) {
      console.error('[VYRN][ImageKit] Upload failed:', imageKitResponse.status, imageKitResult?.message || imageKitResult?.help || 'Unknown error');
      return res.status(502).json({ error: 'ImageKit رفض رفع الصورة. راجع إعدادات المفتاح وصلاحياته ثم حاول مرة أخرى.' });
    }
    if (typeof imageKitResult.url !== 'string' || !imageKitResult.url.startsWith('https://')) {
      console.error('[VYRN][ImageKit] Unexpected upload response.');
      return res.status(502).json({ error: 'لم يُرجع ImageKit رابطًا صالحًا للصورة.' });
    }
    return res.status(201).json({
      url: imageKitResult.url,
      path: imageKitResult.filePath || '',
      fileId: imageKitResult.fileId || '',
    });
  } catch (error) {
    console.error('[VYRN][ImageKit] Upload error:', error);
    return res.status(502).json({ error: 'تعذر الاتصال بخدمة ImageKit. حاول مرة أخرى لاحقًا.' });
  }
});

// --- Dynamic Sections ---
app.get('/api/sections', (req: Request, res: Response) => {
  const authUser = getAuthUser(req);
  const db = readDb();

  let sections = [...db.sections];
  if (authUser?.role !== 'admin') {
    sections = sections.filter((s: any) => s.isEnabled && !s.isDraft);
  }

  sections.sort((a: any, b: any) => a.sortOrder - b.sortOrder);
  res.json(sections);
});

app.post('/api/sections', (req: Request, res: Response) => {
  const authUser = getAuthUser(req);
  if (!authUser || authUser.role !== 'admin') {
    return res.status(403).json({ error: 'صلاحيات الإدارة مطلوبة.' });
  }

  const { name, layoutType, filterType } = req.body;
  if (!name) return res.status(400).json({ error: 'اسم القسم مطلوب.' });

  const db = readDb();
  const newSection = {
    id: `sec_${Date.now()}`,
    slug: req.body.slug || name.toLowerCase().replace(/[^a-z0-9\u0600-\u06FF]+/g, '-'),
    name: name.trim(),
    description: req.body.description || '',
    accentColor: req.body.accentColor || '#FF5A1F',
    layoutType: layoutType || 'editorial',
    filterType: filterType || 'all',
    categoryTarget: req.body.categoryTarget || '',
    customItemIds: req.body.customItemIds || [],
    sortOrder: db.sections.length + 1,
    isEnabled: req.body.isEnabled !== false,
    isDraft: !!req.body.isDraft,
    audience: req.body.audience || 'public',
    coverImage: req.body.coverImage || '',
    bannerImage: req.body.bannerImage || '',
  };

  db.sections.push(newSection);
  writeDb(db);
  res.status(201).json(newSection);
});

app.put('/api/sections/:id', (req: Request, res: Response) => {
  const authUser = getAuthUser(req);
  if (!authUser || authUser.role !== 'admin') {
    return res.status(403).json({ error: 'صلاحيات الإدارة مطلوبة.' });
  }

  const { id } = req.params;
  const db = readDb();
  const index = db.sections.findIndex((s: any) => s.id === id);
  if (index === -1) return res.status(404).json({ error: 'القسم غير موجود.' });

  const { id: _ignoreId, ...safePatch } = req.body || {};
  db.sections[index] = { ...db.sections[index], ...safePatch, id: db.sections[index].id };
  writeDb(db);
  res.json(db.sections[index]);
});

app.delete('/api/sections/:id', (req: Request, res: Response) => {
  const authUser = getAuthUser(req);
  if (!authUser || authUser.role !== 'admin') {
    return res.status(403).json({ error: 'صلاحيات الإدارة مطلوبة.' });
  }

  const { id } = req.params;
  const db = readDb();
  db.sections = db.sections.filter((s: any) => s.id !== id);
  writeDb(db);
  res.json({ message: 'تم حذف القسم بنجاح.' });
});

app.post('/api/sections/reorder', (req: Request, res: Response) => {
  const authUser = getAuthUser(req);
  if (!authUser || authUser.role !== 'admin') {
    return res.status(403).json({ error: 'صلاحيات الإدارة مطلوبة.' });
  }

  const { order } = req.body;
  if (!Array.isArray(order)) return res.status(400).json({ error: 'مصفوفة الترتيب مطلوبة.' });

  const db = readDb();
  order.forEach(({ id, sortOrder }) => {
    const sec = db.sections.find((s: any) => s.id === id);
    if (sec) sec.sortOrder = sortOrder;
  });

  writeDb(db);
  res.json(db.sections);
});

// --- Comments & Interactions ---
app.get('/api/interactions/comments', (req: Request, res: Response) => {
  const { contentId } = req.query;
  const authUser = getAuthUser(req);
  const db = readDb();

  let comments = [...db.comments];
  if (contentId) {
    comments = comments.filter((c: any) => c.contentId === contentId);
  }

  comments = comments.filter((c: any) => {
    if (authUser?.role === 'admin') return true;
    if (c.userId === authUser?.id) return true;
    return c.isApproved;
  });

  comments.sort((a: any, b: any) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
  res.json(comments);
});

app.post('/api/interactions/comments', (req: Request, res: Response) => {
  const authUser = getAuthUser(req);
  const db = readDb();

  if (!authUser && !db.settings.allowGuestInteractions) {
    return res.status(401).json({ error: 'يجب تسجيل الدخول لنشر التعليقات.' });
  }

  const { contentId, content, parentId } = req.body;
  if (!contentId || !content?.trim()) {
    return res.status(400).json({ error: 'معرف المحتوى ونص التعليق مطلوبان.' });
  }

  const item = db.items.find((i: any) => i.id === contentId);
  if (!item || !item.commentsEnabled) {
    return res.status(403).json({ error: 'التعليقات معطلة لهذا المحتوى.' });
  }

  const isApproved = authUser?.role === 'admin' || !db.settings.commentModerationRequired;

  const newComment = {
    id: `cmt_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
    contentId,
    userId: authUser?.id || 'guest_user',
    username: authUser?.username || 'زائر مستكشف',
    userDisplayName: authUser?.displayName || 'زائر',
    userAvatar: authUser?.avatarUrl || '',
    content: content.trim().slice(0, 1500),
    createdAt: new Date().toISOString(),
    parentId: parentId || null,
    isApproved,
    isReported: false,
    likesCount: 0,
  };

  db.comments.push(newComment);

  if (parentId) {
    const parent = db.comments.find((c: any) => c.id === parentId);
    if (parent && parent.userId !== authUser?.id && parent.userId !== 'guest_user') {
      db.notifications.unshift({
        id: `notif_${Date.now()}`,
        userId: parent.userId,
        title: 'رد جديد على تعليقك',
        message: `قام ${newComment.userDisplayName} بالرد على تعليقك في "${item.title}".`,
        linkUrl: `#item/${contentId}`,
        type: 'reply',
        isRead: false,
        createdAt: new Date().toISOString(),
      });
    }
  }

  writeDb(db);
  res.status(201).json(newComment);
});

app.delete('/api/interactions/comments/:id', (req: Request, res: Response) => {
  const authUser = getAuthUser(req);
  if (!authUser) return res.status(401).json({ error: 'يجب تسجيل الدخول.' });

  const { id } = req.params;
  const db = readDb();
  const comment = db.comments.find((c: any) => c.id === id);
  if (!comment) return res.status(404).json({ error: 'التعليق غير موجود.' });

  if (authUser.role !== 'admin' && comment.userId !== authUser.id) {
    return res.status(403).json({ error: 'يمكنك فقط حذف تعليقاتك الخاصة.' });
  }

  db.comments = db.comments.filter((c: any) => c.id !== id && c.parentId !== id);
  writeDb(db);
  res.json({ message: 'تم حذف التعليق.' });
});

app.post('/api/interactions/comments/:id/report', (req: Request, res: Response) => {
  const { id } = req.params;
  const { reason } = req.body;
  const db = readDb();
  const comment = db.comments.find((c: any) => c.id === id);
  if (!comment) return res.status(404).json({ error: 'التعليق غير موجود.' });

  comment.isReported = true;
  comment.reportReason = reason || 'تم الإبلاغ بواسطة أحد المستخدمين للمراجعة.';
  writeDb(db);

  res.json({ message: 'تم إرسال البلاغ إلى قائمة مراجعة الإدارة.' });
});

// --- Likes & Favorites ---
app.post('/api/interactions/likes', (req: Request, res: Response) => {
  const authUser = getAuthUser(req);
  const { contentId } = req.body;
  if (!contentId) return res.status(400).json({ error: 'معرف المحتوى مطلوب.' });

  const db = readDb();
  const item = db.items.find((i: any) => i.id === contentId);
  if (!item) return res.status(404).json({ error: 'عنصر المحتوى غير موجود.' });

  const userId = authUser?.id || req.ip || 'anon';
  const existingIdx = db.likes.findIndex((l: any) => l.userId === userId && l.contentId === contentId);

  let liked = false;
  if (existingIdx !== -1) {
    db.likes.splice(existingIdx, 1);
    item.likesCount = Math.max(0, (item.likesCount || 0) - 1);
    liked = false;
  } else {
    db.likes.push({ userId, contentId });
    item.likesCount = (item.likesCount || 0) + 1;
    liked = true;
  }

  writeDb(db);
  res.json({ liked, count: item.likesCount });
});

app.get('/api/favorites', (req: Request, res: Response) => {
  const authUser = getAuthUser(req);
  if (!authUser) return res.json([]);

  const db = readDb();
  const favContentIds = db.favorites.filter((f: any) => f.userId === authUser.id).map((f: any) => f.contentId);
  const favoriteItems = db.items.filter((i: any) => favContentIds.includes(i.id));

  res.json(favoriteItems);
});

app.post('/api/favorites/toggle', (req: Request, res: Response) => {
  const authUser = getAuthUser(req);
  if (!authUser) return res.status(401).json({ error: 'يرجى تسجيل الدخول لحفظ المفضلة.' });

  const { contentId } = req.body;
  if (!contentId) return res.status(400).json({ error: 'معرف المحتوى مطلوب.' });

  const db = readDb();
  const existingIdx = db.favorites.findIndex((f: any) => f.userId === authUser.id && f.contentId === contentId);

  let isFavorite = false;
  if (existingIdx !== -1) {
    db.favorites.splice(existingIdx, 1);
    isFavorite = false;
  } else {
    db.favorites.push({ userId: authUser.id, contentId });
    isFavorite = true;
  }

  writeDb(db);
  res.json({ isFavorite });
});

// --- Notifications ---
app.get('/api/notifications', (req: Request, res: Response) => {
  const authUser = getAuthUser(req);
  const db = readDb();

  const userNotifs = db.notifications.filter((n: any) => n.userId === authUser?.id || n.userId === 'all');
  res.json(userNotifs);
});

app.put('/api/notifications/:id/read', (req: Request, res: Response) => {
  const authUser = getAuthUser(req);
  if (!authUser) return res.status(401).json({ error: 'يجب تسجيل الدخول.' });

  const { id } = req.params;
  const db = readDb();
  const notif = db.notifications.find((n: any) => n.id === id);
  if (notif) {
    notif.isRead = true;
    writeDb(db);
  }
  res.json({ success: true });
});

app.put('/api/notifications/mark-all-read', (req: Request, res: Response) => {
  const authUser = getAuthUser(req);
  if (!authUser) return res.status(401).json({ error: 'يجب تسجيل الدخول.' });

  const db = readDb();
  db.notifications.forEach((n: any) => {
    if (n.userId === authUser.id || n.userId === 'all') {
      n.isRead = true;
    }
  });
  writeDb(db);
  res.json({ success: true });
});

// --- Admin Moderation & Honest Analytics ---
app.get('/api/moderation/comments', (req: Request, res: Response) => {
  const authUser = getAuthUser(req);
  if (!authUser || authUser.role !== 'admin') {
    return res.status(403).json({ error: 'صلاحيات الإدارة مطلوبة.' });
  }

  const db = readDb();
  const queue = db.comments.filter((c: any) => c.isReported || !c.isApproved);
  res.json(queue);
});

app.put('/api/moderation/comments/:id/approve', (req: Request, res: Response) => {
  const authUser = getAuthUser(req);
  if (!authUser || authUser.role !== 'admin') {
    return res.status(403).json({ error: 'صلاحيات الإدارة مطلوبة.' });
  }

  const { id } = req.params;
  const db = readDb();
  const c = db.comments.find((item: any) => item.id === id);
  if (c) {
    c.isApproved = true;
    c.isReported = false;
    writeDb(db);
  }
  res.json({ success: true });
});

app.get('/api/analytics', (req: Request, res: Response) => {
  const authUser = getAuthUser(req);
  if (!authUser || authUser.role !== 'admin') {
    return res.status(403).json({ error: 'صلاحيات الإدارة مطلوبة.' });
  }

  const db = readDb();
  const itemsByType: Record<string, number> = {
    game: 0,
    app: 0,
    project: 0,
    book: 0,
    podcast: 0,
  };

  let totalLikes = 0;
  let totalViews = 0;
  let totalDownloads = 0;

  db.items.forEach((item: any) => {
    if (itemsByType[item.type] !== undefined) {
      itemsByType[item.type]++;
    }
    totalLikes += item.likesCount || 0;
    totalViews += item.viewsCount || 0;
    totalDownloads += item.downloadsCount || 0;
  });

  const analytics = {
    totalItems: db.items.length,
    itemsByType,
    totalUsers: db.users.length,
    totalComments: db.comments.length,
    totalLikes,
    totalViews,
    totalDownloads,
    pendingModerationCount: db.comments.filter((c: any) => !c.isApproved).length,
    reportedCommentsCount: db.comments.filter((c: any) => c.isReported).length,
  };

  res.json(analytics);
});

// --- Read-Only Local Store Export for Cloud Firestore Migration (Preserves data/vyrn_store.json) ---
app.get('/api/migration/export', (req: Request, res: Response) => {
  const authUser = getAuthUser(req);
  if (!authUser || authUser.role !== 'admin') {
    return res.status(403).json({ error: 'صلاحيات الإدارة مطلوبة لقراءة النسخة المحلية.' });
  }
  const db = readDb();
  res.json({
    settings: db.settings,
    users: (db.users || []).map(sanitizeUser),
    items: db.items || [],
    sections: db.sections || [],
    categories: db.categories || [],
    comments: db.comments || [],
    notifications: db.notifications || [],
  });
});

// ======================= TRUSTED SERVER REWARD AUTHORITY (Cloud Firestore Ledger) =======================
const AUTHORITATIVE_ACHIEVEMENT_REWARDS: Record<string, number> = {
  ach_first_play: 50,
  ach_arcade_veteran: 150,
  ach_first_win: 200,
  ach_collector: 40,
  ach_community_voice: 40,
  ach_points_500: 250,
};

function sanitizeSafeId(val: unknown, maxLen = 128): string {
  if (typeof val !== 'string') return '';
  return val.replace(/[^a-zA-Z0-9_\-]/g, '_').slice(0, maxLen);
}

async function requireVerifiedFirebaseCaller(req: Request) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) return null;
  const idToken = authHeader.slice(7).trim();
  const verified = await verifyFirebaseIdToken(idToken);
  if (!verified) return null;
  if (!verified.emailVerified && verified.signInProvider !== 'password') return null;
  return { ...verified, idToken };
}

function getFirestoreRestBase(): string {
  const dbId = firebaseDatabaseId || '(default)';
  return `https://firestore.googleapis.com/v1/projects/${firebaseProjectId}/databases/${dbId}/documents`;
}

function fromFsValue(v: any): any {
  if (!v || typeof v !== 'object') return undefined;
  if ('stringValue' in v) return String(v.stringValue);
  if ('integerValue' in v) return Number(v.integerValue);
  if ('doubleValue' in v) return Number(v.doubleValue);
  if ('booleanValue' in v) return Boolean(v.booleanValue);
  if ('timestampValue' in v) return String(v.timestampValue);
  if ('nullValue' in v) return null;
  if ('arrayValue' in v) {
    return Array.isArray(v.arrayValue?.values) ? v.arrayValue.values.map(fromFsValue) : [];
  }
  if ('mapValue' in v) {
    const out: Record<string, any> = {};
    const fields = v.mapValue?.fields || {};
    for (const [k, val] of Object.entries(fields)) {
      out[k] = fromFsValue(val);
    }
    return out;
  }
  return undefined;
}

function fromFsDocument(doc: any): { data: Record<string, any>; updateTime?: string } | null {
  if (!doc || !doc.fields) return null;
  const data: Record<string, any> = {};
  for (const [k, v] of Object.entries(doc.fields)) {
    data[k] = fromFsValue(v);
  }
  return { data, updateTime: doc.updateTime };
}

function toFsValue(v: unknown): any {
  if (v === null || v === undefined) return { nullValue: null };
  if (typeof v === 'string') return { stringValue: v };
  if (typeof v === 'boolean') return { booleanValue: v };
  if (typeof v === 'number') {
    if (Number.isInteger(v)) return { integerValue: String(v) };
    return { doubleValue: v };
  }
  if (Array.isArray(v)) {
    return { arrayValue: { values: v.map(toFsValue) } };
  }
  if (typeof v === 'object') {
    const fields: Record<string, any> = {};
    for (const [k, val] of Object.entries(v as Record<string, unknown>)) {
      if (val !== undefined) fields[k] = toFsValue(val);
    }
    return { mapValue: { fields } };
  }
  return { stringValue: String(v) };
}

async function fsGetDoc(docPath: string, idToken: string): Promise<{ data: Record<string, any>; updateTime?: string } | null> {
  const url = `${getFirestoreRestBase()}/${docPath}`;
  const resp = await fetch(url, {
    headers: { Authorization: `Bearer ${idToken}` },
  });
  if (resp.status === 404) return null;
  if (!resp.ok) {
    const errText = await resp.text().catch(() => '');
    throw new Error(`Firestore read failed (${resp.status}): ${errText.slice(0, 180)}`);
  }
  const json = await resp.json();
  return fromFsDocument(json);
}

async function fsRunQuery(structuredQuery: Record<string, unknown>, idToken: string): Promise<Record<string, any>[]> {
  const url = `${getFirestoreRestBase()}:runQuery`;
  const resp = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${idToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ structuredQuery }),
  });
  if (!resp.ok) {
    const errText = await resp.text().catch(() => '');
    throw new Error(`Firestore query failed (${resp.status}): ${errText.slice(0, 180)}`);
  }
  const rows = (await resp.json()) as any[];
  const out: Record<string, any>[] = [];
  for (const row of rows) {
    if (row?.document) {
      const parsed = fromFsDocument(row.document);
      if (parsed) out.push(parsed.data);
    }
  }
  return out;
}

async function fsCommit(writes: any[], idToken: string): Promise<{ ok: boolean; status: number; message?: string }> {
  const url = `${getFirestoreRestBase()}:commit`;
  const resp = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${idToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ writes }),
  });
  if (resp.ok) {
    return { ok: true, status: resp.status };
  }
  const errBody = await resp.text().catch(() => '');
  return { ok: false, status: resp.status, message: errBody.slice(0, 300) };
}

async function fsSetPresenceOffline(uid: string, idToken: string): Promise<void> {
  if (!firebaseProjectId || !uid || !idToken) return;
  const dbId = firebaseDatabaseId || '(default)';
  const docName = `projects/${firebaseProjectId}/databases/${dbId}/documents/userStats/${uid}`;
  await fsCommit(
    [
      {
        update: {
          name: docName,
          fields: {
            isOnline: { booleanValue: false },
            currentRoomId: { stringValue: '' },
          },
        },
        updateMask: { fieldPaths: ['isOnline', 'currentRoomId'] },
        updateTransforms: [
          { fieldPath: 'lastSeenAt', setToServerValue: 'REQUEST_TIME' },
          { fieldPath: 'updatedAt', setToServerValue: 'REQUEST_TIME' },
        ],
        currentDocument: { exists: true },
      },
    ],
    idToken
  ).catch(() => {});
}

interface RewardReceiptPayload {
  claimId: string;
  userId: string;
  claimType: 'game_launch' | 'comment_post' | 'match_finish' | 'achievement';
  targetId: string;
  pointsDelta: number;
  xpDelta: number;
  gamesPlayedDelta: number;
  winsDelta: number;
}

function buildCanonicalReceiptInput(params: RewardReceiptPayload & { nonce: string; expMs: number }): string {
  return JSON.stringify([
    'vyrn-reward-v2',
    params.claimId,
    params.userId,
    params.claimType,
    params.targetId,
    params.pointsDelta,
    params.xpDelta,
    params.gamesPlayedDelta,
    params.winsDelta,
    params.nonce,
    params.expMs,
  ]);
}

function mintRewardReceipt(params: RewardReceiptPayload): { serverReceipt: string; expMs: number } {
  const nonce = crypto.randomBytes(16).toString('hex');
  const expMs = Date.now() + REWARD_RECEIPT_TTL_MS;
  const canonical = buildCanonicalReceiptInput({ ...params, nonce, expMs });
  const sigHex = crypto.createHmac('sha256', REWARDS_HMAC_SECRET).update(canonical).digest('hex');
  return {
    serverReceipt: `v2.${nonce}.${expMs}.${sigHex}`,
    expMs,
  };
}

function verifyRewardReceipt(
  receipt: string,
  expected: RewardReceiptPayload,
  options?: { allowExpired?: boolean }
): { valid: boolean; reason?: string } {
  if (!receipt || typeof receipt !== 'string') {
    return { valid: false, reason: 'missing_receipt' };
  }
  const match = receipt.match(/^v2\.([a-f0-9]{32})\.([0-9]{10,16})\.([a-f0-9]{64})$/);
  if (!match) {
    return { valid: false, reason: 'malformed_receipt' };
  }
  const [, nonce, expStr, sigHex] = match;
  const expMs = Number(expStr);
  if (!Number.isFinite(expMs) || (!options?.allowExpired && expMs < Date.now())) {
    return { valid: false, reason: 'expired_receipt' };
  }
  const canonical = buildCanonicalReceiptInput({ ...expected, nonce, expMs });
  const expectedSigHex = crypto.createHmac('sha256', REWARDS_HMAC_SECRET).update(canonical).digest('hex');
  const providedBuf = Buffer.from(sigHex, 'hex');
  const expectedBuf = Buffer.from(expectedSigHex, 'hex');
  if (providedBuf.length !== expectedBuf.length || !crypto.timingSafeEqual(providedBuf, expectedBuf)) {
    return { valid: false, reason: 'invalid_signature' };
  }
  return { valid: true };
}

app.get('/api/rewards/ledger', async (req: Request, res: Response) => {
  const caller = await requireVerifiedFirebaseCaller(req);
  if (!caller) {
    return res.status(401).json({ error: 'رمز مصادقة Firebase غير صالح.' });
  }
  const uid = sanitizeSafeId(caller.uid);
  try {
    const claims = await fsRunQuery(
      {
        from: [{ collectionId: 'rewardClaims' }],
        where: {
          fieldFilter: {
            field: { fieldPath: 'userId' },
            op: 'EQUAL',
            value: { stringValue: uid },
          },
        },
      },
      caller.idToken
    );
    return res.json({ claims });
  } catch (err: any) {
    return res.status(500).json({ error: err?.message || 'تعذر قراءة سجل المكافآت من Firestore.' });
  }
});

app.post('/api/rewards/claim', async (req: Request, res: Response) => {
  const caller = await requireVerifiedFirebaseCaller(req);
  if (!caller) {
    return res.status(401).json({ error: 'يجب تسجيل الدخول بحساب Firebase موثق لاحتساب المكافآت.' });
  }
  if (!firebaseProjectId) {
    return res.status(500).json({ error: 'إعدادات Firebase غير مكتملة على الخادم.' });
  }

  const uid = sanitizeSafeId(caller.uid);
  const { claimType, targetId } = req.body || {};
  const safeTargetId = sanitizeSafeId(targetId, 128);
  if (!safeTargetId || typeof claimType !== 'string') {
    return res.status(400).json({ error: 'بيانات المكافأة غير مكتملة.' });
  }

  let claimId = '';
  let pointsDelta = 0;
  let xpDelta = 0;
  let gamesPlayedDelta = 0;
  let winsDelta = 0;

  if (claimType === 'game_launch') {
    claimId = `launch_${uid}_${safeTargetId}`;
  } else if (claimType === 'comment_post') {
    claimId = `comment_${uid}_${safeTargetId}`;
  } else if (claimType === 'match_finish') {
    claimId = `match_${uid}_${safeTargetId}`;
  } else if (claimType === 'achievement') {
    claimId = `ach_${uid}_${safeTargetId}`;
  } else {
    return res.status(400).json({ error: 'نوع المكافأة غير مدعوم.' });
  }

  try {
    // 1. Check Firestore single-use ledger first (shared across all Cloud Run instances & restarts)
    const [existingClaim, statsDoc] = await Promise.all([
      fsGetDoc(`rewardClaims/${claimId}`, caller.idToken),
      fsGetDoc(`userStats/${uid}`, caller.idToken),
    ]);

    if (existingClaim) {
      return res.json({
        alreadyClaimed: true,
        committed: false,
        claimId,
        claimType,
        targetId: safeTargetId,
        pointsDelta: 0,
        xpDelta: 0,
        gamesPlayedDelta: 0,
        winsDelta: 0,
      });
    }

    if (!statsDoc || !statsDoc.updateTime) {
      return res.status(409).json({ error: 'ملف إحصائيات اللاعب غير مهيأ بعد.' });
    }
    const stats = statsDoc.data;

    // 2. Validate authoritative targets and compute exact deltas strictly on server from Firestore
    if (claimType === 'game_launch') {
      const contentDoc = await fsGetDoc(`content/${safeTargetId}`, caller.idToken);
      if (!contentDoc || contentDoc.data.status !== 'published') {
        return res.status(404).json({ error: 'اللعبة المطلوبة غير منشورة أو غير موجودة.' });
      }
      pointsDelta = 15;
      xpDelta = 20;
      gamesPlayedDelta = 1;
    } else if (claimType === 'comment_post') {
      const [commentDoc, userClaims] = await Promise.all([
        fsGetDoc(`comments/${safeTargetId}`, caller.idToken),
        fsRunQuery(
          {
            from: [{ collectionId: 'rewardClaims' }],
            where: {
              fieldFilter: {
                field: { fieldPath: 'userId' },
                op: 'EQUAL',
                value: { stringValue: uid },
              },
            },
          },
          caller.idToken
        ),
      ]);

      if (!commentDoc || commentDoc.data.userId !== uid) {
        return res.status(403).json({ error: 'التعليق غير موجود أو لا يعود للحساب الحالي.' });
      }

      const tenMinAgo = Date.now() - 10 * 60 * 1000;
      const recentComments = userClaims.filter(
        (c) =>
          c.claimType === 'comment_post' &&
          typeof c.createdAt === 'string' &&
          new Date(c.createdAt).getTime() >= tenMinAgo
      );
      if (recentComments.length >= 5) {
        return res.status(429).json({
          error: 'تم بلوغ الحد الأقصى لمكافآت التعليقات خلال 10 دقائق لمنع التكرار.',
          rateLimited: true,
        });
      }

      pointsDelta = 10;
      xpDelta = 15;
    } else if (claimType === 'match_finish') {
      const [roomDoc, playerDoc] = await Promise.all([
        fsGetDoc(`rooms/${safeTargetId}`, caller.idToken),
        fsGetDoc(`rooms/${safeTargetId}/players/${uid}`, caller.idToken),
      ]);
      if (!roomDoc || roomDoc.data.status !== 'finished') {
        return res.status(400).json({ error: 'الغرفة لم تصل لحالة الانتهاء بعد.' });
      }
      if (Number(roomDoc.data.playerCount || 0) < 2) {
        return res.status(400).json({
          error: 'تتطلب مكافآت المباريات وجود لاعبَين على الأقل داخل الغرفة.',
          insufficientPlayers: true,
        });
      }
      if (!playerDoc) {
        return res.status(403).json({ error: 'لم يتم العثور على سجل مشاركة اللاعب داخل الغرفة.' });
      }

      const won = String(roomDoc.data.winnerId || '') === uid;
      pointsDelta = won ? 120 : 30;
      xpDelta = won ? 150 : 50;
      gamesPlayedDelta = 1;
      winsDelta = won ? 1 : 0;
    } else if (claimType === 'achievement') {
      const achDoc = await fsGetDoc(`achievements/${safeTargetId}`, caller.idToken);
      if (!achDoc || achDoc.data.isActive !== true) {
        return res.status(404).json({ error: 'الإنجاز غير موجود أو غير مفعل.' });
      }
      const reqType = String(achDoc.data.requirementType || '');
      const reqTarget = Number(achDoc.data.requirementTarget || 1);

      let achieved = false;
      if (reqType === 'games_played') {
        achieved = Number(stats.gamesPlayed || 0) >= reqTarget;
      } else if (reqType === 'wins_count') {
        achieved = Number(stats.winsCount || 0) >= reqTarget;
      } else if (reqType === 'points_total') {
        achieved = Number(stats.points || 0) >= reqTarget;
      } else if (reqType === 'comments_count') {
        const cmts = await fsRunQuery(
          {
            from: [{ collectionId: 'comments' }],
            where: {
              fieldFilter: {
                field: { fieldPath: 'userId' },
                op: 'EQUAL',
                value: { stringValue: uid },
              },
            },
          },
          caller.idToken
        );
        achieved = cmts.length >= reqTarget;
      } else if (reqType === 'favorites_count') {
        const favs = await fsRunQuery(
          {
            from: [{ collectionId: 'favorites' }],
            where: {
              fieldFilter: {
                field: { fieldPath: 'userId' },
                op: 'EQUAL',
                value: { stringValue: uid },
              },
            },
          },
          caller.idToken
        );
        achieved = favs.length >= reqTarget;
      }

      if (!achieved) {
        return res.status(403).json({ error: 'لم يستوفِ اللاعب شروط هذا الإنجاز بعد.' });
      }

      const dbReward = Number(achDoc.data.pointsReward);
      const fallbackReward = AUTHORITATIVE_ACHIEVEMENT_REWARDS[safeTargetId];
      pointsDelta = Number.isFinite(dbReward) && dbReward >= 0 ? Math.min(5000, dbReward) : fallbackReward || 0;
      xpDelta = pointsDelta;
    }

    // 3. Mint time-bound single-use HMAC v2 receipt
    const { serverReceipt } = mintRewardReceipt({
      claimId,
      userId: uid,
      claimType,
      targetId: safeTargetId,
      pointsDelta,
      xpDelta,
      gamesPlayedDelta,
      winsDelta,
    });

    // 4. Execute atomic Firestore commit across /rewardClaims/{claimId} + /userStats/{uid}
    const dbId = firebaseDatabaseId || '(default)';
    const claimName = `projects/${firebaseProjectId}/databases/${dbId}/documents/rewardClaims/${claimId}`;
    const statsName = `projects/${firebaseProjectId}/databases/${dbId}/documents/userStats/${uid}`;

    const nextPoints = Math.min(1000000, Number(stats.points || 0) + pointsDelta);
    const nextXp = Math.min(1000000, Number(stats.xp || 0) + xpDelta);
    const nextLevel = Math.min(100, Math.max(Number(stats.level || 1), Math.floor(nextXp / 100) + 1));
    const nextGames = Number(stats.gamesPlayed || 0) + gamesPlayedDelta;
    const nextWins = Number(stats.winsCount || 0) + winsDelta;
    const prevUnlocked = Array.isArray(stats.unlockedAchievements) ? stats.unlockedAchievements : [];
    const nextUnlocked =
      claimType === 'achievement'
        ? Array.from(new Set([...prevUnlocked, safeTargetId])).slice(0, 50)
        : prevUnlocked;

    const commitResult = await fsCommit(
      [
        {
          update: {
            name: claimName,
            fields: {
              id: toFsValue(claimId),
              userId: toFsValue(uid),
              claimType: toFsValue(claimType),
              targetId: toFsValue(safeTargetId),
              pointsDelta: toFsValue(pointsDelta),
              xpDelta: toFsValue(xpDelta),
              gamesPlayedDelta: toFsValue(gamesPlayedDelta),
              winsDelta: toFsValue(winsDelta),
              serverReceipt: toFsValue(serverReceipt),
            },
          },
          updateTransforms: [{ fieldPath: 'createdAt', setToServerValue: 'REQUEST_TIME' }],
          currentDocument: { exists: false },
        },
        {
          update: {
            name: statsName,
            fields: {
              points: toFsValue(nextPoints),
              xp: toFsValue(nextXp),
              level: toFsValue(nextLevel),
              gamesPlayed: toFsValue(nextGames),
              winsCount: toFsValue(nextWins),
              unlockedAchievements: toFsValue(nextUnlocked),
              lastClaimId: toFsValue(claimId),
            },
          },
          updateMask: {
            fieldPaths: [
              'points',
              'xp',
              'level',
              'gamesPlayed',
              'winsCount',
              'unlockedAchievements',
              'lastClaimId',
            ],
          },
          updateTransforms: [
            { fieldPath: 'lastSeenAt', setToServerValue: 'REQUEST_TIME' },
            { fieldPath: 'updatedAt', setToServerValue: 'REQUEST_TIME' },
          ],
          currentDocument: { updateTime: statsDoc.updateTime },
        },
      ],
      caller.idToken
    );

    if (!commitResult.ok) {
      const checkAfter = await fsGetDoc(`rewardClaims/${claimId}`, caller.idToken).catch(() => null);
      if (checkAfter) {
        return res.json({
          alreadyClaimed: true,
          committed: false,
          claimId,
          claimType,
          targetId: safeTargetId,
          pointsDelta: 0,
          xpDelta: 0,
          gamesPlayedDelta: 0,
          winsDelta: 0,
        });
      }
      return res.status(commitResult.status === 403 ? 403 : 409).json({
        error: commitResult.message || 'تعذر تنفيذ معاملة المكافأة في Firestore.',
      });
    }

    return res.json({
      alreadyClaimed: false,
      committed: true,
      claimId,
      userId: uid,
      claimType,
      targetId: safeTargetId,
      pointsDelta,
      xpDelta,
      gamesPlayedDelta,
      winsDelta,
      newPoints: nextPoints,
      newXp: nextXp,
      newLevel: nextLevel,
      serverReceipt,
    });
  } catch (err: any) {
    return res.status(500).json({ error: err?.message || 'حدث خطأ أثناء معالجة المكافأة على الخادم.' });
  }
});

app.post('/api/rewards/confirm', async (req: Request, res: Response) => {
  const caller = await requireVerifiedFirebaseCaller(req);
  if (!caller) {
    return res.status(401).json({ error: 'غير مصرح.' });
  }
  const uid = sanitizeSafeId(caller.uid);
  const { claimId, serverReceipt } = req.body || {};
  const safeClaimId = sanitizeSafeId(claimId, 256);
  if (!safeClaimId || typeof serverReceipt !== 'string') {
    return res.status(400).json({ error: 'معرف المطالبة وإيصال التحقق مطلوبان.' });
  }

  try {
    const claimDoc = await fsGetDoc(`rewardClaims/${safeClaimId}`, caller.idToken);
    if (!claimDoc || claimDoc.data.userId !== uid) {
      return res.status(404).json({ error: 'المطالبة غير موجودة في سجل Firestore.' });
    }
    const stored = claimDoc.data;
    if (stored.serverReceipt !== serverReceipt) {
      return res.status(403).json({ error: 'إيصال المكافأة لا يطابق السجل المعتمد.' });
    }
    const check = verifyRewardReceipt(
      serverReceipt,
      {
        claimId: safeClaimId,
        userId: uid,
        claimType: stored.claimType,
        targetId: String(stored.targetId || ''),
        pointsDelta: Number(stored.pointsDelta || 0),
        xpDelta: Number(stored.xpDelta || 0),
        gamesPlayedDelta: Number(stored.gamesPlayedDelta || 0),
        winsDelta: Number(stored.winsDelta || 0),
      },
      { allowExpired: false }
    );
    if (!check.valid) {
      return res.status(403).json({ error: 'توقيع إيصال المكافأة غير صالح أو منتهي الصلاحية.', reason: check.reason });
    }
    return res.json({ confirmed: true, claimId: safeClaimId });
  } catch (err: any) {
    return res.status(500).json({ error: err?.message || 'تعذر التحقق من الإيصال.' });
  }
});

// ======================= OPTIONAL REDIS RESP PUB/SUB BUS (Multi-Instance Cloud Run WS Sync) =======================
interface RedisBus {
  enabled: boolean;
  publish: (payload: Record<string, unknown>) => void;
  close: () => void;
}

function encodeRespCommand(args: string[]): Buffer {
  let out = `*${args.length}\r\n`;
  for (const arg of args) {
    const byteLen = Buffer.byteLength(arg, 'utf-8');
    out += `$${byteLen}\r\n${arg}\r\n`;
  }
  return Buffer.from(out, 'utf-8');
}

function createRedisWsBus(
  redisUrlStr: string,
  channel: string,
  onRemoteMessage: (msg: Record<string, unknown>) => void
): RedisBus {
  if (!redisUrlStr) {
    return { enabled: false, publish: () => {}, close: () => {} };
  }

  let parsed: URL;
  try {
    parsed = new URL(redisUrlStr);
  } catch {
    console.warn('[VYRN][Redis] Invalid REDIS_URL format; falling back to single-instance + Firestore sync.');
    return { enabled: false, publish: () => {}, close: () => {} };
  }

  const useTls = parsed.protocol === 'rediss:';
  const host = parsed.hostname;
  const port = parsed.port ? parseInt(parsed.port, 10) : 6379;
  const password = parsed.password ? decodeURIComponent(parsed.password) : '';
  const username = parsed.username ? decodeURIComponent(parsed.username) : '';

  let pubSocket: net.Socket | tls.TLSSocket | null = null;
  let subSocket: net.Socket | tls.TLSSocket | null = null;
  let closed = false;
  let reconnectTimer: ReturnType<typeof setTimeout> | null = null;

  const connectSocket = (onReady: (sock: net.Socket | tls.TLSSocket) => void): net.Socket | tls.TLSSocket => {
    const sock = useTls
      ? tls.connect({ host, port, servername: host })
      : net.createConnection({ host, port });

    sock.on('connect', () => {
      if (password) {
        sock.write(encodeRespCommand(username ? ['AUTH', username, password] : ['AUTH', password]));
      }
      onReady(sock);
    });
    sock.on('error', (err) => {
      console.warn('[VYRN][Redis] Socket warning:', err.message);
    });
    return sock;
  };

  const connectSubscriber = () => {
    if (closed) return;
    let buffer = '';
    subSocket = connectSocket((sock) => {
      sock.write(encodeRespCommand(['SUBSCRIBE', channel]));
    });
    subSocket.on('data', (chunk) => {
      buffer += chunk.toString('utf-8');
      // Parse RESP arrays for SUBSCRIBE "message" frames: *3\r\n$7\r\nmessage\r\n$<ch>\r\n<ch>\r\n$<len>\r\n<json>\r\n
      while (buffer.length > 0) {
        const marker = buffer.indexOf('*3\r\n$7\r\nmessage\r\n');
        if (marker === -1) {
          if (buffer.length > 65536) buffer = buffer.slice(-4096);
          break;
        }
        const slice = buffer.slice(marker);
        const lines = slice.split('\r\n');
        if (lines.length < 7) break;
        const payloadLen = parseInt(lines[5].slice(1), 10);
        if (!Number.isFinite(payloadLen)) {
          buffer = slice.slice(4);
          continue;
        }
        const headerByteOffset = slice.indexOf(lines[5]) + lines[5].length + 2;
        const rawPayloadSlice = Buffer.from(slice.slice(headerByteOffset), 'utf-8');
        if (rawPayloadSlice.length < payloadLen + 2) break;
        const payloadStr = rawPayloadSlice.subarray(0, payloadLen).toString('utf-8');
        buffer = rawPayloadSlice.subarray(payloadLen + 2).toString('utf-8');
        try {
          const parsedMsg = JSON.parse(payloadStr);
          if (parsedMsg && parsedMsg.originInstanceId !== INSTANCE_ID) {
            onRemoteMessage(parsedMsg);
          }
        } catch {
          // Ignore malformed pubsub JSON
        }
      }
    });
    subSocket.on('close', () => {
      if (!closed && !reconnectTimer) {
        reconnectTimer = setTimeout(() => {
          reconnectTimer = null;
          connectSubscriber();
          connectPublisher();
        }, 3000);
      }
    });
  };

  const connectPublisher = () => {
    if (closed) return;
    pubSocket = connectSocket(() => {
      console.log('[VYRN][Redis] Pub/Sub bus connected for multi-instance WebSocket sync.');
    });
    pubSocket.on('error', () => {});
  };

  connectPublisher();
  connectSubscriber();

  return {
    enabled: true,
    publish: (payload: Record<string, unknown>) => {
      if (closed || !pubSocket || pubSocket.destroyed) return;
      try {
        const raw = JSON.stringify({ ...payload, originInstanceId: INSTANCE_ID });
        pubSocket.write(encodeRespCommand(['PUBLISH', channel, raw]));
      } catch {
        // Non-fatal fallback
      }
    },
    close: () => {
      closed = true;
      if (reconnectTimer) clearTimeout(reconnectTimer);
      try {
        pubSocket?.destroy();
        subSocket?.destroy();
      } catch {
        // Ignore close errors
      }
    },
  };
}

// ======================= REAL-TIME WEBSOCKET MULTIPLAYER HUB (/ws) =======================
interface ConnectedWsClient {
  ws: WebSocket;
  userId: string;
  displayName: string;
  roomId: string | null;
  idToken?: string;
  isAlive: boolean;
}

function isAllowedWsOrigin(req: http.IncomingMessage): boolean {
  const origin = req.headers.origin;
  if (!origin) return !IS_PRODUCTION;
  let originHost = '';
  try {
    originHost = new URL(origin).host.toLowerCase();
  } catch {
    return false;
  }
  const forwardedHost = String(req.headers['x-forwarded-host'] || req.headers.host || '').toLowerCase();
  if (forwardedHost && originHost === forwardedHost) return true;

  const extraOrigins = [process.env.APP_URL || '', ...(process.env.ALLOWED_ORIGINS || '').split(',')]
    .map((s) => s.trim())
    .filter(Boolean);
  for (const allowed of extraOrigins) {
    try {
      if (new URL(allowed).host.toLowerCase() === originHost) return true;
    } catch {
      if (allowed.toLowerCase() === originHost) return true;
    }
  }
  return !IS_PRODUCTION;
}

function attachMultiplayerWebSocket(httpServer: http.Server) {
  const wss = new WebSocketServer({ server: httpServer, path: '/ws' });
  const clients = new Map<WebSocket, ConnectedWsClient>();

  const nextEventId = () => `evt_${Date.now()}_${crypto.randomBytes(3).toString('hex')}`;

  const deliverLocalAll = (payload: Record<string, unknown>) => {
    const raw = JSON.stringify(payload);
    for (const [sock] of clients.entries()) {
      if (sock.readyState === WebSocket.OPEN) {
        sock.send(raw);
      }
    }
  };

  const deliverLocalToRoom = (roomId: string, payload: Record<string, unknown>) => {
    const raw = JSON.stringify(payload);
    for (const [sock, client] of clients.entries()) {
      if (client.roomId === roomId && sock.readyState === WebSocket.OPEN) {
        sock.send(raw);
      }
    }
  };

  const redisBus = createRedisWsBus(process.env.REDIS_URL || '', 'vyrn:ws:events', (remoteMsg) => {
    const targetRoom = typeof remoteMsg.roomId === 'string' ? remoteMsg.roomId : '';
    const { originInstanceId: _ignore, ...cleanMsg } = remoteMsg;
    if (cleanMsg.type === 'presence:snapshot') {
      return;
    }
    if (targetRoom) {
      deliverLocalToRoom(targetRoom, cleanMsg);
    } else {
      deliverLocalAll(cleanMsg);
    }
  });

  const broadcastToRoom = (roomId: string, payload: Record<string, unknown>) => {
    deliverLocalToRoom(roomId, payload);
    redisBus.publish(payload);
  };

  const broadcastPresenceSnapshot = () => {
    const deduped = new Map<string, { userId: string; displayName: string; roomId: string | null }>();
    for (const c of clients.values()) {
      if (!c.userId) continue;
      const existing = deduped.get(c.userId);
      if (!existing || (c.roomId && !existing.roomId)) {
        deduped.set(c.userId, { userId: c.userId, displayName: c.displayName, roomId: c.roomId });
      }
    }
    deliverLocalAll({
      type: 'presence:snapshot',
      onlineCount: clients.size,
      players: Array.from(deduped.values()),
      ts: Date.now(),
    });
  };

  // Heartbeat keep-alive for production reverse proxies (Cloud Run / Nginx)
  const heartbeatInterval = setInterval(() => {
    let pruned = false;
    for (const [sock, client] of clients.entries()) {
      if (!client.isAlive) {
        clients.delete(sock);
        pruned = true;
        if (client.userId && client.idToken) {
          fsSetPresenceOffline(client.userId, client.idToken).catch(() => {});
        }
        try {
          sock.terminate();
        } catch {
          // Ignore termination error
        }
        continue;
      }
      client.isAlive = false;
      if (sock.readyState === WebSocket.OPEN) {
        try {
          sock.ping();
        } catch {
          // Ignore ping error
        }
      }
    }
    if (pruned) {
      broadcastPresenceSnapshot();
    }
  }, 25000);

  wss.on('close', () => {
    clearInterval(heartbeatInterval);
    redisBus.close();
  });

  wss.on('connection', (ws, req) => {
    if (!isAllowedWsOrigin(req)) {
      ws.close(1008, 'Origin not allowed');
      return;
    }

    clients.set(ws, { ws, userId: '', displayName: 'زائر', roomId: null, isAlive: true });
    broadcastPresenceSnapshot();

    ws.on('pong', () => {
      const client = clients.get(ws);
      if (client) client.isAlive = true;
    });

    ws.on('message', async (data) => {
      try {
        const msg = JSON.parse(data.toString());
        const client = clients.get(ws);
        if (!client || !msg || typeof msg.type !== 'string') return;
        client.isAlive = true;

        if (msg.type === 'ping') {
          if (ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({ type: 'pong', ts: Date.now() }));
          }
          return;
        }

        if (msg.type === 'presence:hello') {
          if (typeof msg.idToken === 'string' && msg.idToken.length > 20) {
            const verified = await verifyFirebaseIdToken(msg.idToken).catch(() => null);
            if (verified) {
              client.userId = sanitizeSafeId(verified.uid);
              client.idToken = msg.idToken;
            }
          } else {
            client.userId = typeof msg.userId === 'string' ? msg.userId.slice(0, 128) : '';
          }
          client.displayName =
            typeof msg.displayName === 'string' && msg.displayName.trim()
              ? msg.displayName.trim().slice(0, 100)
              : 'لاعب VYRN';
          broadcastPresenceSnapshot();
        } else if (msg.type === 'room:join' && typeof msg.roomId === 'string') {
          const joinedRoom = msg.roomId.slice(0, 128);
          if (!joinedRoom) return;
          const changed = client.roomId !== joinedRoom;
          client.roomId = joinedRoom;
          if (changed) {
            broadcastToRoom(joinedRoom, {
              type: 'room:event',
              eventId: nextEventId(),
              roomId: joinedRoom,
              event: 'player_joined',
              userId: client.userId,
              displayName: client.displayName,
              ts: Date.now(),
            });
          }
          broadcastPresenceSnapshot();
        } else if (msg.type === 'room:leave') {
          const prevRoom = client.roomId;
          client.roomId = null;
          if (prevRoom) {
            broadcastToRoom(prevRoom, {
              type: 'room:event',
              eventId: nextEventId(),
              roomId: prevRoom,
              event: 'player_left',
              userId: client.userId,
              displayName: client.displayName,
              ts: Date.now(),
            });
          }
          broadcastPresenceSnapshot();
        } else if (msg.type === 'room:chat' && client.roomId) {
          const rawText = typeof msg.content === 'string' ? msg.content : typeof msg.text === 'string' ? msg.text : '';
          const cleanText = rawText.trim().slice(0, 500);
          if (!cleanText) return;
          const eventId = nextEventId();
          const msgId = typeof msg.id === 'string' && msg.id.trim() ? msg.id.slice(0, 128) : eventId;
          broadcastToRoom(client.roomId, {
            type: 'room:chat',
            eventId,
            id: msgId,
            roomId: client.roomId,
            userId: client.userId,
            displayName: client.displayName,
            content: cleanText,
            createdAt: typeof msg.createdAt === 'string' ? msg.createdAt : new Date().toISOString(),
            ts: Date.now(),
          });
        } else if (msg.type === 'room:score' && client.roomId) {
          const numericScore = Number(msg.score);
          if (!Number.isFinite(numericScore)) return;
          const boundedScore = Math.max(0, Math.min(1000000, Math.round(numericScore)));
          broadcastToRoom(client.roomId, {
            type: 'room:score',
            eventId: nextEventId(),
            roomId: client.roomId,
            userId: client.userId,
            displayName: client.displayName,
            score: boundedScore,
            ts: Date.now(),
          });
        } else if (msg.type === 'room:sync' && client.roomId) {
          broadcastToRoom(client.roomId, {
            type: 'room:sync',
            eventId: nextEventId(),
            event: typeof msg.event === 'string' ? msg.event.slice(0, 64) : 'sync',
            winnerId: typeof msg.winnerId === 'string' ? msg.winnerId.slice(0, 128) : undefined,
            roomId: client.roomId,
            userId: client.userId,
            displayName: client.displayName,
            ts: Date.now(),
          });
        }
      } catch {
        // Ignore malformed WS payloads
      }
    });

    ws.on('close', () => {
      const client = clients.get(ws);
      const prevRoom = client?.roomId;
      const uid = client?.userId;
      const dName = client?.displayName;
      const token = client?.idToken;
      clients.delete(ws);
      if (uid && token) {
        fsSetPresenceOffline(uid, token).catch(() => {});
      }
      if (prevRoom) {
        broadcastToRoom(prevRoom, {
          type: 'room:event',
          eventId: nextEventId(),
          roomId: prevRoom,
          event: 'player_left',
          userId: uid,
          displayName: dName,
          ts: Date.now(),
        });
      }
      broadcastPresenceSnapshot();
    });
  });

  return { wss, getLocalCount: () => clients.size, redisBusEnabled: redisBus.enabled };
}

// Health check endpoint for Cloud Run liveness & readiness probes
let wsRuntimeInfo: { getLocalCount: () => number; redisBusEnabled: boolean } = {
  getLocalCount: () => 0,
  redisBusEnabled: false,
};

app.get('/api/health', (_req: Request, res: Response) => {
  res.json({
    status: 'ok',
    instanceId: INSTANCE_ID,
    env: IS_PRODUCTION ? 'production' : 'development',
    uptimeSec: Math.round(process.uptime()),
    wsSyncMode: wsRuntimeInfo.redisBusEnabled ? 'redis-pubsub+firestore-sync' : 'single-instance+firestore-sync',
    localWsClients: wsRuntimeInfo.getLocalCount(),
    firebaseConfigured: Boolean(firebaseProjectId && firebaseDatabaseId),
  });
});

// Vite Middleware Mounting (Development vs Production)
async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(path.join(__dirname, 'dist')));
    app.get('*', (req, res) => {
      if (req.path.startsWith('/api/') || req.path.startsWith('/uploads/')) {
        return res.status(404).json({ error: 'Not found' });
      }
      res.sendFile(path.join(__dirname, 'dist', 'index.html'));
    });
  }

  const httpServer = http.createServer(app);
  const wsHub = attachMultiplayerWebSocket(httpServer);
  wsRuntimeInfo = {
    getLocalCount: wsHub.getLocalCount,
    redisBusEnabled: wsHub.redisBusEnabled,
  };

  httpServer.listen(PORT, '0.0.0.0', () => {
    console.log(`[VYRN] Platform engine + WebSocket Hub (${wsRuntimeInfo.redisBusEnabled ? 'Redis+Firestore' : 'Firestore-synced'}) online at http://0.0.0.0:${PORT}`);
  });

  const gracefulShutdown = (signal: string) => {
    console.log(`[VYRN] Received ${signal}, shutting down cleanly...`);
    wsHub.wss.close(() => {
      httpServer.close(() => process.exit(0));
    });
    setTimeout(() => process.exit(0), 5000).unref();
  };

  process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
  process.on('SIGINT', () => gracefulShutdown('SIGINT'));
}

startServer().catch((err) => {
  console.error('[VYRN] Fatal server startup error:', err);
  process.exit(1);
});
