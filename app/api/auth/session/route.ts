import { NextRequest, NextResponse } from 'next/server';
import { desc } from 'drizzle-orm';
import { db } from '@/src/db';
import { adminActivityLogs } from '@/src/db/schema';
import { createAdminSessionToken } from '@/lib/zipblind-auth';
import {
  ADMIN_SESSION_COOKIE_NAME,
  getServerSessionSecret,
  logAdminSecurityActivity,
  validateAdminRequestSession,
} from '@/src/lib/server-auth';

export async function GET(req: NextRequest) {
  try {
    const sessionCheck = await validateAdminRequestSession(req);

    if (!sessionCheck.authenticated || !sessionCheck.admin || !sessionCheck.session) {
      const hasExplicitBearer = Boolean(req.headers.get('authorization'));
      const res = NextResponse.json(
        {
          authenticated: false,
          code: sessionCheck.code,
          message: sessionCheck.message,
        },
        { status: hasExplicitBearer ? sessionCheck.status : 200 }
      );

      if (sessionCheck.code === 'SESSION_EXPIRED' || sessionCheck.code === 'INVALID_SIGNATURE') {
        res.cookies.set(ADMIN_SESSION_COOKIE_NAME, '', {
          httpOnly: true,
          sameSite: 'lax',
          path: '/',
          maxAge: 0,
        });
      }

      return res;
    }

    const recentLogs = await db
      .select()
      .from(adminActivityLogs)
      .orderBy(desc(adminActivityLogs.createdAt))
      .limit(8);

    return NextResponse.json({
      authenticated: true,
      code: 'VALID',
      message: sessionCheck.message,
      role: 'admin',
      admin: sessionCheck.admin,
      expiresAt: new Date(sessionCheck.session.exp * 1000).toISOString(),
      recentActivityLogs: recentLogs,
    });
  } catch (error) {
    console.error('Error pada GET /api/auth/session:', error);
    return NextResponse.json(
      {
        authenticated: false,
        code: 'SESSION_CHECK_ERROR',
        message: 'Gagal memvalidasi sesi Admin.',
      },
      { status: 500 }
    );
  }
}

/**
 * POST /api/auth/session
 * Digunakan untuk menguji skenario Sesi Kedaluwarsa (Session Expiration Handling)
 * dengan mengganti cookie sesi menjadi token yang masa berlakunya telah habis.
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    if (body.action === 'simulate_expired') {
      const current = await validateAdminRequestSession(req);
      const targetAdmin = current.admin || {
        id: '373e0c6c-73ca-4636-949c-13ce8cc04aa7',
        email: 'admin@zipblind.co.id',
        fullName: 'Admin Utama',
      };

      // Buat token sesi yang sudah kedaluwarsa 60 detik yang lalu
      const { token } = createAdminSessionToken(
        targetAdmin,
        getServerSessionSecret(),
        -60
      );

      if (current.admin) {
        await logAdminSecurityActivity({
          adminId: current.admin.id,
          actionType: 'SESSION_EXPIRED_DETECTED',
          entityName: 'admins',
          entityId: current.admin.id,
          description: `Sesi Admin ${current.admin.fullName} kedaluwarsa dan dihentikan otomatis oleh sistem proteksi.`,
        });
      }

      const res = NextResponse.json({
        authenticated: false,
        code: 'SESSION_EXPIRED',
        message: 'Sesi login Anda telah kedaluwarsa. Silakan login kembali.',
        expiredToken: token,
      });

      res.cookies.set(ADMIN_SESSION_COOKIE_NAME, token, {
        httpOnly: true,
        sameSite: 'lax',
        path: '/',
        maxAge: 300,
      });

      return res;
    }

    return NextResponse.json(
      { code: 'INVALID_ACTION', message: 'Aksi sesi tidak dikenali.' },
      { status: 400 }
    );
  } catch (error) {
    console.error('Error pada POST /api/auth/session:', error);
    return NextResponse.json(
      { code: 'INTERNAL_ERROR', message: 'Gagal memproses aksi sesi.' },
      { status: 500 }
    );
  }
}
