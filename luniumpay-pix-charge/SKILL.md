---
name: luniumpay-pix-charge
description: "Receber Pix de um pagador brasileiro e liquidar em USDT/USDC na carteira do dono (ou em saldo em reais) com a LuniumPay. Use quando o usuário quiser \"receber Pix em USDT\", cobrar em reais com entrega em cripto, gerar QR Pix por API, ou montar checkout Pix → stablecoin em Next.js, Express, FastAPI ou Supabase. Inclui receitas por stack e script de teste no sandbox. EN: Accept a Pix payment from a Brazilian customer and settle USDT/USDC to the owner wallet (or BRL balance) with LuniumPay. Use for \"accept Pix, receive USDT\", Pix QR by API, Pix → stablecoin checkout in Next.js, Express, FastAPI or Supabase. Stack recipes and sandbox smoke script included."
license: MIT
metadata:
  version: "2.2.0"
  api: "1.45.2"
---

# Cash-in: Pix entra, USDT sai

Base: `https://api.luniumpay.com`. Header `X-API-Key: <LUNIUM_API_KEY>` em todas as
chamadas. Chave de teste: `POST /keys/sandbox` com `{"email": "<e-mail de quem testa>"}`
(obrigatório). Chave de produção: `POST /keys` com `{"name": "<negócio>", "email": "<e-mail>"}`.

## Decisão inicial: destino

- `destino: "cripto"` → USDT/USDC entregue na `payout_address` em cada cobrança
  (ou na `settlement_address` da chave, se configurada). Exige `asset` e `chain`
  presentes em `GET /cashin/catalog` com `entregavel: true`.
- `destino: "saldo"` → crédito em reais na custódia, sem carteira. Dono saca
  depois (`POST /saldo/sacar-cripto`) ou paga Pix com o saldo. Use quando o dono
  não tem carteira ou quer agrupar saques. `customer_ref` separa subcontas.

## Sequência (sempre nesta ordem)

1. `GET /keys/me` → capacidades, taxas, `nivel_conta`, webhook configurado?
2. `GET /cashin/catalog` → escolha `asset` + `network` (vai no campo **`chain`**).
   Confira `withdrawMin`, `minBuyAmount`, `memoRequired` (redes como XRP/TON
   exigem `payout_tag`).
3. `POST /cashin/preview` `{"amount_cents": 10000, "destino": "cripto",
   "asset": "USDT", "chain": "polygon"}` → `net_cents`, `asset_amount`
   (estimativa), `min_brl_cents`, `fee_total_cents`. Mostre como estimativa.
4. Persista seu `external_id` (≤ 64 chars, único por intenção) **antes** de criar.
5. `POST /cashin/charge`:
   ```json
   {
     "amount_cents": 10000,
     "payer_tax_number": "<CPF/CNPJ do pagador, só dígitos>",
     "destino": "cripto",
     "asset": "USDT",
     "chain": "polygon",
     "payout_address": "<carteira confirmada pelo dono>",
     "external_id": "pedido-4812",
     "customer_ref": "cliente-42"
   }
   ```
   Resposta: `cashin_id`, `status: "pending"`, `qr_copypaste`, `qr_image_url`,
   `expires_at`, `net_cents`, `hold_hours`.
6. Frontend mostra `qr_image_url` + `qr_copypaste` + valor + validade. Nada gerado
   localmente.
7. Acompanhe por webhook (`cashin.paid`, `cashin.settled`, `cashin.held`,
   `cashin.failed`, `cashin.refunded`, `cashin.expired`) e confirme por
   `GET /cashin/{cashin_id}/status`. Polling: a cada 5 s até `expires_at`.

## Leitura do status (três eixos independentes)

| Campo | Valores | Significado |
|---|---|---|
| `status` | pending, delayed, under_review, paid, expired, refunded, failed | O Pix em si |
| `settlement_status` | pending, sending, entregando, sent, incerto, failed | A entrega/crédito |
| `settlement_proof` | none, broadcast, confirmed, reported, simulated | Evidência da entrega |

- Libere o pedido quando `status=paid` **e** `settlement_status=sent` (ou, para
  saldo, quando o crédito aparecer em `GET /saldo`). Para rastro on-chain use
  `settlement_tx_hash` / `settlement_tx_url` e `settlement_proof=confirmed`.
- `held: true` / `hold_hours > 0`: retenção automática por faixa do pagador.
  Mostre `liberar_em`. Não peça outro Pix.
- `settlement_status=incerto`: estado de conciliação. Mostre e aguarde; nunca
  repita a cobrança nem anuncie entrega.
- `e2e` é o identificador do Banco Central: qualquer um prova o Pix em
  `GET /v1/verificar/{e2e}` sem chave.

## Armadilhas

- A API **não valida o dígito verificador** de `payer_tax_number`: CPF digitado errado gera QR
  normalmente e o Pix volta como `refunded` (`refund_reason=PAYER_MISMATCH`). Valide no app
  antes de chamar (`documentoValido` nas receitas). Formato errado → `documento_invalido`.
- `payer_name` é opcional (só informativo). `delivery_mode` (`full`|`split`) existe só para
  `chain: "liquid"` (DePix); ignore nas demais redes.
- Pagador estreante tem teto baixo: `erro=limite_do_pagador` → ofereça valor
  menor; o teto sobe com o histórico. Não divida a compra em vários Pix para
  contornar.
- `external_id` reaproveitado com corpo diferente → `external_id_divergente`.
  Crie um id novo para uma intenção nova.
- Taxa fixa por Pix e percentual vêm da conta (`GET /keys/me`, prévia). Não os
  grave no código.
- Sandbox: `qr_copypaste` vem como `SANDBOX:NAO_PAGAVEL:...`; pague só com
  `POST /sandbox/cashin/{id}/pay`. `sandbox_scenario` por destino — cripto: `success`,
  `delayed`, `expired`, `refunded`, `failed`, `payer_mismatch`, `settlement_failed`,
  `settlement_uncertain`, `route_unavailable`, `provider_unavailable`; saldo: os mesmos +
  `held` (carência visível em `GET /saldo`). Cenário de outro fluxo → 400 `cenario_invalido`.
  `settlement_uncertain` para em `incerto`: feche com `POST /sandbox/operations/{cashin_id}/resolve`
  `{"outcome": "sent"}`. A escada por pagador fica desligada no sandbox. Omita em produção.

## Receitas prontas

Todas leem `LUNIUM_DESTINO` (`cripto` com `LUNIUM_PAYOUT_ADDRESS`, ou `saldo` sem carteira) e
validam o dígito do CPF/CNPJ antes de chamar a API.
- `references/nextjs.md` — App Router: rota de cobrança, rota de status, webhook com corpo cru.
- `references/express.md` — Node/Express com `express.raw` no webhook.
- `references/fastapi.md` — Python/FastAPI com httpx.
- `references/supabase-edge.md` — Edge Function Deno + tabela `pedidos`.
- `scripts/smoke.mjs` — prova ponta a ponta no sandbox (recusa `lun_live_`).
