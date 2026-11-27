# LuniumPay por MCP

Dois servidores, dois papéis:

| | URL | Autenticação | Serve para |
|---|---|---|---|
| Onboarding público | `https://api.luniumpay.com/mcp/onboarding` | nenhuma | descoberta, saúde, catálogo, verificar Pix, contato |
| MCP completo | `https://api.luniumpay.com/mcp` | `X-API-Key` configurada no host (fora do chat) | operar a conta: cobranças, venda com cripto, carteira USDT |

Descritor: `https://api.luniumpay.com/.well-known/mcp.json` (streamable-HTTP). Liste com `tools/list`.

## 20 tools (contrato vivo em `tools/list`)

Sem chave: `lunium_plan_integration` (comece aqui), `lunium_list_settlement_options` (catálogo;
`direction=deposit` cripto → Pix, `direction=withdraw` Pix → cripto), `lunium_verify_pix_payment` (E2E, sem
chave), `lunium_check_network_health`, `lunium_contact` (só quando o usuário pedir um humano).

**Criação de chave fechada desde 25/11/2026:** `lunium_create_sandbox_key` e `lunium_start_sandbox_demo` (que
cria uma chave de teste para a jornada sintética) esbarram na recusa `sandbox_somente_no_painel`, mesmo que a
descrição da tool ainda fale em "uma chamada"; `lunium_get_sandbox_demo` só lê demos iniciadas antes. Não insista: a chave de teste nasce no painel
(https://parceiros.luniumpay.com, entrar com Google → "Chaves de API") e vai para o host com `chave.mjs`.

Com chave (12):
- Cash-in: `lunium_check_payer_limit` (quanto o CPF/CNPJ pode pagar agora),
  `lunium_create_pix_charge`, `lunium_get_pix_charge` (leia `status` E `settlement_status`).
- Venda com cripto: `lunium_quote_crypto_sale` → `lunium_confirm_crypto_sale` (devolve
  `deposit_address`) → `lunium_get_crypto_sale` (até `COMPLETED`, `pix_e2e`).
- Carteira USDT: `lunium_get_usdt_wallet`, `lunium_request_usdt_deposit`,
  `lunium_list_usdt_deposits`, `lunium_quote_pix_with_usdt`, `lunium_pay_pix_with_usdt`,
  `lunium_get_usdt_pix_payment` (`final=true` encerra).

As mesmas recusas da REST valem no MCP: `verificacao_titular_pendente` (chave de produção de conta nova sem o
upgrade de conta), `recebimento_sem_autorizacao` (cobranças não liberadas), `pagador_bloqueado`. Leia
`structuredContent`, siga `acao` e não repita em laço.

Não existem tools para saldo em reais, payouts, subcontas, comissão, webhooks e configuração da chave: isso é
REST (`luniumpay-custody`, `luniumpay-webhooks`). MCP não substitui todas as rotas.

## Configuração
Claude Code (a chave já no ambiente do shell, nunca digitada no chat):
```bash
claude mcp add --transport http lunium https://api.luniumpay.com/mcp --header "X-API-Key: ${LUNIUM_API_KEY}"
```
Cursor / outros hosts: tipo `streamable-http`, URL acima, header `X-API-Key` vindo de variável de ambiente.

Limites: a conexão pública não vincula conta de produção por OAuth. Erros de tool MCP podem vir em HTTP 200 com
`isError: true`; leia `structuredContent`. Para integrar no código do app, prefira a REST (sub-skills); MCP é
ótimo para o dono operar e consultar pelo chat.
