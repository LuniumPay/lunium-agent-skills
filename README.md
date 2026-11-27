# LuniumPay Agent Skills

**PT** · Pix ⇄ stablecoin no Brasil, integrado pelo seu agente de IA. Instale, peça
"quero receber Pix e cair em USDT na minha carteira" e o agente monta o backend, o QR, o webhook,
prova no sandbox e leva para produção, com a chave gerada no painel e nunca colada no chat.
**EN** · Brazilian Pix ↔ stablecoin payments, integrated by your coding agent. Install, ask
"accept Pix and settle in USDT to my wallet", and the agent builds and proves it. API keys come
from the partner dashboard (Google sign-in); production requires the account upgrade.

Funciona em Claude Code, Cursor, Codex, Gemini CLI, Windsurf, Antigravity e em
qualquer agente que leia o padrão [Agent Skills](https://agentskills.io).

> **3.0.0 (27/11/2026)**: a API não cria mais chave (`POST /keys` e `/keys/sandbox` respondem 403). As
> chaves nascem no painel, `chave.mjs` guarda sem eco, `go-live.mjs` confere o upgrade de conta e a liberação
> das cobranças. Veja [`luniumpay/references/novidades.md`](luniumpay/references/novidades.md).

## Instalar / Install

```bash
npx skills add LuniumPay/lunium-agent-skills
```

Claude Code, pelo marketplace de plugins (recebe atualizações):

```text
/plugin marketplace add LuniumPay/lunium-agent-skills
/plugin install luniumpay@lunium-agent-skills
```

Já instalou a 2.x? `npx skills add LuniumPay/lunium-agent-skills` de novo, ou `/plugin marketplace update lunium-agent-skills`.
Manual: copie as pastas para o diretório de skills do agente
(`.claude/skills/`, `.cursor/skills/`, `.codex/skills/`, `.agents/skills/`).

## 1. A chave (2 minutos, no painel)

1. Entre em **https://parceiros.luniumpay.com** com Google.
2. "Conta real e testes" → **"Acessar testes"** → menu "Integração por API" › **"Chaves de API"** → "Gerar chave deste projeto".
3. Guarde sem passar pelo chat:

```bash
node luniumpay/scripts/chave.mjs          # cole a chave: nada aparece na tela; grava .env (0600) e .gitignore
# macOS: pbpaste | node luniumpay/scripts/chave.mjs
```

## O que vem / What's inside

| Skill | Use quando… | Extras |
|---|---|---|
| `luniumpay` | **Comece aqui.** Chave pelo painel, prontidão da conta, árvore de decisão, roteiro de 7 passos, 13 regras, o que o sandbox simula | `references/` conta e liberação, estados, erros por grupo, checklist, FAQ do dono, prompts, MCP, produção, novidades · `scripts/chave.mjs`, `init.mjs`, `doctor.mjs`, `go-live.mjs` |
| `luniumpay-pix-charge` | Receber Pix → USDT/USDC na carteira (ou saldo) | receitas Next.js, Express, FastAPI, Supabase Edge, checkout React com retenção explicada · `scripts/smoke.mjs` |
| `luniumpay-custody` | Saldo em reais sem carteira fixa, subcontas, retenção/carência, saque em cripto | `scripts/smoke-custody.mjs` (inclui carência) |
| `luniumpay-webhooks` | Receber eventos assinados com segurança | verificador oficial + teste |
| `luniumpay-crypto-sale` | Pagar Pix com cripto (cash-out): catálogo, prévia, ordem, aceite, devolução | `scripts/smoke-cashout.mjs` |
| `luniumpay-usdt-wallet` | Saldo em USDT e Pix pago com ele (chave ou copia e cola) | webhooks `wallet.*` |
| `luniumpay-verify-payment` | Provar que um Pix liquidou, consulta aberta | |

## Montar no seu projeto / Scaffold into your project

```bash
node luniumpay/scripts/init.mjs            # detecta Next.js, Express, FastAPI ou Supabase
```

Grava as rotas de cobrança, status e webhook da receita oficial no seu projeto (nunca sobrescreve) e o
`.env.example`. `--stack next|express|fastapi|supabase` força a stack; `--dry` só mostra o plano.
As receitas validam o CPF/CNPJ, devolvem o erro da API com o status certo e mostram a retenção com clareza.

## Testar sem dinheiro / Try with no money

```bash
node luniumpay/scripts/doctor.mjs                 # diagnóstico: conta, prontidão, catálogo, saldo, webhooks
node luniumpay-pix-charge/scripts/smoke.mjs cripto success
node luniumpay-pix-charge/scripts/smoke.mjs cripto failed
node luniumpay-custody/scripts/smoke-custody.mjs
node luniumpay-crypto-sale/scripts/smoke-cashout.mjs USDT polygon
node luniumpay-crypto-sale/scripts/smoke-cashout.mjs DEPIX liquid settlement_uncertain
node luniumpay-webhooks/scripts/verify-webhook.test.mjs
```

Os scripts leem a chave de teste (`lun_test_`) do ambiente ou do `.env`, cobram, simulam o Pix e leem o
estado final. Recusam chaves de produção. Nenhum dinheiro real se move.

## Produção / Production

1. No painel, conta real: **"Upgrade de conta"** (verificação de identidade do titular) e liberação das
   cobranças Pix ("Criar cobrança" › "Solicitar liberação").
2. "Chaves de API" → gere a `lun_live_`.
3. Depois do deploy:

```bash
node luniumpay/scripts/go-live.mjs --webhook https://seu-dominio.com/api/webhooks/lunium --vercel     # ou --env .env.lunium.production
```
Confere a prontidão em `GET /keys/me`, cadastra o webhook com segredo, grava os segredos no host (nunca
imprime) e prova a entrega com `POST /webhooks/test`. Mesmo contrato do sandbox: só a chave muda.
Deploy por stack e primeira cobrança real: `luniumpay/references/producao.md`.

## Fonte de verdade / Source of truth

SKILL.md são curtos de propósito. O contrato vivo manda:
[openapi.json](https://docs.luniumpay.com/openapi.json) · [llms.txt](https://docs.luniumpay.com/llms.txt) ·
[integration.json](https://docs.luniumpay.com/integration.json) · [sandbox](https://docs.luniumpay.com/sandbox) ·
MCP `https://api.luniumpay.com/mcp`. Quando um texto divergir da resposta da API, vale a resposta
(`erro`, `acao`, `agent_guidance`). Skills **3.0.1** · revisão 2026-11-27 · API 1.55.0.

Suporte: contato@luniumpay.com · https://wa.me/27722944340 · [Lunium Partners (Telegram)](https://t.me/+FerOZMRRP_g5MDk5)

## Licença
MIT.
