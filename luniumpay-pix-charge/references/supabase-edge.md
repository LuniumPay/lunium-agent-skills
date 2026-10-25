# Supabase Edge Function (Deno) — receber Pix e cair em USDT

Segredos: `supabase secrets set LUNIUM_API_KEY=lun_test_... LUNIUM_WEBHOOK_SECRET=... LUNIUM_DESTINO=cripto LUNIUM_PAYOUT_ADDRESS=0x...` (sem carteira: `LUNIUM_DESTINO=saldo`)

Tabela sugerida:
```sql
create table pedidos (
  id text primary key,            -- vira external_id = 'pedido-' || id
  amount_cents int not null,
  cashin_id text,
  status text default 'pending',
  settlement_status text,
  created_at timestamptz default now()
);
create table lunium_eventos (event_id text primary key, payload jsonb, received_at timestamptz default now());
```

`supabase/functions/lunium-cobranca/index.ts`
```ts
import { createClient } from 'npm:@supabase/supabase-js@2';
const BASE = 'https://api.luniumpay.com';
const KEY = Deno.env.get('LUNIUM_API_KEY')!;
const H = { 'X-API-Key': KEY, 'Content-Type': 'application/json' };
const destino = Deno.env.get('LUNIUM_DESTINO') ?? (Deno.env.get('LUNIUM_PAYOUT_ADDRESS') ? 'cripto' : 'saldo');
// CPF/CNPJ com dígito verificador: a API não valida o DV; documento errado vira Pix devolvido.
function documentoValido(doc: string): boolean {
  const d = String(doc).replace(/\D/g, '');
  if (/^(\d)\1+$/.test(d)) return false;
  const dv = (base: string, pesos: number[]) => { const r = [...base].reduce((a, n, i) => a + Number(n) * pesos[i], 0) % 11; return r < 2 ? 0 : 11 - r; };
  if (d.length === 11) return dv(d.slice(0, 9), [10, 9, 8, 7, 6, 5, 4, 3, 2]) === Number(d[9]) && dv(d.slice(0, 10), [11, 10, 9, 8, 7, 6, 5, 4, 3, 2]) === Number(d[10]);
  if (d.length === 14) return dv(d.slice(0, 12), [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]) === Number(d[12]) && dv(d.slice(0, 13), [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]) === Number(d[13]);
  return false;
}

Deno.serve(async (req) => {
  const { pedidoId, amountCents, payerTaxNumber } = await req.json();
  if (!documentoValido(payerTaxNumber)) return Response.json({ erro: 'documento_invalido', acao: 'corrigir', detail: 'CPF/CNPJ do pagador inválido' }, { status: 400 });
  const db = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
  await db.from('pedidos').upsert({ id: pedidoId, amount_cents: amountCents });   // antes de cobrar
  const r = await fetch(BASE + '/cashin/charge', { method: 'POST', headers: H, body: JSON.stringify({
    amount_cents: amountCents,
    payer_tax_number: String(payerTaxNumber).replace(/\D/g, ''),
    destino,
    ...(destino === 'cripto' ? { asset: 'USDT', chain: Deno.env.get('LUNIUM_CHAIN') ?? 'polygon', payout_address: Deno.env.get('LUNIUM_PAYOUT_ADDRESS') } : {}),
    external_id: `pedido-${pedidoId}`,
    ...(KEY.startsWith('lun_test_') ? { sandbox_scenario: 'success' } : {}),
  }) });
  const c = await r.json();
  if (!r.ok) return Response.json(c, { status: 400 });          // c.erro / c.acao / c.agent_guidance
  await db.from('pedidos').update({ cashin_id: c.cashin_id }).eq('id', pedidoId);
  return Response.json({ cashinId: c.cashin_id, qrImageUrl: c.qr_image_url, qrCopyPaste: c.qr_copypaste, expiresAt: c.expires_at });
});
```

`supabase/functions/lunium-webhook/index.ts` (deploy com `--no-verify-jwt`)
```ts
import { createClient } from 'npm:@supabase/supabase-js@2';
const enc = new TextEncoder();
const hex = (b: ArrayBuffer) => [...new Uint8Array(b)].map(x => x.toString(16).padStart(2, '0')).join('');

Deno.serve(async (req) => {
  const raw = new Uint8Array(await req.arrayBuffer());
  const f = Object.fromEntries((req.headers.get('x-lunium-signature') ?? '').split(',').map(p => p.trim().split('=')));
  if (!/^\d+$/.test(f.t ?? '') || !/^[a-f0-9]{64}$/i.test(f.v1 ?? '')) return new Response('bad', { status: 401 });
  if (Math.abs(Date.now() / 1000 - Number(f.t)) > 300) return new Response('stale', { status: 401 });
  const key = await crypto.subtle.importKey('raw', enc.encode(Deno.env.get('LUNIUM_WEBHOOK_SECRET')!), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const msg = new Uint8Array([...enc.encode(`${f.t}.`), ...raw]);
  const expected = hex(await crypto.subtle.sign('HMAC', key, msg));
  if (expected !== f.v1.toLowerCase()) return new Response('bad', { status: 401 });   // em Deno, compare com timing-safe se disponível

  const event = JSON.parse(new TextDecoder().decode(raw));
  const eventId = req.headers.get('x-lunium-event-id') ?? event.event_id;
  const db = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
  const { error } = await db.from('lunium_eventos').insert({ event_id: eventId, payload: event });
  if (error?.code === '23505') return new Response('dup', { status: 200 });   // já processado
  // Releia o status antes de liberar: GET /cashin/{id}/status → paid + sent
  return new Response('ok', { status: 200 });
});
```
