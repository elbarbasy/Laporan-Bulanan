import { NextRequest, NextResponse } from 'next/server';
import fs from 'node:fs/promises';
import path from 'node:path';
import { eq } from 'drizzle-orm';
import { db } from '@/src/db';
import { executiveSecretLinks, projectPhotos } from '@/src/db/schema';
import {
  hashSecretToken,
  isWellFormedSecretToken,
  validateSecretLinkRecord,
} from '@/lib/zipblind-auth';
import { validateAdminRequestSession } from '@/src/lib/server-auth';

const STORAGE_BUCKET_NAME = 'project-photos';
const LOCAL_STORAGE_ROOT = path.join(process.cwd(), 'public', 'storage', STORAGE_BUCKET_NAME);

export async function GET(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const rawToken =
    req.nextUrl.searchParams.get('token') ||
    req.headers.get('x-executive-token') ||
    '';

  let authorized = false;

  if (rawToken.trim() && isWellFormedSecretToken(rawToken)) {
    const incomingHash = hashSecretToken(rawToken);
    const [record] = await db
      .select()
      .from(executiveSecretLinks)
      .where(eq(executiveSecretLinks.tokenHash, incomingHash))
      .limit(1);
    const validation = validateSecretLinkRecord(record, rawToken, new Date());
    if (validation.valid && record) {
      authorized = true;
    }
  }

  if (!authorized) {
    const authCheck = await validateAdminRequestSession(req);
    if (!authCheck.authenticated) {
      return NextResponse.json(
        { error: authCheck.message, code: authCheck.code },
        { status: authCheck.status }
      );
    }
  }

  const { id } = await context.params;
  if (!id) {
    return NextResponse.json({ error: 'ID foto tidak valid.' }, { status: 400 });
  }

  const [photoRow] = await db
    .select()
    .from(projectPhotos)
    .where(eq(projectPhotos.id, id))
    .limit(1);

  if (!photoRow) {
    return NextResponse.json(
      { error: 'Data foto tidak ditemukan di database.' },
      { status: 404 }
    );
  }

  const absoluteFilePath = path.join(LOCAL_STORAGE_ROOT, photoRow.storagePath);
  try {
    const fileBuffer = await fs.readFile(absoluteFilePath);
    const isDownload = req.nextUrl.searchParams.get('download') === '1';
    const disposition = isDownload
      ? `attachment; filename="${photoRow.fileName}"`
      : `inline; filename="${photoRow.fileName}"`;

    return new NextResponse(fileBuffer, {
      status: 200,
      headers: {
        'Content-Type': photoRow.mimeType || 'image/png',
        'Content-Length': String(fileBuffer.length),
        'Content-Disposition': disposition,
        'Cache-Control': 'private, max-age=3600',
      },
    });
  } catch {
    return NextResponse.json(
      { error: 'File fisik foto tidak ditemukan di storage bucket.' },
      { status: 404 }
    );
  }
}
