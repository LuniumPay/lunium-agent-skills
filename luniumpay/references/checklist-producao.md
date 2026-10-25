# Checklist antes de ligar `lun_live_`

Rode `node luniumpay/scripts/doctor.mjs` com a chave de produção e confira:

- [ ] `GET /keys/me`: `cashin_enabled` (e `payout_enabled` se usar saldo), `webhook_configured: true`, `nivel_conta` lido.
- [ ] `.env` do servidor tem `LUNIUM_API_KEY=lun_live_…` e `LUNIUM_WEBHOOK_SECRET`. Nada disso no frontend, no repo, no chat.
- [ ] `sandbox_scenario` não aparece em nenhuma chamada de produção.
- [ ] Pedido/intenção é gravado ANTES da chamada; `external_id` reutilizado no retry; timeout → consulta antes de repetir.
- [ ] Liberação do produto depende de `status=paid` **e** `settlement_status=sent` (ou crédito em `/saldo`), nunca só do webhook `cashin.paid`.
- [ ] Webhook: corpo cru, HMAC validado, janela de 300 s, `event_id` único no banco, 2xx rápido, processamento assíncrono, ordem fora de sequência tolerada.
- [ ] `node luniumpay/scripts/go-live.mjs … --webhook https://<dominio>/…` rodado após o deploy: chave `lun_live_`, webhook cadastrado, segredos no host, `POST /webhooks/test` entregue com 2xx (`GET /webhooks/deliveries`).
- [ ] `LUNIUM_DESTINO` definido (`saldo` sem carteira; `cripto` com `LUNIUM_PAYOUT_ADDRESS` confirmado).
- [ ] CPF/CNPJ do pagador validado no app (dígito verificador) antes de criar a cobrança.
- [ ] Taxas e mínimos lidos em runtime (`/cashin/preview`, `/keys/me`, `/saldo`); UI mostra valor em cripto como estimativa.
- [ ] Mensagens ao pagador cobrem: aguardando, pago e em entrega, retido (com `liberar_em`), devolvido, expirado, em análise.
- [ ] Destino cripto: `payout_address` confirmado pelo dono (rede certa, `payout_tag` quando a rede exige).
- [ ] Primeira cobrança real pequena (ex. R$ 5,00) paga e acompanhada até `sent`; `settlement_tx_url` aberto.
- [ ] Dono informado de: Lunium Partners (Telegram), suporte humano, `monitor_url` privado (nunca exposto a clientes).
- [ ] Linguagem do app revisada: sem "sem KYC", "anônimo", "instantâneo", sem citar provedores.
