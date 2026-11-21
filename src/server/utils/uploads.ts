import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import multer from 'multer';

export const UPLOADS_ROOT = path.resolve(process.cwd(), 'uploads');

const ALLOWED_ACADEMIC_EXTS = new Set(['.pdf', '.docx', '.pptx', '.txt']);
const ALLOWED_ACADEMIC_MIMES = new Set([
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'text/plain',
]);

const ALLOWED_IMAGE_EXTS = new Set(['.jpg', '.jpeg', '.png', '.webp']);
const ALLOWED_IMAGE_MIMES = new Set(['image/jpeg', 'image/png', 'image/webp']);

export function ensureUploadDirs() {
  const dirs = ['resources', 'images', 'avatars', 'submissions'];
  for (const dir of dirs) {
    const fullPath = path.join(UPLOADS_ROOT, dir);
    if (!fs.existsSync(fullPath)) {
      fs.mkdirSync(fullPath, { recursive: true });
    }
  }
}

export function resolveSafeUploadPath(subpath: string): string | null {
  const cleaned = subpath.replace(/^\/+/, '');
  const resolved = path.resolve(UPLOADS_ROOT, cleaned);
  if (!resolved.startsWith(UPLOADS_ROOT + path.sep)) {
    return null;
  }
  return resolved;
}

export const academicUpload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024, // 10 MB max
  },
});

export const imageUpload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 4 * 1024 * 1024, // 4 MB max
  },
});

export function validateAcademicBuffer(
  buffer: Buffer,
  originalName: string,
  mimeType: string
): { valid: boolean; ext: string; error?: string } {
  const ext = path.extname(originalName).toLowerCase();
  if (!ALLOWED_ACADEMIC_EXTS.has(ext) || !ALLOWED_ACADEMIC_MIMES.has(mimeType)) {
    return {
      valid: false,
      ext,
      error: 'Only PDF, DOCX, PPTX, and TXT documents up to 10 MB are permitted.',
    };
  }

  if (buffer.length === 0) {
    return { valid: false, ext, error: 'Uploaded file is empty.' };
  }

  // Magic-byte verification
  if (ext === '.pdf') {
    const header = buffer.subarray(0, 5).toString('ascii');
    if (header !== '%PDF-') {
      return { valid: false, ext, error: 'File content does not match PDF signature.' };
    }
  } else if (ext === '.docx' || ext === '.pptx') {
    const isZip = buffer[0] === 0x50 && buffer[1] === 0x4b;
    if (!isZip) {
      return { valid: false, ext, error: 'File content does not match Office OpenXML archive.' };
    }
  } else if (ext === '.txt') {
    // Reject binary null bytes in plain text uploads
    if (buffer.subarray(0, 512).includes(0)) {
      return { valid: false, ext, error: 'Invalid characters in text document.' };
    }
  }

  return { valid: true, ext };
}

export function validateImageBuffer(
  buffer: Buffer,
  originalName: string,
  mimeType: string
): { valid: boolean; ext: string; error?: string } {
  const ext = path.extname(originalName).toLowerCase();
  if (!ALLOWED_IMAGE_EXTS.has(ext) || !ALLOWED_IMAGE_MIMES.has(mimeType)) {
    return {
      valid: false,
      ext,
      error: 'Only JPG, PNG, and WEBP images up to 4 MB are permitted.',
    };
  }

  if (buffer.length < 12) {
    return { valid: false, ext, error: 'Image file is corrupted or too small.' };
  }

  const isJpeg = buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff;
  const isPng =
    buffer[0] === 0x89 &&
    buffer[1] === 0x50 &&
    buffer[2] === 0x4e &&
    buffer[3] === 0x47;
  const isWebp =
    buffer.subarray(0, 4).toString('ascii') === 'RIFF' &&
    buffer.subarray(8, 12).toString('ascii') === 'WEBP';

  if (
    ((ext === '.jpg' || ext === '.jpeg') && !isJpeg) ||
    (ext === '.png' && !isPng) ||
    (ext === '.webp' && !isWebp)
  ) {
    return { valid: false, ext, error: 'Image header does not match file extension.' };
  }

  return { valid: true, ext };
}

export function persistUploadedBuffer(
  folder: 'resources' | 'images' | 'avatars' | 'submissions',
  buffer: Buffer,
  ext: string
): { relativePath: string; publicUrl: string } {
  ensureUploadDirs();
  const safeName = `${crypto.randomUUID()}${ext}`;
  const target = path.resolve(UPLOADS_ROOT, folder, safeName);
  if (!target.startsWith(UPLOADS_ROOT + path.sep)) {
    throw new Error('Invalid upload target path');
  }
  fs.writeFileSync(target, buffer);
  return {
    relativePath: `${folder}/${safeName}`,
    publicUrl: `/uploads/${folder}/${safeName}`,
  };
}
