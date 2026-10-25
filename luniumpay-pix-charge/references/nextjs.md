# Next.js (App Router) — receber Pix e cair em USDT

`.env.local` (nunca commitar):
```
LUNIUM_API_KEY=lun_test_...      # troque por lun_live_ em produção
LUNIUM_WEBHOOK_SECRET=...        # devolvido por PATCH /keys/me ao cadastrar webhook_url
LUNIUM_PAYOUT_ADDRESS=0x...      # carteira do dono (destino=cripto)
LUNIUM_CHAIN=polygon
```

`lib/lunium.ts`
```ts
const BASE = 'https://api.luniumpay.com';
const headers = { 'X-API-Key': process.env.LUNIUM_API_KEY!, 'Content-Type': 'application/json' };

export async function lunium<T>(path: string, init?: RequestInit): Promise<T> {
  const r = await fetch(BASE + path, { ...init, headers: { ...headers, ...(init?.headers || {}) }, cache: 'no-store' });
  const body = await r.json();
  if (!r.ok) throw Object.assign(new Error(body.detail || body.erro || 'lunium_error'), { lunium: body, status: r.status });
  return body as T;
}
```

`app/api/cobranca/route.ts` — cria a cobrança. `external_id` = id do pedido, gravado ANTES.
```ts
import { NextResponse } from 'next/server';
import { lunium } from '@/lib/lunium';

export async function POST(req: Request) {
  const { pedidoId, amountCents, payerTaxNumber } = await req.json();
  // 1. garanta que o pedido existe no seu banco com este id (idempotência)
  // 2. crie a cobrança reutilizando o mesmo external_id em qualquer retry
  const charge = await lunium<any>('/cashin/charge', {
    method: 'POST',
    body: JSON.stringify({
      amount_cents: amountCents,
      payer_tax_number: payerTaxNumber.replace(/\D/g, ''),
      destino: 'cripto',
      asset: 'USDT',
      chain: process.env.LUNIUM_CHAIN,
      payout_address: process.env.LUNIUM_PAYOUT_ADDRESS,
      external_id: `pedido-${pedidoId}`,
      ...(process.env.LUNIUM_API_KEY!.startsWith('lun_test_') ? { sandbox_scenario: 'success' } : {}),
    }),
  });
  // grave charge.cashin_id no pedido
  return NextResponse.json({
    cashinId: charge.cashin_id,
    qrImageUrl: charge.qr_image_url,
    qrCopyPaste: charge.qr_copypaste,
    amountCents: charge.amount_cents,
    expiresAt: charge.expires_at,
  });
}
```

`app/api/cobranca/[id]/route.ts` — status para o frontend fazer polling.
```ts
import { NextResponse } from 'next/server';
import { lunium } from '@/lib/lunium';

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const s = await lunium<any>(`/cashin/${id}/status`);
  const liberado = s.status === 'paid' && s.settlement_status === 'sent';
  return NextResponse.json({ status: s.status, settlement: s.settlement_status, proof: s.settlement_proof, liberado, txUrl: s.settlement_tx_url, liberarEm: s.liberar_em });
}
```

`app/api/webhooks/lunium/route.ts` — corpo CRU, assinatura, dedupe. Veja `luniumpay-webhooks`.
```ts
import { createHmac, timingSafeEqual } from 'node:crypto';

export async function POST(req: Request) {
  const raw = Buffer.from(await req.arrayBuffer());
  const sig = req.headers.get('x-lunium-signature') || '';
  const f = Object.fromEntries(sig.split(',').map(p => p.trim().split('=') as [string, string]));
  if (!/^\d+$/.test(f.t || '') || !/^[a-f0-9]{64}$/i.test(f.v1 || '')) return new Response('bad signature', { status: 401 });
  if (Math.abs(Date.now() / 1000 - Number(f.t)) > 300) return new Response('stale', { status: 401 });
  const expected = createHmac('sha256', process.env.LUNIUM_WEBHOOK_SECRET!).update(`${f.t}.`).update(raw).digest();
  const got = Buffer.from(f.v1, 'hex');
  if (expected.length !== got.length || !timingSafeEqual(expected, got)) return new Response('bad signature', { status: 401 });

  const event = JSON.parse(raw.toString('utf8'));
  const eventId = req.headers.get('x-lunium-event-id') || event.event_id;
  // 1. INSERT eventId numa tabela com unique → se já existe, responda 200 e saia
  // 2. grave o evento e responda 200 rápido; processe depois
  // 3. no processamento, releia GET /cashin/{id}/status antes de liberar o pedido
  return new Response('ok', { status: 200 });
}
```

Frontend: renderize `<img src={qrImageUrl}>` e um botão "copiar" com `qrCopyPaste`.
Faça polling em `/api/cobranca/{id}` a cada 5 s até `liberado` ou `expiresAt`.
