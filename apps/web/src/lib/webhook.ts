import crypto from 'crypto';

/**
 * Verifies HMAC SHA-256 signatures for incoming webhooks.
 * Uses timing-safe equality comparison to prevent timing attacks.
 *
 * @param payload Raw request body string or Buffer
 * @param signature The signature sent in the header (e.g. 'sha256=...' or hex string)
 * @param secret Webhook signing secret
 */
export function verifyWebhookSignature(
  payload: string | Buffer,
  signature: string,
  secret: string
): boolean {
  if (!signature || !secret) {
    return false;
  }

  const cleanSignature = signature.startsWith('sha256=')
    ? signature.slice(7)
    : signature;

  const expectedSignature = crypto
    .createHmac('sha256', secret)
    .update(payload)
    .digest('hex');

  const sigBuffer = Buffer.from(cleanSignature, 'hex');
  const expectedBuffer = Buffer.from(expectedSignature, 'hex');

  if (sigBuffer.length !== expectedBuffer.length) {
    return false;
  }

  return crypto.timingSafeEqual(sigBuffer, expectedBuffer);
}
