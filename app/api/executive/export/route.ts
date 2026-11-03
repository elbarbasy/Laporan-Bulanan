import { NextRequest, NextResponse } from 'next/server';
import { desc, eq } from 'drizzle-orm';
import { db } from '@/src/db';
import {
  executiveAccessLogs,
  executiveSecretLinks,
  projectPhotos,
  reportExportLogs,
} from '@/src/db/schema';
import {
  hashSecretToken,
  isWellFormedSecretToken,
  validateSecretLinkRecord,
} from '@/lib/zipblind-auth';
import { validateAdminRequestSession } from '@/src/lib/server-auth';
import { getOperationalSnapshot } from '@/src/lib/operational-db';
import { decodePhotoCaptionMetadata } from '@/lib/zipblind-gallery';
import {
  buildOfficialMonthlyReport,
  generateMonthlyReportExcelBuffer,
  generateMonthlyReportPdfBuffer,
} from '@/lib/zipblind-monthly-report';
import { enforceExecutiveReadOnlyGuard } from '@/lib/zipblind-executive';

export async function GET(req: NextRequest) {
  try {
    const rawToken =
      req.nextUrl.searchParams.get('token') ||
      req.headers.get('x-executive-token') ||
      '';
    const periodMonth = (req.nextUrl.searchParams.get('period') || '2026-11').slice(0, 7);
    const rawFormat = (req.nextUrl.searchParams.get('format') || 'PDF').toUpperCase();
    const exportFormat: 'PDF' | 'EXCEL' = rawFormat === 'EXCEL' ? 'EXCEL' : 'PDF';

    let secretLinkId: string | null = null;
    let adminId: string | null = null;
    let exportedByRole: 'executive' | 'admin' = 'executive';

    if (rawToken.trim()) {
      if (!isWellFormedSecretToken(rawToken)) {
        return NextResponse.json(
          {
            valid: false,
            code: 'TOKEN_INVALID_FORMAT',
            message: 'Akses unduh ditolak: Format token secret link tidak valid.',
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

      const guard = enforceExecutiveReadOnlyGuard({
        httpMethod: 'GET',
        attemptedOperation: exportFormat === 'PDF' ? 'download_pdf' : 'download_excel',
        canDownloadReports: record.canDownloadReports,
      });

      if (!guard.allowed) {
        return NextResponse.json(
          {
            valid: false,
            code: guard.code,
            message: guard.message,
          },
          { status: guard.status }
        );
      }

      secretLinkId = record.id;
      exportedByRole = 'executive';

      const forwardedFor = req.headers.get('x-forwarded-for');
      const ipAddress = forwardedFor
        ? forwardedFor.split(',')[0].trim().slice(0, 64)
        : '127.0.0.1';
      const userAgent = req.headers.get('user-agent') || 'ZIPBLIND-Executive-Portal';

      await db.insert(executiveAccessLogs).values({
        secretLinkId: record.id,
        accessAction: exportFormat === 'PDF' ? 'download_pdf' : 'download_excel',
        ipAddress,
        userAgent,
      });
    } else {
      const adminSession = await validateAdminRequestSession(req);
      if (!adminSession.authenticated || !adminSession.admin) {
        return NextResponse.json(
          {
            valid: false,
            code: 'TOKEN_MISSING',
            message:
              'Akses unduh ditolak: Token secret link pimpinan wajib disertakan.',
          },
          { status: 401 }
        );
      }
      adminId = adminSession.admin.id;
      exportedByRole = 'admin';
    }

    const snapshot = await getOperationalSnapshot();
    const rawPhotos = await db
      .select()
      .from(projectPhotos)
      .orderBy(desc(projectPhotos.uploadedAt));

    const projectMap = new Map(snapshot.projects.map((p) => [p.id, p]));
    const activityMap = new Map(snapshot.activities.map((a) => [a.id, a]));

    const formattedPhotos = rawPhotos.map((ph) => {
      const proj = projectMap.get(ph.projectId);
      const act = ph.activityId ? activityMap.get(ph.activityId) : undefined;
      const decoded = decodePhotoCaptionMetadata(ph.category, ph.caption);

      return {
        id: ph.id,
        projectId: ph.projectId,
        projectCode: proj?.projectCode || 'PRJ-ZB',
        projectTitle: proj?.title || 'Proyek ZIPBLIND',
        activityId: ph.activityId,
        activityType: act?.activityType || decoded.documentationCategory,
        activityDate: act?.startDate || proj?.startDate || '2026-11-10',
        documentationCategory: decoded.documentationCategory,
        caption: decoded.cleanCaption,
        uploadedAt: ph.uploadedAt.toISOString(),
        imageUrl: `/api/admin/gallery/download/${ph.id}`,
      };
    });

    const report = buildOfficialMonthlyReport({
      periodMonth,
      activities: snapshot.activities,
      projects: snapshot.projects,
      technicians: snapshot.technicians,
      products: snapshot.products,
      photos: formattedPhotos,
    });

    const fileExt = exportFormat === 'PDF' ? 'pdf' : 'xls';
    const fileName = `Laporan-Eksekutif-ZIPBLIND-${periodMonth}.${fileExt}`;

    await db.insert(reportExportLogs).values({
      reportPeriodMonth: `${periodMonth}-01`,
      reportTitle: `Laporan Operasional Bulanan — ${report.periodLabel}`,
      exportFormat,
      exportedByRole,
      adminId,
      secretLinkId,
      fileStoragePath: `/exports/executive/${fileName}`,
    });

    if (exportFormat === 'PDF') {
      const pdfBuffer = generateMonthlyReportPdfBuffer(report);
      return new NextResponse(new Uint8Array(pdfBuffer), {
        status: 200,
        headers: {
          'Content-Type': 'application/pdf',
          'Content-Disposition': `attachment; filename="${fileName}"`,
          'Cache-Control': 'no-store',
        },
      });
    }

    const excelBuffer = generateMonthlyReportExcelBuffer(report);
    return new NextResponse(new Uint8Array(excelBuffer), {
      status: 200,
      headers: {
        'Content-Type': 'application/vnd.ms-excel; charset=utf-8',
        'Content-Disposition': `attachment; filename="${fileName}"`,
        'Cache-Control': 'no-store',
      },
    });
  } catch (err) {
    console.error('Error GET /api/executive/export:', err);
    return NextResponse.json(
      {
        valid: false,
        code: 'EXPORT_ERROR',
        message: 'Gagal mengunduh dokumen laporan pada Portal Pimpinan.',
      },
      { status: 500 }
    );
  }
}
