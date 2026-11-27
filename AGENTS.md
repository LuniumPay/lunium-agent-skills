# Para agentes de código

Este repositório contém as Agent Skills da LuniumPay (Pix ⇄ stablecoin no Brasil).
Comece por `luniumpay/SKILL.md`. A fonte de verdade da API é https://docs.luniumpay.com/openapi.json
e o contrato para máquina é https://docs.luniumpay.com/llms.txt; se um texto divergir da resposta da API,
vale a resposta (`erro`, `acao`, `agent_guidance`).

- A API não cria chave: a chave de teste e a de produção nascem no painel (https://parceiros.luniumpay.com).
  Não tente `POST /keys`, `POST /keys/sandbox` nem tools MCP de criação; não peça a chave no chat. Use
  `node luniumpay/scripts/chave.mjs`, que lê sem eco e grava em arquivo 0600.
- Nunca invente endpoint, taxa, rede, QR ou endereço: use o que a API devolve.
- Recusa de conta (`verificacao_titular_pendente`, `recebimento_sem_autorizacao`, `pagador_bloqueado`,
  `em_manutencao`) não se repete em laço nem se contorna: mostre o motivo e o caminho.
- Scripts em `*/scripts/smoke*.mjs` só rodam com chave de sandbox (`lun_test_`); `go-live.mjs` só com `lun_live_`.
- Testes do repositório (sem chamar a API): `node --test tests/*.test.mjs` e `node luniumpay-webhooks/scripts/verify-webhook.test.mjs`.
- Ao editar: o `init.mjs` extrai os blocos de código das receitas por posição; mantenha a ordem dos blocos em
  `luniumpay-pix-charge/references/*.md`. Versão em `metadata.version` de cada SKILL.md e nos `plugin.json`.
