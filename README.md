# LuniumPay Agent Skills

Skills de integração da [LuniumPay](https://luniumpay.com) — Pix ⇄ stablecoin no
Brasil — para quem programa com IA: Claude Code, Cursor, Codex, Gemini CLI,
Antigravity e qualquer agente que leia o padrão [Agent Skills](https://agentskills.io).

Instale, peça "quero receber Pix e cair em USDT na minha carteira" e o agente
integra sozinho: chave em uma chamada, backend, QR, webhook, sandbox, produção.

## Instalar

```bash
npx skills add guilhermezanqueta-collab/lunium-agent-skills
```

ou copie as pastas para o diretório de skills do seu agente
(`.claude/skills/`, `.cursor/skills/`, `.codex/skills/` ou equivalente).

## Skills

| Skill | Quando o agente usa |
|---|---|
| `luniumpay` | Comece aqui: roteiro de integração + regras que não se negociam |
| `luniumpay-pix-charge` | Receber Pix e liquidar em USDT/USDC ou saldo em reais, com receitas Next.js, Express, FastAPI e Supabase |
| `luniumpay-webhooks` | Receber e validar webhooks assinados (verificador + teste) |
| `luniumpay-crypto-sale` | Pagar Pix com cripto (cash-out) |
| `luniumpay-verify-payment` | Provar que um Pix liquidou, sem chave |

## Testar sem dinheiro

```bash
LUNIUM_SANDBOX_EMAIL=voce@empresa.com node luniumpay-pix-charge/scripts/smoke.mjs cripto success
node luniumpay-webhooks/scripts/verify-webhook.test.mjs
```

O script cria uma chave de teste (`lun_test_`), cobra, simula o Pix e lê o estado
final. Recusa chaves de produção. Cenários: `success`, `failed`, `held`,
`payer_mismatch`, `settlement_uncertain`... (lista em `GET /sandbox`).

## Fonte de verdade

Os SKILL.md são curtos de propósito. O contrato vivo manda:
`https://docs.luniumpay.com/openapi.json` (OpenAPI 3.1),
`https://docs.luniumpay.com/llms.txt`, `https://docs.luniumpay.com/integration.json`,
MCP em `https://api.luniumpay.com/mcp`. Revisão: 2026-10-24, API 1.45.2.

Suporte: contato@luniumpay.com · https://wa.me/27722944340 · [Lunium Partners](https://t.me/+FerOZMRRP_g5MDk5)
