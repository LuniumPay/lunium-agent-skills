# Checklist antes de ligar `lun_live_`

Rode `node luniumpay/scripts/doctor.mjs` com a chave de produção (ele lê do `.env`, não imprime) e confira:

**Conta (painel, com login)**
- [ ] Upgrade de conta feito: `GET /keys/me` → `verificacao_titular.api_producao_liberada: true` (ou `exigida: false`).
- [ ] Cobranças Pix liberadas: `key.cashin_enabled: true` (sem isso, 403 `recebimento_sem_autorizacao`).
- [ ] `payout` lido: se `via: "manutencao"`, o app não oferece Pix com saldo em reais e mostra as alternativas.
- [ ] Chave `lun_live_` gerada em "Chaves de API" da conta real e guardada com `chave.mjs`/`go-live.mjs` (nunca no chat).

**Segredos e ambiente**
- [ ] Host de produção tem `LUNIUM_API_KEY=lun_live_…` e `LUNIUM_WEBHOOK_SECRET`. Nada disso no frontend, no repo, no chat, em preview público.
- [ ] `sandbox_scenario` não aparece em nenhuma chamada de produção.
- [ ] `LUNIUM_DESTINO` definido (`saldo` sem carteira; `cripto` com `LUNIUM_PAYOUT_ADDRESS` confirmado pelo dono, rede certa, `payout_tag` quando a rede exige).

**Código**
- [ ] Pedido/intenção é gravado ANTES da chamada; `external_id` reutilizado no retry; timeout → consulta antes de repetir.
- [ ] CPF/CNPJ do pagador validado no app (dígito verificador) antes de criar a cobrança; `payer_email` só quando o pagador informou.
- [ ] Liberação do produto depende de `status=paid` **e** `settlement_status=sent` (ou crédito em `/saldo`), nunca só do webhook `cashin.paid`.
- [ ] Erros da API chegam ao frontend com `erro`/`acao` e mensagem humana; recusas de conta (`verificacao_titular_pendente`, `recebimento_sem_autorizacao`, `pagador_bloqueado`, `em_manutencao`) não entram em laço.
- [ ] Taxas e mínimos lidos em runtime (`/cashin/preview`, `/keys/me`, `/saldo`); UI mostra valor em cripto como estimativa.
- [ ] Mensagens ao pagador cobrem: aguardando, pago e em entrega, **em retenção** (horas + data em Brasília; motivo só com `hold_reason`), devolvido, expirado, em análise.

**Webhook**
- [ ] Corpo cru, HMAC v2 validado, janela de 300 s, `event_id` único no banco, 2xx rápido, processamento assíncrono, ordem fora de sequência tolerada, evento desconhecido ignorado.
- [ ] `node luniumpay/scripts/go-live.mjs --webhook https://<dominio>/…` rodado após o deploy: webhook cadastrado, segredos no host, `POST /webhooks/test` entregue com 2xx (`GET /webhooks/deliveries`).

**Primeira operação e comunicação**
- [ ] Primeira cobrança real pequena (ex. R$ 5,00) paga pelo dono e acompanhada até `sent`; `settlement_tx_url` aberto.
- [ ] Dono informado de: Lunium Partners (Telegram), suporte humano, `monitor_url` privado (nunca exposto a clientes).
- [ ] Linguagem do app revisada: nada que sugira anonimato ou ausência de verificação, nada de "instantâneo" ou "sem aprovação", nenhum provedor citado.
