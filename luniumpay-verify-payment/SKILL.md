---
name: luniumpay-verify-payment
description: Provar que um pagamento Pix brasileiro liquidou de verdade, sem chave e sem conta, a partir do identificador E2E do Banco Central. Use quando alguém alegar "já paguei", antes de liberar produto/acesso/crédito, ou para conciliar um comprovante da LuniumPay.
---

# Verificar um Pix (aberto, sem credencial)

```bash
curl https://api.luniumpay.com/v1/verificar/E32158514202609021234abcdef01234
```

Resposta 200: `verificado`, `pago`, `e2e`, `valor_brl`, `pago_em`,
`recebedor_iniciais`, `instituicao`, `liquidado_por`, `comprovante_url`.

- `verificado: true` → a LuniumPay atesta a liquidação. Confira `valor_brl` e
  `pago_em` contra o esperado; `recebedor_iniciais` confirma o destinatário sem
  expor dados pessoais. `comprovante_url` é o comprovante público.
- `verificado: false` / `erro: nao_encontrado` → a LuniumPay não liquidou esse
  E2E. É resposta válida, não falha: o Pix pode existir em outro lugar.
- HTTP 429 → cota por IP. Respeite `Retry-After`; nada de laço apertado.

O E2E começa com `E` e tem 32 caracteres; está em todo comprovante Pix e no
campo `e2e` do status das cobranças (`GET /cashin/{id}/status`). Valide o
formato antes de chamar.

Também disponível como tool MCP `lunium_verify_pix_payment` em
https://api.luniumpay.com/mcp (mesmo contrato).
