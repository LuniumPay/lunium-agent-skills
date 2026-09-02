---
name: luniumpay-crypto-sale
description: Vender cripto e pagar uma chave PIX em reais (cash-out da Lunium) — cotação, aceite, depósito on-chain e PIX com comprovante E2E. Use quando o usuário quiser transformar USDT/USDC (ou outro ativo do catálogo) em reais numa conta PIX.
---

# Cash-out: cripto entra, PIX sai

## Fluxo (3 passos + acompanhamento)

1. `POST /cash-outs` com `asset`, `network`, `amount` (decimal em string) OU
   `brl_amount`, `pix_key` (+ `pix_key_type` se 11 dígitos) e `external_id`.
   A resposta traz a cotação e `expires_at`.
2. `POST /cash-outs/{id}/accept` — trava a cotação e devolve
   `deposit_address`. **Aceite rápido**: cotação expirada → `cotacao_expirada`
   → recote (nunca insista na velha).
3. Envie o valor EXATO cotado para `deposit_address` na `network` escolhida.
4. `GET /cash-outs/{id}` até `pix_e2e` aparecer — esse E2E é a prova pública
   (`/v1/verificar/{e2e}` confirma para qualquer terceiro).

## Armadilhas

- Catálogo primeiro: o par (asset, network) precisa existir em `GET /catalog`.
- `provedor_indisponivel` (`acao=repetir`) → repita a MESMA chamada com o
  MESMO `external_id`; no sandbox o gatilho .07 ensaia exatamente isso.
- Recusa de compliance (`pagador_recusado_pelo_provedor`, sandbox .06) →
  NUNCA retente; informe o usuário.
- Depósito de valor diferente do cotado não concilia — envie o valor exato.
