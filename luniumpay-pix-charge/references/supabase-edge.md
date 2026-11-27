# Supabase Edge Function (Deno) — receber Pix e cair em USDT

Segredos: grave a chave do painel com `node luniumpay/scripts/chave.mjs --env .env` e suba com
`supabase secrets set --env-file .env` (`LUNIUM_API_KEY`, `LUNIUM_WEBHOOK_SECRET`, `LUNIUM_DESTINO=cripto|saldo`,
`LUNIUM_PAYOUT_ADDRESS`). Nunca digite a chave na linha de comando: ela fica no histórico do shell.

Tabela sugerida:
```sql
create table pedidos (
  id text primary key,            -- vira external_id = 'pedido-' || id
  amount_cents int not null,
  cashin_id text,
  status text default 'pending',
  settlement_status text,
  hold_hours int,                 -- retenção local decidida na criação do QR
  hold_reason text,               -- new_payer | new_account (só quando a API gravou)
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
  const { pedidoId, amountCents, payerTaxNumber, payerEmail } = await req.json();
  if (!documentoValido(payerTaxNumber)) return Response.json({ erro: 'documento_invalido', acao: 'corrigir', detail: 'CPF/CNPJ do pagador inválido' }, { status: 400 });
  const db = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
  await db.from('pedidos').upsert({ id: pedidoId, amount_cents: amountCents });   // antes de cobrar
  const r = await fetch(BASE + '/cashin/charge', { method: 'POST', headers: H, body: JSON.stringify({
    amount_cents: amountCents,
    payer_tax_number: String(payerTaxNumber).replace(/\D/g, ''),
    ...(typeof payerEmail === 'string' && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(payerEmail) ? { payer_email: payerEmail.trim() } : {}),   // opcional
    destino,
    ...(destino === 'cripto' ? { asset: 'USDT', chain: Deno.env.get('LUNIUM_CHAIN') ?? 'polygon', payout_address: Deno.env.get('LUNIUM_PAYOUT_ADDRESS') } : {}),
    external_id: `pedido-${pedidoId}`,
    ...(KEY.startsWith('lun_test_') ? { sandbox_scenario: 'success' } : {}),
  }) });
  const c = await r.json().catch(() => ({}));
  if (!r.ok) {
    // Erros da CONTA (verificação do titular, liberação, chave): o pagador não resolve; o dono vê no log e resolve no painel.
    const daConta = ['chave_ausente', 'chave_incorreta', 'chave_desconhecida', 'nao_autenticado', 'verificacao_titular_pendente', 'recebimento_sem_autorizacao', 'em_manutencao', 'custodia_desligada', 'cashin_indisponivel'];
    if (daConta.includes(c.erro)) {
      console.error('[lunium] conta não pronta:', c.erro, c.liberacao?.status ?? '', c.detail, c.request_id);
      return Response.json({ erro: 'pagamento_indisponivel', detail: 'Pagamento por Pix indisponível no momento. Tente mais tarde.' }, { status: 503 });
    }
    return Response.json({ erro: c.erro ?? 'indisponivel', acao: c.acao, detail: c.detail }, { status: r.status >= 500 ? 502 : r.status });
  }
  await db.from('pedidos').update({ cashin_id: c.cashin_id, hold_hours: c.hold_hours ?? 0, hold_reason: c.hold_reason ?? null }).eq('id', pedidoId);
  return Response.json({ cashinId: c.cashin_id, qrImageUrl: c.qr_image_url, qrCopyPaste: c.qr_copypaste, amountCents: c.amount_cents, expiresAt: c.expires_at, holdHours: c.hold_hours ?? 0, holdReason: c.hold_reason ?? null });
});
```

`supabase/functions/lunium-webhook/index.ts` (deploy com `--no-verify-jwt`)
```ts
import { createClient } from 'npm:@supabase/supabase-js@2';
const enc = new TextEncoder();
const hex = (b: ArrayBuffer) => [...new Uint8Array(b)].map(x => x.toString(16).padStart(2, '0')).join('');
// comparação em tempo constante (mesmo tamanho; percorre tudo sem sair cedo)
const iguais = (a: string, b: string) => { if (a.length !== b.length) return false; let d = 0; for (let i = 0; i < a.length; i++) d |= a.charCodeAt(i) ^ b.charCodeAt(i); return d === 0; };

Deno.serve(async (req) => {
  const raw = new Uint8Array(await req.arrayBuffer());
  const f = Object.fromEntries((req.headers.get('x-lunium-signature') ?? '').split(',').map(p => p.trim().split('=')));
  if (!/^\d+$/.test(f.t ?? '') || !/^[a-f0-9]{64}$/i.test(f.v1 ?? '')) return new Response('bad', { status: 401 });
  if (Math.abs(Date.now() / 1000 - Number(f.t)) > 300) return new Response('stale', { status: 401 });
  const key = await crypto.subtle.importKey('raw', enc.encode(Deno.env.get('LUNIUM_WEBHOOK_SECRET')!), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const msg = new Uint8Array([...enc.encode(`${f.t}.`), ...raw]);
  const expected = hex(await crypto.subtle.sign('HMAC', key, msg));
  if (!iguais(expected, f.v1.toLowerCase())) return new Response('bad', { status: 401 });

  const event = JSON.parse(new TextDecoder().decode(raw));
  const eventId = req.headers.get('x-lunium-event-id') ?? event.event_id;
  const db = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
  const { error } = await db.from('lunium_eventos').insert({ event_id: eventId, payload: event });
  if (error?.code === '23505') return new Response('dup', { status: 200 });   // já processado
  // Evento desconhecido = ignore. Antes de liberar, releia: GET /cashin/{id}/status → paid + sent
  return new Response('ok', { status: 200 });
});
```
