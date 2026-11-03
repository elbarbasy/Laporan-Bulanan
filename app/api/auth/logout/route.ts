import { NextRequest, NextResponse } from 'next/server';
import {
  ADMIN_SESSION_COOKIE_NAME,
  logAdminSecurityActivity,
  validateAdminRequestSession,
} from '@/src/lib/server-auth';

export async function POST(req: NextRequest) {
  try {
    const current = await validateAdminRequestSession(req);
    if (current.authenticated && current.admin) {
      await logAdminSecurityActivity({
        adminId: current.admin.id,
        actionType: 'ADMIN_LOGOUT',
        entityName: 'admins',
        entityId: current.admin.id,
        description: `Admin ${current.admin.fullName} (${current.admin.email}) melakukan logout dari sistem.`,
      });
    }

    const response = NextResponse.json({
      authenticated: false,
      code: 'LOGGED_OUT',
      message: 'Anda telah berhasil keluar dari sesi Admin ZIPBLIND.',
    });

    response.cookies.set(ADMIN_SESSION_COOKIE_NAME, '', {
      httpOnly: true,
      sameSite: 'lax',
      path: '/',
      maxAge: 0,
    });

    return response;
  } catch (error) {
    console.error('Error pada POST /api/auth/logout:', error);
    return NextResponse.json(
      {
        authenticated: false,
        code: 'LOGOUT_ERROR',
        message: 'Gagal mengakhiri sesi.',
      },
      { status: 500 }
    );
  }
}
