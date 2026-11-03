import { NextRequest } from 'next/server';
import { eq } from 'drizzle-orm';
import { db } from '@/src/db';
import { admins, adminActivityLogs } from '@/src/db/schema';
import {
  createAdminSessionToken,
  verifyAdminSessionToken,
  type AdminSessionPayload,
} from '@/lib/zipblind-auth';

export const ADMIN_SESSION_COOKIE_NAME = 'zipblind_admin_session';

export function getServerSessionSecret(): string {
  return process.env.ADMIN_SESSION_SECRET || 'zipblind-server-hmac-secret-2026-key';
}

export function getExpectedAdminPassword(): string {
  return process.env.ADMIN_DEFAULT_PASSWORD || 'ZipblindAdmin2026!';
}

export function getSupabaseProjectUrl(): string {
  return (
    process.env.NEXT_PUBLIC_SUPABASE_URL ||
    'https://tdmivjmxkcljkaskqggw.supabase.co'
  ).replace(/\/+$/, '');
}

/**
 * Memastikan akun Administrator utama terdaftar di tabel public.admins.
 */
export async function ensureDefaultAdminsSeeded() {
  const existing = await db.select().from(admins).limit(5);
  if (existing.length === 0) {
    await db
      .insert(admins)
      .values([
        {
          fullName: 'Admin Utama',
          email: 'admin@zipblind.co.id',
          avatarUrl: '/images/ref_admin_avatar.png',
          isActive: true,
        },
        {
          fullName: 'Muhammad Amrizal (Admin)',
          email: 'muhammadamrizal613@gmail.com',
          avatarUrl: '/images/ref_admin_avatar.png',
          isActive: true,
        },
      ])
      .onConflictDoNothing();
  }
}

/**
 * Membaca token sesi Admin dari HTTP-Only Cookie atau Authorization Header.
 */
export function extractSessionTokenFromRequest(req: NextRequest): string | null {
  const cookieToken = req.cookies.get(ADMIN_SESSION_COOKIE_NAME)?.value;
  if (cookieToken && cookieToken.trim()) {
    return cookieToken.trim();
  }

  const authHeader = req.headers.get('authorization');
  if (authHeader && authHeader.toLowerCase().startsWith('bearer ')) {
    return authHeader.slice(7).trim();
  }

  return null;
}

/**
 * Memvalidasi sesi Admin terhadap tanda tangan token, waktu kedaluwarsa,
 * serta status keaktifan Admin di tabel public.admins PostgreSQL.
 */
export async function validateAdminRequestSession(req: NextRequest): Promise<{
  authenticated: boolean;
  status: 200 | 401 | 403;
  code: string;
  message: string;
  admin?: {
    id: string;
    fullName: string;
    email: string;
    avatarUrl: string | null;
    role: 'admin';
  };
  session?: AdminSessionPayload;
}> {
  const rawToken = extractSessionTokenFromRequest(req);
  const verification = verifyAdminSessionToken(rawToken, getServerSessionSecret());

  if (!verification.valid || !verification.payload) {
    return {
      authenticated: false,
      status: verification.code === 'FORBIDDEN_ROLE' ? 403 : 401,
      code: verification.code,
      message: verification.message,
    };
  }

  await ensureDefaultAdminsSeeded();

  const [adminRow] = await db
    .select()
    .from(admins)
    .where(eq(admins.email, verification.payload.email.toLowerCase().trim()))
    .limit(1);

  if (!adminRow) {
    return {
      authenticated: false,
      status: 403,
      code: 'ADMIN_NOT_REGISTERED',
      message: 'Akses ditolak: Akun tidak terdaftar sebagai Administrator ZIPBLIND.',
    };
  }

  if (!adminRow.isActive) {
    return {
      authenticated: false,
      status: 403,
      code: 'ADMIN_INACTIVE',
      message: 'Akses ditolak: Akun Administrator sedang dinonaktifkan.',
    };
  }

  return {
    authenticated: true,
    status: 200,
    code: 'VALID',
    message: 'Sesi Admin aktif dan terverifikasi.',
    admin: {
      id: adminRow.id,
      fullName: adminRow.fullName,
      email: adminRow.email,
      avatarUrl: adminRow.avatarUrl || '/images/ref_admin_avatar.png',
      role: 'admin',
    },
    session: verification.payload,
  };
}

/**
 * Mencatat aktivitas keamanan/operasional Admin ke tabel public.admin_activity_logs.
 */
export async function logAdminSecurityActivity(params: {
  adminId: string | null;
  actionType: string;
  entityName: string;
  entityId?: string | null;
  description: string;
  metadata?: Record<string, unknown>;
}) {
  try {
    await db.insert(adminActivityLogs).values({
      adminId: params.adminId,
      actionType: params.actionType,
      entityName: params.entityName,
      entityId: params.entityId || null,
      description: params.description,
      metadata: params.metadata || null,
    });
  } catch (err) {
    console.error('Gagal mencatat admin_activity_logs:', err);
  }
}

export { createAdminSessionToken };
