---
name: luniumpay
description: Regras de ouro para integrar a Lunium (PIX ⇄ stablecoin, Brasil) sem erro de primeira. Use SEMPRE que o usuário pedir para integrar PIX, cash-in, cash-out, venda de cripto por reais ou verificação de pagamento com a LuniumPay. Carrega o mapa da plataforma e as armadilhas conhecidas; os detalhes vivem nas URLs vivas (progressive disclosure).
---

# LuniumPay — regras de ouro

Fontes de verdade (leia só quando precisar — não copie docs para o contexto):
- Contrato para máquina: https://api.luniumpay.com/llms.txt
- OpenAPI 3.1 (operationIds completos): https://api.luniumpay.com/openapi.json
- MCP (streamable-HTTP, 10 tools): https://api.luniumpay.com/mcp
- A2A agent card: https://luniumpay.com/.well-known/agent-card.json
- Docs humanas: https://docs.luniumpay.com

## As 10 regras

1. **Comece sem conta.** `POST /keys/sandbox` devolve uma chave `lun_test_` em
   1 chamada. Mesmo contrato de produção: mesmos estados, mesmos erros. Código
   que passa no sandbox roda em produção trocando só a chave.
2. **Verificação de pagamento é grátis e sem chave.**
   `GET /v1/verificar/{e2e}` prova que um PIX liquidou. `nao_encontrado` é
   resposta válida ("a Lunium não liquidou esse E2E"), não falha.
3. **Pagador estreante tem teto baixo (escada de confiança).** O primeiro PIX
   de um CPF novo começa na casa de R$ 60 e sobe com o histórico. Antes de
   disparar cobrança alta, valide com a tool MCP `lunium_check_payer_limit` ou
   trate `erro=limite_do_pagador` orientando um valor menor.
4. **11 dígitos crus são ambíguos.** CPF ou telefone? A API recusa com
   `tipo_ambiguo` em vez de adivinhar. Sempre envie `pix_key_type`.
5. **`external_id` em toda criação.** É a idempotência: retry com o mesmo id e
   mesmos parâmetros devolve a ordem original; parâmetros diferentes retornam
   `external_id_divergente` (não "conserte" mudando o payload no retry).
6. **Todo erro traz `erro` + `acao` + `detail` + `agent_guidance`.** Siga o
   `agent_guidance` literalmente — ele diz o próximo passo executável
   (corrigir campo X, repetir com backoff, parar). Nunca re-tente `acao=parar`.
7. **Valores de cash-in são em CENTAVOS inteiros** (`amount_cents: 15000` =
   R$ 150,00). Valores de cash-out são decimais em string no ativo.
8. **Sandbox determinístico pelos centavos** (.01 delayed · .02 falha ·
   .03 cotação expira · .04 limites · .05 lento · .06 recusa de compliance do
   provedor · .07 primeiro aceite falha 503, segundo funciona · .08 escada
   anti-fraude do pagador). Teste o caminho ruim antes de entregar.
9. **Webhooks têm assinatura** `X-Lunium-Signature` (v2: `t=<ts>,v1=<hmac>`)
   — valide sempre, deduplique por `event_id`, responda 2xx rápido.
10. **Não invente campos nem valores.** Se está na dúvida, é o openapi.json
    que manda; o status ao vivo está na tool MCP `lunium_check_network_health`.

## Ferramentas MCP úteis durante o desenvolvimento

Sem chave: `lunium_verify_pix_payment`, `lunium_list_settlement_options`,
`lunium_check_network_health`, `lunium_create_sandbox_key`.
Com chave: `lunium_check_payer_limit`, `lunium_quote_crypto_sale`,
`lunium_confirm_crypto_sale`, `lunium_create_pix_charge`, consultas de status.
