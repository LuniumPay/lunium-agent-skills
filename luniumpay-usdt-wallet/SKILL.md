---
name: luniumpay-usdt-wallet
description: "Carteira USDT/USDC na LuniumPay — depositar stablecoin em várias redes, manter saldo em cripto e pagar Pix com ele por chave Pix ou Pix Copia e Cola, com cotação, reserva e comprovante. Use quando o dono do app quer pagar contas, fornecedores ou clientes em Pix usando USDT que já possui, sem converter antes."
---

# Carteira USDT: saldo em stablecoin, Pix pago com ele

Liberada para todas as chaves de produção; sandbox simula. Valores em **string
decimal** (`"amount": "100"`, `"brl_amount": "250.00"`).

## 1. Ver a carteira
`GET /carteira-usdt` → `enabled`, `balance`, `networks[]` (rede, mínimo, prazo),
`min_deposit`, `min_payment_brl`, `deposit_validity_hours`, `payments_enabled`,
`pix_rules` (teto por Pix etc.).

## 2. Depositar
`POST /carteira-usdt/deposits` `{"amount": "100", "network": "tron"}` →
`deposit_id`, `address`, `network`, `accepted_assets`, `amount_to_send`,
`expires_at`, `instructions`. Mostre endereço, rede e prazo **exatamente como
vieram**; nunca gere nem reutilize endereço. `GET /carteira-usdt/deposits` até
`status=available` (creditado). Depósito pré-creditado em confirmação ainda não
é saldo livre.

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
`GET /carteira-usdt/payments/{id}` até `final: true`. `GET /carteira-usdt/statement`
= extrato.

## Sacar USDT de volta
`GET /carteira-usdt/withdrawals/networks` → `POST /carteira-usdt/withdrawals/quote`
→ `POST /carteira-usdt/withdrawals` → `GET /carteira-usdt/withdrawals/{id}`
(ou por `external/{external_id}`).

## Armadilhas
- Rede errada perde fundos: confirme `network` com o dono antes de mostrar o endereço.
- `saldo_insuficiente`: saldo precisa cobrir `usdt_total` (ordem + taxa); leia
  `balance` e a reserva (`reserve_usd`).
- Piso por Pix (`min_payment_brl`) e teto (`pix_rules`) vêm da API.
- Cotação vence (`expires_at`); recote em vez de insistir.
- `final: false` = em andamento; não pague de novo. Com `error`, leia e informe.
- Copia e cola de valor fixo paga EXATAMENTE o valor do código.
