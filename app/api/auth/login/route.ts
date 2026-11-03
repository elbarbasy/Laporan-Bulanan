import crypto from 'node:crypto';
import { NextRequest, NextResponse } from 'next/server';
import { eq } from 'drizzle-orm';
import { db } from '@/src/db';
import { admins, technicians } from '@/src/db/schema';
import { adminAuth } from '@/src/lib/firebase-admin';
import {
  authorizeRoleAccess,
  createAdminSessionToken,
} from '@/lib/zipblind-auth';
import {
  ADMIN_SESSION_COOKIE_NAME,
  ensureDefaultAdminsSeeded,
  getExpectedAdminPassword,
  getServerSessionSecret,
  getSupabaseProjectUrl,
  logAdminSecurityActivity,
} from '@/src/lib/server-auth';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const {
      email,
      password,
      idToken,
      action,
      role,
      ttlSeconds,
    }: {
      email?: string;
      password?: string;
      idToken?: string;
      action?: string;
      role?: string;
      ttlSeconds?: number;
    } = body;

    // 1. Tolak segala percobaan registrasi publik
    if (action === 'register' || action === 'signup') {
      const guard = authorizeRoleAccess({
        role: null,
        httpMethod: 'POST',
        targetScope: 'public_register',
      });
      return NextResponse.json(
        {
          authenticated: false,
          code: guard.code,
          message: guard.message,
        },
        { status: guard.status }
      );
    }

    // 2. Tolak segala percobaan login menggunakan role Teknisi atau role selain Admin
    if (role && role !== 'admin') {
      const guard = authorizeRoleAccess({
        role,
        httpMethod: 'POST',
        targetScope: 'admin',
      });
      return NextResponse.json(
        {
          authenticated: false,
          code: guard.code,
          message: guard.message,
        },
        { status: guard.status }
      );
    }

    await ensureDefaultAdminsSeeded();

    let verifiedEmail = '';

    // 3A. Jika login menggunakan token OAuth / Supabase / Firebase ID Token
    if (idToken && typeof idToken === 'string') {
      try {
        const decoded = await adminAuth.verifyIdToken(idToken);
        if (!decoded.email) {
          return NextResponse.json(
            {
              authenticated: false,
              code: 'EMAIL_MISSING',
              message: 'Token autentikasi tidak memiliki alamat email yang valid.',
            },
            { status: 401 }
          );
        }
        verifiedEmail = decoded.email.toLowerCase().trim();
      } catch {
        return NextResponse.json(
          {
            authenticated: false,
            code: 'INVALID_ID_TOKEN',
            message: 'Token autentikasi tidak valid atau telah kedaluwarsa.',
          },
          { status: 401 }
        );
      }
    } else {
      // 3B. Login menggunakan Email & Password Admin
      if (!email || typeof email !== 'string' || !password || typeof password !== 'string') {
        return NextResponse.json(
          {
            authenticated: false,
            code: 'MISSING_CREDENTIALS',
            message: 'Email dan kata sandi Admin wajib diisi.',
          },
          { status: 400 }
        );
      }

      const normalizedEmail = email.toLowerCase().trim();

      // Cek apakah email milik teknisi atau mengindikasikan teknisi
      if (normalizedEmail.includes('teknisi') || normalizedEmail.includes('tech@')) {
        return NextResponse.json(
          {
            authenticated: false,
            code: 'TECHNICIAN_NO_ACCOUNT',
            message: 'Akses ditolak: Teknisi tidak memiliki akun dan tidak memiliki akses login.',
          },
          { status: 403 }
        );
      }

      // Cek apakah nama/kode ada di tabel teknisi
      const [techMatch] = await db
        .select()
        .from(technicians)
        .where(eq(technicians.technicianCode, normalizedEmail.toUpperCase()))
        .limit(1);

      if (techMatch) {
        return NextResponse.json(
          {
            authenticated: false,
            code: 'TECHNICIAN_NO_ACCOUNT',
            message: 'Akses ditolak: Teknisi tidak memiliki akun dan tidak memiliki akses login.',
          },
          { status: 403 }
        );
      }

      const expectedPass = getExpectedAdminPassword();
      const inputBuf = Buffer.from(password, 'utf8');
      const expectedBuf = Buffer.from(expectedPass, 'utf8');
      let isPasswordValid =
        inputBuf.length === expectedBuf.length &&
        crypto.timingSafeEqual(inputBuf, expectedBuf);

      const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
      if (
        !isPasswordValid &&
        supabaseAnonKey &&
        supabaseAnonKey !== 'your-supabase-anon-key'
      ) {
        try {
          const sbUrl = getSupabaseProjectUrl();
          const sbRes = await fetch(`${sbUrl}/auth/v1/token?grant_type=password`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              apikey: supabaseAnonKey,
            },
            body: JSON.stringify({ email: normalizedEmail, password }),
          });
          if (sbRes.ok) {
            isPasswordValid = true;
          }
        } catch {
          // Fallback to server-side password check if external network call fails
        }
      }

      if (!isPasswordValid) {
        return NextResponse.json(
          {
            authenticated: false,
            code: 'INVALID_CREDENTIALS',
            message: 'Email atau kata sandi Admin tidak sesuai.',
          },
          { status: 401 }
        );
      }

      verifiedEmail = normalizedEmail;
    }

    // 4. Pastikan pengguna terdaftar sebagai Admin aktif di tabel public.admins
    const [adminUser] = await db
      .select()
      .from(admins)
      .where(eq(admins.email, verifiedEmail))
      .limit(1);

    if (!adminUser) {
      return NextResponse.json(
        {
          authenticated: false,
          code: 'ADMIN_NOT_FOUND',
          message:
            'Akses ditolak: Email tidak terdaftar sebagai Administrator ZIPBLIND. Registrasi publik tidak diizinkan.',
        },
        { status: 403 }
      );
    }

    if (!adminUser.isActive) {
      return NextResponse.json(
        {
          authenticated: false,
          code: 'ADMIN_INACTIVE',
          message: 'Akses ditolak: Akun Administrator ini sedang dinonaktifkan.',
        },
        { status: 403 }
      );
    }

    // 5. Buat token sesi Admin bertanda tangan HMAC-SHA256
    const effectiveTtl =
      typeof ttlSeconds === 'number' && ttlSeconds >= -3600 && ttlSeconds <= 86400
        ? ttlSeconds
        : 8 * 60 * 60; // default 8 jam

    const { token, expiresAtIso } = createAdminSessionToken(
      {
        id: adminUser.id,
        email: adminUser.email,
        fullName: adminUser.fullName,
      },
      getServerSessionSecret(),
      effectiveTtl
    );

    // 6. Catat log login ke tabel public.admin_activity_logs
    await logAdminSecurityActivity({
      adminId: adminUser.id,
      actionType: 'ADMIN_LOGIN',
      entityName: 'admins',
      entityId: adminUser.id,
      description: `Admin ${adminUser.fullName} (${adminUser.email}) berhasil login ke sistem.`,
      metadata: {
        role: 'admin',
        expiresAt: expiresAtIso,
      },
    });

    const response = NextResponse.json({
      authenticated: true,
      code: 'LOGIN_SUCCESS',
      message: `Selamat datang kembali, ${adminUser.fullName}.`,
      role: 'admin',
      admin: {
        id: adminUser.id,
        fullName: adminUser.fullName,
        email: adminUser.email,
        avatarUrl: adminUser.avatarUrl || '/images/ref_admin_avatar.png',
      },
      expiresAt: expiresAtIso,
      sessionToken: token,
    });

    response.cookies.set(ADMIN_SESSION_COOKIE_NAME, token, {
      httpOnly: true,
      sameSite: 'lax',
      path: '/',
      maxAge: Math.max(effectiveTtl, 60),
    });

    return response;
  } catch (error) {
    console.error('Error pada POST /api/auth/login:', error);
    return NextResponse.json(
      {
        authenticated: false,
        code: 'INTERNAL_ERROR',
        message: 'Terjadi kesalahan saat memproses autentikasi Admin.',
      },
      { status: 500 }
    );
  }
}
