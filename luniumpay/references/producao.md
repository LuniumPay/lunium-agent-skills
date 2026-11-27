# Produção de verdade: da conta ao primeiro Pix real

Ordem que funciona: **conta pronta** (upgrade de conta + cobranças liberadas, no painel) → **chave `lun_live_`**
(gerada no painel) → **deploy** (para existir uma URL https) → **go-live** (webhook + segredos no host +
entrega provada) → **cobrança real pequena**.

## 0. Conta pronta (painel, com login)
1. https://parceiros.luniumpay.com → entrar com Google → conta real.
2. "Upgrade de conta": verificação de identidade do titular (documento, prova de vida e selfie). Conta antiga
   pode estar fora dessa exigência: `GET /keys/me` → `verificacao_titular.exigida`.
3. Cobranças Pix: "Criar cobrança" › "Solicitar liberação" (na conta nova o upgrade já abre o pedido). Estado em
   `key.cashin_enabled`; recusa da API traz `liberacao.status`.
4. "Integração por API" › "Chaves de API" → "Gerar chave deste projeto" → `lun_live_…` (aparece uma vez).
   Guarde com `node luniumpay/scripts/chave.mjs` (vai para `.env.lunium.production`, 0600) ou cole direto no
   `go-live.mjs`.

`node luniumpay/scripts/doctor.mjs` com a chave live lista o que ainda falta.

## 1. Deploy por stack (o código é o mesmo do sandbox)

| Stack | Deploy | Variáveis de produção | URL do webhook |
|---|---|---|---|
| Next.js (Vercel) | `vercel` (preview) → `vercel --prod` | `go-live.mjs --vercel` grava `LUNIUM_API_KEY`, `LUNIUM_WEBHOOK_SECRET` (e `LUNIUM_DESTINO` com `--destino`) em production por stdin; `LUNIUM_PAYOUT_ADDRESS`/`LUNIUM_CHAIN` com `vercel env add`; redeploy depois | `https://<dominio>/api/webhooks/lunium` |
| Express (Railway, Render, Fly, VPS) | build normal; Node 20+ | painel do host ou `.env` 0600 no servidor | `https://<dominio>/webhooks/lunium` |
| FastAPI (Railway, Render, Fly, VPS) | `uvicorn lunium_api:app --host 0.0.0.0 --port $PORT` | idem | `https://<dominio>/webhooks/lunium` |
| Supabase Edge | `supabase functions deploy lunium-cobranca` e `supabase functions deploy lunium-webhook --no-verify-jwt` | `supabase secrets set --env-file .env.lunium.production` | `https://<ref>.supabase.co/functions/v1/lunium-webhook` |

Regras: segredos só no host; `LUNIUM_API_KEY` de produção nunca em preview público, repositório, frontend ou
chat. `sandbox_scenario` não existe em produção (as receitas só o enviam com `lun_test_`). Sem carteira:
`LUNIUM_DESTINO=saldo` (custódia em reais, saque em cripto quando quiser).

## 2. Go-live em um comando
```bash
node luniumpay/scripts/go-live.mjs --webhook https://<dominio>/api/webhooks/lunium --vercel --deploy   # ou --env .env.lunium.production
```
Faz: lê a `lun_live_` (ambiente → `--env` → colada sem eco), confere em `GET /keys/me` a verificação do titular,
a liberação das cobranças e o estado do payout, cadastra o webhook (`PATCH /keys/me`, que devolve o
`webhook_secret`), grava os segredos no host sem imprimir, e prova a entrega com `POST /webhooks/test` lida em
`GET /webhooks/deliveries` (seu endpoint tem de responder 2xx com assinatura válida). Com a verificação do
titular pendente, cadastra o webhook mas adia o teste (a API recusaria com `verificacao_titular_pendente`).
`--dry` mostra só a prontidão.

## 3. Primeira cobrança real (quem paga é o dono do app)
Valor pequeno (ex. R$ 5,00), CPF do próprio dono. Acompanhe `GET /cashin/{id}/status` até `status=paid` e
`settlement_status=sent`; abra `settlement_tx_url` (cripto) ou veja o crédito em `GET /saldo`. Confira o webhook
`cashin.settled` em `GET /webhooks/deliveries`. Só então anuncie o checkout aos clientes.

## 4. Operar
- Entregas de webhook: `GET /webhooks/deliveries?status=failed`; reenviar: `POST /webhooks/deliveries/{event_id}/retry`.
- Cobranças e eventos: `GET /cashin/charges`, `GET /cashin/events`; saldo: `GET /saldo`, `GET /saldo/extrato`.
- Painel web (comprovantes, notificações, time com papéis): https://parceiros.luniumpay.com.
  `POST /keys/painel-link` manda o link ao e-mail da chave. `monitor_url` (em `GET /keys/me`) é privado.
- Limites do pagador antes de cobrar valores altos: `GET /cashin/limits?payer_tax=`.
- Girar segredos: `PATCH /keys/me {"rotate_webhook_secret": true}` (aparece uma vez) e
  `{"rotate_monitor_token": true}`. A API key gira no painel: "Chaves de API" → gere a nova, troque no host,
  revogue a antiga (vazou? revogue já e avise contato@luniumpay.com).
- Pix com saldo em reais em manutenção (`payout.via: "manutencao"`): o app esconde essa opção até
  `payout.enabled` voltar a `true`.
- Sub fee (se você revende): `partner_fee_bps`, `partner_cashout_fee_bps`, `partner_saque_fee_bps`,
  `partner_deposito_fee_bps` em `PATCH /keys/me`; saldo em `GET /comissao`.

## 5. Dados pessoais e linguagem
Guarde `payer_tax_number` mascarado e o `e2e`/comprovante da operação; não exponha CPF em páginas públicas.
`payer_email` só com o e-mail que o próprio pagador informou. No app: "Pix com liquidação em USDT"; nada que
sugira anonimato ou ausência de verificação, nada de "instantâneo", nem o nome de corretoras, bancos ou
provedores por trás da LuniumPay.
