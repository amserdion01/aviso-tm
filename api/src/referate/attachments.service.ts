import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { ReferatStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { R2Service } from '../storage/r2.service';
import { REFERAT_INCLUDE } from './referate.service';

/** Max size per file (10 MB) — enforced again here besides the interceptor. */
export const MAX_FILE_BYTES = 10 * 1024 * 1024;

/** Allowed content types: pdf, common images, office docs, plain text. */
const ALLOWED_CONTENT_TYPES = new Set([
  'application/pdf',
  'image/png',
  'image/jpeg',
  'image/webp',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'text/plain',
  'text/csv',
]);

/** Statuses that still accept new attachments (the flow is not closed). */
const OPEN_STATUSES: ReferatStatus[] = [
  ReferatStatus.IN_ASTEPTARE,
  ReferatStatus.TRIMIS_INAPOI,
];

/** Keep the original name readable but safe for storage keys / headers. */
function sanitizeFileName(name: string): string {
  const trimmed = name.trim().replace(/[/\\]/g, '_').slice(0, 140);
  return trimmed || 'fisier';
}

@Injectable()
export class AttachmentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly r2: R2Service,
  ) {}

  /**
   * Upload one or more files to R2 and record them on the referat.
   * Allowed only while the flow is still open (IN_ASTEPTARE / TRIMIS_INAPOI).
   */
  async upload(
    referatId: string,
    actingUserId: string,
    files: Express.Multer.File[],
  ) {
    if (!files || files.length === 0) {
      throw new BadRequestException('Niciun fișier de încărcat.');
    }

    const referat = await this.prisma.referat.findUnique({
      where: { id: referatId },
    });
    if (!referat) {
      throw new NotFoundException(`Referatul ${referatId} nu există.`);
    }
    if (!OPEN_STATUSES.includes(referat.status)) {
      throw new ConflictException(
        'Nu se mai pot adăuga fișiere — fluxul acestui referat este încheiat.',
      );
    }

    const uploader = await this.prisma.user.findUnique({
      where: { id: actingUserId },
    });
    if (!uploader) {
      throw new BadRequestException(`Utilizatorul ${actingUserId} nu există.`);
    }

    for (const file of files) {
      if (file.size > MAX_FILE_BYTES) {
        throw new BadRequestException(
          `Fișierul „${file.originalname}” depășește limita de 10 MB.`,
        );
      }
      if (!ALLOWED_CONTENT_TYPES.has(file.mimetype)) {
        throw new BadRequestException(
          `Tipul de fișier „${file.mimetype}” nu este permis (PDF, imagini, documente Office, text).`,
        );
      }
    }

    // Upload the bytes first; only then record the metadata rows, so the DB
    // never points at an object that failed to reach R2.
    const rows = [] as { fileName: string; storageKey: string; contentType: string; sizeBytes: number }[];
    for (const file of files) {
      // Multer decodes the original name as latin1; recover the UTF-8 diacritics.
      const fileName = sanitizeFileName(
        Buffer.from(file.originalname, 'latin1').toString('utf8'),
      );
      const storageKey = `referate/${referatId}/${randomUUID()}-${fileName}`;
      await this.r2.putObject(storageKey, file.buffer, file.mimetype);
      rows.push({
        fileName,
        storageKey,
        contentType: file.mimetype,
        sizeBytes: file.size,
      });
    }

    await this.prisma.attachment.createMany({
      data: rows.map((r) => ({
        ...r,
        referatId,
        uploadedById: uploader.id,
      })),
    });

    return this.prisma.referat.findUniqueOrThrow({
      where: { id: referatId },
      include: REFERAT_INCLUDE,
    });
  }

  /** Presigned R2 URL for one attachment (verifies it belongs to the referat). */
  async downloadUrl(referatId: string, attachmentId: string): Promise<string> {
    const attachment = await this.prisma.attachment.findUnique({
      where: { id: attachmentId },
    });
    if (!attachment || attachment.referatId !== referatId) {
      throw new NotFoundException('Atașamentul nu există.');
    }
    return this.r2.presignGetUrl(attachment.storageKey, attachment.fileName);
  }
}
