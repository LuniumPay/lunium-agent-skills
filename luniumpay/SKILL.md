---
name: luniumpay
description: Integrar a LuniumPay (Pix ⇄ stablecoin no Brasil) em qualquer app. Use SEMPRE que o usuário pedir para receber Pix e cair em USDT/USDC, cobrar em reais com entrega em cripto, pagar Pix com cripto, ou verificar um pagamento Pix. Traz o roteiro completo (chave em 1 chamada, backend, QR, webhook, sandbox, produção) e as regras que evitam erro de primeira. Detalhes vivem nas URLs oficiais (progressive disclosure).
---

# LuniumPay — comece aqui

A LuniumPay recebe Pix de clientes brasileiros e entrega USDT/USDC (ou outro ativo
do catálogo) na carteira do dono do app, ou mantém saldo em reais para sacar
depois. Também faz o caminho inverso: cripto entra, Pix sai. Tudo por API REST,
chave de produção em uma chamada, sem aprovação humana.

Fontes de verdade (consulte só o que precisar; nunca copie docs inteiras para o contexto):
- OpenAPI 3.1: https://docs.luniumpay.com/openapi.json
- Contrato para máquina: https://docs.luniumpay.com/llms.txt
- Jornadas estruturadas: https://docs.luniumpay.com/integration.json
- Sandbox (cenários de falha): https://docs.luniumpay.com/sandbox
- Manual humano: https://docs.luniumpay.com/manual

## Roteiro para integrar em um app (vibe coder)

1. **Pergunte 3 coisas** ao dono do app: (a) quer USDT direto na carteira ou saldo
   em reais para sacar depois? (b) rede e endereço da carteira (se cripto);
   (c) e-mail dele (obrigatório para a chave de teste; recomendado na de produção).
2. **Chave de teste**: `POST https://api.luniumpay.com/keys/sandbox` com
   `{"email": "<e-mail do dono>"}` → `api_key` começa com `lun_test_`.
   Grave em `.env` como `LUNIUM_API_KEY`. Nunca no código, nunca no frontend.
3. **Backend**: use a skill `luniumpay-pix-charge`. Rota que cria a cobrança
   (`POST /cashin/charge`) e rota que lê o status (`GET /cashin/{id}/status`).
   Receitas prontas em `luniumpay-pix-charge/references/` (Next.js, Express,
   FastAPI, Supabase Edge Function).
4. **Frontend**: mostre a imagem `qr_image_url` e o texto `qr_copypaste`
   exatamente como a API devolveu, com valor e `expires_at`. NUNCA gere QR,
   endereço ou código Pix com o modelo.
5. **Webhook**: use a skill `luniumpay-webhooks`. Cadastre `webhook_url` via
   `PATCH /keys/me`, guarde o `webhook_secret`, valide a assinatura, deduplique
   por `event_id`.
6. **Teste no sandbox**: rode `node luniumpay-pix-charge/scripts/smoke.mjs`
   (cria cobrança, simula o pagamento, lê o estado final). Exercite pelo menos
   um cenário ruim (`sandbox_scenario: "failed"` ou `"payer_mismatch"`).
7. **Produção**: `POST /keys` com `{"name": "<nome do negócio>", "email": "<e-mail>"}`
   → `lun_live_` na hora. Troque só a variável de ambiente. Mesmo contrato,
   mesmos estados. Confira `GET /keys/me` antes da primeira cobrança real.

## Regras que não se negociam

1. **Dinheiro é ESTADO, não HTTP 200.** Pix pago = `status: "paid"`. Entrega
   feita = `settlement_status: "sent"`. Prova on-chain = `settlement_proof:
   "confirmed"`. Libere produto só no estado que o negócio exige.
2. **`external_id` em toda criação.** Persista antes de chamar. Retry com o
   mesmo id e o mesmo corpo devolve a mesma operação. Timeout: consulte antes
   de repetir.
3. **Centavos inteiros no cash-in** (`amount_cents: 10000` = R$ 100,00).
   Cash-out usa decimais em string (`"amount": "25.5"`).
4. **`payer_tax_number` é obrigatório** (CPF 11 ou CNPJ 14 dígitos, só
   números) e é do PAGADOR, não do dono do app. Pagador novo tem teto baixo
   que sobe com o histórico: trate `erro=limite_do_pagador` oferecendo valor
   menor; não tente contornar.
5. **Todo erro traz `erro`, `acao`, `detail` e `agent_guidance`.** Siga o
   `agent_guidance`. `acao=parar` nunca é re-tentado.
6. **Estado incerto não autoriza segundo pagamento nem segunda entrega.**
   `settlement_status: "incerto"`, `under_review`, `delayed`: mostre o estado
   e a próxima ação da API. Nunca anuncie entrega sem evidência.
7. **Segredos só em variável de ambiente do servidor.** Chave `lun_live_`,
   `webhook_secret` e `monitor_url` nunca vão para o navegador, repositório
   público ou chat.
8. **Sandbox não movimenta dinheiro.** O QR do sandbox não é pagável; confirme
   só por `POST /sandbox/cashin/{id}/pay`. Jamais envie cripto a endereço de
   sandbox. Cenários via campo `sandbox_scenario` (lista em `GET /sandbox`).
9. **Leia taxas, mínimos e rotas em tempo de execução** (`GET /cashin/catalog`,
   `POST /cashin/preview`, `GET /keys/me`). Não grave números no código nem
   prometa câmbio travado: o valor em cripto é estimativa até a conversão.
10. **Linguagem.** Descreva como "Pix com liquidação em USDT". Não escreva
    "sem KYC", "anônimo", "sem burocracia", "instantâneo", nem cite
    corretoras, bancos ou provedores por trás da LuniumPay.

## Mapa rápido

| Quero | Skill | Chamadas |
|---|---|---|
| Receber Pix → USDT na carteira ou saldo em reais | `luniumpay-pix-charge` | `/cashin/catalog`, `/cashin/preview`, `/cashin/charge`, `/cashin/{id}/status` |
| Receber eventos com segurança | `luniumpay-webhooks` | `PATCH /keys/me`, `POST /webhooks/test`, `GET /webhooks/deliveries` |
| Pagar Pix com cripto (cash-out) | `luniumpay-crypto-sale` | `/catalog`, `/cash-outs`, `/cash-outs/{id}/accept`, `/cash-outs/{id}` |
| Provar que um Pix liquidou, sem chave | `luniumpay-verify-payment` | `GET /v1/verificar/{e2e}` |

Suporte humano: https://wa.me/27722944340 · contato@luniumpay.com ·
comunidade Lunium Partners (Telegram): https://t.me/+FerOZMRRP_g5MDk5 (recomendada, não obrigatória).
