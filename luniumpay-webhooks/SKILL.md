---
name: luniumpay-webhooks
description: Receber webhooks da Lunium com segurança - validar a assinatura HMAC, deduplicar, responder rápido e auditar entregas. Use ao implementar o endpoint que recebe eventos de cobrança/venda da Lunium.
---

# Webhooks assinados

1. Cadastre `webhook_url` na chave (`PATCH /keys/me`) e guarde o
   `webhook_secret` retornado.
2. **Valide TODA entrega** pelo header `X-Lunium-Signature`
   (v2: `t=<timestamp>,v1=<hmac-sha256 do corpo cru com o secret>`;
   o header legado `X-Webhook-Signature` v1 `sha256=<hex>` também vem).
   Assinatura inválida → descarte com 401. Cheque o `t` contra replay
   (tolerância de poucos minutos).
3. **Dedupe por `event_id`** — reenvios repetem o mesmo id.
4. Responda 2xx em milissegundos; processe async. Sem 2xx a Lunium reenvia.
5. Prove antes de produção: `POST /webhooks/test` dispara uma entrega real
   assinada; `GET /webhooks/deliveries` audita o histórico e
   `POST /webhooks/deliveries/{event_id}/retry` reenvia uma específica.

Assinatura em pseudo-código:

```
esperado = "t=" + t + ",v1=" + HMAC_SHA256(secret, t + "." + corpo_cru)
seguro   = comparacao_em_tempo_constante(esperado, header)
```
