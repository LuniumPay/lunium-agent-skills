# LuniumPay Agent Skills

**PT** · Pix ⇄ stablecoin no Brasil, integrado pelo seu agente de IA. Instale, peça
"quero receber Pix e cair em USDT na minha carteira" e o agente faz tudo: chave em
uma chamada, backend, QR, webhook, sandbox, produção.
**EN** · Brazilian Pix ↔ stablecoin payments, integrated by your coding agent.
Install, ask "accept Pix and settle in USDT to my wallet", and the agent does the rest.

Funciona em Claude Code, Cursor, Codex, Gemini CLI, Windsurf, Antigravity e em
qualquer agente que leia o padrão [Agent Skills](https://agentskills.io).

## Instalar / Install

```bash
npx skills add LuniumPay/lunium-agent-skills
```

Manual: copie as pastas para o diretório de skills do agente
(`.claude/skills/`, `.cursor/skills/`, `.codex/skills/`, `.agents/skills/`).

## O que vem / What's inside

| Skill | Use quando… | Extras |
|---|---|---|
| `luniumpay` | **Comece aqui.** Pitch, árvore de decisão, roteiro de 7 passos, 11 regras | `references/` estados, erros, checklist de produção, FAQ do dono, prompts, MCP · `scripts/doctor.mjs` |
| `luniumpay-pix-charge` | Receber Pix → USDT/USDC na carteira (ou saldo) | receitas Next.js, Express, FastAPI, Supabase Edge, componente React de checkout · `scripts/smoke.mjs` |
| `luniumpay-custody` | Saldo em reais sem carteira, subcontas, saque em cripto, Pix com saldo | `scripts/smoke-custody.mjs` |
| `luniumpay-webhooks` | Receber eventos assinados com segurança | verificador oficial + teste |
| `luniumpay-crypto-sale` | Pagar Pix com cripto (cash-out) | |
| `luniumpay-usdt-wallet` | Saldo em USDT e Pix pago com ele (chave ou copia e cola) | |
| `luniumpay-verify-payment` | Provar que um Pix liquidou, sem chave | |

## Montar no seu projeto em um comando / Scaffold into your project

```bash
node luniumpay/scripts/init.mjs --email voce@empresa.com      # detecta Next.js, Express, FastAPI ou Supabase
```

Grava as rotas de cobrança, status e webhook da receita oficial no seu projeto (nunca sobrescreve), o
`.env.example`, cria uma chave de **sandbox** no `.env` local (0600, nunca impressa) e lista os próximos passos.
`--stack next|express|fastapi|supabase` força a stack; `--dry` só mostra o plano.

## Testar sem dinheiro / Try with no money

```bash
export LUNIUM_SANDBOX_EMAIL=voce@empresa.com     # recebe 1 e-mail com o manual
node luniumpay/scripts/doctor.mjs                 # diagnóstico da chave (após criar)
node luniumpay-pix-charge/scripts/smoke.mjs cripto success
node luniumpay-pix-charge/scripts/smoke.mjs cripto failed
node luniumpay-custody/scripts/smoke-custody.mjs
node luniumpay-webhooks/scripts/verify-webhook.test.mjs
```

Os scripts criam uma chave de teste (`lun_test_`), cobram, simulam o Pix e leem o
estado final. Recusam chaves de produção. Nenhum dinheiro real se move.

## Produção em uma chamada / Production key in one call

```bash
curl -X POST https://api.luniumpay.com/keys -H 'Content-Type: application/json' \
  -d '{"name":"Minha Empresa","email":"voce@empresa.com"}'
```
Devolve `lun_live_…` na hora, sem aprovação. Mesmo contrato do sandbox: troque só a
variável de ambiente.

## Fonte de verdade / Source of truth

SKILL.md são curtos de propósito. O contrato vivo manda:
[openapi.json](https://docs.luniumpay.com/openapi.json) · [llms.txt](https://docs.luniumpay.com/llms.txt) ·
[integration.json](https://docs.luniumpay.com/integration.json) · [sandbox](https://docs.luniumpay.com/sandbox) ·
MCP `https://api.luniumpay.com/mcp`. Revisão 2026-10-24 · API 1.45.2.

Suporte: contato@luniumpay.com · https://wa.me/27722944340 · [Lunium Partners (Telegram)](https://t.me/+FerOZMRRP_g5MDk5)

## Licença
MIT.
