---
name: luniumpay-custody
description: "Receber Pix em saldo em reais na LuniumPay (sem carteira fixa), separar por cliente com subcontas, sacar em cripto para uma rota do catálogo, transferir entre subcontas e pagar Pix com o saldo (hoje em manutenção na produção). Use quando o dono do app não tem carteira, quer acumular e sacar depois, opera marketplace/plataforma com vários clientes finais, ou precisa entender retenção, carência e em_manutencao. EN: Receive Pix into a BRL custody balance (no fixed wallet), per-customer sub-accounts, withdraw as crypto to a catalog route, internal transfers, pay Pix from the balance (currently under maintenance in production). Use for marketplaces/platforms or owners without a wallet."
license: MIT
metadata:
  version: "3.0.1"
  api: "1.55.0"
---

# Custódia: Pix entra em reais, sai como você quiser

Base `https://api.luniumpay.com`, header `X-API-Key` (chave gerada no painel, guardada com
`node luniumpay/scripts/chave.mjs`). Valores em centavos inteiros. Em produção, a cobrança exige a conta
liberada (`key.cashin_enabled`; senão 403 `recebimento_sem_autorizacao`) e, em conta nova, o upgrade de
conta (`verificacao_titular`; senão 403 `verificacao_titular_pendente`).

## Receber em saldo
`POST /cashin/charge` com `"destino": "saldo"`, `amount_cents`, `payer_tax_number`
(do pagador, dígito verificador validado no seu app), `external_id` e opcional `customer_ref`
(subconta = seu cliente final). Sem `asset`/`chain`/`payout_address`. QR e acompanhamento
iguais a `luniumpay-pix-charge`. Crédito líquido em `net_cents`; aparece em
`GET /saldo?customer_ref=…` quando `status=paid` e `settlement_status=sent`.

## Ler saldo
- `GET /saldo` (casa) ou `GET /saldo?customer_ref=cliente-42` → `disponivel_cents`,
  `bloqueado_cents`, `proximas_liberacoes[]` (`valor_cents`, `disponivel_em`), `em_carencia`,
  `carencia_ate`, `carencia_horas`, taxas de saque (`saque_fee_bps`, `saque_taxa_estimada_cents`,
  `saque_cripto_conversao_fee_bps`), `pix_rules` (teto por Pix).
- `GET /saldo/clientes` (subcontas paginadas), `GET /saldo/consolidado` (casa + clientes),
  `GET /saldo/extrato` (ledger ou operações agrupadas).

## Retenção: duas camadas, nenhuma é falha
1. **Faixa do pagador** (decidida na criação do QR): `hold_hours`, `liberar_em` e, quando gravado,
   `hold_reason` (`new_payer` = CPF/CNPJ novo · `new_account` = conta nova) no `POST /cashin/charge`, no
   status e nos webhooks (`cashin.held`). Pagador estreante acima da faixa instantânea espera; o teto e a
   faixa sobem com o histórico (`GET /cashin/limits?payer_tax=`). Retenção do provedor aparece em
   `held`/`held_hours`/`delay_until`.
2. **Carência do saldo** (decidida no crédito): o valor entra em `bloqueado_cents` com data em
   `proximas_liberacoes[].disponivel_em` e `em_carencia: true`; webhooks `saldo.congelado` →
   `saldo.liberado`. Saque e payout usam só `disponivel_cents`.
Mostre "EM RETENÇÃO" com a data de liberação no horário de Brasília (motivo só com `hold_reason`), não
peça outro Pix, não recrie a cobrança. Só a camada 2 aparece no sandbox (cenário `held`); a camada 1 só em
produção.

## Sacar em cripto (sem teto comercial por valor)
`POST /saldo/sacar-cripto`:
```json
{"amount_cents": 50000, "asset": "usdt", "chain": "polygon",
 "payout_address": "<carteira do dono>", "tax_number": "<CPF/CNPJ do dono do saldo>",
 "customer_ref": "cliente-42", "external_id": "saque-2026-10-24-01",
 "max_debited_cents": 51500}
```
- `asset` minúsculo e `chain` de uma rota `entregavel: true` de `GET /cashin/catalog` (aliases aceitos:
  `trc20`, `erc20`, `bep20`, `sol`, `base`…). A criação revalida a rota: `rede_indisponivel`/`asset_invalido`
  → ofereça outra rota do catálogo. DePix/Liquid não vale para saque do saldo. `payout_tag` obrigatório em
  redes com memo (XRP, XLM, TON…), senão 400 `memo_obrigatorio`. Não há prévia pública de saque.
- `max_debited_cents` protege contra taxa maior que o esperado (409 `taxa_alterada`).
- Resposta: `debited_cents` (valor + taxa), `fee_cents`, `settlement_status`
  (`sending` → `sent`; `incerto` = conciliar, não repetir).
- Respeita saldo livre, mínimos da rota (`withdrawMin`) e carência; não herda o teto do Pix.

## Pagar Pix com o saldo (payout) — em manutenção na produção
Desde 21/11/2026 o `POST /payouts` de produção responde 503 `em_manutencao` (`acao: esperar`), sem reserva
nem débito; `GET /keys/me` mostra `payout.enabled: false` e `payout.via: "manutencao"`. Não repita em laço;
consultas e comprovantes de payouts antigos seguem. Enquanto isso: sacar em cripto (acima) e pagar o Pix pela
carteira USDT (`luniumpay-usdt-wallet`) ou pela venda de cripto (`luniumpay-crypto-sale`). O contrato abaixo
vale no sandbox e quando `payout.enabled` voltar a `true`:

`POST /payouts` `{"amount_cents": 5000, "pix_key": "<chave>", "pix_key_type": "cpf",
"tax_number": "<CPF/CNPJ do recebedor>", "customer_ref": "cliente-42",
"external_id": "pg-fornecedor-77"}`
- Teto por Pix em `pix_rules.max_amount_cents` do `/saldo` (padrão R$ 6.000,00), sujeito a
  limites menores da conta. Débito ANTES do envio (valor + `saque_fee`). `tax_number`
  obrigatório com chave de e-mail, telefone ou aleatória; derivável de chave CPF/CNPJ.
- `GET /payouts/{id}` → `status` `pending` → `sent` (`e2e`, `verify_url`) · `failed`
  (`error`, saldo volta) · `refunded`. Histórico: `GET /payouts` → `payouts[]`.
- 11 dígitos: envie `pix_key_type` (`cpf` ou `phone`).

## Mover entre subcontas (sem Pix)
`POST /saldo/transferir` `{"from_customer_ref": "casa", "to_customer_ref": "cliente-42",
"amount_cents": 1000, "descricao": "bônus", "external_id": "tr-001"}`.

## Comissão do parceiro (se você revende)
`GET /comissao`, `GET /comissao/extrato`, `POST /comissao/sacar`. Comissão só sobre
operação liquidada; Pix retido, contestado ou devolvido nunca gera comissão.

## Webhooks
`cashin.paid` → `cashin.settled` (crédito), `cashin.held`, `saldo.congelado`, `saldo.liberado`,
`saldo.transferido`, `payout.sent|failed|refunded`.

## Sandbox
Cenários do saldo (`sandbox_scenario`): `success`, `delayed`, `held`, `expired`, `refunded`,
`failed`, `payer_mismatch`, `settlement_failed`, `settlement_uncertain`, `provider_unavailable`.
Payout: `success`, `delayed`, `failed`, `refunded`, `settlement_failed`, `settlement_uncertain`,
`provider_unavailable`. Saque cripto: `success`, `delayed`, `settlement_failed`,
`settlement_uncertain`, `route_unavailable`, `provider_unavailable`. Estado `incerto` fecha com
`POST /sandbox/operations/{cashin_id}/resolve` `{"outcome": "sent"}`. A escada por pagador fica
desligada no sandbox (teto fixo, sem `limite_do_pagador`).
Prova: `node scripts/smoke-custody.mjs` (lê a `lun_test_` do ambiente ou do `.env`) cobra em saldo, simula o Pix, mostra a carência do
cenário `held`, transfere, faz um payout e um saque em cripto, tudo fictício.
