---
name: luniumpay-webhooks
description: "Receber webhooks da LuniumPay com segurança — cadastrar a URL, validar a assinatura HMAC X-Lunium-Signature sobre o corpo cru, deduplicar por event_id, responder rápido e auditar entregas. Use ao implementar o endpoint que recebe eventos de cobrança Pix, cash-out, payout ou saldo da Lunium. EN: Receive LuniumPay webhooks safely: register the URL, verify the X-Lunium-Signature HMAC over the raw body, deduplicate by event_id, respond fast, audit deliveries. Includes the official verifier and a test."
license: MIT
metadata:
  version: "2.2.0"
  api: "1.45.2"
---

# Webhooks assinados

## Cadastro
1. `PATCH /keys/me` com `{"webhook_url": "https://seu-app.com/webhooks/lunium"}` (https público) →
   resposta traz `webhook_secret`. Guarde em `LUNIUM_WEBHOOK_SECRET` (servidor).
   Perdeu? `PATCH /keys/me` com `{"rotate_webhook_secret": true}`.
2. Dispare uma entrega real assinada: `POST /webhooks/test`.
3. Audite: `GET /webhooks/deliveries`; reenvie uma: `POST /webhooks/deliveries/{event_id}/retry`.

## Validação (obrigatória em TODA entrega)
Headers: `X-Lunium-Signature: t=<unix>,v1=<hex sha256>`, `X-Lunium-Event-Id`,
`X-Lunium-Event`, `X-Lunium-Timestamp`, `X-Lunium-Attempt`, `X-Lunium-Delivery-Id`.

```
esperado = HMAC_SHA256(secret, t + "." + corpo_cru_em_bytes)
válido   = |agora - t| ≤ 300 s  E  comparação_em_tempo_constante(esperado, v1)
```
- Use o corpo CRU (bytes), antes de qualquer `JSON.parse` / middleware de JSON.
- Inválido → HTTP 401 e descarte. Nunca processe.
- Ignore `X-Webhook-Signature` (`sha256=…`): formato legado, desligado em 2026-11-09; chaves
  criadas desde 2026-08-08 nem o recebem. Valide só a v2 acima.
- Implementação de referência: `scripts/verify-webhook.mjs` (igual ao exemplo oficial
  em https://docs.luniumpay.com/examples/verify-webhook.mjs). Teste: `node scripts/verify-webhook.test.mjs`.

## Processamento
1. `INSERT event_id` numa tabela com chave única. Já existe? Responda 200 e saia.
2. Grave o evento, responda 2xx em milissegundos, processe depois. Sem 2xx a Lunium reenvia
   com backoff exponencial: 12 tentativas em ~7 h (`X-Lunium-Attempt` cresce); o que esgotar
   fica em `GET /webhooks/deliveries` e volta com o `retry`.
3. Antes de liberar algo, **releia o status** na API (`GET /cashin/{id}/status`,
   `GET /cash-outs/{id}`, `GET /payouts/{id}`). O webhook avisa; o status manda.
4. Eventos podem chegar fora de ordem. Não regrida estado (ex.: `cashin.paid`
   depois de `cashin.settled`).

## Eventos
- Cash-in: `cashin.paid`, `cashin.settled`, `cashin.held`, `cashin.delayed`,
  `cashin.expired`, `cashin.failed`, `cashin.refunded`, `cashin.settlement_failed`.
- Cash-out: `cashout.awaiting_deposit`, `cashout.deposit_detected`, `cashout.confirming`,
  `cashout.processing`, `cashout.completed`, `cashout.receipt_ready`, `cashout.under_review`,
  `cashout.awaiting_refund_address`, `cashout.refunding`, `cashout.refunded`,
  `cashout.expired`, `cashout.failed`.
- Payout: `payout.sent`, `payout.failed`, `payout.refunded`.
- Saldo: `saldo.congelado`, `saldo.liberado`, `saldo.transferido`.

`cashin.paid` NÃO significa cripto entregue; espere `cashin.settled` (e
`settlement_status=sent` no status). Webhook assinado não substitui dedupe nem
validação de negócio (valor, pedido, destinatário).

## Sandbox
O sandbox entrega webhooks reais e assinados para a `webhook_url` cadastrada (precisa ser
pública). Sem URL pública, inspecione o que seria enviado em `GET /sandbox/events` e valide a
assinatura localmente com `verify-webhook.test.mjs`.
