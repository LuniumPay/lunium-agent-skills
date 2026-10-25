---
name: luniumpay-crypto-sale
description: "Pagar uma chave Pix ou um Pix copia e cola usando cripto (cash-out da LuniumPay) — cotação, aceite, depósito on-chain e Pix com comprovante E2E. Use quando o usuário quiser transformar USDT/USDC (ou outro ativo do catálogo) em reais numa conta Pix, ou pagar um boleto Pix com cripto. EN: Pay a Pix key or Pix copy-and-paste code with crypto (LuniumPay cash-out): quote, accept, on-chain deposit, Pix paid with a Central Bank receipt. Use to turn USDT/USDC into BRL on a Pix account."
license: MIT
metadata:
  version: "2.2.0"
  api: "1.45.2"
---

# Cash-out: cripto entra, Pix sai

Base `https://api.luniumpay.com`, header `X-API-Key`. Valores em **string decimal**
(`"amount": "25.5"`, `"brl_amount": "100.00"`); rede no campo **`network`**.

## 0. Catálogo (`GET /catalog`, diferente de `/cashin/catalog`)
- `fast[]` → `{asset, network}` com rota direta (ex.: USDT/polygon).
- `convert[]` → `{asset, networks[], min, max, precision, deposit_eta[]}`: o par vale se
  `network` estiver em `networks`. `deposit_eta` dá confirmações e prazo por rede.
- `dex.chains[]` → tokens long-tail por contrato: `GET /catalog/dex?chain=<chain>` devolve
  `tokens[].address`; envie como `token_address` em `POST /cash-outs` (símbolos repetem, o endereço não).
Par fora do catálogo → `rota_indisponivel`: ofereça outro par, não insista.

## 1. Prévia sem compromisso: `POST /cash-outs/preview`
`{"asset": "USDT", "network": "polygon", "brl_amount": "100.00"}` (ou `amount`, ou `br_code`;
exatamente um dos três; sem `pix_key`). Devolve `amount`, `brl_amount`, `expires_at`. Não cria
ordem, não reserva nada. Use para mostrar o preço antes de pedir a chave Pix.

## 2. Cotar e criar a ordem: `POST /cash-outs`
`asset`, `network`, `external_id` (persistido ANTES; idempotente: mesmo id = mesma ordem) e:
- `brl_amount` (o recebedor recebe exato) **ou** `amount` (quanto cripto o cliente envia), mais
  `pix_key` + `pix_key_type` (`cpf`, `cnpj`, `email`, `phone`, `evp`); **ou**
- `br_code` completo para pagar uma cobrança Pix existente (valor e recebedor vêm do código;
  `merchant_name` na resposta).
Resposta: `cashout_id`, `state: "QUOTE_CREATED"`, `amount`, `brl_amount`, `expires_at`,
`reserve_brl`. Ainda sem endereço.

## 3. Aceitar: `POST /cash-outs/{id}/accept`
Trava a cotação e devolve `deposit_address`, `network`, `deposit_tag` (quando houver),
`state: "AWAITING_DEPOSIT"`. Mostre exatamente como veio; nunca invente, complete ou reutilize
endereço de outra ordem. `cotacao_expirada` → recote (novo `POST /cash-outs`).

## 4. Cliente deposita, você acompanha: `GET /cash-outs/{id}`
Valor EXATO cotado, rede exata, memo/tag se exigido. Acompanhe `state` até `COMPLETED`:
`pix_e2e`, `verify_url`, `receipt_url`, `receipt_pdf_url` (o comprovante pode chegar depois:
webhook `cashout.receipt_ready`). Histórico: `GET /cash-outs` → `cash_outs[]`.

## Estados
`QUOTE_CREATED → AWAITING_DEPOSIT → DEPOSIT_DETECTED → DEPOSIT_CONFIRMED → SELLING/SOLD/FORWARDING → PAYING_OUT → COMPLETED`.
Desvios: `DELAYED`, `PROCESSING`, `MANUAL_REVIEW`, `AWAITING_REFUND_ADDRESS`,
`REFUNDING`/`REFUNDING_CRYPTO` → `REFUNDED`, `EXPIRED`, `FAILED`.

## Devolução (quando a venda não pôde concluir)
`state: "AWAITING_REFUND_ADDRESS"` com `refund_address_required: true` (webhook
`cashout.awaiting_refund_address`): peça ao SEU cliente uma carteira dele na rede indicada em
`refund_network`/`refund_asset` e envie `POST /cash-outs/{id}/refund-address`
`{"refund_address": "<carteira do cliente>"}`. A ordem segue `REFUNDING → REFUNDED`
(`refund_tx_hash`). `deposit_from` é informativo: nunca devolva "para a origem" (pode ser
corretora). Não existe devolução automática sem esse passo.

## Armadilhas
- `MANUAL_REVIEW`, `PAYING_OUT`, `DELAYED`, `PROCESSING` e timeouts NÃO autorizam outro
  depósito. Acompanhe a mesma ordem.
- `provedor_indisponivel` (`acao=repetir`) → repita a MESMA chamada com o MESMO `external_id`.
  Recusa de compliance (`acao=parar`) → NUNCA retente; informe a pessoa.
- Depósito de valor diferente do cotado não concilia. Cotação vencida (`expires_at`) → recote.
- 11 dígitos crus são ambíguos (CPF ou telefone): envie sempre `pix_key_type`.
- Cripto é estimativa até a conversão; não prometa câmbio travado além de `expires_at`.

## Sandbox (dinheiro fictício, catálogo sintético)
- USDT/polygon e DEPIX/liquid simulam a ordem inteira: ~10 s após o `accept` o depósito
  "chega" sozinho e a ordem vai a `COMPLETED` com `pix_e2e`. Nunca envie fundos ao
  `deposit_address` de sandbox, mesmo que pareça um endereço real.
- `sandbox_scenario` (só sandbox; omita em produção): `success`, `delayed`, `failed`,
  `expired`, `refunded`, `no_deposit`, `provider_unavailable`, `route_unavailable`,
  `settlement_uncertain`. O cenário incerto só existe em DEPIX/liquid: a ordem para em
  `PROCESSING` e você fecha com `POST /sandbox/operations/{cashout_id}/resolve`
  `{"outcome": "sent"}` (ou `"failed"` → `REFUNDED`).
- Tokens DEX não são simulados (`/catalog/dex` vem vazio). Prévia funciona.
- Prova pronta: `node scripts/smoke-cashout.mjs [USDT polygon|DEPIX liquid] [cenario]`.
