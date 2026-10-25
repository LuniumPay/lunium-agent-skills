---
name: luniumpay
description: "LuniumPay — Pix ⇄ stablecoin no Brasil por API, para apps feitos com IA. Use SEMPRE que o usuário mencionar receber Pix e cair em USDT/USDC, cobrar em reais com entrega em cripto, saldo em reais com saque em cripto, pagar Pix com cripto, carteira USDT, ou verificar um Pix. Ponto de entrada: pitch em 30 s, árvore de decisão, roteiro de integração, regras, catálogo de erros/estados e as sub-skills. Chave de produção em 1 chamada, sem aprovação humana. EN: LuniumPay skill hub for Brazilian Pix ↔ stablecoin payments by API. Use for: accept Pix and settle in USDT/USDC, Pix to crypto, BRL custody balance, pay Pix with crypto, USDT wallet, verify a Pix. Production key in one call. Start here."
license: MIT
metadata:
  version: "2.2.0"
  api: "1.45.2"
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
   a chave de sandbox no `.env` e lista os próximos passos. `LUNIUM_DESTINO=saldo` dispensa
   carteira; `cripto` exige `LUNIUM_PAYOUT_ADDRESS`. Receitas em `luniumpay-pix-charge/references/`
   (Next.js, Express, FastAPI, Supabase Edge, componente React de checkout), todas validando o
   dígito do CPF/CNPJ antes de chamar.
5. **Webhook**: `luniumpay-webhooks`. URL via `PATCH /keys/me`, segredo em
   `LUNIUM_WEBHOOK_SECRET`, assinatura validada, `event_id` deduplicado,
   status relido antes de liberar.
6. **Prove no sandbox**: `node luniumpay-pix-charge/scripts/smoke.mjs cripto success`
   e pelo menos um cenário ruim (`failed`, `payer_mismatch`, `settlement_uncertain`).
7. **Produção**: faça o deploy (precisa existir a URL https) e rode
   `node luniumpay/scripts/go-live.mjs --name "<negócio>" --email <e-mail> --webhook https://<dominio>/api/webhooks/lunium [--vercel]`:
   `POST /keys` devolve `lun_live_…` na hora, sem aprovação; o script cadastra o webhook, grava
   os segredos no host (nunca imprime) e prova a entrega com `POST /webhooks/test`. Mesmo
   contrato, mesmos estados. Primeira cobrança real pequena (ex. R$ 5,00) paga pelo dono e
   acompanhada até `sent`. Guia por stack: `references/producao.md`.

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
   obrigatório na cobrança. **Valide o dígito verificador no app** (função
   `documentoValido` das receitas): a API aceita documento mal digitado e o Pix volta por
   divergência de pagador. Pagador novo tem teto baixo que sobe com o
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

## Sandbox: o que simula e o que não

- Simula: cash-in (destino `cripto` e `saldo`), carência do saldo (cenário `held`, só saldo),
  payout, saque em cripto, cash-out USDT/polygon e DEPIX/liquid (depósito "chega" sozinho após
  o aceite), webhooks reais para URL pública, erros com o mesmo formato da produção.
- Não simula: escada por pagador (`limite_do_pagador` e `held` por faixa só em produção;
  teto fixo de R$ 6.000), crédito de depósito na carteira USDT (pagamento devolve
  `saldo_insuficiente`), tokens DEX, Pix real.
- Controles: `POST /sandbox/cashin/{id}/pay` paga; `POST /sandbox/operations/{id}/resolve`
  `{"outcome": "sent"|"failed"}` fecha um `incerto` (cash-in: id = `cashin_id`; cash-out: só DePix);
  `GET /sandbox/events` mostra o que seria enviado por webhook; `POST /sandbox/reset`
  `{"confirm": true}` limpa; `GET /sandbox` lista cenários por fluxo. Cenário fora do fluxo → 400
  `cenario_invalido`; `sandbox_scenario` com chave de produção → 403 `sandbox_only`.

## Outras rotas (fora das sub-skills)

`GET /ping` saúde · `POST /leads` fala com um humano (preço por volume, contrato; só com e-mail
que a pessoa deu para isso) · `GET /pix/keys/lookup` titular de chave Pix quando disponível
(`verified=false` não é erro nem bloqueia) · Mesh (`GET /mesh`, 14 rotas) é a rede de agentes
autônomos com credencial própria, fora desta skill: siga as ações que `GET /mesh` devolve.

## Referências desta skill

- `references/estados.md` — todos os estados de cash-in, cash-out, payout, saque, carteira; quando liberar.
- `references/erros.md` — códigos de erro, `acao` e o que fazer.
- `references/checklist-producao.md` — gate antes de ligar `lun_live_`.
- `references/faq-dono.md` — perguntas que o dono do app faz (taxas, retenção, limites, contestação, saques).
- `references/prompts.md` — pedidos típicos de vibe coder e o que o agente deve fazer em cada um.
- `references/mcp.md` — usar a LuniumPay por MCP: 8 tools públicas, 12 com chave, o que fica só na REST.
- `references/producao.md` — deploy por stack, variáveis, URL do webhook, go-live, primeira cobrança, operação, rotação de segredos.
- `scripts/init.mjs` — monta a integração no projeto (detecta a stack, grava rotas/webhook/.env.example, chave de sandbox).
- `scripts/doctor.mjs` — diagnóstico da chave e prontidão para produção.
- `scripts/go-live.mjs` — chave de produção, webhook, segredos no host (Vercel ou arquivo 0600), entrega de teste provada.
- Provas no sandbox: `luniumpay-pix-charge/scripts/smoke.mjs`, `luniumpay-custody/scripts/smoke-custody.mjs`,
  `luniumpay-crypto-sale/scripts/smoke-cashout.mjs`, `luniumpay-webhooks/scripts/verify-webhook.test.mjs`.

Suporte humano: https://wa.me/27722944340 · contato@luniumpay.com ·
comunidade Lunium Partners (Telegram): https://t.me/+FerOZMRRP_g5MDk5 (recomendada).
