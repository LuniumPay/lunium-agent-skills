---
name: luniumpay-custody
description: Receber Pix em saldo em reais na LuniumPay (sem carteira fixa), separar por cliente com subcontas, sacar em cripto para qualquer rede do catálogo, pagar Pix com o saldo e transferir entre subcontas. Use quando o dono do app não tem carteira, quer acumular e sacar depois, opera marketplace/plataforma com vários clientes finais, ou precisa pagar fornecedores em Pix com o que recebeu.
---

# Custódia: Pix entra em reais, sai como você quiser

Base `https://api.luniumpay.com`, header `X-API-Key`. Valores em centavos inteiros.

## Receber em saldo
`POST /cashin/charge` com `"destino": "saldo"`, `amount_cents`, `payer_tax_number`
(do pagador), `external_id` e opcional `customer_ref` (subconta = seu cliente final).
Sem `asset`/`chain`/`payout_address`. QR e acompanhamento iguais a
`luniumpay-pix-charge`. Crédito líquido das taxas em `net_cents`; aparece em
`GET /saldo?customer_ref=…` quando `status=paid` e `settlement_status=sent`.

## Ler saldo
- `GET /saldo` (casa) ou `GET /saldo?customer_ref=cliente-42` → `disponivel_cents`,
  `bloqueado_cents`, `proximas_liberacoes`, `carencia_horas`, taxas de saque
  (`saque_fee_bps`, `saque_taxa_estimada_cents`, `saque_cripto_conversao_fee_bps`).
- `GET /saldo/clientes` (todas as subcontas), `GET /saldo/consolidado`,
  `GET /saldo/extrato` (ledger).
- Bloqueado ≠ perdido: retenção por faixa do pagador ou carência do primeiro
  depósito; `proximas_liberacoes` diz quando.

## Sacar em cripto (sem teto comercial por valor)
`POST /saldo/sacar-cripto`:
```json
{"amount_cents": 50000, "asset": "usdt", "chain": "polygon",
 "payout_address": "<carteira do dono>", "tax_number": "<CPF/CNPJ do dono do saldo>",
 "customer_ref": "cliente-42", "external_id": "saque-2026-10-24-01",
 "max_debited_cents": 51500}
```
- `asset` minúsculo e `chain` conforme `GET /cashin/catalog` (aliases aceitos:
  `trc20`, `erc20`, `bep20`, `sol`, `base`…). `payout_tag` obrigatório em redes
  com memo (XRP, XLM, TON…).
- `max_debited_cents` protege contra taxa maior que o esperado (409 `taxa_alterada`).
- Resposta: `debited_cents` (valor + taxa), `fee_cents`, `settlement_status`
  (`sending` → `sent`; `incerto` = conciliar, não repetir).
- Respeita saldo livre, mínimos da rota (`withdrawMin`) e carência; não herda o
  teto de entrada do Pix.

## Pagar Pix com o saldo (payout)
`POST /payouts` `{"amount_cents": 5000, "pix_key": "<chave>", "pix_key_type": "cpf",
"tax_number": "<CPF/CNPJ do recebedor>", "customer_ref": "cliente-42",
"external_id": "pg-fornecedor-77"}`
- Máximo R$ 6.000,00 por Pix, sujeito a limites menores da conta. Débito ANTES
  do envio (valor + `saque_fee`). `tax_number` obrigatório com chave de e-mail,
  telefone ou aleatória; derivável de chave CPF/CNPJ.
- `GET /payouts/{id}` → `status` `pending` → `sent` (`e2e`, `verify_url`) ·
  `failed` (`error`, saldo volta) · `refunded`.
- 11 dígitos: envie `pix_key_type` (`cpf` ou `phone`).

## Mover entre subcontas (sem Pix)
`POST /saldo/transferir` `{"from_customer_ref": "casa", "to_customer_ref": "cliente-42",
"amount_cents": 1000, "descricao": "bônus", "external_id": "tr-001"}`.

## Comissão do parceiro (se você revende)
`GET /comissao`, `GET /comissao/extrato`, `POST /comissao/sacar`. Comissão só sobre
operação liquidada; Pix retido, contestado ou devolvido nunca gera comissão.

## Webhooks
`cashin.paid` → `cashin.settled` (crédito), `saldo.congelado`, `saldo.liberado`,
`saldo.transferido`, `payout.sent|failed|refunded`.

## Prova no sandbox
`node scripts/smoke-custody.mjs`: cobra em saldo, simula o Pix, lê o saldo da
subconta, transfere, faz um payout e um saque em cripto, tudo fictício.
