# Estados — quando liberar o quê

## Cash-in (`GET /cashin/{id}/status`) — três eixos independentes

| Eixo | Valores | Lê-se como |
|---|---|---|
| `status` | `pending` → `paid` · `delayed` · `under_review` · `expired` · `refunded` · `failed` | o Pix |
| `settlement_status` | `pending` → `sending`/`entregando` → `sent` · `incerto` · `failed` | a entrega (cripto) ou o crédito (saldo) |
| `settlement_proof` | `none` · `broadcast` · `confirmed` · `reported` · `simulated` | evidência da entrega |

- **Liberar produto (destino cripto):** `paid` **e** `sent`. Para rastro: `settlement_tx_hash`, `settlement_tx_url`, `proof=confirmed`.
- **Liberar produto (destino saldo):** `paid` e `sent`; o crédito aparece em `GET /saldo` (`disponivel_cents`). Pode haver carência: `bloqueado_cents`, `proximas_liberacoes`.
- `held: true` / `hold_hours > 0` / `liberar_em`: retenção automática pela faixa do pagador. Não é falha. Não peça outro Pix.
- `delayed`: provedor demorando. Espere; o estado final chega por webhook/status.
- `under_review`: análise de risco. Espere. Não repita.
- `incerto`: conciliação em curso. Mostre o estado e aguarde; nunca anuncie entrega nem recrie a cobrança.
- `refunded`: Pix devolvido ao pagador (`refund_reason`, `refund_reason_detail`). Comunique; não há entrega.
- `expired`: ninguém pagou até `expires_at`. Nova intenção = novo `external_id`.
- `broadcast` ≠ falha: tx informada sem confirmação registrada. Ausência de confirmação não prova nada.
- `trilho` (`casa`, `corretora`, `saldo`, `liquid`) é informativo, não é promessa de prazo.
- `e2e`: identificador do Banco Central. Prova pública em `GET /v1/verificar/{e2e}`.

## Cash-out (`GET /cash-outs/{id}` → `state`)
`QUOTE_CREATED → AWAITING_DEPOSIT → DEPOSIT_DETECTED → DEPOSIT_CONFIRMED → SELLING → SOLD → FORWARDING → PAYING_OUT → COMPLETED`
- Só `COMPLETED` conclui. `pix_e2e`, `receipt_url`, `receipt_pdf_url`, `verify_url` aparecem aí (o comprovante pode vir depois: `cashout.receipt_ready`).
- `DELAYED`, `PROCESSING`, `PAYING_OUT`, `MANUAL_REVIEW`: em andamento. **Nenhum autoriza novo depósito.**
- `AWAITING_REFUND_ADDRESS`: peça ao cliente a carteira confirmada na rede informada. `deposit_from` é informativo; nunca "devolver para a origem".
- `REFUNDING_CRYPTO` / `REFUNDING` → `REFUNDED` (`refund_tx_hash`, ativo e valor reais da devolução). `provider_return_txid` não é devolução ao cliente.
- `EXPIRED` (cotação venceu sem depósito) · `FAILED`.

## Payout Pix com saldo (`GET /payouts/{id}` → `status`)
`pending` → `sent` (concluído, `e2e`, `verify_url`) · `failed` (`error`) · `refunded`. Débito acontece ANTES do envio (valor + taxa).

## Saque do saldo em cripto (`POST /saldo/sacar-cripto` → `settlement_status`)
Mesmo eixo do cash-in: `sending` → `sent` · `incerto` · `failed`. `debited_cents` = valor + taxa. Sem teto comercial por valor; respeita saldo livre, mínimos da rota e carência.

## Carteira USDT (`GET /carteira-usdt/payments/{id}`)
`status` + `final: true|false`. Com `final: true` leia `pix_e2e`, `receipt_url` ou `error`. Depósito: `GET /carteira-usdt/deposits` → `status=available` quando creditado.

## Webhooks correspondentes
`cashin.paid` (Pix pago, NÃO entregue) → `cashin.settled` (entregue/creditado). `cashin.held`, `cashin.delayed`, `cashin.expired`, `cashin.failed`, `cashin.refunded`, `cashin.settlement_failed`.
`cashout.*` espelha os estados acima. `payout.sent|failed|refunded`. `saldo.congelado|liberado|transferido`.
Webhook avisa; status manda: releia antes de liberar.
