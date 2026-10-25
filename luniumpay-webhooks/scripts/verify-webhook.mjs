import { createHmac, timingSafeEqual } from 'node:crypto';

/** Pass the untouched request-body Buffer, before JSON parsing. */
export function verifyLuniumWebhook({ rawBody, signature, secret, now = Date.now(), toleranceSeconds = 300 }) {
  if (!Buffer.isBuffer(rawBody) || typeof signature !== 'string' || !secret) return false;
  if (!Number.isFinite(now) || !Number.isFinite(toleranceSeconds) || toleranceSeconds < 0) return false;
  const parts = signature.split(',').map(part => part.trim());
  if (parts.length !== 2) return false;
  const fields = Object.fromEntries(parts.map(part => {
    const i = part.indexOf('=');
    return [part.slice(0, i), part.slice(i + 1)];
  }));
  if (!/^\d{1,12}$/.test(fields.t || '') || !/^[a-fA-F0-9]{64}$/.test(fields.v1 || '')) return false;
  const timestamp = Number(fields.t);
  if (Math.abs(now / 1000 - timestamp) > toleranceSeconds) return false;
  const expected = createHmac('sha256', secret).update(`${fields.t}.`).update(rawBody).digest();
  const received = Buffer.from(fields.v1, 'hex');
  return expected.length === received.length && timingSafeEqual(expected, received);
}

// Verify first, then JSON.parse(rawBody.toString('utf8')).
// Persist/deduplicate event_id, acknowledge 2xx, and process asynchronously.
// A valid signature does not replace event deduplication or business validation.
