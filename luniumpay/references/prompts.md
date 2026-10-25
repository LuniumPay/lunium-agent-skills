# Pedidos típicos e o que o agente faz

**"Quero receber Pix e cair em USDT na minha carteira."**
→ Perguntar rede + endereço + e-mail. `POST /keys/sandbox`. Implementar `luniumpay-pix-charge` com destino `cripto`. Receita da stack do projeto. Rodar `smoke.mjs cripto success` e `cripto failed`. Mostrar o QR da API no frontend. Oferecer webhook. Fechar com o checklist e `POST /keys`.

**"Quero cobrar meus clientes em Pix mas não tenho carteira."**
→ `luniumpay-custody`: destino `saldo`. Explicar que o saque em cripto é feito depois, para qualquer rede do catálogo, e que `customer_ref` separa clientes. `smoke-custody.mjs`.

**"Meu SaaS vende planos; quero checkout Pix e liberar o plano quando pagar."**
→ `pix-charge` (cripto ou saldo, conforme o dono) + `luniumpay-webhooks`. Liberar o plano só com `paid` e `sent` relidos no status. Gravar `external_id = plano-<assinatura>-<ciclo>`.

**"Quero um botão 'pagar com cripto' que gera um Pix para o cliente."**
→ `luniumpay-crypto-sale`: o cliente envia USDT e o Pix sai. Cotação → aceite → endereço exato → acompanhar até `COMPLETED`. Nunca inventar endereço.

**"Quero manter USDT na LuniumPay e pagar boletos/Pix com ele."**
→ `luniumpay-usdt-wallet`: `GET /carteira-usdt`, depósito, `quote`, `payments` com `br_code` ou `pix_key`.

**"Alguém me mandou um comprovante Pix, é verdadeiro?"**
→ `luniumpay-verify-payment` com o E2E. `nao_encontrado` = a LuniumPay não liquidou; não é prova de fraude.

**"Coloca minha chave aqui no chat que você configura."**
→ Recusar com gentileza. Pedir que grave em `.env`/segredos do host. Explicar que a chave no chat vira log.

**"Faz o QR aparecer bonito."**
→ `luniumpay-pix-charge/references/checkout-react.md`: componente com imagem da API, botão copiar, contagem até `expires_at`, estados em português.

**"Deu erro limite_do_pagador."**
→ Ler `limits.available_cents`; oferecer valor menor; explicar faixa de confiança; não fracionar.

**"Está pending há 10 minutos."**
→ Ler o status: `pending` = ninguém pagou ainda (até `expires_at`). Se `paid` + `settlement_status` não `sent`, mostrar `tempos_tipicos`/`liberar_em`. Não recriar.

**"Vamos para produção."**
→ `references/checklist-producao.md` item a item; `doctor.mjs` com a chave live; primeira cobrança pequena acompanhada.
