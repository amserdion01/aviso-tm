import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import { GetObjectCommand, PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

/** How long a presigned download link stays valid. */
const DOWNLOAD_URL_TTL_SECONDS = 15 * 60;

/**
 * Thin wrapper over Cloudflare R2 (S3-compatible). The client is created
 * lazily on first use so the rest of the demo keeps working when the R2
 * env vars are not configured — only attachment operations fail, with a
 * clear Romanian error.
 */
@Injectable()
export class R2Service {
  private client: S3Client | null = null;
  private bucket = '';

  private ensureClient(): S3Client {
    if (this.client) return this.client;

    // Endpoint: either the full URL from the R2 dashboard (R2_ENDPOINT — required
    // for jurisdiction buckets like *.eu.r2.cloudflarestorage.com) or derived
    // from the account id.
    const accountId = process.env.R2_ACCOUNT_ID;
    const endpoint =
      process.env.R2_ENDPOINT ||
      (accountId ? `https://${accountId}.r2.cloudflarestorage.com` : undefined);
    // Accept both the documented R2_ACCESS_KEY_ID and the shorter R2_ACCESS_KEY.
    const accessKeyId = process.env.R2_ACCESS_KEY_ID || process.env.R2_ACCESS_KEY;
    const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY;
    const bucket = process.env.R2_BUCKET;

    if (!endpoint || !accessKeyId || !secretAccessKey || !bucket) {
      throw new ServiceUnavailableException(
        'Stocarea de fișiere nu este configurată (setați R2_ENDPOINT sau R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY și R2_BUCKET în api/.env).',
      );
    }

    this.bucket = bucket;
    this.client = new S3Client({
      region: 'auto',
      endpoint,
      credentials: { accessKeyId, secretAccessKey },
    });
    return this.client;
  }

  /** Upload one object. */
  async putObject(key: string, body: Buffer, contentType: string): Promise<void> {
    const client = this.ensureClient();
    await client.send(
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: key,
        Body: body,
        ContentType: contentType,
      }),
    );
  }

  /** Presigned GET URL that downloads as `fileName` (bucket stays private). */
  async presignGetUrl(key: string, fileName: string): Promise<string> {
    const client = this.ensureClient();
    const command = new GetObjectCommand({
      Bucket: this.bucket,
      Key: key,
      ResponseContentDisposition: `attachment; filename*=UTF-8''${encodeURIComponent(fileName)}`,
    });
    return getSignedUrl(client, command, { expiresIn: DOWNLOAD_URL_TTL_SECONDS });
  }
}
