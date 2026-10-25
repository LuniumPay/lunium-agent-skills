# Produção de verdade: do deploy ao primeiro Pix real

Ordem que funciona: **deploy primeiro** (para existir uma URL https), **go-live depois**
(chave de produção + webhook apontando para essa URL), **cobrança real pequena** por último.

## 1. Deploy por stack (o código é o mesmo do sandbox)

| Stack | Deploy | Variáveis de produção | URL do webhook |
|---|---|---|---|
| Next.js (Vercel) | `vercel` (preview) → `vercel --prod` | `vercel env add LUNIUM_API_KEY production` (valor por stdin), idem `LUNIUM_WEBHOOK_SECRET`, `LUNIUM_DESTINO`, `LUNIUM_PAYOUT_ADDRESS`, `LUNIUM_CHAIN`; redeploy depois | `https://<dominio>/api/webhooks/lunium` |
| Express (Railway, Render, Fly, VPS) | build normal; Node 20+ | painel do host ou `.env` 0600 no servidor | `https://<dominio>/webhooks/lunium` |
| FastAPI (Railway, Render, Fly, VPS) | `uvicorn lunium_api:app --host 0.0.0.0 --port $PORT` | idem | `https://<dominio>/webhooks/lunium` |
| Supabase Edge | `supabase functions deploy lunium-cobranca` e `supabase functions deploy lunium-webhook --no-verify-jwt` | `supabase secrets set LUNIUM_API_KEY=… LUNIUM_WEBHOOK_SECRET=…` | `https://<ref>.supabase.co/functions/v1/lunium-webhook` |

Regras: segredos só no host; `LUNIUM_API_KEY` de produção nunca em preview público, repositório,
frontend ou chat. `sandbox_scenario` não existe em produção (as receitas só o enviam com `lun_test_`).
Sem carteira: `LUNIUM_DESTINO=saldo` (custódia em reais, saque em cripto quando quiser).

## 2. Go-live em um comando
```bash
node luniumpay/scripts/go-live.mjs --name "Minha Empresa" --email voce@empresa.com \
  --webhook https://<dominio>/api/webhooks/lunium --vercel        # ou --env .env.lunium.production
```
Faz: `POST /keys` (chave `lun_live_` na hora, sem aprovação, enviada ao e-mail), webhook cadastrado
com `webhook_secret`, segredos gravados no host (nunca impressos), `GET /keys/me` conferido,
`POST /webhooks/test` disparado e a entrega lida em `GET /webhooks/deliveries` (seu endpoint tem
de responder 2xx com assinatura válida). Com `LUNIUM_API_KEY=lun_live_` já no ambiente, reutiliza
a chave. Depois de gravar variáveis na Vercel, faça um novo deploy.

## 3. Primeira cobrança real (quem paga é o dono do app)
Valor pequeno (ex. R$ 5,00), CPF do próprio dono. Acompanhe `GET /cashin/{id}/status` até
`status=paid` e `settlement_status=sent`; abra `settlement_tx_url` (cripto) ou veja o crédito em
`GET /saldo`. Confira o webhook `cashin.settled` em `GET /webhooks/deliveries`. Só então
anuncie o checkout aos clientes.

## 4. Operar
- Entregas de webhook: `GET /webhooks/deliveries?status=failed`; reenviar: `POST /webhooks/deliveries/{event_id}/retry`.
- Cobranças e eventos: `GET /cashin/charges`, `GET /cashin/events`; saldo: `GET /saldo`, `GET /saldo/extrato`.
- Painel web: `POST /keys/painel-link` manda o link ao e-mail da chave. `monitor_url` (em `GET /keys/me`) é privado.
- Limites do pagador antes de cobrar valores altos: `GET /cashin/limits?payer_tax=`.
- Girar segredos: `PATCH /keys/me {"rotate_webhook_secret": true}` (aparece uma vez) e
  `{"rotate_monitor_token": true}`. Não há rotação da API key por rota: crie outra com `POST /keys`,
  troque a variável e peça a desativação da antiga em contato@luniumpay.com se ela vazou.
- Sub fee (se você revende): `partner_fee_bps`, `partner_cashout_fee_bps`, `partner_saque_fee_bps`,
  `partner_deposito_fee_bps` em `PATCH /keys/me`; saldo em `GET /comissao`.

## 5. Dados pessoais e linguagem
Guarde `payer_tax_number` mascarado e o `e2e`/comprovante da operação; não exponha CPF em páginas
públicas. No app: "Pix com liquidação em USDT", nunca "sem KYC", "anônimo", "instantâneo", nem o
nome de corretoras, bancos ou provedores por trás da LuniumPay.
