# Erros — formato e catálogo prático

Toda resposta de erro tem o mesmo corpo:
```json
{"erro": "limite_do_pagador", "acao": "corrigir", "detail": "…", "agent_guidance": "…", "request_id": "req_…", "docs": "https://docs.luniumpay.com/…", "limits": {…}, "code": 400}
```
`acao` manda:

| `acao` | Faça |
|---|---|
| `corrigir` | ajuste o campo indicado em `detail` e repita com um `external_id` NOVO se o corpo mudou |
| `repetir` | repita a MESMA chamada, mesmo `external_id`, com backoff (2 s, 5 s, 15 s) |
| `esperar` | não repita agora; consulte o status depois |
| `parar` | não repita nunca; informe o usuário com `detail` |
| `falar_com_suporte` | informe `request_id` ao suporte (contato@luniumpay.com); não repita |

## Códigos frequentes

| `erro` | Causa | Resposta certa |
|---|---|---|
| `chave_ausente` / 401 | sem `X-API-Key` | enviar a chave do `.env`; sem chave, criar sandbox |
| `email_obrigatorio` | `POST /keys/sandbox` sem `email` | pedir o e-mail de quem testa; nunca inventar |
| `documento_invalido` | CPF/CNPJ com dígitos errados | corrigir o número do pagador; só dígitos |
| `limite_do_pagador` | pagador novo acima da faixa atual | oferecer valor ≤ `limits.available_cents`; teto sobe com o histórico; nunca fracionar |
| `external_id_divergente` | mesmo `external_id`, corpo diferente | novo id para nova intenção; nunca "consertar" o payload no retry |
| `tipo_ambiguo` | 11 dígitos: CPF ou telefone? | enviar `pix_key_type` |
| `cotacao_expirada` | aceite tardio no cash-out | recotar (`POST /cash-outs` de novo); nunca insistir na velha |
| `provedor_indisponivel` | provedor fora momentaneamente | `acao=repetir` com mesmo `external_id` |
| `pagador_recusado_pelo_provedor` | recusa de compliance | **nunca** retentar; informar a pessoa |
| `taxa_alterada` (409) | `max_debited_cents` menor que valor + taxa | mostrar nova taxa; repetir só com consentimento |
| `saldo_insuficiente` | saldo livre menor que valor + taxa | ler `GET /saldo` (`disponivel_cents`, `bloqueado_cents`) e orientar |
| `rota_indisponivel` / `route_unavailable` | par ativo/rede fora do catálogo agora | reler `/cashin/catalog` ou `/catalog` e oferecer alternativa |
| `nao_encontrado` em `/v1/verificar` | a LuniumPay não liquidou esse E2E | resposta válida, não falha |
| `memo_obrigatorio` (400) | rede coletiva (XRP, XLM, TON, ATOM, HBAR, ALGO…) sem `payout_tag`/`deposit_tag` | pedir o memo/tag ao dono; não criar sem ele |
| `cenario_invalido` (400) | `sandbox_scenario` que não existe neste fluxo | ver `GET /sandbox` → `scenarios_by_flow` |
| `sandbox_only` (403) | `sandbox_scenario` ou rota `/sandbox/*` com chave de produção | remover o campo; receitas só o enviam com `lun_test_` |
| 429 | cota por chave/IP | respeitar `Retry-After`; sem laço apertado |

Erros autocorrigíveis trazem também `campo`, `missing[]` e `next_actions[]` (ex.: `POST /keys/sandbox` sem `email`).

Regra geral: leia `agent_guidance` e faça exatamente aquilo. Se o código não estiver
aqui, o `detail` explica e `docs` aponta a página.
