import { NextRequest, NextResponse } from 'next/server';
import { eq } from 'drizzle-orm';
import { db } from '@/src/db';
import {
  executiveAccessLogs,
  executiveSecretLinks,
} from '@/src/db/schema';
import {
  authorizeRoleAccess,
  hashSecretToken,
  isWellFormedSecretToken,
  validateSecretLinkRecord,
} from '@/lib/zipblind-auth';

type AllowedAccessAction = 'view_dashboard' | 'download_pdf' | 'download_excel';

async function handleValidateToken(
  req: NextRequest,
  rawToken: string,
  accessAction: AllowedAccessAction = 'view_dashboard'
) {
  if (!rawToken || !rawToken.trim()) {
    return NextResponse.json(
      {
        valid: false,
        code: 'TOKEN_MISSING',
        message: 'Token secret link pimpinan wajib disertakan.',
      },
      { status: 401 }
    );
  }

  if (!isWellFormedSecretToken(rawToken)) {
    return NextResponse.json(
      {
        valid: false,
        code: 'TOKEN_INVALID_FORMAT',
        message: 'Akses ditolak: Format token secret link tidak valid.',
      },
      { status: 401 }
    );
  }

  const incomingHash = hashSecretToken(rawToken);
  const [record] = await db
    .select()
    .from(executiveSecretLinks)
    .where(eq(executiveSecretLinks.tokenHash, incomingHash))
    .limit(1);

  const validation = validateSecretLinkRecord(record, rawToken, new Date());

  if (!validation.valid || !record) {
    return NextResponse.json(
      {
        valid: false,
        code: validation.code,
        message: validation.message,
      },
      { status: validation.status }
    );
  }

  // Cek izin unduh laporan apabila aksi adalah download_pdf atau download_excel
  const isReportDownload =
    accessAction === 'download_pdf' || accessAction === 'download_excel';

  const roleGuard = authorizeRoleAccess({
    role: 'executive',
    httpMethod: 'GET',
    targetScope: 'executive',
    canDownloadReports: record.canDownloadReports,
    isReportDownloadRequest: isReportDownload,
  });

  if (!roleGuard.allowed) {
    return NextResponse.json(
      {
        valid: false,
        code: roleGuard.code,
        message: roleGuard.message,
      },
      { status: roleGuard.status }
    );
  }

  const now = new Date();

  // Perbarui waktu akses terakhir
  await db
    .update(executiveSecretLinks)
    .set({ lastAccessedAt: now })
    .where(eq(executiveSecretLinks.id, record.id));

  // Catat ke tabel executive_access_logs sesuai skema PROMPT 2
  const forwardedFor = req.headers.get('x-forwarded-for');
  const ipAddress = forwardedFor ? forwardedFor.split(',')[0].trim().slice(0, 64) : '127.0.0.1';
  const userAgent = req.headers.get('user-agent') || 'ZIPBLIND-Executive-Client';

  await db.insert(executiveAccessLogs).values({
    secretLinkId: record.id,
    accessAction,
    ipAddress,
    userAgent,
  });

  return NextResponse.json({
    valid: true,
    code: 'VALID',
    message: validation.message,
    role: 'executive',
    readOnly: true,
    allowedActions: record.canDownloadReports
      ? ['view_dashboard', 'download_pdf', 'download_excel']
      : ['view_dashboard'],
    link: {
      id: record.id,
      label: record.label,
      tokenPrefix: record.tokenPrefix,
      canDownloadReports: record.canDownloadReports,
      expiresAt: record.expiresAt,
      lastAccessedAt: now.toISOString(),
    },
  });
}

export async function GET(req: NextRequest) {
  const token =
    req.nextUrl.searchParams.get('token') ||
    req.headers.get('x-executive-token') ||
    '';
  const actionParam = req.nextUrl.searchParams.get('action');
  const accessAction: AllowedAccessAction =
    actionParam === 'download_pdf' || actionParam === 'download_excel'
      ? actionParam
      : 'view_dashboard';

  return handleValidateToken(req, token, accessAction);
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    // Jika body berisi upaya mutasi data oleh Pimpinan (mis. operation === 'mutate_data'), tolak!
    if (body.operation === 'mutate_data' || body.intent === 'write') {
      const rbac = authorizeRoleAccess({
        role: 'executive',
        httpMethod: 'PUT',
        targetScope: 'executive',
      });
      return NextResponse.json(
        {
          allowed: false,
          code: rbac.code,
          message: rbac.message,
        },
        { status: rbac.status }
      );
    }

    const token =
      typeof body.token === 'string'
        ? body.token
        : req.headers.get('x-executive-token') || '';
    const accessAction: AllowedAccessAction =
      body.accessAction === 'download_pdf' || body.accessAction === 'download_excel'
        ? body.accessAction
        : 'view_dashboard';

    return handleValidateToken(req, token, accessAction);
  } catch (error) {
    console.error('Error pada POST /api/executive/validate:', error);
    return NextResponse.json(
      {
        valid: false,
        code: 'INTERNAL_ERROR',
        message: 'Terjadi kesalahan saat memvalidasi secret link pimpinan.',
      },
      { status: 500 }
    );
  }
}

// Semua metode perubahan data (PUT, PATCH, DELETE) oleh Pimpinan ditolak keras (403 Read-Only)
export async function PUT() {
  const rbac = authorizeRoleAccess({
    role: 'executive',
    httpMethod: 'PUT',
    targetScope: 'executive',
  });
  return NextResponse.json(
    { allowed: false, code: rbac.code, message: rbac.message },
    { status: rbac.status }
  );
}

export async function PATCH() {
  const rbac = authorizeRoleAccess({
    role: 'executive',
    httpMethod: 'PATCH',
    targetScope: 'executive',
  });
  return NextResponse.json(
    { allowed: false, code: rbac.code, message: rbac.message },
    { status: rbac.status }
  );
}

export async function DELETE() {
  const rbac = authorizeRoleAccess({
    role: 'executive',
    httpMethod: 'DELETE',
    targetScope: 'executive',
  });
  return NextResponse.json(
    { allowed: false, code: rbac.code, message: rbac.message },
    { status: rbac.status }
  );
}
