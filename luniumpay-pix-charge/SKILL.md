---
name: luniumpay-pix-charge
description: Receber um PIX de um pagador brasileiro e liquidar em stablecoin (cash-in da Lunium). Use quando o usuário quiser cobrar em reais e receber USDT/USDC/DePix, gerar QR code PIX programaticamente, ou montar checkout PIX→cripto.
---

# Cash-in: PIX entra, stablecoin sai

## Fluxo

1. `POST /keys/sandbox` → chave `lun_test_` (desenvolva sem conta).
2. `POST /cashin/charge` com `amount_cents` (INTEIRO, centavos), `chain`
   (ex.: "polygon"), `asset` ("usdt" | "usdc" | "depix"), `payout_address`
   (recebe a stablecoin após o PIX ser pago) e **`external_id` seu**.
3. Mostre `qr_copypaste` ao pagador. A cobrança expira — leia `expires_at`.
4. Acompanhe `GET /cashin/{id}/status` **ou** receba o webhook assinado.
5. Estados terminam em pago+liquidado; o comprovante carrega o E2E do Bacen.

## Armadilhas que derrubam integrações

- **Escada do pagador**: CPF estreante ≈ R$ 60 no primeiro PIX
  (`erro=limite_do_pagador` quando estoura → siga o `agent_guidance`: valor
  menor agora, teto sobe com o histórico).
- `payer_tax_number` só números (11 = CPF, 14 = CNPJ).
- Retry sempre com o MESMO `external_id`.
- No sandbox, os centavos escolhem o desfecho (.02 falha, .08 estoura a
  escada anti-fraude…) — exercite os dois caminhos antes de entregar.

Limites vigentes: `GET /cashin/limits` (com chave). Preview sem criar:
`POST /cashin/preview`.
