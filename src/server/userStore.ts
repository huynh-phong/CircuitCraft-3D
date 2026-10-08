import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import dns from 'dns';
import dotenv from 'dotenv';
import { createClient, SupabaseClient } from '@supabase/supabase-js';

// Always load environment variables for standalone or server-side usage
dotenv.config({ override: true });

const dnsPromises = dns.promises;

export interface RegisteredUser {
  id: string;
  email: string;
  phone?: string;
  passwordHash: string;
  fullName: string;
  role: 'user' | 'admin' | 'creator' | 'pro';
  tier: 'free' | 'student' | 'creator';
  status?: 'active' | 'suspended';
  createdAt: string;
  verifiedAt?: string;
  lastActiveAt?: string;
}

export interface SyncedProjectRecord {
  id: string;
  ownerId: string;
  ownerEmail: string;
  ownerName: string;
  name: string;
  description: string;
  revision: number;
  boardType: string;
  boardWidth: number;
  boardDepth: number;
  componentCount: number;
  connectionCount: number;
  status: 'active' | 'archived';
  isPublic: boolean;
  createdAt: string;
  updatedAt: string;
  document?: any;
}

export interface SyncedProjectVersionRecord {
  id: string;
  projectId: string;
  projectName: string;
  ownerId: string;
  ownerEmail: string;
  revision: number;
  note: string;
  componentCount: number;
  createdAt: string;
}

export interface CourseEnrollmentRecord {
  id: string;
  userId: string;
  userEmail: string;
  courseId: string;
  courseTitle: string;
  enrolledAt: string;
  progressPercent: number;
  completedLessons: string[];
  updatedAt: string;
}

export interface SystemLogRecord {
  id: string;
  timestamp: string;
  level: 'info' | 'success' | 'warning' | 'error';
  category: 'auth' | 'payment' | 'course' | 'project' | 'marketplace' | 'admin' | 'system';
  action: string;
  actorId?: string;
  actorEmail?: string;
  targetId?: string;
  details: string;
}

export interface SystemSettingsRecord {
  adminEmail: string;
  maintenanceMode: boolean;
  requireCourseReview: boolean;
  requireMarketplaceReview: boolean;
  allowNewRegistrations: boolean;
  updatedAt: string;
}

export function getAdminEmail(): string {
  return (process.env.ADMIN_EMAIL || 'huynhphongff1@gmail.com').trim().toLowerCase();
}

export function isVerifiedAdminEmail(email?: string | null, isVerified: boolean = true): boolean {
  if (!email) return false;
  return email.trim().toLowerCase() === getAdminEmail() && Boolean(isVerified);
}

const DATA_DIR = path.join(process.cwd(), 'data');
const USERS_FILE = path.join(DATA_DIR, 'registered_users.json');
const PROJECTS_FILE = path.join(DATA_DIR, 'synced_projects.json');
const PROJECT_VERSIONS_FILE = path.join(DATA_DIR, 'synced_project_versions.json');
const ENROLLMENTS_FILE = path.join(DATA_DIR, 'course_enrollments.json');
const LOGS_FILE = path.join(DATA_DIR, 'system_logs.json');
const SETTINGS_FILE = path.join(DATA_DIR, 'system_settings.json');

// Memory store of users and system records
const usersByEmail = new Map<string, RegisteredUser>();
const projectsById = new Map<string, SyncedProjectRecord>();
const projectVersionsList: SyncedProjectVersionRecord[] = [];
const enrollmentsById = new Map<string, CourseEnrollmentRecord>();
const systemLogsList: SystemLogRecord[] = [];
let systemSettings: SystemSettingsRecord = {
  adminEmail: getAdminEmail(),
  maintenanceMode: false,
  requireCourseReview: true,
  requireMarketplaceReview: true,
  allowNewRegistrations: true,
  updatedAt: new Date().toISOString(),
};

// Domain DNS existence cache (10-minute TTL)
const domainDnsCache = new Map<string, { exists: boolean; expiresAt: number; reason?: string }>();

// Password hash helper
function hashPassword(password: string): string {
  return crypto.createHash('sha256').update(password).digest('hex');
}

// Supabase admin client for database sync
let cachedSupabaseAdmin: SupabaseClient | null = null;
function getSupabaseAdmin(): SupabaseClient | null {
  if (cachedSupabaseAdmin) return cachedSupabaseAdmin;
  dotenv.config({ override: true });
  const url = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
  const serviceRole = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceRole) return null;
  try {
    cachedSupabaseAdmin = createClient(url, serviceRole, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    return cachedSupabaseAdmin;
  } catch {
    return null;
  }
}

// Known disposable / fake temporary email providers
const DISPOSABLE_EMAIL_DOMAINS = new Set([
  'tempmail.com',
  'temp-mail.org',
  '10minutemail.com',
  'guerrillamail.com',
  'mailinator.com',
  'sharklasers.com',
  'yopmail.com',
  'throwawaymail.com',
  'trashmail.com',
  'fakemailgenerator.com',
  'getairmail.com',
  'mohmal.com',
]);

// Ensure data folder and load users
function initUserStore() {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }

    if (fs.existsSync(USERS_FILE)) {
      const raw = fs.readFileSync(USERS_FILE, 'utf-8');
      const list: RegisteredUser[] = JSON.parse(raw);
      let mutated = false;
      for (const u of list) {
        if (!u.email) continue;
        const clean = u.email.trim().toLowerCase();
        // Purge legacy placeholder fake admin account
        if (clean === 'admin@circuitcraft3d.com') {
          mutated = true;
          continue;
        }
        // Strictly enforce single admin email rule
        if (isVerifiedAdminEmail(clean, Boolean(u.verifiedAt))) {
          if (u.role !== 'admin') {
            u.role = 'admin';
            mutated = true;
          }
        } else if (u.role === 'admin') {
          u.role = u.tier === 'creator' ? 'creator' : u.tier === 'student' ? 'pro' : 'user';
          mutated = true;
        }
        if (!u.status) u.status = 'active';
        usersByEmail.set(clean, u);
      }
      if (mutated) {
        saveUsersToDisk();
      }
    }

    if (fs.existsSync(PROJECTS_FILE)) {
      const list: SyncedProjectRecord[] = JSON.parse(fs.readFileSync(PROJECTS_FILE, 'utf-8'));
      if (Array.isArray(list)) {
        for (const p of list) {
          if (p && p.id) projectsById.set(p.id, p);
        }
      }
    }

    if (fs.existsSync(PROJECT_VERSIONS_FILE)) {
      const list: SyncedProjectVersionRecord[] = JSON.parse(fs.readFileSync(PROJECT_VERSIONS_FILE, 'utf-8'));
      if (Array.isArray(list)) {
        projectVersionsList.push(...list);
      }
    }

    if (fs.existsSync(ENROLLMENTS_FILE)) {
      const list: CourseEnrollmentRecord[] = JSON.parse(fs.readFileSync(ENROLLMENTS_FILE, 'utf-8'));
      if (Array.isArray(list)) {
        for (const e of list) {
          if (e && e.id) enrollmentsById.set(e.id, e);
        }
      }
    }

    if (fs.existsSync(LOGS_FILE)) {
      const list: SystemLogRecord[] = JSON.parse(fs.readFileSync(LOGS_FILE, 'utf-8'));
      if (Array.isArray(list)) {
        systemLogsList.push(...list);
      }
    }

    if (fs.existsSync(SETTINGS_FILE)) {
      const parsed = JSON.parse(fs.readFileSync(SETTINGS_FILE, 'utf-8'));
      if (parsed && typeof parsed === 'object') {
        systemSettings = {
          ...systemSettings,
          ...parsed,
          adminEmail: getAdminEmail(),
        };
      }
    }
  } catch (err) {
    console.warn('[UserStore] Error loading data files:', err);
  }
}

function saveUsersToDisk() {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    const list = Array.from(usersByEmail.values());
    fs.writeFileSync(USERS_FILE, JSON.stringify(list, null, 2), 'utf-8');
  } catch (err) {
    console.warn('[UserStore] Error saving users file:', err);
  }
}

// Initialize on module load
initUserStore();
syncUsersFromSupabase().catch(() => {});

/**
 * Syncs users from Supabase Auth & Profiles table into local store on startup or on-demand
 */
export async function syncUsersFromSupabase(): Promise<void> {
  const supabase = getSupabaseAdmin();
  if (!supabase) return;

  try {
    const { data: authData, error: aErr } = await supabase.auth.admin.listUsers();
    if (aErr || !authData?.users) return;

    const { data: profiles } = await supabase.from('profiles').select('*');
    const profileMap = new Map((profiles || []).map((p: any) => [p.email?.toLowerCase(), p]));

    let updated = false;
    for (const u of authData.users) {
      if (!u.email) continue;
      const cleanEmail = u.email.trim().toLowerCase();
      const prof = profileMap.get(cleanEmail);
      const existing = usersByEmail.get(cleanEmail);

      if (!existing) {
        const isAdmin = isVerifiedAdminEmail(cleanEmail, true);
        const newUser: RegisteredUser = {
          id: u.id,
          email: cleanEmail,
          phone: u.phone || undefined,
          passwordHash: '', // Password stored in Supabase Auth
          fullName: prof?.full_name || u.user_metadata?.full_name || cleanEmail.split('@')[0],
          role: isAdmin ? 'admin' : prof?.role === 'creator' ? 'creator' : prof?.role === 'pro' ? 'pro' : 'user',
          tier: prof?.role === 'creator' ? 'creator' : prof?.role === 'pro' ? 'student' : 'free',
          status: 'active',
          createdAt: u.created_at || new Date().toISOString(),
          verifiedAt: u.email_confirmed_at || u.created_at || new Date().toISOString(),
          lastActiveAt: u.last_sign_in_at || u.created_at || new Date().toISOString(),
        };
        usersByEmail.set(cleanEmail, newUser);
        updated = true;
      } else {
        if (isVerifiedAdminEmail(cleanEmail, true) && existing.role !== 'admin') {
          existing.role = 'admin';
          updated = true;
        } else if (!isVerifiedAdminEmail(cleanEmail, true) && existing.role === 'admin') {
          existing.role = existing.tier === 'creator' ? 'creator' : existing.tier === 'student' ? 'pro' : 'user';
          updated = true;
        }
        if (!existing.fullName && (prof?.full_name || u.user_metadata?.full_name)) {
          existing.fullName = prof?.full_name || u.user_metadata?.full_name;
          updated = true;
        }
      }
    }

    if (updated) {
      saveUsersToDisk();
      console.log(`[UserStore] Synced ${authData.users.length} user(s) from Supabase. Total users: ${usersByEmail.size}`);
    }
  } catch (err) {
    console.warn('[UserStore] Error syncing users from Supabase:', err);
  }
}

/**
 * Checks whether an email domain actually exists on the Internet and can receive emails
 * using DNS MX & A record verification.
 */
export async function verifyDomainExists(domain: string): Promise<{ exists: boolean; reason?: string }> {
  const cleanDomain = domain.trim().toLowerCase();

  // Trusted popular email providers that are guaranteed to exist on the Internet
  const TRUSTED_PUBLIC_DOMAINS = new Set([
    'gmail.com',
    'googlemail.com',
    'yahoo.com',
    'yahoo.com.vn',
    'ymail.com',
    'outlook.com',
    'hotmail.com',
    'live.com',
    'msn.com',
    'icloud.com',
    'me.com',
    'proton.me',
    'protonmail.com',
  ]);

  if (
    TRUSTED_PUBLIC_DOMAINS.has(cleanDomain) ||
    cleanDomain.endsWith('.edu.vn') ||
    cleanDomain.endsWith('.test') ||
    cleanDomain === 'circuitcraft3d.com' ||
    cleanDomain === 'localhost'
  ) {
    return { exists: true };
  }

  // Reject disposable domains
  if (DISPOSABLE_EMAIL_DOMAINS.has(cleanDomain)) {
    return {
      exists: false,
      reason: 'Hệ thống không hỗ trợ đăng ký bằng địa chỉ email tạm thời / rác.',
    };
  }

  // Check memory cache
  const cached = domainDnsCache.get(cleanDomain);
  if (cached && Date.now() < cached.expiresAt) {
    return { exists: cached.exists, reason: cached.reason };
  }

  try {
    // 1. Check MX records (Primary email exchange)
    const mxRecords = await dnsPromises.resolveMx(cleanDomain);
    if (Array.isArray(mxRecords) && mxRecords.length > 0) {
      domainDnsCache.set(cleanDomain, { exists: true, expiresAt: Date.now() + 10 * 60 * 1000 });
      return { exists: true };
    }
  } catch (mxErr: any) {
    // If MX lookup failed, check if the domain has at least an A/AAAA record
    // (RFC allows fallback to A record if MX doesn't exist, though rare)
    try {
      const aRecords = await dnsPromises.resolve(cleanDomain);
      if (Array.isArray(aRecords) && aRecords.length > 0) {
        domainDnsCache.set(cleanDomain, { exists: true, expiresAt: Date.now() + 10 * 60 * 1000 });
        return { exists: true };
      }
    } catch {
      // Both MX and A lookups failed -> domain definitely does not exist
      const reason = `Tên miền email "@${cleanDomain}" không tồn tại hoặc không thể nhận thư trên Internet. Vui lòng kiểm tra lại.`;
      domainDnsCache.set(cleanDomain, { exists: false, expiresAt: Date.now() + 10 * 60 * 1000, reason });
      return { exists: false, reason };
    }
  }

  const reason = `Tên miền email "@${cleanDomain}" không có máy chủ nhận thư (Mail Server). Vui lòng nhập email có thật.`;
  domainDnsCache.set(cleanDomain, { exists: false, expiresAt: Date.now() + 10 * 60 * 1000, reason });
  return { exists: false, reason };
}

/**
 * Validates whether an email format is valid, whether mailbox rules for the specific
 * provider (Gmail, Yahoo, Outlook, Edu) are satisfied, and whether the domain has active MX servers.
 */
export async function validateEmailFormatAndExistence(
  email: string
): Promise<{ valid: boolean; exists: boolean; reason?: string }> {
  const clean = email.trim();
  if (!clean) {
    return { valid: false, exists: false, reason: 'Vui lòng nhập địa chỉ email của bạn.' };
  }

  // Strict email regex matching RFC rules
  const emailRegex = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)+$/;

  if (!emailRegex.test(clean)) {
    return {
      valid: false,
      exists: false,
      reason: 'Địa chỉ email không đúng định dạng chuẩn (Ví dụ: name@gmail.com).',
    };
  }

  const parts = clean.split('@');
  if (parts.length !== 2) {
    return { valid: false, exists: false, reason: 'Địa chỉ email không hợp lệ.' };
  }

  const username = parts[0];
  const domain = parts[1].toLowerCase();
  const domainParts = domain.split('.');
  const tld = domainParts[domainParts.length - 1];

  if (!tld || tld.length < 2) {
    return {
      valid: false,
      exists: false,
      reason: 'Phần đuôi tên miền email không hợp lệ (Ví dụ: .com, .vn, .edu.vn).',
    };
  }

  // 1. Provider-Specific Mailbox Existence & Creation Rules
  // A. GMAIL & GOOGLEMAIL
  if (domain === 'gmail.com' || domain === 'googlemail.com') {
    // Gmail usernames MUST be between 6 and 30 characters (Google Account creation rule)
    if (username.length < 6) {
      return {
        valid: false,
        exists: false,
        reason: 'Tên người dùng Gmail phải từ 6 đến 30 ký tự. Google không cho phép tạo email dưới 6 ký tự nên email này không tồn tại.',
      };
    }
    if (username.length > 30) {
      return {
        valid: false,
        exists: false,
        reason: 'Tên người dùng Gmail tối đa 30 ký tự. Hộp thư này không thể tồn tại trên Google.',
      };
    }
    // Gmail only allows letters (a-z), numbers (0-9), and periods (.).
    // Google DOES NOT allow underscores (_), hyphens (-), plus (+ in registration), or special symbols.
    if (/[^a-zA-Z0-9.]/.test(username)) {
      return {
        valid: false,
        exists: false,
        reason: 'Tên tài khoản Gmail chỉ được chứa chữ cái, số và dấu chấm (Google cấm dấu gạch dưới _, gạch ngang - hoặc ký tự đặc biệt). Email này chưa từng được tạo trên Gmail.',
      };
    }
    // Cannot start or end with a period
    if (username.startsWith('.') || username.endsWith('.')) {
      return {
        valid: false,
        exists: false,
        reason: 'Tên tài khoản Gmail không thể bắt đầu hoặc kết thúc bằng dấu chấm (.). Email này không tồn tại.',
      };
    }
    // Cannot contain consecutive periods
    if (/\.\./.test(username)) {
      return {
        valid: false,
        exists: false,
        reason: 'Tên tài khoản Gmail không được chứa hai dấu chấm liên tiếp (..).',
      };
    }
    // Check for repetitive single-character gibberish (e.g. aaaaaa@gmail.com, 111111@gmail.com)
    if (/^(.)\1{5,}$/i.test(username)) {
      return {
        valid: false,
        exists: false,
        reason: 'Địa chỉ Gmail này có định dạng chuỗi lặp lại vô nghĩa chưa từng được kích hoạt.',
      };
    }
    // Google reserved usernames
    const reservedNames = ['admin', 'administrator', 'google', 'gmail', 'support', 'security', 'postmaster', 'abuse', 'root', 'mailer-daemon'];
    if (reservedNames.includes(username.toLowerCase())) {
      return {
        valid: false,
        exists: false,
        reason: 'Tên này thuộc danh bạ hệ thống bảo lưu của Google, không thể sử dụng làm email cá nhân.',
      };
    }
  }

  // B. YAHOO MAIL
  if (domain === 'yahoo.com' || domain === 'yahoo.com.vn' || domain === 'ymail.com') {
    if (username.length < 4 || username.length > 32) {
      return {
        valid: false,
        exists: false,
        reason: 'Tên tài khoản Yahoo phải từ 4 đến 32 ký tự.',
      };
    }
    if (!/^[a-zA-Z]/.test(username)) {
      return {
        valid: false,
        exists: false,
        reason: 'Tên tài khoản Yahoo bắt buộc phải bắt đầu bằng chữ cái.',
      };
    }
    if (/[^a-zA-Z0-9._]/.test(username) || /\.\./.test(username) || /__/.test(username)) {
      return {
        valid: false,
        exists: false,
        reason: 'Tên tài khoản Yahoo chứa ký tự không hợp lệ hoặc liên tiếp.',
      };
    }
  }

  // C. OUTLOOK & HOTMAIL
  if (domain === 'outlook.com' || domain === 'hotmail.com' || domain === 'live.com' || domain === 'msn.com') {
    if (username.length < 1 || username.length > 64) {
      return {
        valid: false,
        exists: false,
        reason: 'Tên tài khoản Microsoft Outlook/Hotmail không đúng độ dài quy định.',
      };
    }
    if (/[^a-zA-Z0-9._-]/.test(username)) {
      return {
        valid: false,
        exists: false,
        reason: 'Tên tài khoản Outlook chỉ chứa chữ, số, dấu chấm, gạch ngang hoặc gạch dưới.',
      };
    }
  }

  // 2. Verify real DNS MX existence
  const domainResult = await verifyDomainExists(domain);
  if (!domainResult.exists) {
    return {
      valid: true,
      exists: false,
      reason: domainResult.reason || `Hộp thư hoặc tên miền "@${domain}" không tồn tại trên Internet.`,
    };
  }

  return { valid: true, exists: true };
}

/**
 * Legacy synchronous format check for fast UI typing
 */
export function validateEmailFormat(email: string): { valid: boolean; reason?: string } {
  const clean = email.trim();
  if (!clean) {
    return { valid: false, reason: 'Vui lòng nhập địa chỉ email.' };
  }

  const emailRegex = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)+$/;
  if (!emailRegex.test(clean)) {
    return {
      valid: false,
      reason: 'Địa chỉ email không đúng định dạng (Ví dụ: name@gmail.com).',
    };
  }

  const parts = clean.split('@');
  const domain = parts[1]?.toLowerCase() || '';
  const domainParts = domain.split('.');
  const tld = domainParts[domainParts.length - 1];

  if (!tld || tld.length < 2) {
    return { valid: false, reason: 'Tên miền email không hợp lệ (thiếu phần đuôi .com, .vn,...).' };
  }

  return { valid: true };
}

/**
 * Checks whether an email is already registered in local store or Supabase
 */
export async function isEmailRegistered(email: string): Promise<boolean> {
  const clean = email.trim().toLowerCase();
  if (usersByEmail.has(clean)) {
    return true;
  }

  // Check Supabase if configured
  const supabase = getSupabaseAdmin();
  if (supabase) {
    try {
      // Check 1: profiles table
      const { data: profile } = await supabase
        .from('profiles')
        .select('*')
        .eq('email', clean)
        .maybeSingle();

      if (profile && profile.email) {
        // Cache user into local store immediately
        const isAdmin = isVerifiedAdminEmail(clean, true);
        const user: RegisteredUser = {
          id: profile.id,
          email: clean,
          fullName: profile.full_name || clean.split('@')[0],
          passwordHash: '',
          role: isAdmin ? 'admin' : profile.role === 'creator' ? 'creator' : profile.role === 'pro' ? 'pro' : 'user',
          tier: profile.role === 'creator' ? 'creator' : profile.role === 'pro' ? 'student' : 'free',
          status: 'active',
          createdAt: profile.created_at || new Date().toISOString(),
          verifiedAt: new Date().toISOString(),
        };
        usersByEmail.set(clean, user);
        saveUsersToDisk();
        return true;
      }

      // Check 2: auth.users list
      const { data: authData } = await supabase.auth.admin.listUsers();
      const authUser = authData?.users?.find((u) => u.email?.toLowerCase() === clean);
      if (authUser) {
        const isAdmin = isVerifiedAdminEmail(clean, Boolean(authUser.email_confirmed_at || true));
        const user: RegisteredUser = {
          id: authUser.id,
          email: clean,
          phone: authUser.phone || undefined,
          fullName: authUser.user_metadata?.full_name || clean.split('@')[0],
          passwordHash: '',
          role: isAdmin ? 'admin' : 'user',
          tier: 'free',
          status: 'active',
          createdAt: authUser.created_at || new Date().toISOString(),
          verifiedAt: authUser.email_confirmed_at || new Date().toISOString(),
        };
        usersByEmail.set(clean, user);
        saveUsersToDisk();
        return true;
      }
    } catch (err) {
      console.warn('[UserStore] Supabase check notice:', err);
    }
  }

  return false;
}

/**
 * Retrieves a user by email
 */
export function getUserByEmail(email: string): RegisteredUser | undefined {
  return usersByEmail.get(email.trim().toLowerCase());
}

/**
 * Retrieves a user by id
 */
export function getUserById(userId: string): RegisteredUser | undefined {
  if (!userId) return undefined;
  for (const u of usersByEmail.values()) {
    if (u.id === userId) return u;
  }
  return undefined;
}

/**
 * Updates a user's subscription tier (e.g. 'creator')
 */
export function updateUserTier(userId: string, tier: 'free' | 'student' | 'creator'): boolean {
  let user = getUserById(userId);
  if (!user) user = getUserByEmail(userId);
  if (!user) return false;
  user.tier = tier;
  if (isVerifiedAdminEmail(user.email, Boolean(user.verifiedAt))) {
    user.role = 'admin';
  } else {
    user.role = tier === 'creator' ? 'creator' : tier === 'student' ? 'pro' : 'user';
  }
  usersByEmail.set(user.email.toLowerCase(), user);
  saveUsersToDisk();
  return true;
}

/**
 * Updates a user's role (e.g. 'creator', 'user', 'admin').
 * Non-admin emails can NEVER be assigned 'admin' role.
 */
export function updateUserRole(
  userIdOrEmail: string,
  role: 'user' | 'admin' | 'creator' | 'pro',
  allowAdminOverride: boolean = false
): boolean {
  let user = getUserById(userIdOrEmail);
  if (!user) {
    user = getUserByEmail(userIdOrEmail);
  }
  if (!user) return false;

  if (isVerifiedAdminEmail(user.email, Boolean(user.verifiedAt))) {
    user.role = 'admin';
    if (role === 'creator') user.tier = 'creator';
    else if (role === 'pro') user.tier = 'student';
  } else {
    // Strictly forbid non-admin email from becoming admin
    const safeRole = role === 'admin' ? 'user' : role;
    user.role = safeRole;
    if (safeRole === 'creator') user.tier = 'creator';
    else if (safeRole === 'pro') user.tier = 'student';
    else if (allowAdminOverride) user.tier = 'free';
  }

  usersByEmail.set(user.email.toLowerCase(), user);
  saveUsersToDisk();
  return true;
}

/**
 * Checks password matching (supports local PBKDF2/SHA256 hash and Supabase Auth fallback)
 */
export async function verifyUserPassword(email: string, passwordAttempt: string): Promise<boolean> {
  const cleanEmail = email.trim().toLowerCase();
  let user = getUserByEmail(cleanEmail);

  if (user && user.passwordHash) {
    const hash = hashPassword(passwordAttempt);
    if (user.passwordHash === hash) {
      return true;
    }
  }

  // Fallback: Verify password via Supabase Auth client if user signed up via Supabase
  const supabase = getSupabaseAdmin();
  if (supabase) {
    try {
      dotenv.config({ override: true });
      const anonKey = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY;
      const url = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
      if (url && anonKey) {
        const client = createClient(url, anonKey, { auth: { persistSession: false, autoRefreshToken: false } });
        const { data, error } = await client.auth.signInWithPassword({
          email: cleanEmail,
          password: passwordAttempt,
        });

        if (!error && data.user) {
          // Success! Sync local user password hash so subsequent logins are fast
          if (!user) {
            user = {
              id: data.user.id,
              email: cleanEmail,
              passwordHash: hashPassword(passwordAttempt),
              fullName: data.user.user_metadata?.full_name || cleanEmail.split('@')[0],
              role: 'user',
              tier: 'free',
              createdAt: data.user.created_at,
              verifiedAt: data.user.email_confirmed_at || new Date().toISOString(),
            };
            usersByEmail.set(cleanEmail, user);
          } else {
            user.passwordHash = hashPassword(passwordAttempt);
          }
          saveUsersToDisk();
          return true;
        }
      }
    } catch (err) {
      console.warn('[UserStore] Supabase password verify error:', err);
    }
  }

  return false;
}

/**
 * Normalizes phone numbers for consistent storage and lookup
 */
export function normalizePhoneNumber(phone: string): string {
  let cleaned = phone.replace(/[\s\-\.\(\)]/g, '');
  if (cleaned.startsWith('+84')) {
    cleaned = '0' + cleaned.slice(3);
  } else if (cleaned.startsWith('84') && cleaned.length >= 11) {
    cleaned = '0' + cleaned.slice(2);
  }
  return cleaned;
}

/**
 * Validates phone numbers (supports Vietnamese 10-digit formats and international E.164)
 */
export function validatePhoneNumber(phone: string): { valid: boolean; reason?: string } {
  const clean = phone.trim();
  if (!clean) {
    return { valid: false, reason: 'Vui lòng nhập số điện thoại.' };
  }
  const norm = normalizePhoneNumber(clean);
  const vnPhoneRegex = /^(03|05|07|08|09)\d{8}$/;
  const intlPhoneRegex = /^\+?[1-9]\d{7,14}$/;

  if (vnPhoneRegex.test(norm) || intlPhoneRegex.test(clean.replace(/[\s\-]/g, ''))) {
    return { valid: true };
  }
  return {
    valid: false,
    reason: 'Số điện thoại không hợp lệ. Vui lòng nhập số điện thoại 10 chữ số (Ví dụ: 0912345678 hoặc +84912345678).',
  };
}

/**
 * Retrieves a user by phone number
 */
export function getUserByPhone(phone: string): RegisteredUser | undefined {
  const norm = normalizePhoneNumber(phone);
  for (const user of usersByEmail.values()) {
    if (user.phone && normalizePhoneNumber(user.phone) === norm) {
      return user;
    }
  }
  return undefined;
}

/**
 * Retrieves a user by email or phone
 */
export function findUserByEmailOrPhone(query: string): RegisteredUser | undefined {
  const clean = query.trim().toLowerCase();
  const byEmail = usersByEmail.get(clean);
  if (byEmail) return byEmail;
  return getUserByPhone(query);
}

/**
 * Updates user password in userStore and saves to disk, syncing with Supabase Auth
 */
export async function updateUserPassword(
  emailOrPhone: string,
  newPassword: string
): Promise<{ success: boolean; user?: RegisteredUser; message?: string }> {
  let user = findUserByEmailOrPhone(emailOrPhone);
  const cleanQuery = emailOrPhone.trim().toLowerCase();
  const supabase = getSupabaseAdmin();

  // If user not yet in memory store, lookup in Supabase
  if (!user && supabase && cleanQuery.includes('@')) {
    try {
      const { data: authData } = await supabase.auth.admin.listUsers();
      const sbUser = authData?.users?.find((u) => u.email?.toLowerCase() === cleanQuery);
      if (sbUser) {
        const { data: profile } = await supabase.from('profiles').select('*').eq('email', cleanQuery).maybeSingle();
        user = {
          id: sbUser.id,
          email: cleanQuery,
          phone: sbUser.phone || undefined,
          passwordHash: hashPassword(newPassword),
          fullName: profile?.full_name || sbUser.user_metadata?.full_name || cleanQuery.split('@')[0],
          role: profile?.role === 'admin' ? 'admin' : 'user',
          tier: 'free',
          createdAt: sbUser.created_at || new Date().toISOString(),
          verifiedAt: new Date().toISOString(),
        };
        usersByEmail.set(cleanQuery, user);
      }
    } catch (err) {
      console.warn('[UserStore] Supabase lookup on reset password notice:', err);
    }
  }

  if (!user) {
    return { success: false, message: 'Không tìm thấy tài khoản để đặt lại mật khẩu.' };
  }

  user.passwordHash = hashPassword(newPassword);
  usersByEmail.set(user.email.toLowerCase(), user);
  saveUsersToDisk();

  // Also sync to Supabase if connected
  if (supabase) {
    try {
      await supabase.auth.admin.updateUserById(user.id, { password: newPassword });
    } catch (err) {
      console.warn('[UserStore] Supabase password update notice:', err);
    }
  }

  return { success: true, user };
}

/**
 * Updates or links a phone number to an existing user account
 */
export function linkUserPhone(email: string, phone: string): boolean {
  const cleanEmail = email.trim().toLowerCase();
  const user = usersByEmail.get(cleanEmail);
  if (!user) return false;
  user.phone = normalizePhoneNumber(phone);
  usersByEmail.set(cleanEmail, user);
  saveUsersToDisk();
  return true;
}

/**
 * Registers a new user into the store
 */
export async function registerNewUser(params: {
  email: string;
  password: string;
  fullName?: string;
  phone?: string;
}): Promise<RegisteredUser> {
  const cleanEmail = params.email.trim().toLowerCase();
  const id = `usr_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
  const fullName = params.fullName?.trim() || cleanEmail.split('@')[0] || 'Kỹ sư CircuitCraft';
  const phone = params.phone ? normalizePhoneNumber(params.phone) : undefined;

  const isAdmin = isVerifiedAdminEmail(cleanEmail, true);
  const nowIso = new Date().toISOString();

  const user: RegisteredUser = {
    id,
    email: cleanEmail,
    phone,
    passwordHash: hashPassword(params.password),
    fullName,
    role: isAdmin ? 'admin' : 'user',
    tier: 'free',
    status: 'active',
    createdAt: nowIso,
    verifiedAt: nowIso,
    lastActiveAt: nowIso,
  };

  usersByEmail.set(cleanEmail, user);
  saveUsersToDisk();

  addSystemLog({
    level: 'success',
    category: 'auth',
    action: 'USER_REGISTERED',
    actorId: id,
    actorEmail: cleanEmail,
    targetId: id,
    details: `Tài khoản mới đăng ký và xác thực thành công: ${cleanEmail} (${user.role})`,
  });

  // Also sync to Supabase if connected
  const supabase = getSupabaseAdmin();
  if (supabase) {
    try {
      await supabase.from('profiles').upsert({
        id,
        email: cleanEmail,
        full_name: fullName,
        role: isAdmin ? 'admin' : 'user',
        created_at: nowIso,
      });
    } catch (err) {
      console.warn('[UserStore] Supabase profile sync notice:', err);
    }
  }

  return user;
}

/**
 * Lists all registered real users in the system
 */
export function listAllUsers(): RegisteredUser[] {
  return Array.from(usersByEmail.values())
    .filter((u) => u.email.toLowerCase() !== 'admin@circuitcraft3d.com')
    .map((u) => {
      const isAdmin = isVerifiedAdminEmail(u.email, Boolean(u.verifiedAt));
      return {
        ...u,
        role: (isAdmin ? 'admin' : u.role === 'admin' ? 'user' : u.role) as RegisteredUser['role'],
        status: u.status || 'active',
      };
    })
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
}

/**
 * Updates lastActiveAt timestamp for a user
 */
export function touchUserActivity(emailOrId: string): void {
  let user = getUserByEmail(emailOrId) || getUserById(emailOrId);
  if (!user) return;
  user.lastActiveAt = new Date().toISOString();
  if (isVerifiedAdminEmail(user.email, Boolean(user.verifiedAt))) {
    user.role = 'admin';
  }
  usersByEmail.set(user.email.toLowerCase(), user);
  saveUsersToDisk();
}

/**
 * Ensures an authenticated user (e.g. via Supabase session or Admin verification) exists in userStore
 */
export function ensureAuthenticatedUserRecord(params: {
  id?: string;
  email: string;
  fullName?: string;
  verified?: boolean;
}): RegisteredUser {
  const cleanEmail = params.email.trim().toLowerCase();
  let existing = usersByEmail.get(cleanEmail);
  const nowIso = new Date().toISOString();
  const isAdmin = isVerifiedAdminEmail(cleanEmail, params.verified ?? true);

  if (existing) {
    if (isAdmin && existing.role !== 'admin') {
      existing.role = 'admin';
    } else if (!isAdmin && existing.role === 'admin') {
      existing.role = existing.tier === 'creator' ? 'creator' : existing.tier === 'student' ? 'pro' : 'user';
    }
    existing.lastActiveAt = nowIso;
    if (params.verified && !existing.verifiedAt) {
      existing.verifiedAt = nowIso;
    }
    usersByEmail.set(cleanEmail, existing);
    saveUsersToDisk();
    return existing;
  }

  const newUser: RegisteredUser = {
    id: params.id || `usr_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
    email: cleanEmail,
    fullName: params.fullName || cleanEmail.split('@')[0],
    passwordHash: '',
    role: isAdmin ? 'admin' : 'user',
    tier: 'free',
    status: 'active',
    createdAt: nowIso,
    verifiedAt: (params.verified ?? true) ? nowIso : undefined,
    lastActiveAt: nowIso,
  };
  usersByEmail.set(cleanEmail, newUser);
  saveUsersToDisk();
  return newUser;
}

/**
 * Admin update user attributes (plan/tier, status, fullName)
 */
export function adminUpdateUserRecord(
  userId: string,
  updates: {
    tier?: 'free' | 'student' | 'creator';
    role?: 'user' | 'pro' | 'creator' | 'admin';
    status?: 'active' | 'suspended';
    fullName?: string;
  }
): RegisteredUser | null {
  let user = getUserById(userId) || getUserByEmail(userId);
  if (!user) return null;

  if (updates.fullName !== undefined && updates.fullName.trim()) {
    user.fullName = updates.fullName.trim();
  }
  if (updates.status !== undefined) {
    // Do not allow suspending the primary admin account
    if (!isVerifiedAdminEmail(user.email, Boolean(user.verifiedAt))) {
      user.status = updates.status;
    }
  }
  if (updates.tier !== undefined) {
    user.tier = updates.tier;
    if (!isVerifiedAdminEmail(user.email, Boolean(user.verifiedAt))) {
      user.role = updates.tier === 'creator' ? 'creator' : updates.tier === 'student' ? 'pro' : 'user';
    }
  }
  if (updates.role !== undefined) {
    if (isVerifiedAdminEmail(user.email, Boolean(user.verifiedAt))) {
      user.role = 'admin';
    } else if (updates.role !== 'admin') {
      user.role = updates.role;
      if (updates.role === 'creator') user.tier = 'creator';
      else if (updates.role === 'pro') user.tier = 'student';
      else user.tier = 'free';
    }
  }

  usersByEmail.set(user.email.toLowerCase(), user);
  saveUsersToDisk();
  return user;
}

// ============================================================================
// REAL PROJECTS, VERSIONS, ENROLLMENTS, LOGS & SETTINGS PERSISTENCE
// ============================================================================

function saveProjectsToDisk() {
  try {
    fs.writeFileSync(PROJECTS_FILE, JSON.stringify(Array.from(projectsById.values()), null, 2), 'utf-8');
  } catch (err) {
    console.warn('[UserStore] Error saving projects file:', err);
  }
}

function saveProjectVersionsToDisk() {
  try {
    fs.writeFileSync(PROJECT_VERSIONS_FILE, JSON.stringify(projectVersionsList.slice(0, 500), null, 2), 'utf-8');
  } catch (err) {
    console.warn('[UserStore] Error saving project versions file:', err);
  }
}

function saveEnrollmentsToDisk() {
  try {
    fs.writeFileSync(ENROLLMENTS_FILE, JSON.stringify(Array.from(enrollmentsById.values()), null, 2), 'utf-8');
  } catch (err) {
    console.warn('[UserStore] Error saving enrollments file:', err);
  }
}

function saveLogsToDisk() {
  try {
    fs.writeFileSync(LOGS_FILE, JSON.stringify(systemLogsList.slice(0, 1000), null, 2), 'utf-8');
  } catch (err) {
    console.warn('[UserStore] Error saving logs file:', err);
  }
}

function saveSettingsToDisk() {
  try {
    fs.writeFileSync(SETTINGS_FILE, JSON.stringify(systemSettings, null, 2), 'utf-8');
  } catch (err) {
    console.warn('[UserStore] Error saving settings file:', err);
  }
}

export function syncPersonalProject(params: {
  project: any;
  userId?: string;
  userEmail?: string;
  userName?: string;
  versionNote?: string;
}): SyncedProjectRecord | null {
  const doc = params.project;
  if (!doc || !doc.projectId) return null;

  const user =
    (params.userEmail ? getUserByEmail(params.userEmail) : undefined) ||
    (params.userId ? getUserById(params.userId) : undefined) ||
    (doc.authorId ? getUserById(doc.authorId) : undefined);

  const ownerId = params.userId || user?.id || doc.authorId || 'guest';
  const ownerEmail = params.userEmail || user?.email || 'guest@circuitcraft.io';
  const ownerName = params.userName || user?.fullName || ownerEmail.split('@')[0];
  const nowIso = new Date().toISOString();

  const existing = projectsById.get(doc.projectId);
  const record: SyncedProjectRecord = {
    id: doc.projectId,
    ownerId,
    ownerEmail,
    ownerName,
    name: doc.name || 'Dự án Mạch 3D',
    description: doc.description || '',
    revision: Number(doc.revision) || 1,
    boardType: doc.board?.shape || 'rectangle',
    boardWidth: Number(doc.board?.width) || 140,
    boardDepth: Number(doc.board?.depth) || 90,
    componentCount: Array.isArray(doc.components) ? doc.components.length : 0,
    connectionCount: Array.isArray(doc.connections) ? doc.connections.length : 0,
    status: 'active',
    isPublic: false,
    createdAt: existing?.createdAt || doc.createdAt || nowIso,
    updatedAt: doc.updatedAt || nowIso,
    document: doc,
  };

  projectsById.set(record.id, record);
  saveProjectsToDisk();

  // Mirror project to Supabase PostgreSQL with service-role admin client (bypasses RLS)
  try {
    const supabase = getSupabaseAdmin();
    if (supabase) {
      const supaOwnerId =
        (user?.id && user.id.includes('-') ? user.id : null) ||
        (ownerId && ownerId.includes('-') ? ownerId : '3c6c5edd-3780-4451-9525-f9e7f2250035');

      const supaPayload = {
        id: record.id,
        owner_id: supaOwnerId,
        name: record.name,
        description: record.description,
        revision: record.revision,
        units: doc.units || 'mm',
        board: doc.board || {},
        components: doc.components || [],
        connections: doc.connections || [],
        wire_routes: doc.wireRoutes || [],
        is_public: false,
        updated_at: record.updatedAt,
      };

      (async () => {
        try {
          const { error: supaErr } = await supabase.from('projects').upsert(supaPayload, { onConflict: 'id' });
          if (supaErr) {
            console.warn('[UserStore] Supabase Admin sync note:', supaErr.message);
          }
        } catch (err) {
          console.warn('[UserStore] Supabase sync error:', err);
        }
      })();
    }
  } catch (supaEx) {
    console.warn('[UserStore] Supabase sync exception:', supaEx);
  }

  if (!existing || existing.revision !== record.revision || params.versionNote) {
    const ver: SyncedProjectVersionRecord = {
      id: `ver_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      projectId: record.id,
      projectName: record.name,
      ownerId,
      ownerEmail,
      revision: record.revision,
      note: params.versionNote || `Revision #${record.revision}`,
      componentCount: record.componentCount,
      createdAt: nowIso,
    };
    projectVersionsList.unshift(ver);
    saveProjectVersionsToDisk();
  }

  return record;
}

export function removePersonalProject(projectId: string): boolean {
  if (!projectsById.has(projectId)) return false;
  projectsById.delete(projectId);
  saveProjectsToDisk();
  try {
    const supabase = getSupabaseAdmin();
    if (supabase) {
      (async () => {
        try {
          await supabase.from('projects').delete().eq('id', projectId);
        } catch {}
      })();
    }
  } catch {}
  return true;
}

export function listAllPersonalProjects(): SyncedProjectRecord[] {
  return Array.from(projectsById.values()).sort(
    (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
  );
}

export function listAllProjectVersions(): SyncedProjectVersionRecord[] {
  return [...projectVersionsList].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );
}

export function recordCourseEnrollment(params: {
  userId: string;
  userEmail: string;
  courseId: string;
  courseTitle: string;
  completedLessons?: string[];
  totalLessons?: number;
}): CourseEnrollmentRecord {
  const key = `enr_${params.userId}_${params.courseId}`;
  const existing = enrollmentsById.get(key);
  const nowIso = new Date().toISOString();
  const completed = params.completedLessons ?? existing?.completedLessons ?? [];
  const total = params.totalLessons || 8;
  const pct = Math.min(100, Math.round((completed.length / Math.max(1, total)) * 100));

  const rec: CourseEnrollmentRecord = {
    id: key,
    userId: params.userId,
    userEmail: params.userEmail,
    courseId: params.courseId,
    courseTitle: params.courseTitle || existing?.courseTitle || params.courseId,
    enrolledAt: existing?.enrolledAt || nowIso,
    progressPercent: pct,
    completedLessons: completed,
    updatedAt: nowIso,
  };
  enrollmentsById.set(key, rec);
  saveEnrollmentsToDisk();
  return rec;
}

export function listAllCourseEnrollments(): CourseEnrollmentRecord[] {
  return Array.from(enrollmentsById.values()).sort(
    (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
  );
}

export function addSystemLog(params: {
  level: 'info' | 'success' | 'warning' | 'error';
  category: 'auth' | 'payment' | 'course' | 'project' | 'marketplace' | 'admin' | 'system';
  action: string;
  actorId?: string;
  actorEmail?: string;
  targetId?: string;
  details: string;
}): SystemLogRecord {
  const rec: SystemLogRecord = {
    id: `log_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
    timestamp: new Date().toISOString(),
    level: params.level,
    category: params.category,
    action: params.action,
    actorId: params.actorId,
    actorEmail: params.actorEmail,
    targetId: params.targetId,
    details: params.details,
  };
  systemLogsList.unshift(rec);
  if (systemLogsList.length > 1000) {
    systemLogsList.length = 1000;
  }
  saveLogsToDisk();
  return rec;
}

export function listSystemLogs(limit = 200): SystemLogRecord[] {
  return systemLogsList.slice(0, limit);
}

export function getSystemSettings(): SystemSettingsRecord {
  return {
    ...systemSettings,
    adminEmail: getAdminEmail(),
  };
}

export function updateSystemSettings(updates: Partial<SystemSettingsRecord>): SystemSettingsRecord {
  systemSettings = {
    ...systemSettings,
    ...updates,
    adminEmail: getAdminEmail(),
    updatedAt: new Date().toISOString(),
  };
  saveSettingsToDisk();
  return systemSettings;
}

