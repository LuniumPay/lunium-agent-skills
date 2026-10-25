# LuniumPay por MCP

Dois servidores, dois papéis:

| | URL | Autenticação | Serve para |
|---|---|---|---|
| Onboarding público | `https://api.luniumpay.com/mcp/onboarding` | nenhuma | descoberta, demo simulada, criar chave de teste, contato |
| MCP completo | `https://api.luniumpay.com/mcp` | `X-API-Key` configurada no host (fora do chat) | operar a conta: cobranças, cash-out, status |

Descritor: `https://api.luniumpay.com/.well-known/mcp.json` (streamable-HTTP).

Tools do onboarding (sem chave): `lunium_create_sandbox_key`, `lunium_contact`,
`lunium_check_network_health`, `lunium_verify_pix_payment`,
`lunium_list_settlement_options`, `lunium_plan_integration`,
`lunium_start_sandbox_demo`, `lunium_get_sandbox_demo`.

Exemplo de configuração (Claude Code):
```bash
claude mcp add --transport http lunium https://api.luniumpay.com/mcp --header "X-API-Key: ${LUNIUM_API_KEY}"
```
Cursor / outros hosts: tipo `streamable-http`, URL acima, header `X-API-Key` vindo de variável de ambiente.

Limites: a conexão pública não vincula conta de produção por OAuth. Erros de tool
MCP podem vir em HTTP 200 com `isError: true`; leia `structuredContent`. Para
integrar no código do app, prefira a REST (sub-skills); MCP é ótimo para o dono
operar e consultar pelo chat.
