# Erros — formato e catálogo prático

Toda resposta de erro tem o mesmo corpo:
```json
{"erro": "limite_do_pagador", "acao": "corrigir", "detail": "…", "agent_guidance": "…", "request_id": "req_…", "docs": "https://docs.luniumpay.com/…", "limits": {…}}
```
Ramifique por `erro` (estável), nunca por `detail` (texto para humano). O alias legado `code` foi
desligado em 09/11/2026. Recusas de conta trazem campos extras: `liberacao` (recebimento), `painel` e
`upgrade` (chave e verificação), `situacao_kyc`. `request_id` também vem no header `X-Request-ID` e é o que
se cita ao suporte (nunca a chave).

| `acao` | Faça |
|---|---|
| `corrigir` | ajuste o campo indicado em `detail` e repita com um `external_id` NOVO se o corpo mudou |
| `repetir` | repita a MESMA chamada, mesmo `external_id`, com backoff (2 s, 5 s, 15 s) |
| `esperar` | não repita agora; consulte o status depois |
| `parar` | não repita nunca; informe o usuário com `detail` |
| `falar_com_suporte` | informe `request_id` ao suporte (contato@luniumpay.com); não repita |
| `criar_conta_no_painel` / `usar_sandbox_ou_painel` | leve a pessoa ao painel (campo `painel`); não tente outra rota de criação |

## Acesso, chave e conta

| `erro` | Causa | Resposta certa |
|---|---|---|
| `chave_ausente` · `nao_autenticado` (401) | sem `X-API-Key` | enviar a chave do `.env`; sem chave → painel (`chave.mjs` guarda) |
| `chave_desconhecida` · `chave_incorreta` (401) | chave revogada, digitada errada ou de outro ambiente | gerar outra no painel ("Chaves de API"); nunca adivinhar |
| `sandbox_somente_no_painel` (403) | `POST /keys/sandbox`, `POST /mesh/agents` ou MCP criando chave | a chave de teste nasce no painel, com login |
| `producao_somente_no_painel` (403) | `POST /keys` | a chave de produção nasce no painel, depois do upgrade de conta |
| `verificacao_titular_pendente` (403, `parar`) | escrita com `lun_live_` de conta nova sem a verificação do titular | upgrade de conta no painel; leituras e `/keys/*` seguem; não repita |
| `recebimento_sem_autorizacao` (403, `parar`) | cobrança Pix sem liberação da conta | ler `liberacao.status`: `nao_solicitado` pedir no painel · `pendente` aguardar · `recusado` suporte |
| `em_manutencao` (503, `esperar`) | `POST /payouts` (Pix com saldo em reais) em manutenção | nada foi debitado; oferecer saque em cripto, carteira USDT ou venda de cripto |
| `caminho_invalido` (400) | URL com segmento `.`/`..` (ou `%2e`) | montar a URL só com IDs devolvidos pela API |
| `email_nao_aceito` (400) | conta/usuário novo com e-mail de privacidade, apelido ou temporário | usar um e-mail comum |

## Cobrança Pix (cash-in) e pagador

| `erro` | Causa | Resposta certa |
|---|---|---|
| `documento_invalido` · `payer_tax_number_invalido` · `payer_tax_invalido` | CPF/CNPJ fora do formato | corrigir o número do pagador; só dígitos; validar DV no app |
| `limite_do_pagador` | pagador acima da faixa atual | oferecer valor ≤ `limits.available_cents`; teto sobe com o histórico; nunca fracionar |
| `pagador_bloqueado` (403, `parar`) | CPF/CNPJ bloqueado nesta conta ou na Lunium | informar; desbloqueio só pelo suporte; nunca trocar o documento |
| `pagador_recusado_pelo_provedor` | recusa de compliance | **nunca** retentar; informar a pessoa |
| `valor_abaixo_do_minimo` · `valor_acima_do_maximo` | fora dos limites da rota/conta | reler `/cashin/preview` (`min_brl_cents`) e `/keys/me` |
| `payout_address_invalido` · `payout_address_obrigatorio` | carteira ausente ou da rede errada | pedir ao dono o endereço da rede escolhida |
| `memo_obrigatorio` (400) | rede coletiva (XRP, XLM, TON, ATOM, HBAR, ALGO…) sem `payout_tag`/`deposit_tag` | pedir o memo/tag; não criar sem ele |
| `rota_indisponivel` · `rede_indisponivel` · `asset_invalido` | par ativo/rede fora do catálogo agora | reler `/cashin/catalog` ou `/catalog` e oferecer alternativa |
| `cashin_indisponivel` · `criacao_recusada` | a cobrança não pôde nascer agora | não repetir em laço; ler `agent_guidance` |

## Venda de cripto (cash-out) e carteira USDT

| `erro` | Causa | Resposta certa |
|---|---|---|
| `cotacao_expirada` · `cotacao_divergente` | aceite tardio ou preço mudou | recotar (`POST /cash-outs` de novo, novo `external_id`); nunca insistir na velha |
| `limite_diario_recebedor` (`esperar`) | teto diário por CPF/CNPJ de quem recebe o Pix | esperar a virada (meia-noite de Brasília) ou outro recebedor legítimo |
| `tipo_ambiguo` | 11 dígitos: CPF ou telefone? | enviar `pix_key_type` |
| `pix_key_invalida` · `pix_key_obrigatoria` · `br_code_invalido` · `br_code_sem_valor` | chave Pix ou copia e cola inválidos | pedir de novo à pessoa; nunca completar |
| `boleto_vencido` · `boleto_ja_pago` · `boleto_em_pagamento` | boleto não pagável | informar; não repetir |
| `refund_address_invalida` · `refund_address_imutavel` | carteira de devolução errada ou já gravada | pedir a carteira certa na rede indicada; a gravada não muda |
| `carteira_nao_liberada` · `pagamentos_indisponiveis` | carteira USDT ou pagamento indisponível para a conta | suporte |

## Saldo, payout e comissão

| `erro` | Causa | Resposta certa |
|---|---|---|
| `saldo_insuficiente` (402/409) | saldo livre menor que valor + taxa | ler `GET /saldo` (`disponivel_cents`, `bloqueado_cents`) e orientar |
| `taxa_alterada` (409) | `max_debited_cents` menor que valor + taxa | mostrar nova taxa; repetir só com consentimento |
| `carencia_primeiro_deposito` (`esperar`) | crédito ainda em carência | mostrar `proximas_liberacoes[].disponivel_em` |
| `custodia_desligada` (`falar_com_suporte`) | conta sem custódia | suporte |
| `payout_nao_liberado` · `payout_recusado` | payout desligado ou recusado | ler `payout` em `/keys/me`; não repetir |
| `saque_comissao_diario` | um saque de comissão por dia | esperar o próximo dia |

## Idempotência e conciliação

| `erro` | Causa | Resposta certa |
|---|---|---|
| `external_id_divergente` | mesmo `external_id`, corpo diferente | novo id para nova intenção; nunca "consertar" o payload no retry |
| `em_processamento` (`esperar`) | a mesma operação ainda está rodando | consultar o status; não criar outra |
| `em_conciliacao` · `ja_entregue` (`parar`) | resultado incerto em conciliação, ou já entregue | não repetir envio/entrega; mostrar o estado |

## Rede, provedor e cota

| `erro` | Causa | Resposta certa |
|---|---|---|
| `provedor_indisponivel` · `liquidante_indisponivel` · `temporariamente_indisponivel` · `tempo_esgotado` | indisponibilidade momentânea | `acao=repetir` com o mesmo `external_id`; timeout → consultar antes |
| `rate_limit` · `limite_consultas` · `muitas_tentativas` (429) | cota por chave/IP | respeitar `Retry-After`; sem laço apertado |
| `erro_interno` (500) | falha do serviço | consultar o estado antes de repetir; se persistir, suporte com `request_id` |

## Webhook, verificação e sandbox

| `erro` | Causa | Resposta certa |
|---|---|---|
| `webhook_nao_configurado` · `webhook_url_invalida` | `POST /webhooks/test` sem URL, ou URL não https/pública | `PATCH /keys/me {"webhook_url": "https://…"}` |
| `nao_encontrado` em `/v1/verificar` | a LuniumPay não liquidou esse E2E | resposta válida, não falha |
| `cenario_invalido` (400) | `sandbox_scenario` que não existe neste fluxo | ver `GET /sandbox` → `scenarios_by_flow` |
| `outcome_invalido` (400) | resolve sem `outcome` `sent`/`failed` | enviar um dos dois |
| `sandbox_only` (403) | `sandbox_scenario` ou rota `/sandbox/*` com chave de produção | remover o campo; receitas só o enviam com `lun_test_` |
| `sandbox_sem_saldo` · `sandbox_sem_cashin` · `sandbox_sem_saque` | operação fictícia sem lastro fictício | criar e pagar uma cobrança de teste antes |

Erros autocorrigíveis trazem também `campo`, `missing[]` e `next_actions[]`. Código que não está aqui:
leia `agent_guidance` e faça exatamente aquilo; a lista completa vive em
`components.schemas.Erro.properties.erro.x-known-values` do OpenAPI e cresce sem aviso.
