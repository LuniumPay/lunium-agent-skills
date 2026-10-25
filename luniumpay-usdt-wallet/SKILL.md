---
name: luniumpay-usdt-wallet
description: "Carteira USDT/USDC na LuniumPay — depositar stablecoin em várias redes, manter saldo em cripto e pagar Pix com ele por chave Pix ou Pix Copia e Cola, com cotação, reserva e comprovante. Use quando o dono do app quer pagar contas, fornecedores ou clientes em Pix usando USDT que já possui, sem converter antes. EN: USDT/USDC wallet at LuniumPay: deposit stablecoin on several networks, hold a crypto balance and pay Pix from it by key or copy-and-paste, with quote, reserve and receipt."
license: MIT
metadata:
  version: "2.2.0"
  api: "1.45.2"
---

# Carteira USDT: saldo em stablecoin, Pix pago com ele

Liberada para todas as chaves de produção. Valores em **string decimal**
(`"amount": "100"`, `"brl_amount": "250.00"`).

## 1. Ver a carteira
`GET /carteira-usdt` → `enabled`, `payments_enabled`, `withdrawals_enabled`, `balance`
(`available` paga Pix agora, `reserved` preso em cotações, `confirming` em confirmação),
`networks[]` (`network`, `name`, `assets[]`, `eta_minutes`), `min_deposit`, `min_payment_brl`,
`deposit_validity_hours`, `payment_methods`, `pix_rules` (teto por Pix etc.).

## 2. Depositar
`POST /carteira-usdt/deposits` `{"amount": "100", "network": "tron"}` →
`deposit_id`, `address`, `network`, `accepted_assets`, `amount_to_send`,
`expires_at`, `instructions`. Mostre endereço, rede e prazo **exatamente como
vieram**; nunca gere nem reutilize endereço. `GET /carteira-usdt/deposits` →
`items[]` com `status` `waiting` → `confirming` → `available` (creditado) · `expired`.
`confirming` ainda não é saldo livre.

## 3. Cotar um Pix
`POST /carteira-usdt/quote` com **ou** `{"brl_amount": "250.00", "pix_key": "<chave>",
"pix_key_type": "cnpj"}` **ou** `{"br_code": "000201…"}` (copia e cola: valor e
recebedor vêm do código). Resposta: `usdt_order`, `withdrawal_fee`, `usdt_total`,
`usdt_reserved`, `merchant_name`, `expires_at`, `quote_id`. Mostre o total em
USDT como cotação com validade.

## 4. Pagar
`POST /carteira-usdt/payments` com os mesmos campos da cotação + `external_id`
(e `quote_id` se usou `br_code`). Resposta: `payment_id`, `status`, `final`,
`usdt_debited`, `pix_e2e`, `recipient_name`, `receipt_url`, `error`.
`GET /carteira-usdt/payments/{id}` até `final: true`. Histórico:
`GET /carteira-usdt/payments`; extrato: `GET /carteira-usdt/statement`.

## Sacar USDT de volta
`GET /carteira-usdt/withdrawals/networks` (rotas e mínimos) →
`POST /carteira-usdt/withdrawals/quote` (prévia, sem reserva) →
`POST /carteira-usdt/withdrawals` (confirma, com `external_id`) →
`GET /carteira-usdt/withdrawals/{id}` ou `GET /carteira-usdt/withdrawals/external/{external_id}`
(recupera pela sua referência após timeout). Lista: `GET /carteira-usdt/withdrawals`.

## Armadilhas
- Rede errada perde fundos: confirme `network` com o dono antes de mostrar o endereço.
- `saldo_insuficiente` (409): `available` precisa cobrir `usdt_reserved` (ordem + taxa + reserva).
  Leia `balance` e oriente a depositar ou reduzir.
- Piso por Pix (`min_payment_brl`) e teto (`pix_rules`) vêm da API.
- Cotação vence (`expires_at`); recote em vez de insistir.
- `final: false` = em andamento; não pague de novo. Com `error`, leia e informe.
- Copia e cola de valor fixo paga EXATAMENTE o valor do código.

## Sandbox (limite honesto)
`GET /carteira-usdt` e `POST /carteira-usdt/quote` respondem com cotação simulada; o depósito
nasce `waiting` e **não existe crédito simulado**, então `POST /carteira-usdt/payments` devolve
`saldo_insuficiente`. Prove a carteira com chave de produção e um depósito pequeno, ou use o
sandbox só para o contrato (campos, erros, UI). Para o caminho cripto → Pix com simulação
completa, use `luniumpay-crypto-sale`.
