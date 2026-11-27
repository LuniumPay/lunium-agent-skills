# Express (Node 20+) — receber Pix e cair em USDT

`.env` com `LUNIUM_API_KEY` (gerada no painel, gravada por `node luniumpay/scripts/chave.mjs`), `LUNIUM_WEBHOOK_SECRET`,
`LUNIUM_DESTINO`, `LUNIUM_PAYOUT_ADDRESS`, `LUNIUM_CHAIN`. Rode com `node --env-file=.env lunium-server.mjs`.

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
  const b = await r.json().catch(() => ({}));
  if (!r.ok) { const e = new Error(b.detail || b.erro); e.lunium = b; e.status = r.status; throw e; }
  return b;
}
// Erros da CONTA (chave, verificação do titular, liberação, manutenção): o pagador não resolve; o dono resolve no painel.
const DA_CONTA = new Set(['chave_ausente', 'chave_incorreta', 'chave_desconhecida', 'nao_autenticado', 'verificacao_titular_pendente',
  'recebimento_sem_autorizacao', 'em_manutencao', 'custodia_desligada', 'cashin_indisponivel']);
function responderErro(res, e) {
  const b = e?.lunium;
  if (!b?.erro) return res.status(502).json({ erro: 'indisponivel', detail: 'Serviço de pagamento fora do ar. Tente de novo em instantes.' });
  if (DA_CONTA.has(b.erro)) {
    console.error('[lunium] conta não pronta:', b.erro, b.liberacao?.status || '', b.detail, b.request_id);   // para o dono; nunca em loop
    return res.status(503).json({ erro: 'pagamento_indisponivel', detail: 'Pagamento por Pix indisponível no momento. Tente mais tarde.' });
  }
  return res.status(e.status >= 500 ? 502 : e.status).json({ erro: b.erro, acao: b.acao, detail: b.detail });
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
  const { pedidoId, amountCents, payerTaxNumber, payerEmail } = req.body;
  if (!documentoValido(payerTaxNumber)) return res.status(400).json({ erro: 'documento_invalido', acao: 'corrigir', detail: 'CPF/CNPJ do pagador inválido' });
  try {
    const c = await lunium('/cashin/charge', { method: 'POST', body: JSON.stringify({
      amount_cents: amountCents,
      payer_tax_number: String(payerTaxNumber).replace(/\D/g, ''),
      ...(typeof payerEmail === 'string' && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(payerEmail) ? { payer_email: payerEmail.trim() } : {}),   // opcional
      destino,
      ...(destino === 'cripto' ? { asset: 'USDT', chain: process.env.LUNIUM_CHAIN || 'polygon', payout_address: process.env.LUNIUM_PAYOUT_ADDRESS } : {}),
      external_id: `pedido-${pedidoId}`,
      ...(isSandbox ? { sandbox_scenario: 'success' } : {}),
    }) });
    res.json({ cashinId: c.cashin_id, qrImageUrl: c.qr_image_url, qrCopyPaste: c.qr_copypaste, amountCents: c.amount_cents,
               expiresAt: c.expires_at, holdHours: c.hold_hours ?? 0, holdReason: c.hold_reason ?? null });
  } catch (e) { responderErro(res, e); }
});

app.get('/cobrancas/:id', async (req, res) => {
  if (!/^[A-Za-z0-9_-]{4,80}$/.test(req.params.id)) return res.status(400).json({ erro: 'id_invalido' });   // só ids que a API devolveu
  try {
    const s = await lunium(`/cashin/${req.params.id}/status`);
    res.json({ status: s.status, settlement: s.settlement_status, proof: s.settlement_proof,
               liberado: s.status === 'paid' && s.settlement_status === 'sent', txUrl: s.settlement_tx_url, e2e: s.e2e,
               holdHours: s.hold_hours ?? 0, liberarEm: s.liberar_em ?? null, holdReason: s.hold_reason ?? null });   // motivo só se gravado
  } catch (e) { responderErro(res, e); }
});

app.listen(3000);
```
