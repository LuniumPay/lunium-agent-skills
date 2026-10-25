# Express (Node 20+) — receber Pix e cair em USDT

```js
import express from 'express';
import { createHmac, timingSafeEqual } from 'node:crypto';

const BASE = 'https://api.luniumpay.com';
const H = { 'X-API-Key': process.env.LUNIUM_API_KEY, 'Content-Type': 'application/json' };
const isSandbox = process.env.LUNIUM_API_KEY.startsWith('lun_test_');
const destino = process.env.LUNIUM_DESTINO || (process.env.LUNIUM_PAYOUT_ADDRESS ? 'cripto' : 'saldo');
// CPF/CNPJ com dígito verificador: a API não valida o DV; documento errado vira Pix devolvido.
function documentoValido(doc) {
  const d = String(doc).replace(/\D/g, '');
  if (/^(\d)\1+$/.test(d)) return false;
  const dv = (base, pesos) => { const r = [...base].reduce((a, n, i) => a + Number(n) * pesos[i], 0) % 11; return r < 2 ? 0 : 11 - r; };
  if (d.length === 11) return dv(d.slice(0, 9), [10, 9, 8, 7, 6, 5, 4, 3, 2]) === Number(d[9]) && dv(d.slice(0, 10), [11, 10, 9, 8, 7, 6, 5, 4, 3, 2]) === Number(d[10]);
  if (d.length === 14) return dv(d.slice(0, 12), [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]) === Number(d[12]) && dv(d.slice(0, 13), [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]) === Number(d[13]);
  return false;
}
const app = express();

async function lunium(path, init = {}) {
  const r = await fetch(BASE + path, { ...init, headers: { ...H, ...(init.headers || {}) } });
  const b = await r.json();
  if (!r.ok) { const e = new Error(b.detail || b.erro); e.lunium = b; throw e; }
  return b;
}

// Webhook ANTES do express.json(): precisa do corpo cru.
app.post('/webhooks/lunium', express.raw({ type: '*/*' }), (req, res) => {
  const f = Object.fromEntries((req.get('x-lunium-signature') || '').split(',').map(p => p.trim().split('=')));
  if (!/^\d+$/.test(f.t || '') || !/^[a-f0-9]{64}$/i.test(f.v1 || '')) return res.sendStatus(401);
  if (Math.abs(Date.now() / 1000 - Number(f.t)) > 300) return res.sendStatus(401);
  const exp = createHmac('sha256', process.env.LUNIUM_WEBHOOK_SECRET).update(`${f.t}.`).update(req.body).digest();
  const got = Buffer.from(f.v1, 'hex');
  if (exp.length !== got.length || !timingSafeEqual(exp, got)) return res.sendStatus(401);
  const event = JSON.parse(req.body.toString('utf8'));
  const eventId = req.get('x-lunium-event-id') || event.event_id;
  // dedupe por eventId (unique no banco), grave, responda 200, processe async
  res.sendStatus(200);
});

app.use(express.json());

app.post('/cobrancas', async (req, res) => {
  const { pedidoId, amountCents, payerTaxNumber } = req.body;
  if (!documentoValido(payerTaxNumber)) return res.status(400).json({ erro: 'documento_invalido', acao: 'corrigir', detail: 'CPF/CNPJ do pagador inválido' });
  try {
    const c = await lunium('/cashin/charge', { method: 'POST', body: JSON.stringify({
      amount_cents: amountCents,
      payer_tax_number: String(payerTaxNumber).replace(/\D/g, ''),
      destino,
      ...(destino === 'cripto' ? { asset: 'USDT', chain: process.env.LUNIUM_CHAIN || 'polygon', payout_address: process.env.LUNIUM_PAYOUT_ADDRESS } : {}),
      external_id: `pedido-${pedidoId}`,
      ...(isSandbox ? { sandbox_scenario: 'success' } : {}),
    }) });
    res.json({ cashinId: c.cashin_id, qrImageUrl: c.qr_image_url, qrCopyPaste: c.qr_copypaste, expiresAt: c.expires_at });
  } catch (e) {
    // e.lunium.erro / acao / agent_guidance dizem o que fazer
    res.status(e.lunium ? 400 : 502).json(e.lunium || { erro: 'indisponivel' });
  }
});

app.get('/cobrancas/:id', async (req, res) => {
  const s = await lunium(`/cashin/${req.params.id}/status`);
  res.json({ status: s.status, settlement: s.settlement_status, proof: s.settlement_proof,
             liberado: s.status === 'paid' && s.settlement_status === 'sent', txUrl: s.settlement_tx_url });
});

app.listen(3000);
```
