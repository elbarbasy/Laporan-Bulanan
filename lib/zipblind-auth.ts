import crypto from 'node:crypto';

// ============================================================================
// TIPE DATA AUTENTIKASI & OTORISASI ZIPBLIND (TAHAP 3)
// ============================================================================

export type ZipblindAccessRole = 'admin' | 'executive';

export interface AdminSessionPayload {
  adminId: string;
  email: string;
  fullName: string;
  role: 'admin';
  iat: number; // unix timestamp (detik)
  exp: number; // unix timestamp (detik)
}

export interface SessionVerificationResult {
  valid: boolean;
  code:
    | 'VALID'
    | 'MISSING_TOKEN'
    | 'INVALID_FORMAT'
    | 'INVALID_SIGNATURE'
    | 'SESSION_EXPIRED'
    | 'FORBIDDEN_ROLE';
  message: string;
  payload?: AdminSessionPayload;
}

export interface SecretLinkRecordInput {
  id: string;
  label: string;
  tokenHash: string;
  tokenPrefix: string;
  canDownloadReports: boolean;
  expiresAt: Date | string;
  isRevoked: boolean;
  revokedAt?: Date | string | null;
  lastAccessedAt?: Date | string | null;
}

export interface SecretLinkValidationResult {
  valid: boolean;
  status: 200 | 401 | 403;
  code:
    | 'VALID'
    | 'TOKEN_MISSING'
    | 'TOKEN_INVALID_FORMAT'
    | 'TOKEN_NOT_FOUND'
    | 'TOKEN_REVOKED'
    | 'TOKEN_EXPIRED';
  message: string;
  role?: 'executive';
  readOnly?: true;
  canDownloadReports?: boolean;
}

export interface RoleAuthorizationResult {
  allowed: boolean;
  status: 200 | 401 | 403;
  code:
    | 'ALLOWED'
    | 'UNAUTHENTICATED'
    | 'TECHNICIAN_NO_ACCOUNT'
    | 'FORBIDDEN_ROLE'
    | 'FORBIDDEN_READ_ONLY'
    | 'PUBLIC_REGISTRATION_DISABLED';
  message: string;
}

// ============================================================================
// 1. SECRET LINK PIMPINAN: GENERATE & SHA-256 HASHING
// ============================================================================

/**
 * Menghasilkan hash SHA-256 (64 karakter hex) dari raw secret token.
 * Raw token tidak pernah disimpan di database; hanya nilai hash ini yang disimpan.
 */
export function hashSecretToken(rawToken: string): string {
  const normalized = rawToken.trim();
  return crypto.createHash('sha256').update(normalized, 'utf8').digest('hex');
}

/**
 * Membuat secret token kriptografis baru (256-bit entropi = 64 karakter hex),
 * beserta prefix identifikasi (12 karakter) dan hash SHA-256 (64 karakter).
 */
export function generateSecureSecretToken(): {
  rawToken: string;
  tokenPrefix: string;
  tokenHash: string;
} {
  const randomHex = crypto.randomBytes(32).toString('hex'); // 64 hex chars
  const rawToken = `zb_exec_${randomHex}`;
  const tokenPrefix = rawToken.slice(0, 12); // 'zb_exec_xxxx' (12 chars)
  const tokenHash = hashSecretToken(rawToken);
  return {
    rawToken,
    tokenPrefix,
    tokenHash,
  };
}

/**
 * Memvalidasi apakah format raw token pimpinan layak diproses sebelum di-hash.
 */
export function isWellFormedSecretToken(rawToken: unknown): rawToken is string {
  if (typeof rawToken !== 'string') return false;
  const trimmed = rawToken.trim();
  // Minimal 24 karakter dan hanya karakter URL-safe (alphanumeric, underscore, hyphen)
  return trimmed.length >= 24 && trimmed.length <= 160 && /^[a-zA-Z0-9_-]+$/.test(trimmed);
}

/**
 * Memvalidasi rekaman secret link dari database terhadap waktu sekarang dan hash token.
 */
export function validateSecretLinkRecord(
  record: SecretLinkRecordInput | null | undefined,
  rawToken: string,
  now: Date = new Date()
): SecretLinkValidationResult {
  if (!rawToken || typeof rawToken !== 'string' || !rawToken.trim()) {
    return {
      valid: false,
      status: 401,
      code: 'TOKEN_MISSING',
      message: 'Token secret link tidak disertakan pada permintaan.',
    };
  }

  if (!isWellFormedSecretToken(rawToken)) {
    return {
      valid: false,
      status: 401,
      code: 'TOKEN_INVALID_FORMAT',
      message: 'Format token secret link tidak valid.',
    };
  }

  if (!record) {
    return {
      valid: false,
      status: 401,
      code: 'TOKEN_NOT_FOUND',
      message: 'Akses ditolak: Token secret link tidak ditemukan atau tidak terdaftar.',
    };
  }

  // Bandingkan hash secara timing-safe
  const incomingHash = hashSecretToken(rawToken);
  const storedHash = record.tokenHash.trim();
  const isHashMatch =
    incomingHash.length === storedHash.length &&
    crypto.timingSafeEqual(Buffer.from(incomingHash, 'utf8'), Buffer.from(storedHash, 'utf8'));

  if (!isHashMatch) {
    return {
      valid: false,
      status: 401,
      code: 'TOKEN_NOT_FOUND',
      message: 'Akses ditolak: Token secret link tidak cocok.',
    };
  }

  if (record.isRevoked) {
    return {
      valid: false,
      status: 403,
      code: 'TOKEN_REVOKED',
      message: 'Akses ditolak: Secret link ini telah dicabut (nonaktif) oleh Administrator.',
    };
  }

  const expiresAtMs = new Date(record.expiresAt).getTime();
  if (Number.isNaN(expiresAtMs) || expiresAtMs <= now.getTime()) {
    return {
      valid: false,
      status: 403,
      code: 'TOKEN_EXPIRED',
      message: 'Akses ditolak: Masa berlaku secret link pimpinan telah kedaluwarsa.',
    };
  }

  return {
    valid: true,
    status: 200,
    code: 'VALID',
    message: 'Token secret link valid. Akses Read-Only Pimpinan diizinkan.',
    role: 'executive',
    readOnly: true,
    canDownloadReports: Boolean(record.canDownloadReports),
  };
}

// ============================================================================
// 2. MANAJEMEN SESI ADMIN (SIGNED HMAC-SHA256 TOKEN & EXPIRATION HANDLING)
// ============================================================================

function base64UrlEncode(input: string | Buffer): string {
  return Buffer.from(input)
    .toString('base64')
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');
}

function base64UrlDecode(input: string): string {
  const padded = input.replace(/-/g, '+').replace(/_/g, '/');
  const padLength = (4 - (padded.length % 4)) % 4;
  return Buffer.from(padded + '='.repeat(padLength), 'base64').toString('utf8');
}

/**
 * Membuat token sesi Admin yang ditandatangani dengan HMAC-SHA256.
 * Mendukung pengaturan masa berlaku (default 8 jam = 28800 detik).
 */
export function createAdminSessionToken(
  admin: { id: string; email: string; fullName: string },
  secret: string,
  ttlSeconds: number = 8 * 60 * 60,
  now: Date = new Date()
): { token: string; payload: AdminSessionPayload; expiresAtIso: string } {
  const iat = Math.floor(now.getTime() / 1000);
  const exp = iat + ttlSeconds;

  const header = base64UrlEncode(JSON.stringify({ alg: 'HS256', typ: 'ZB_SESSION' }));
  const payloadObj: AdminSessionPayload = {
    adminId: admin.id,
    email: admin.email.toLowerCase().trim(),
    fullName: admin.fullName,
    role: 'admin',
    iat,
    exp,
  };
  const payload = base64UrlEncode(JSON.stringify(payloadObj));
  const signingInput = `${header}.${payload}`;
  const signature = base64UrlEncode(
    crypto.createHmac('sha256', secret).update(signingInput, 'utf8').digest()
  );

  return {
    token: `${signingInput}.${signature}`,
    payload: payloadObj,
    expiresAtIso: new Date(exp * 1000).toISOString(),
  };
}

/**
 * Memvalidasi token sesi Admin, memeriksa keaslian tanda tangan kriptografis,
 * memeriksa masa berlaku sesi (session expiration), serta memastikan role === 'admin'.
 */
export function verifyAdminSessionToken(
  token: string | undefined | null,
  secret: string,
  now: Date = new Date()
): SessionVerificationResult {
  if (!token || typeof token !== 'string' || !token.trim()) {
    return {
      valid: false,
      code: 'MISSING_TOKEN',
      message: 'Sesi login tidak ditemukan. Silakan login sebagai Admin terlebih dahulu.',
    };
  }

  const parts = token.trim().split('.');
  if (parts.length !== 3) {
    return {
      valid: false,
      code: 'INVALID_FORMAT',
      message: 'Format token sesi tidak valid.',
    };
  }

  const [headerB64, payloadB64, signatureB64] = parts;
  const signingInput = `${headerB64}.${payloadB64}`;
  const expectedSig = base64UrlEncode(
    crypto.createHmac('sha256', secret).update(signingInput, 'utf8').digest()
  );

  const sigBuf = Buffer.from(signatureB64, 'utf8');
  const expectedBuf = Buffer.from(expectedSig, 'utf8');
  if (sigBuf.length !== expectedBuf.length || !crypto.timingSafeEqual(sigBuf, expectedBuf)) {
    return {
      valid: false,
      code: 'INVALID_SIGNATURE',
      message: 'Tanda tangan sesi tidak valid atau telah dimodifikasi.',
    };
  }

  try {
    const decoded = JSON.parse(base64UrlDecode(payloadB64)) as Partial<AdminSessionPayload>;
    if (
      !decoded ||
      typeof decoded.adminId !== 'string' ||
      typeof decoded.email !== 'string' ||
      typeof decoded.exp !== 'number'
    ) {
      return {
        valid: false,
        code: 'INVALID_FORMAT',
        message: 'Muatan sesi tidak lengkap.',
      };
    }

    if (decoded.role !== 'admin') {
      return {
        valid: false,
        code: 'FORBIDDEN_ROLE',
        message: 'Akses ditolak: Hanya role Admin yang diizinkan mengakses halaman ini.',
      };
    }

    const nowSec = Math.floor(now.getTime() / 1000);
    if (decoded.exp <= nowSec) {
      return {
        valid: false,
        code: 'SESSION_EXPIRED',
        message: 'Sesi login Anda telah kedaluwarsa. Silakan login kembali.',
      };
    }

    return {
      valid: true,
      code: 'VALID',
      message: 'Sesi Admin valid dan aktif.',
      payload: decoded as AdminSessionPayload,
    };
  } catch {
    return {
      valid: false,
      code: 'INVALID_FORMAT',
      message: 'Gagal membaca muatan token sesi.',
    };
  }
}

// ============================================================================
// 3. PEMBATASAN AKSES BERDASARKAN ROLE (RBAC GUARD)
// ============================================================================

/**
 * Memeriksa hak akses berdasarkan role ('admin' | 'executive' | 'technician' | null),
 * metode HTTP, dan cakupan rute ('admin' | 'executive' | 'public_register').
 */
export function authorizeRoleAccess(params: {
  role: string | null | undefined;
  httpMethod: string;
  targetScope: 'admin' | 'executive' | 'public_register';
  canDownloadReports?: boolean;
  isReportDownloadRequest?: boolean;
}): RoleAuthorizationResult {
  const method = params.httpMethod.toUpperCase();

  // 1. Larangan mutlak registrasi publik sesuai spesifikasi PROMPT 3
  if (params.targetScope === 'public_register') {
    return {
      allowed: false,
      status: 403,
      code: 'PUBLIC_REGISTRATION_DISABLED',
      message: 'Fitur registrasi publik dinonaktifkan. Hanya Admin terdaftar yang memiliki akun.',
    };
  }

  // 2. Larangan mutlak akun/login teknisi sesuai spesifikasi PROMPT 3
  if (params.role === 'technician' || params.role === 'teknisi') {
    return {
      allowed: false,
      status: 403,
      code: 'TECHNICIAN_NO_ACCOUNT',
      message: 'Akses ditolak: Teknisi tidak memiliki akun dan tidak memiliki akses login.',
    };
  }

  // 3. Jika belum terautentikasi sama sekali
  if (!params.role) {
    return {
      allowed: false,
      status: 401,
      code: 'UNAUTHENTICATED',
      message: 'Akses ditolak: Autentikasi diperlukan.',
    };
  }

  // 4. Evaluasi akses ke halaman/endpoint Admin
  if (params.targetScope === 'admin') {
    if (params.role !== 'admin') {
      return {
        allowed: false,
        status: 403,
        code: 'FORBIDDEN_ROLE',
        message: 'Akses ditolak: Hanya Admin yang memiliki akses ke menu dan pengelolaan data admin.',
      };
    }
    return {
      allowed: true,
      status: 200,
      code: 'ALLOWED',
      message: 'Akses Admin diizinkan.',
    };
  }

  // 5. Evaluasi akses ke Portal Pimpinan (Executive)
  if (params.targetScope === 'executive') {
    if (params.role === 'admin') {
      return {
        allowed: true,
        status: 200,
        code: 'ALLOWED',
        message: 'Akses Admin ke pratinjau Portal Pimpinan diizinkan.',
      };
    }

    if (params.role === 'executive') {
      // Pimpinan TIDAK BOLEH melakukan perubahan data (POST, PUT, PATCH, DELETE ditolak)
      const isReadOnlyMethod = method === 'GET' || method === 'HEAD';
      if (!isReadOnlyMethod) {
        return {
          allowed: false,
          status: 403,
          code: 'FORBIDDEN_READ_ONLY',
          message:
            'Akses ditolak: Pimpinan hanya memiliki akses Read-Only dan dilarang mengubah data operasional.',
        };
      }

      if (params.isReportDownloadRequest && params.canDownloadReports === false) {
        return {
          allowed: false,
          status: 403,
          code: 'FORBIDDEN_READ_ONLY',
          message: 'Akses ditolak: Token secret link ini tidak memiliki izin unduh laporan.',
        };
      }

      return {
        allowed: true,
        status: 200,
        code: 'ALLOWED',
        message: 'Akses Read-Only Pimpinan diizinkan.',
      };
    }
  }

  return {
    allowed: false,
    status: 403,
    code: 'FORBIDDEN_ROLE',
    message: 'Role pengguna tidak dikenali dalam spesifikasi ZIPBLIND.',
  };
}
