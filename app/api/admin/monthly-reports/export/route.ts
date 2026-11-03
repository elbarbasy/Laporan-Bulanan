import { NextRequest, NextResponse } from 'next/server';
import { desc } from 'drizzle-orm';
import { db } from '@/src/db';
import { projectPhotos, reportExportLogs } from '@/src/db/schema';
import { validateAdminRequestSession } from '@/src/lib/server-auth';
import { getOperationalSnapshot } from '@/src/lib/operational-db';
import { decodePhotoCaptionMetadata } from '@/lib/zipblind-gallery';
import {
  buildOfficialMonthlyReport,
  generateMonthlyReportExcelBuffer,
  generateMonthlyReportPdfBuffer,
} from '@/lib/zipblind-monthly-report';

export async function GET(req: NextRequest) {
  const authCheck = await validateAdminRequestSession(req);
  if (!authCheck.authenticated || !authCheck.admin) {
    return NextResponse.json(
      { error: authCheck.message, code: authCheck.code },
      { status: authCheck.status }
    );
  }

  try {
    const { searchParams } = new URL(req.url);
    const periodMonth = (searchParams.get('period') || '2026-11').slice(0, 7);
    const rawFormat = (searchParams.get('format') || 'PDF').toUpperCase();
    const exportFormat: 'PDF' | 'EXCEL' = rawFormat === 'EXCEL' ? 'EXCEL' : 'PDF';

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
    const fileName = `Laporan-Bulanan-ZIPBLIND-${periodMonth}.${fileExt}`;

    // Catat riwayat ekspor ke tabel report_export_logs di PostgreSQL
    await db.insert(reportExportLogs).values({
      reportPeriodMonth: `${periodMonth}-01`,
      reportTitle: `Laporan Operasional Bulanan — ${report.periodLabel}`,
      exportFormat,
      exportedByRole: 'admin',
      adminId: authCheck.admin.id,
      fileStoragePath: `/exports/${fileName}`,
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
    console.error('Error GET /api/admin/monthly-reports/export:', err);
    return NextResponse.json(
      { error: 'Gagal menghasilkan dokumen ekspor laporan bulanan.' },
      { status: 500 }
    );
  }
}
