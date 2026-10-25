---
name: luniumpay-crypto-sale
description: Pagar uma chave Pix ou um Pix copia e cola usando cripto (cash-out da LuniumPay) — cotação, aceite, depósito on-chain e Pix com comprovante E2E. Use quando o usuário quiser transformar USDT/USDC (ou outro ativo do catálogo) em reais numa conta Pix, ou pagar um boleto Pix com cripto.
---

# Cash-out: cripto entra, Pix sai

## Fluxo (3 passos + acompanhamento)

1. `GET /catalog` → o par (`asset`, `network`) precisa existir. (É outro catálogo,
   diferente de `/cashin/catalog`.)
2. `POST /cash-outs` com `asset`, `network`, `external_id` e UM destes:
   `amount` (decimal em string, ex. `"25.5"`) ou `brl_amount` (`"100.00"`), mais
   `pix_key` + `pix_key_type` (`cpf`, `cnpj`, `email`, `phone`, `evp`); ou
   `br_code` completo para pagar uma cobrança existente (hoje USDT/USDC em rotas
   compatíveis). Resposta: cotação, custos, `expires_at`.
3. `POST /cash-outs/{id}/accept` → trava a cotação e devolve `deposit_address`,
   `network`, `deposit_tag` (quando houver). Mostre exatamente; nunca invente nem
   reutilize endereço de outra ordem. Cotação expirada → `cotacao_expirada` →
   recote.
4. A pessoa envia o valor EXATO cotado, na rede exata, com memo/tag se exigido.
5. `GET /cash-outs/{id}` até `state: "COMPLETED"`. Então `pix_e2e`,
   `receipt_url`, `receipt_pdf_url`, `verify_url`. O comprovante pode ficar
   pronto depois (`cashout.receipt_ready`).

## Estados
`QUOTE_CREATED → AWAITING_DEPOSIT → DEPOSIT_DETECTED → DEPOSIT_CONFIRMED → SELLING/SOLD/FORWARDING → PAYING_OUT → COMPLETED`.
Desvios: `DELAYED`, `PROCESSING`, `MANUAL_REVIEW`, `AWAITING_REFUND_ADDRESS`,
`REFUNDING`/`REFUNDING_CRYPTO` → `REFUNDED`, `EXPIRED`, `FAILED`.

## Armadilhas
- `MANUAL_REVIEW`, `PAYING_OUT`, `DELAYED` e timeouts NÃO autorizam outro
  depósito. Acompanhe a mesma ordem.
- `AWAITING_REFUND_ADDRESS`: peça ao cliente a carteira confirmada na rede
  informada. `deposit_from` é só informativo; nunca devolva "para a origem".
- `provedor_indisponivel` (`acao=repetir`) → repita a MESMA chamada com o MESMO
  `external_id`. Recusa de compliance → NUNCA retente; informe a pessoa.
- Depósito de valor diferente do cotado não concilia.
- 11 dígitos crus são ambíguos (CPF ou telefone): envie sempre `pix_key_type`.
- Sandbox: `sandbox_scenario` (`success`, `delayed`, `failed`, `expired`,
  `refunded`, `settlement_uncertain`, `provider_unavailable`, `route_unavailable`,
  `no_deposit`); nenhum depósito real. Omita em produção.
