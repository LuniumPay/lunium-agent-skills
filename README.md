# LuniumPay Agent Skills

Skills de integração da [Lunium](https://luniumpay.com) — PIX ⇄ stablecoin no
Brasil — para agentes de IA (Gemini, ChatGPT, Claude, Cursor, Antigravity e
qualquer IDE que leia o padrão Agent Skills).

## Instalar

```bash
npx skills add guilhermezanqueta-collab/lunium-agent-skills
```

ou copie as pastas para o diretório de skills do seu agente
(`.claude/skills/`, `.cursor/skills/` ou equivalente).

## Skills

| Skill | Quando o agente usa |
|---|---|
| `luniumpay` | Regras de ouro + mapa da plataforma (comece aqui) |
| `luniumpay-verify-payment` | Provar que um PIX liquidou (grátis, sem chave) |
| `luniumpay-pix-charge` | Receber PIX e liquidar em stablecoin (cash-in) |
| `luniumpay-crypto-sale` | Vender cripto e pagar uma chave PIX (cash-out) |
| `luniumpay-webhooks` | Receber e validar webhooks assinados |

## Progressive disclosure

Cada SKILL.md é curto de propósito. A fonte de verdade fica na plataforma viva:
`https://api.luniumpay.com/llms.txt` (contrato para máquina),
`https://api.luniumpay.com/openapi.json` (OpenAPI 3.1, operationIds completos),
`https://api.luniumpay.com/mcp` (MCP streamable-HTTP) e
`https://luniumpay.com/.well-known/agent-card.json` (A2A). O agente só puxa o
que precisa, quando precisa.
