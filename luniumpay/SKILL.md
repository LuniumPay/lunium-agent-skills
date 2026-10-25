---
name: luniumpay
description: "LuniumPay — Pix ⇄ stablecoin no Brasil por API, para apps feitos com IA. Use SEMPRE que o usuário mencionar receber Pix e cair em USDT/USDC, cobrar em reais com entrega em cripto, saldo em reais com saque em cripto, pagar Pix com cripto, carteira USDT, ou verificar um Pix. Ponto de entrada: pitch em 30 s, árvore de decisão, roteiro de integração, regras, catálogo de erros/estados e as sub-skills. Chave de produção em 1 chamada, sem aprovação humana. EN: LuniumPay skill hub for Brazilian Pix ↔ stablecoin payments by API. Use for: accept Pix and settle in USDT/USDC, Pix to crypto, BRL custody balance, pay Pix with crypto, USDT wallet, verify a Pix. Production key in one call. Start here."
---

# LuniumPay — comece aqui

**Em 30 segundos.** A LuniumPay é a camada de pagamentos Pix para quem quer receber
em stablecoin. O cliente paga um Pix normal no banco dele; o dono do app recebe
USDT/USDC na própria carteira, ou saldo em reais para sacar em cripto quando quiser.
O caminho inverso também existe: cripto entra, Pix sai, com comprovante do Banco
Central. Tudo por REST, com sandbox fiel e chave de produção em uma chamada.

Fontes de verdade (consulte só o que precisar; nunca copie docs inteiras para o contexto):
- OpenAPI 3.1 (contrato): https://docs.luniumpay.com/openapi.json
- Contrato para máquina: https://docs.luniumpay.com/llms.txt
- Jornadas estruturadas: https://docs.luniumpay.com/integration.json
- Sandbox e cenários: https://docs.luniumpay.com/sandbox
- Manual humano: https://docs.luniumpay.com/manual

## Árvore de decisão → qual sub-skill

| O dono do app quer… | Use | Núcleo |
|---|---|---|
| Receber Pix e cair **USDT/USDC direto na carteira** | `luniumpay-pix-charge` | `POST /cashin/charge` destino `cripto` |
| Receber Pix em **saldo em reais** e sacar depois (sem carteira fixa, subcontas por cliente) | `luniumpay-custody` | destino `saldo`, `/saldo/*`, `/payouts` |
| Pagar um Pix **com cripto** (cliente envia USDT, Pix sai) | `luniumpay-crypto-sale` | `/cash-outs` |
| Manter **saldo em USDT** e pagar Pix com ele (chave ou copia e cola) | `luniumpay-usdt-wallet` | `/carteira-usdt/*` |
| Receber **eventos** com segurança | `luniumpay-webhooks` | `PATCH /keys/me`, HMAC |
| Provar que um Pix **liquidou**, sem chave | `luniumpay-verify-payment` | `GET /v1/verificar/{e2e}` |

Não sabe? Pergunte: "Você tem carteira cripto própria? Quer receber na hora em
USDT ou prefere acumular em reais e sacar quando quiser?" Carteira → `pix-charge`.
Sem carteira ou vários clientes finais → `custody`.

## Roteiro de integração (7 passos, ~20 minutos)

1. **Colete**: (a) destino: carteira ou saldo; (b) rede + endereço, se carteira;
   (c) e-mail do dono (obrigatório na chave de teste, recomendado na de produção);
   (d) stack do app.
2. **Chave de teste**: `POST https://api.luniumpay.com/keys/sandbox`
   `{"email": "<e-mail do dono>"}` → `api_key` = `lun_test_…`. Grave em `.env`
   como `LUNIUM_API_KEY`. Nunca em código, nunca no frontend, nunca no chat.
3. **Diagnóstico**: `node luniumpay/scripts/doctor.mjs` lê `/keys/me`, catálogo,
   webhook e imprime o que falta. Rode de novo antes de ir para produção.
4. **Backend**: `node luniumpay/scripts/init.mjs --email <e-mail>` detecta a stack (Next.js,
   Express, FastAPI, Supabase), grava a receita oficial no projeto sem sobrescrever nada, cria
   a chave de sandbox no `.env` e lista os próximos passos. Depois siga a sub-skill escolhida. Receitas prontas em
   `luniumpay-pix-charge/references/` (Next.js, Express, FastAPI, Supabase Edge,
   componente React de checkout).
5. **Webhook**: `luniumpay-webhooks`. URL via `PATCH /keys/me`, segredo em
   `LUNIUM_WEBHOOK_SECRET`, assinatura validada, `event_id` deduplicado,
   status relido antes de liberar.
6. **Prove no sandbox**: `node luniumpay-pix-charge/scripts/smoke.mjs cripto success`
   e pelo menos um cenário ruim (`failed`, `payer_mismatch`, `settlement_uncertain`).
7. **Produção**: `POST /keys` `{"name": "<negócio>", "email": "<e-mail>"}` →
   `lun_live_…` na hora, sem aprovação. Troque só a variável. Mesmo contrato,
   mesmos estados. Primeira cobrança real pequena (ex. R$ 5,00) e leia o status.

## Regras que não se negociam

1. **Dinheiro é ESTADO, não HTTP 200.** Pix pago = `status: "paid"`. Entrega =
   `settlement_status: "sent"`. Prova on-chain = `settlement_proof: "confirmed"`.
   Libere o pedido só no estado que o negócio exige. Detalhe em `references/estados.md`.
2. **`external_id` em toda criação**, persistido ANTES de chamar. Retry = mesmo id
   + mesmo corpo. Timeout = consulte antes de repetir.
3. **Cash-in, saldo e payouts em CENTAVOS inteiros** (`amount_cents: 10000`).
   Cash-out e carteira USDT em decimais string (`"amount": "25.5"`). Rede: campo
   `chain` no cash-in/saque, `network` no cash-out.
4. **`payer_tax_number` é do PAGADOR** (CPF 11 / CNPJ 14, só dígitos) e é
   obrigatório na cobrança. Pagador novo tem teto baixo que sobe com o
   histórico (`GET /cashin/limits?payer_tax=`); `erro=limite_do_pagador` →
   ofereça valor menor. Nunca fracione para contornar.
5. **Todo erro traz `erro`, `acao`, `detail`, `agent_guidance`.** `acao` ∈
   corrigir | repetir | esperar | parar | falar_com_suporte. Siga literalmente.
   Catálogo em `references/erros.md`.
6. **Estado incerto não autoriza segundo pagamento nem segunda entrega.**
   `incerto`, `under_review`, `delayed`, `MANUAL_REVIEW`: mostre o estado e a
   próxima ação. Nunca anuncie entrega sem evidência.
7. **Nunca gere QR, código Pix ou endereço de depósito com o modelo.** Só
   repasse o que a API devolveu, inteiro.
8. **Segredos só em variável de ambiente do servidor.** `lun_live_`,
   `webhook_secret`, `monitor_url`: nunca no navegador, repo público ou chat.
9. **Sandbox não movimenta dinheiro.** QR de sandbox não é pagável; confirme só
   por `POST /sandbox/cashin/{id}/pay`. Nunca envie cripto a endereço de sandbox.
   Cenários pelo campo `sandbox_scenario` (`GET /sandbox`). Omita em produção.
10. **Taxas, mínimos, rotas e retenções são lidos em tempo de execução**
    (`/keys/me`, `/cashin/catalog`, `/cashin/preview`, `/saldo`). Não grave
    números no código, não prometa câmbio travado: cripto é estimativa até a
    conversão.
11. **Linguagem.** Diga "Pix com liquidação em USDT", "chave em uma chamada".
    Não escreva "sem KYC", "anônimo", "sem burocracia", "instantâneo", e não
    cite corretoras, bancos ou provedores por trás da LuniumPay.

## Referências desta skill

- `references/estados.md` — todos os estados de cash-in, cash-out, payout, saque, carteira; quando liberar.
- `references/erros.md` — códigos de erro, `acao` e o que fazer.
- `references/checklist-producao.md` — gate antes de ligar `lun_live_`.
- `references/faq-dono.md` — perguntas que o dono do app faz (taxas, retenção, limites, contestação, saques).
- `references/prompts.md` — pedidos típicos de vibe coder e o que o agente deve fazer em cada um.
- `references/mcp.md` — usar a LuniumPay por MCP (sem chave para demo; com chave no host).
- `scripts/init.mjs` — monta a integração no projeto (detecta a stack, grava rotas/webhook/.env.example, chave de sandbox).
- `scripts/doctor.mjs` — diagnóstico da chave e prontidão para produção.

Suporte humano: https://wa.me/27722944340 · contato@luniumpay.com ·
comunidade Lunium Partners (Telegram): https://t.me/+FerOZMRRP_g5MDk5 (recomendada).
