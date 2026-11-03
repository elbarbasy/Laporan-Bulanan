import { NextRequest, NextResponse } from 'next/server';
import { desc, eq } from 'drizzle-orm';
import { db } from '@/src/db';
import {
  executiveAccessLogs,
  executiveSecretLinks,
} from '@/src/db/schema';
import {
  authorizeRoleAccess,
  generateSecureSecretToken,
} from '@/lib/zipblind-auth';
import {
  logAdminSecurityActivity,
  validateAdminRequestSession,
} from '@/src/lib/server-auth';

async function requireAdmin(req: NextRequest) {
  // Jika request mencoba menggunakan header executive role, tolak dengan RBAC 403
  const requestedRole = req.headers.get('x-zipblind-role');
  if (requestedRole && requestedRole !== 'admin') {
    const rbac = authorizeRoleAccess({
      role: requestedRole,
      httpMethod: req.method,
      targetScope: 'admin',
    });
    return {
      ok: false as const,
      response: NextResponse.json(
        { code: rbac.code, message: rbac.message },
        { status: rbac.status }
      ),
    };
  }

  const sessionCheck = await validateAdminRequestSession(req);
  if (!sessionCheck.authenticated || !sessionCheck.admin) {
    return {
      ok: false as const,
      response: NextResponse.json(
        {
          authenticated: false,
          code: sessionCheck.code,
          message: sessionCheck.message,
        },
        { status: sessionCheck.status }
      ),
    };
  }

  return { ok: true as const, admin: sessionCheck.admin };
}

export async function GET(req: NextRequest) {
  const guard = await requireAdmin(req);
  if (!guard.ok) return guard.response;

  try {
    const links = await db
      .select({
        id: executiveSecretLinks.id,
        label: executiveSecretLinks.label,
        tokenPrefix: executiveSecretLinks.tokenPrefix,
        tokenHash: executiveSecretLinks.tokenHash,
        canDownloadReports: executiveSecretLinks.canDownloadReports,
        expiresAt: executiveSecretLinks.expiresAt,
        isRevoked: executiveSecretLinks.isRevoked,
        revokedAt: executiveSecretLinks.revokedAt,
        lastAccessedAt: executiveSecretLinks.lastAccessedAt,
        createdAt: executiveSecretLinks.createdAt,
      })
      .from(executiveSecretLinks)
      .orderBy(desc(executiveSecretLinks.createdAt));

    const accessLogs = await db
      .select({
        id: executiveAccessLogs.id,
        secretLinkId: executiveAccessLogs.secretLinkId,
        accessAction: executiveAccessLogs.accessAction,
        ipAddress: executiveAccessLogs.ipAddress,
        accessedAt: executiveAccessLogs.accessedAt,
      })
      .from(executiveAccessLogs)
      .orderBy(desc(executiveAccessLogs.accessedAt))
      .limit(15);

    return NextResponse.json({
      secretLinks: links,
      accessLogs,
    });
  } catch (error) {
    console.error('Error pada GET /api/admin/secret-links:', error);
    return NextResponse.json(
      { code: 'INTERNAL_ERROR', message: 'Gagal memuat daftar secret link pimpinan.' },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  const guard = await requireAdmin(req);
  if (!guard.ok) return guard.response;

  try {
    const body = await req.json().catch(() => ({}));
    const label =
      typeof body.label === 'string' && body.label.trim()
        ? body.label.trim().slice(0, 120)
        : 'Akses Eksekutif Pimpinan ZIPBLIND';

    const expiresInDays =
      typeof body.expiresInDays === 'number' && body.expiresInDays !== 0
        ? body.expiresInDays
        : 30;

    const canDownloadReports =
      typeof body.canDownloadReports === 'boolean' ? body.canDownloadReports : true;

    const { rawToken, tokenPrefix, tokenHash } = generateSecureSecretToken();
    const expiresAt = new Date(Date.now() + expiresInDays * 24 * 60 * 60 * 1000);

    const [inserted] = await db
      .insert(executiveSecretLinks)
      .values({
        label,
        tokenHash,
        tokenPrefix,
        canDownloadReports,
        expiresAt,
        isRevoked: false,
        createdBy: guard.admin.id,
      })
      .returning({
        id: executiveSecretLinks.id,
        label: executiveSecretLinks.label,
        tokenPrefix: executiveSecretLinks.tokenPrefix,
        tokenHash: executiveSecretLinks.tokenHash,
        canDownloadReports: executiveSecretLinks.canDownloadReports,
        expiresAt: executiveSecretLinks.expiresAt,
        isRevoked: executiveSecretLinks.isRevoked,
        createdAt: executiveSecretLinks.createdAt,
      });

    await logAdminSecurityActivity({
      adminId: guard.admin.id,
      actionType: 'CREATE_SECRET_LINK',
      entityName: 'executive_secret_links',
      entityId: inserted.id,
      description: `Admin ${guard.admin.fullName} membuat secret link baru "${label}" (Prefix: ${tokenPrefix}..., Hash SHA-256 tersimpan).`,
      metadata: {
        tokenPrefix,
        expiresAt: expiresAt.toISOString(),
        canDownloadReports,
      },
    });

    return NextResponse.json(
      {
        code: 'SECRET_LINK_CREATED',
        message:
          'Secret link pimpinan baru berhasil dibuat. Salin tautan sekarang karena raw token hanya ditampilkan satu kali dan hanya disimpan dalam bentuk hash SHA-256 di database.',
        secretLink: inserted,
        // Raw token hanya dikirim pada respons pembuatan (tidak pernah disimpan di DB)
        rawToken,
        secretPath: `/executive/${rawToken}`,
      },
      { status: 201 }
    );
  } catch (error) {
    console.error('Error pada POST /api/admin/secret-links:', error);
    return NextResponse.json(
      { code: 'INTERNAL_ERROR', message: 'Gagal membuat secret link pimpinan baru.' },
      { status: 500 }
    );
  }
}

export async function PATCH(req: NextRequest) {
  const guard = await requireAdmin(req);
  if (!guard.ok) return guard.response;

  try {
    const body = await req.json().catch(() => ({}));
    const {
      id,
      action,
      expiresInDays,
    }: {
      id?: string;
      action?: 'revoke' | 'extend' | 'expire_now';
      expiresInDays?: number;
    } = body;

    if (!id || typeof id !== 'string') {
      return NextResponse.json(
        { code: 'MISSING_ID', message: 'ID secret link wajib disertakan.' },
        { status: 400 }
      );
    }

    const [existing] = await db
      .select()
      .from(executiveSecretLinks)
      .where(eq(executiveSecretLinks.id, id))
      .limit(1);

    if (!existing) {
      return NextResponse.json(
        { code: 'NOT_FOUND', message: 'Data secret link tidak ditemukan.' },
        { status: 404 }
      );
    }

    if (action === 'revoke') {
      const [updated] = await db
        .update(executiveSecretLinks)
        .set({
          isRevoked: true,
          revokedAt: new Date(),
          revokedBy: guard.admin.id,
        })
        .where(eq(executiveSecretLinks.id, id))
        .returning();

      await logAdminSecurityActivity({
        adminId: guard.admin.id,
        actionType: 'REVOKE_SECRET_LINK',
        entityName: 'executive_secret_links',
        entityId: id,
        description: `Admin ${guard.admin.fullName} mencabut akses secret link "${existing.label}" (${existing.tokenPrefix}...).`,
      });

      return NextResponse.json({
        code: 'SECRET_LINK_REVOKED',
        message: `Akses secret link "${existing.label}" berhasil dicabut.`,
        secretLink: updated,
      });
    }

    if (action === 'extend') {
      const days = typeof expiresInDays === 'number' && expiresInDays > 0 ? expiresInDays : 30;
      const newExpiry = new Date(Date.now() + days * 24 * 60 * 60 * 1000);

      const [updated] = await db
        .update(executiveSecretLinks)
        .set({
          expiresAt: newExpiry,
          isRevoked: false,
          revokedAt: null,
          revokedBy: null,
        })
        .where(eq(executiveSecretLinks.id, id))
        .returning();

      await logAdminSecurityActivity({
        adminId: guard.admin.id,
        actionType: 'EXTEND_SECRET_LINK',
        entityName: 'executive_secret_links',
        entityId: id,
        description: `Admin ${guard.admin.fullName} memperbarui masa berlaku secret link "${existing.label}" hingga ${newExpiry.toISOString()}.`,
      });

      return NextResponse.json({
        code: 'SECRET_LINK_EXTENDED',
        message: `Masa berlaku secret link "${existing.label}" berhasil diperbarui (+${days} hari).`,
        secretLink: updated,
      });
    }

    if (action === 'expire_now') {
      const pastDate = new Date(Date.now() - 24 * 60 * 60 * 1000);
      const [updated] = await db
        .update(executiveSecretLinks)
        .set({
          expiresAt: pastDate,
        })
        .where(eq(executiveSecretLinks.id, id))
        .returning();

      await logAdminSecurityActivity({
        adminId: guard.admin.id,
        actionType: 'EXPIRE_SECRET_LINK',
        entityName: 'executive_secret_links',
        entityId: id,
        description: `Masa berlaku secret link "${existing.label}" diatur menjadi kedaluwarsa untuk pengujian keamanan.`,
      });

      return NextResponse.json({
        code: 'SECRET_LINK_EXPIRED_SET',
        message: `Secret link "${existing.label}" kini berstatus kedaluwarsa.`,
        secretLink: updated,
      });
    }

    return NextResponse.json(
      { code: 'INVALID_ACTION', message: 'Aksi pengelolaan secret link tidak valid.' },
      { status: 400 }
    );
  } catch (error) {
    console.error('Error pada PATCH /api/admin/secret-links:', error);
    return NextResponse.json(
      { code: 'INTERNAL_ERROR', message: 'Gagal memperbarui status secret link.' },
      { status: 500 }
    );
  }
}
