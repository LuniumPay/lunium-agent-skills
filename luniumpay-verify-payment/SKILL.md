---
name: luniumpay-verify-payment
description: Provar que um pagamento PIX brasileiro liquidou de verdade, sem chave e sem conta, a partir do identificador E2E do Banco Central. Use quando alguém alegar "já paguei", antes de liberar produto/acesso/crédito, ou para conciliar um comprovante.
---

# Verificar um PIX (grátis, sem credencial)

```bash
curl https://api.luniumpay.com/v1/verificar/E32158514202609021234abcdef01234
```

- `verificado: true` → a Lunium atesta a liquidação. Confira `valor_brl` e
  `pago_em` contra o que você esperava; `recebedor_iniciais` confirma o
  destinatário sem expor PII.
- `verificado: false, erro: nao_encontrado` → a Lunium não liquidou esse E2E.
  É resposta válida — não significa que o pagamento não existe no mundo, só
  que não passou por aqui.
- HTTP 429 → cota por IP. Respeite `Retry-After` (não faça busy-loop).

O E2E começa com a letra E e está em todo comprovante de PIX. Valide o formato
antes de chamar (`E` + ~31 caracteres alfanuméricos).

Também disponível como tool MCP `lunium_verify_pix_payment` em
https://api.luniumpay.com/mcp — mesmo contrato.
