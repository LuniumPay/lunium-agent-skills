# Next.js (App Router) — receber Pix e cair em USDT

`.env.local` (nunca commitar). A chave nasce no painel ("Chaves de API"); grave com
`node luniumpay/scripts/chave.mjs`, que escreve a linha abaixo sem passar pelo chat:
```
LUNIUM_API_KEY=lun_test_...      # produção: lun_live_ (painel, depois do upgrade de conta), levada ao host por go-live.mjs
LUNIUM_WEBHOOK_SECRET=...        # devolvido por PATCH /keys/me ao cadastrar webhook_url
LUNIUM_DESTINO=cripto            # cripto = USDT na carteira abaixo · saldo = custódia em reais, sem carteira
LUNIUM_PAYOUT_ADDRESS=0x...      # carteira do dono (só destino=cripto)
LUNIUM_CHAIN=polygon
```

`lib/lunium.ts`
```ts
const BASE = 'https://api.luniumpay.com';
const headers = { 'X-API-Key': process.env.LUNIUM_API_KEY!, 'Content-Type': 'application/json' };

export type LuniumErro = { erro?: string; acao?: string; detail?: string; agent_guidance?: string; request_id?: string; liberacao?: { status?: string } };

export async function lunium<T>(path: string, init?: RequestInit): Promise<T> {
  const r = await fetch(BASE + path, { ...init, headers: { ...headers, ...(init?.headers || {}) }, cache: 'no-store' });
  const body = await r.json().catch(() => ({}));
  if (!r.ok) throw Object.assign(new Error(body.detail || body.erro || 'lunium_error'), { lunium: body as LuniumErro, status: r.status });
  return body as T;
}

// Erros da CONTA (chave, verificação do titular, liberação, manutenção): o pagador não resolve; o dono resolve no painel.
const DA_CONTA = new Set(['chave_ausente', 'chave_incorreta', 'chave_desconhecida', 'nao_autenticado', 'verificacao_titular_pendente',
  'recebimento_sem_autorizacao', 'em_manutencao', 'custodia_desligada', 'cashin_indisponivel']);

/** Converte um erro da LuniumPay na resposta para o SEU frontend, sem 500 genérico e sem vazar detalhe interno. */
export function respostaDeErro(e: any): { status: number; body: Record<string, unknown> } {
  const b: LuniumErro | undefined = e?.lunium;
  if (!b?.erro) return { status: 502, body: { erro: 'indisponivel', detail: 'Não foi possível falar com o serviço de pagamento. Tente de novo em instantes.' } };
  if (DA_CONTA.has(b.erro)) {
    // Para o dono do app (log do servidor): o motivo e o caminho (painel, liberacao.status). Nunca em loop.
    console.error('[lunium] conta não pronta:', b.erro, b.liberacao?.status || '', b.detail, b.request_id);
    return { status: 503, body: { erro: 'pagamento_indisponivel', detail: 'Pagamento por Pix indisponível no momento. Tente mais tarde.' } };
  }
  return { status: e.status >= 500 ? 502 : e.status, body: { erro: b.erro, acao: b.acao, detail: b.detail } };
}

export const destino = process.env.LUNIUM_DESTINO || (process.env.LUNIUM_PAYOUT_ADDRESS ? 'cripto' : 'saldo');
// CPF (11) ou CNPJ (14) só dígitos, com dígito verificador. A API não valida o DV: documento errado vira Pix devolvido por divergência de pagador.
export function documentoValido(doc: string): boolean {
  const d = String(doc).replace(/\D/g, '');
  if (/^(\d)\1+$/.test(d)) return false;
  const dv = (base: string, pesos: number[]) => { const r = [...base].reduce((a, n, i) => a + Number(n) * pesos[i], 0) % 11; return r < 2 ? 0 : 11 - r; };
  if (d.length === 11) return dv(d.slice(0, 9), [10, 9, 8, 7, 6, 5, 4, 3, 2]) === Number(d[9]) && dv(d.slice(0, 10), [11, 10, 9, 8, 7, 6, 5, 4, 3, 2]) === Number(d[10]);
  if (d.length === 14) return dv(d.slice(0, 12), [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]) === Number(d[12]) && dv(d.slice(0, 13), [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]) === Number(d[13]);
  return false;
}
```

`app/api/cobranca/route.ts` — cria a cobrança. `external_id` = id do pedido, gravado ANTES.
```ts
import { NextResponse } from 'next/server';
import { lunium, destino, documentoValido, respostaDeErro } from '@/lib/lunium';

export async function POST(req: Request) {
  const { pedidoId, amountCents, payerTaxNumber, payerEmail } = await req.json();
  if (!documentoValido(payerTaxNumber)) return NextResponse.json({ erro: 'documento_invalido', acao: 'corrigir', detail: 'CPF/CNPJ do pagador inválido' }, { status: 400 });
  // 1. garanta que o pedido existe no seu banco com este id (idempotência)
  // 2. crie a cobrança reutilizando o mesmo external_id (e o mesmo corpo) em qualquer retry
  try {
    const charge = await lunium<any>('/cashin/charge', {
      method: 'POST',
      body: JSON.stringify({
        amount_cents: amountCents,
        payer_tax_number: payerTaxNumber.replace(/\D/g, ''),
        ...(typeof payerEmail === 'string' && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(payerEmail) ? { payer_email: payerEmail.trim() } : {}),   // opcional: e-mail que o pagador informou
        destino,
        ...(destino === 'cripto' ? { asset: 'USDT', chain: process.env.LUNIUM_CHAIN, payout_address: process.env.LUNIUM_PAYOUT_ADDRESS } : {}),
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
      holdHours: charge.hold_hours ?? 0,
      holdReason: charge.hold_reason ?? null,
    });
  } catch (e) {
    const { status, body } = respostaDeErro(e);
    return NextResponse.json(body, { status });
  }
}
```

`app/api/cobranca/[id]/route.ts` — status para o frontend fazer polling.
```ts
import { NextResponse } from 'next/server';
import { lunium, respostaDeErro } from '@/lib/lunium';

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^[A-Za-z0-9_-]{4,80}$/.test(id)) return NextResponse.json({ erro: 'id_invalido' }, { status: 400 });   // só ids que a API devolveu
  try {
    const s = await lunium<any>(`/cashin/${id}/status`);
    const liberado = s.status === 'paid' && s.settlement_status === 'sent';
    return NextResponse.json({
      status: s.status, settlement: s.settlement_status, proof: s.settlement_proof, liberado,
      txUrl: s.settlement_tx_url, e2e: s.e2e,
      // retenção local: horas + data; motivo só quando a API gravou (nunca deduza)
      holdHours: s.hold_hours ?? 0, liberarEm: s.liberar_em ?? null, holdReason: s.hold_reason ?? null,
    });
  } catch (e) {
    const { status, body } = respostaDeErro(e);
    return NextResponse.json(body, { status });
  }
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
  // 2. grave o evento e responda 200 rápido; processe depois (evento desconhecido = ignore)
  // 3. no processamento, releia GET /cashin/{id}/status antes de liberar o pedido
  return new Response('ok', { status: 200 });
}
```

Frontend: renderize `<img src={qrImageUrl}>` e um botão "copiar" com `qrCopyPaste`.
Faça polling em `/api/cobranca/{id}` a cada 5 s até `liberado` ou `expiresAt`. Componente pronto em
`checkout-react.md` (inclui a mensagem de retenção).
