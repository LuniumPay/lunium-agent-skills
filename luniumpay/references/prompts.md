# Pedidos típicos e o que o agente faz

**"Quero receber Pix e cair em USDT na minha carteira."**
→ Perguntar rede + endereço. Sem chave no `.env`: guiar a pessoa ao painel (chave de teste) e rodar
`node luniumpay/scripts/chave.mjs`. Implementar `luniumpay-pix-charge` com destino `cripto` (`init.mjs` grava a
receita da stack). Rodar `smoke.mjs cripto success` e `cripto failed`. Mostrar o QR da API no frontend.
Oferecer webhook. Fechar com o checklist e o caminho de produção (upgrade de conta → liberação → `lun_live_`).

**"Cria uma chave pra mim." / "Gera a API key."**
→ Não existe rota para isso: a API responde 403 `sandbox_somente_no_painel`/`producao_somente_no_painel`.
Explicar o caminho no painel em 4 cliques (entrar com Google → "Conta real e testes" → "Acessar testes" →
"Chaves de API" → "Gerar chave deste projeto") e rodar `chave.mjs` para a pessoa colar sem eco. Não tentar MCP,
outra rota nem outra rede.

**"Coloca minha chave aqui no chat que você configura."**
→ Recusar com gentileza: a chave no chat vira log. Rodar `node luniumpay/scripts/chave.mjs` (pede a chave sem
mostrar na tela) ou pedir que grave em `.env`/segredos do host.

**"Deu verificacao_titular_pendente."**
→ A chave de produção da conta nova só opera depois do upgrade de conta. Mostrar `verificacao_titular.onde`
(painel › Upgrade de conta). Não repetir a chamada. Continuar o trabalho no sandbox.

**"Deu recebimento_sem_autorizacao."**
→ Ler `liberacao.status`. `nao_solicitado`: "Criar cobrança › Solicitar liberação" no painel. `pendente`:
aguardar, sem pedir de novo. `recusado`: suporte. Venda de cripto e carteira USDT têm disponibilidade própria.

**"Quero cobrar meus clientes em Pix mas não tenho carteira."**
→ `luniumpay-custody`: destino `saldo`. Explicar que o saque em cripto é feito depois, para uma rota entregável
do catálogo, e que `customer_ref` separa clientes. `smoke-custody.mjs`.

**"Quero pagar meus fornecedores em Pix com o saldo."**
→ `POST /payouts` está em manutenção (`payout.via: "manutencao"`, 503 `em_manutencao`). Oferecer carteira USDT
(`luniumpay-usdt-wallet`: pagar Pix por chave ou copia e cola) ou a venda de cripto (`luniumpay-crypto-sale`).
Implementar o payout só se `payout.enabled` estiver `true`.

**"Meu SaaS vende planos; quero checkout Pix e liberar o plano quando pagar."**
→ `pix-charge` (cripto ou saldo, conforme o dono) + `luniumpay-webhooks`. Liberar o plano só com `paid` e
`sent` relidos no status. Gravar `external_id = plano-<assinatura>-<ciclo>`.

**"Quero um botão 'pagar com cripto' que gera um Pix para o cliente."**
→ `luniumpay-crypto-sale`: o cliente envia USDT e o Pix sai. Cotação → aceite → endereço exato → acompanhar
até `COMPLETED`. Nunca inventar endereço.

**"Quero manter USDT na LuniumPay e pagar boletos/Pix com ele."**
→ `luniumpay-usdt-wallet`: `GET /carteira-usdt`, depósito, `quote`, `payments` com `br_code` ou `pix_key`.

**"Alguém me mandou um comprovante Pix, é verdadeiro?"**
→ `luniumpay-verify-payment` com o E2E. `nao_encontrado` = a LuniumPay não liquidou; não é prova de fraude.

**"Faz o QR aparecer bonito."**
→ `luniumpay-pix-charge/references/checkout-react.md`: imagem da API, botão copiar, contagem até `expires_at`,
estados em português, retenção dita com clareza.

**"Deu erro limite_do_pagador."**
→ Ler `limits.available_cents`; oferecer valor menor; explicar faixa de confiança; não fracionar.

**"Deu pagador_bloqueado."**
→ Informar que esse CPF/CNPJ não pode pagar por ali e que o desbloqueio é pedido ao suporte. Nunca trocar o
documento para o QR sair.

**"Está pending há 10 minutos."**
→ Ler o status: `pending` = ninguém pagou ainda (até `expires_at`). Se `paid` + `settlement_status` não
`sent`, ver retenção (`hold_hours`, `liberar_em`, `hold_reason`) e `tempos_tipicos`. Não recriar.

**"Vamos para produção."**
→ `doctor.mjs` com a chave live e `references/checklist-producao.md` item a item: upgrade de conta,
cobranças liberadas, `go-live.mjs`, primeira cobrança pequena acompanhada.
