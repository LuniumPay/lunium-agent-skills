# Componente React de checkout Pix (QR da API, copiar, contagem, estados)

Usa as rotas das receitas (`POST /api/cobranca`, `GET /api/cobranca/{id}`). Sem
biblioteca de QR: a imagem vem pronta da LuniumPay (`qr_image_url`).

```tsx
'use client';
import { useEffect, useState } from 'react';

export type Cobranca = { cashinId: string; qrImageUrl: string; qrCopyPaste: string; amountCents: number; expiresAt: string };
type Status = { status: string; settlement: string | null; proof: string | null; liberado: boolean; txUrl?: string | null; liberarEm?: string | null };

const brl = (c: number) => (c / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const MENSAGEM: Record<string, string> = {
  pending: 'Aguardando pagamento. Abra o app do seu banco e pague o Pix.',
  paid: 'Pix recebido. Finalizando a entrega…',
  delayed: 'Pagamento identificado. A confirmação está levando um pouco mais que o normal.',
  under_review: 'Pagamento em análise. Você será avisado assim que concluir.',
  expired: 'Este Pix expirou. Gere um novo para continuar.',
  refunded: 'O pagamento foi devolvido para a conta de origem.',
  failed: 'Não foi possível concluir. Nenhum valor foi cobrado.',
};

export function CheckoutPix({ cobranca }: { cobranca: Cobranca }) {
  const [st, setSt] = useState<Status | null>(null);
  const [copiado, setCopiado] = useState(false);
  const [restante, setRestante] = useState(0);

  useEffect(() => {
    const tick = () => setRestante(Math.max(0, Math.floor((new Date(cobranca.expiresAt).getTime() - Date.now()) / 1000)));
    tick(); const t = setInterval(tick, 1000); return () => clearInterval(t);
  }, [cobranca.expiresAt]);

  useEffect(() => {
    let parar = false;
    const poll = async () => {
      const r = await fetch(`/api/cobranca/${cobranca.cashinId}`, { cache: 'no-store' });
      const s: Status = await r.json(); if (parar) return; setSt(s);
      if (s.liberado || ['expired', 'refunded', 'failed'].includes(s.status)) return;
      setTimeout(poll, 5000);
    };
    poll(); return () => { parar = true; };
  }, [cobranca.cashinId]);

  const copiar = async () => { await navigator.clipboard.writeText(cobranca.qrCopyPaste); setCopiado(true); setTimeout(() => setCopiado(false), 2000); };
  const status = st?.status ?? 'pending';
  const retido = st?.liberarEm && !st.liberado;

  if (st?.liberado) return (
    <section role="status" aria-live="polite">
      <h2>Pagamento confirmado</h2>
      <p>{brl(cobranca.amountCents)} recebidos. Pedido liberado.</p>
      {st.txUrl && <a href={st.txUrl} target="_blank" rel="noreferrer">Ver comprovante da liquidação</a>}
    </section>
  );

  return (
    <section aria-live="polite">
      <h2>Pague {brl(cobranca.amountCents)} via Pix</h2>
      {status === 'pending' && restante > 0 && (
        <>
          <img src={cobranca.qrImageUrl} alt="QR Code Pix" width={240} height={240} />
          <p>Ou copie o código e cole no seu banco:</p>
          <textarea readOnly value={cobranca.qrCopyPaste} rows={3} style={{ width: '100%' }} />
          <button type="button" onClick={copiar}>{copiado ? 'Copiado!' : 'Copiar código Pix'}</button>
          <p>Expira em {Math.floor(restante / 60)}:{String(restante % 60).padStart(2, '0')}</p>
        </>
      )}
      <p>{retido ? `Pagamento recebido. Liberação prevista para ${new Date(st!.liberarEm!).toLocaleString('pt-BR')}.` : MENSAGEM[status] ?? 'Processando…'}</p>
      {status === 'pending' && restante === 0 && <p>{MENSAGEM.expired}</p>}
    </section>
  );
}
```

Regras embutidas: imagem e código vêm da API; nada é gerado no cliente. "Liberado"
só quando o backend diz `liberado` (status `paid` + `settlement_status` `sent`).
Estados intermediários falam a verdade sem prometer prazo. Sem "instantâneo".

Página pronta (`app/pagar/page.tsx`): valor + CPF/CNPJ → `POST /api/cobranca` → checkout.
`init.mjs` grava as duas; ajuste o visual à vontade, mantenha as regras.

```tsx
'use client';
import { useState, type FormEvent } from 'react';
import { CheckoutPix, type Cobranca } from '@/components/CheckoutPix';

export default function PagarPage() {
  const [valor, setValor] = useState('5,00');
  const [doc, setDoc] = useState('');
  const [cobranca, setCobranca] = useState<Cobranca | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [carregando, setCarregando] = useState(false);

  async function criar(e: FormEvent) {
    e.preventDefault(); setErro(null); setCarregando(true);
    const amountCents = Math.round(Number(valor.replace(/\./g, '').replace(',', '.')) * 100);
    const pedidoId = `web-${Date.now()}`;   // no seu app: id do pedido já gravado no banco (idempotência)
    const r = await fetch('/api/cobranca', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ pedidoId, amountCents, payerTaxNumber: doc }) });
    const b = await r.json(); setCarregando(false);
    if (!r.ok) { setErro(b.detail || b.erro || 'Não foi possível gerar o Pix.'); return; }
    setCobranca(b);
  }

  return (
    <main style={{ maxWidth: 480, margin: '40px auto', padding: 16 }}>
      {cobranca ? <CheckoutPix cobranca={cobranca} /> : (
        <>
          <h1>Pagar com Pix</h1>
          <form onSubmit={criar}>
            <label>Valor (R$)<br /><input value={valor} onChange={e => setValor(e.target.value)} inputMode="decimal" required /></label><br />
            <label>CPF ou CNPJ de quem paga<br /><input value={doc} onChange={e => setDoc(e.target.value)} inputMode="numeric" required /></label><br />
            <button type="submit" disabled={carregando}>{carregando ? 'Gerando…' : 'Gerar Pix'}</button>
          </form>
          {erro && <p role="alert">{erro}</p>}
          <p style={{ fontSize: 12, opacity: 0.7 }}>Pix com liquidação em stablecoin pela LuniumPay. O CPF/CNPJ serve para limites e proteção contra fraude.</p>
        </>
      )}
    </main>
  );
}
```
