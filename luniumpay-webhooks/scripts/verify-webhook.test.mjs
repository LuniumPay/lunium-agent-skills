import { createHmac } from 'node:crypto';
import assert from 'node:assert/strict';
import { verifyLuniumWebhook } from './verify-webhook.mjs';

const secret = 'whsec_teste';
const rawBody = Buffer.from(JSON.stringify({ event_id: 'evt_1', event: 'cashin.settled', cashin_id: 'ci_x' }));
const t = Math.floor(Date.now() / 1000);
const v1 = createHmac('sha256', secret).update(`${t}.`).update(rawBody).digest('hex');
const sig = `t=${t},v1=${v1}`;

assert.equal(verifyLuniumWebhook({ rawBody, signature: sig, secret }), true, 'assinatura válida');
assert.equal(verifyLuniumWebhook({ rawBody: Buffer.from(rawBody.toString() + ' '), signature: sig, secret }), false, 'corpo alterado');
assert.equal(verifyLuniumWebhook({ rawBody, signature: sig, secret: 'outro' }), false, 'segredo errado');
assert.equal(verifyLuniumWebhook({ rawBody, signature: sig, secret, now: (t + 301) * 1000 }), false, 'timestamp velho');
assert.equal(verifyLuniumWebhook({ rawBody, signature: 'v1=abc', secret }), false, 'formato inválido');
console.log('verify-webhook: 5/5 OK');
