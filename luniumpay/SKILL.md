---
name: luniumpay
description: "LuniumPay — Pix ⇄ stablecoin no Brasil por API, para apps feitos com IA. Use SEMPRE que o usuário mencionar receber Pix e cair em USDT/USDC, cobrar em reais com entrega em cripto, saldo em reais com saque em cripto, pagar Pix com cripto, carteira USDT, verificar um Pix, ou erros como sandbox_somente_no_painel, verificacao_titular_pendente e recebimento_sem_autorizacao. Ponto de entrada: pitch, chave pelo painel, prontidão da conta, árvore de decisão, roteiro, regras, erros/estados e sub-skills. EN: LuniumPay hub for Brazilian Pix ↔ stablecoin payments by API: accept Pix and settle USDT/USDC, BRL custody, pay Pix with crypto, USDT wallet, verify a Pix. API keys come from the partner dashboard (Google sign-in); production needs the account upgrade (owner identity check). Start here."
license: MIT
metadata:
  version: "3.0.1"
  api: "1.55.0"
  revisao: "2026-11-27.1"
---

# LuniumPay — comece aqui

**Em 30 segundos.** A LuniumPay é a camada de pagamentos Pix para quem quer receber
em stablecoin. O cliente paga um Pix normal no banco dele; o dono do app recebe
USDT/USDC na própria carteira, ou saldo em reais para sacar em cripto quando quiser.
O caminho inverso também existe: cripto entra, Pix sai, com comprovante do Banco
Central. Tudo por REST, com sandbox fiel. As chaves nascem no painel do parceiro, com login.

Fontes de verdade (consulte só o que precisar; nunca copie docs inteiras para o contexto):
- OpenAPI 3.1 (contrato): https://docs.luniumpay.com/openapi.json
- Contrato para máquina: https://docs.luniumpay.com/llms.txt · jornadas: https://docs.luniumpay.com/integration.json
- Sandbox e cenários: https://docs.luniumpay.com/sandbox · manual humano: https://docs.luniumpay.com/manual

Se um texto da documentação divergir da resposta da API, vale a resposta: `erro`, `acao` e
`agent_guidance` saem do serviço na hora. O que mudou desde a skill 2.x: `references/novidades.md`.

## 1. A chave nasce no painel (desde 25/11/2026)

A API não cria chave. `POST /keys/sandbox` → 403 `sandbox_somente_no_painel`; `POST /keys` → 403
`producao_somente_no_painel`; as tools MCP `lunium_create_sandbox_key` e `lunium_start_sandbox_demo`
recusam igual. **Não repita, não troque de IP, rota ou origem, não procure outra porta:** leve a
pessoa ao painel.

| Para | No painel (https://parceiros.luniumpay.com, entrar com Google) | Depois |
|---|---|---|
| Testar (`lun_test_`) | "Conta real e testes" → "Acessar testes" → menu "Integração por API" › "Chaves de API" → "Gerar chave deste projeto" | `node luniumpay/scripts/chave.mjs` grava no `.env` sem passar pelo chat |
| Produção (`lun_live_`) | conta real → "Upgrade de conta" (verificação de identidade do titular) → cobranças Pix liberadas → "Chaves de API" → "Gerar chave deste projeto" | `node luniumpay/scripts/go-live.mjs --webhook …` |

A chave aparece uma vez só e só Dono ou Financeiro do projeto a gera. **Nunca peça a chave no chat:**
`chave.mjs` lê sem eco (ou `pbpaste | node luniumpay/scripts/chave.mjs`), confere em `GET /keys/me`
e grava `LUNIUM_API_KEY` em arquivo 0600 que entra no `.gitignore`. Quem não tem conta cria no próprio
painel (e-mail de privacidade, apelido ou temporário não abre conta nova: `email_nao_aceito`).

## 2. Prontidão da conta — leia `GET /keys/me` antes de cobrar

| Sinal em `GET /keys/me` | Efeito | O que fazer |
|---|---|---|
| `verificacao_titular.exigida: true` e `api_producao_liberada: false` | toda escrita com `lun_live_` → 403 `verificacao_titular_pendente` (`acao: parar`); leituras e `/keys/*` seguem | upgrade de conta em `verificacao_titular.onde`; enquanto isso, sandbox |
| `key.cashin_enabled: false` | `POST /cashin/charge`, `POST /cashin/preview`, `GET /cashin/limits` → 403 `recebimento_sem_autorizacao` com `liberacao.status` | `nao_solicitado`: pedir no painel (Criar cobrança › Solicitar liberação) · `pendente`: aguardar, sem repetir · `recusado`: suporte |
| `payout.enabled: false` com `payout.via: "manutencao"` | `POST /payouts` (Pix com saldo em reais) → 503 `em_manutencao` (`acao: esperar`), nada debitado | saque em cripto (`/saldo/sacar-cripto`), carteira USDT (`/carteira-usdt/payments`) ou venda de cripto (`/cash-outs`) |
| `key.cashout_enabled: false` | venda de cripto desligada nesta conta | suporte |
| `conta_nova` presente | regras dos primeiros dias da conta | mostre o texto do campo; não deduza prazo |

Contas antigas ficam fora da verificação do titular. Na conta nova, a liberação das cobranças pode sair
sozinha quando a verificação confere; senão, fica para análise da Lunium. Não prometa liberação nem
prazo. `node luniumpay/scripts/doctor.mjs` mostra tudo isso de uma vez. Detalhe: `references/conta-e-liberacao.md`.

## 3. Árvore de decisão → qual sub-skill

| O dono do app quer… | Use | Núcleo |
|---|---|---|
| Receber Pix e cair **USDT/USDC direto na carteira** | `luniumpay-pix-charge` | `POST /cashin/charge` destino `cripto` |
| Receber Pix em **saldo em reais** e sacar depois (sem carteira fixa, subcontas por cliente) | `luniumpay-custody` | destino `saldo`, `/saldo/*` |
| Pagar um Pix **com cripto** (cliente envia USDT, Pix sai) | `luniumpay-crypto-sale` | `/cash-outs` |
| Manter **saldo em USDT** e pagar Pix com ele (chave ou copia e cola) | `luniumpay-usdt-wallet` | `/carteira-usdt/*` |
| Receber **eventos** com segurança | `luniumpay-webhooks` | `PATCH /keys/me`, HMAC |
| Provar que um Pix **liquidou**, sem chave | `luniumpay-verify-payment` | `GET /v1/verificar/{e2e}` |

Não sabe? Pergunte: "Você tem carteira cripto própria? Quer receber na hora em USDT ou prefere
acumular em reais e sacar quando quiser?" Carteira → `pix-charge`. Sem carteira ou vários clientes
finais → `custody`. Pagar fornecedor em Pix: hoje pela carteira USDT ou pela venda de cripto, enquanto
o Pix com saldo em reais estiver em manutenção.

## 4. Roteiro de integração (7 passos)

1. **Colete**: destino (carteira ou saldo); rede + endereço, se carteira; stack do app; quem tem
   login de Dono/Financeiro no painel.
2. **Chave de teste**: a pessoa gera no painel (seção 1) e roda `node luniumpay/scripts/chave.mjs`.
3. **Diagnóstico**: `node luniumpay/scripts/doctor.mjs` (lê a chave do `.env`, nunca a imprime).
4. **Backend**: `node luniumpay/scripts/init.mjs` detecta a stack (Next.js, Express, FastAPI, Supabase)
   e grava a receita oficial sem sobrescrever nada. `LUNIUM_DESTINO=saldo` dispensa carteira; `cripto`
   exige `LUNIUM_PAYOUT_ADDRESS`. Receitas em `luniumpay-pix-charge/references/`, todas validando o
   dígito do CPF/CNPJ e devolvendo os erros da API (com `acao`) ao frontend.
5. **Webhook**: `luniumpay-webhooks`. URL via `PATCH /keys/me`, segredo em `LUNIUM_WEBHOOK_SECRET`,
   assinatura validada, `event_id` deduplicado, status relido antes de liberar.
6. **Prove no sandbox**: `node luniumpay-pix-charge/scripts/smoke.mjs cripto success` e pelo menos
   um cenário ruim (`failed`, `payer_mismatch`, `settlement_uncertain`).
7. **Produção**: upgrade de conta e liberação das cobranças no painel → chave `lun_live_` em
   "Chaves de API" → deploy (precisa existir a URL https) →
   `node luniumpay/scripts/go-live.mjs --webhook https://<dominio>/api/webhooks/lunium [--vercel]`
   (confere a prontidão, cadastra o webhook, grava os segredos no host sem imprimir e prova a entrega
   com `POST /webhooks/test`). Primeira cobrança real pequena (ex. R$ 5,00) paga pelo dono e
   acompanhada até `sent`. Guia por stack: `references/producao.md`.

## 5. Regras que não se negociam

1. **Dinheiro é ESTADO, não HTTP 200.** Pix pago = `status: "paid"`. Entrega =
   `settlement_status: "sent"`. Prova on-chain = `settlement_proof: "confirmed"`.
   Libere o pedido só no estado que o negócio exige. Detalhe em `references/estados.md`.
2. **`external_id` em toda criação**, persistido ANTES de chamar. Retry = mesmo id
   + mesmo corpo. Timeout = consulte antes de repetir.
3. **Cash-in, saldo e payouts em CENTAVOS inteiros** (`amount_cents: 10000`).
   Cash-out e carteira USDT em decimais string (`"amount": "25.5"`). Rede: campo
   `chain` no cash-in/saque, `network` no cash-out.
4. **`payer_tax_number` é do PAGADOR** (CPF 11 / CNPJ 14, só dígitos) e é obrigatório na cobrança.
   **Valide o dígito verificador no app** (`documentoValido` nas receitas): a API aceita documento mal
   digitado e o Pix volta por divergência de pagador. `payer_email` (opcional) é o e-mail do pagador para
   identificá-lo no QR; sem ele vai o da conta. CPF/CNPJ novo pode nascer retido acima da faixa
   instantânea (`hold_reason: "new_payer"`, `hold_hours`, `liberar_em`); `erro=limite_do_pagador` →
   ofereça valor menor (`GET /cashin/limits?payer_tax=`). Nunca fracione para contornar.
5. **Todo erro traz `erro`, `acao`, `detail`, `agent_guidance`.** `acao` ∈ corrigir | repetir | esperar |
   parar | falar_com_suporte (e, nas portas de chave, `criar_conta_no_painel` / `usar_sandbox_ou_painel`).
   Siga literalmente; ramifique por `erro`, nunca pelo texto. Catálogo em `references/erros.md`.
6. **Estado incerto não autoriza segundo pagamento nem segunda entrega.** `incerto`, `under_review`,
   `delayed`, `MANUAL_REVIEW`: mostre o estado e a próxima ação. Nunca anuncie entrega sem evidência.
7. **Nunca gere QR, código Pix ou endereço de depósito com o modelo.** Só repasse o que a API
   devolveu, inteiro.
8. **Segredos só em variável de ambiente do servidor.** `lun_live_`, `lun_test_`, `webhook_secret`,
   `monitor_url`: nunca no navegador, repo público ou chat. Para guardar, `chave.mjs`; para levar ao
   host, `go-live.mjs`.
9. **Sandbox não movimenta dinheiro.** QR de sandbox não é pagável; confirme só por
   `POST /sandbox/cashin/{id}/pay`. Nunca envie cripto a endereço de sandbox. Cenários pelo campo
   `sandbox_scenario` (`GET /sandbox`). Omita em produção.
10. **Taxas, mínimos, rotas e retenções são lidos em tempo de execução** (`/keys/me`, `/cashin/catalog`,
    `/cashin/preview`, `/cashin/limits`, `/saldo`). Não grave números no código, não prometa câmbio
    travado: cripto é estimativa até a conversão.
11. **Porta fechada não se força.** 403 de chave, verificação, liberação ou bloqueio de pagador
    (`sandbox_somente_no_painel`, `producao_somente_no_painel`, `verificacao_titular_pendente`,
    `recebimento_sem_autorizacao`, `pagador_bloqueado`) não se repete em laço, não se contorna com outra
    chave, outro documento, outro IP ou outra rota. Mostre o motivo e o caminho no painel/suporte.
12. **URL só com IDs que a API devolveu.** Nunca monte caminho com `.` ou `..` (nem `%2e`): o serviço
    responde 400 `caminho_invalido` (a borda redireciona antes).
13. **Linguagem.** Diga "Pix com liquidação em USDT", "chave gerada no painel", "upgrade de conta",
    "limites progressivos", "comprovante oficial (E2E)". Nada que sugira anonimato ou ausência de
    verificação (de identidade, documentos, cadastro ou conta bancária), nada de "instantâneo", "chave em
    uma chamada" ou "sem aprovação", nenhuma promessa de liberação, e nenhum nome de corretora, banco ou
    provedor (inclusive o de verificação de identidade) por trás da LuniumPay.

## 6. Sandbox: o que simula e o que não

- Simula: cash-in (destino `cripto` e `saldo`), carência do saldo (cenário `held`, só saldo), payout,
  saque em cripto, cash-out USDT/polygon e DEPIX/liquid (depósito "chega" sozinho após o aceite),
  webhooks reais para URL pública, erros com o mesmo formato da produção.
- Não simula: escada por pagador (`limite_do_pagador` e retenção por faixa só em produção), verificação
  do titular e liberação de cobranças (a chave de teste já nasce pronta), manutenção do payout, crédito de
  depósito na carteira USDT (pagamento devolve `saldo_insuficiente`), tokens DEX, Pix real.
- Controles: `POST /sandbox/cashin/{id}/pay` paga; `POST /sandbox/operations/{id}/resolve`
  `{"outcome": "sent"|"failed"}` fecha um `incerto` (cash-in: id = `cashin_id`; cash-out: só DePix);
  `GET /sandbox/events` mostra o que seria enviado por webhook; `GET /sandbox/qr/{cashin_id}.svg` dá a
  imagem não pagável; `POST /sandbox/reset` `{"confirm": true}` limpa; `GET /sandbox` lista cenários por
  fluxo. Cenário fora do fluxo → 400 `cenario_invalido`; `sandbox_scenario` com chave de produção → 403
  `sandbox_only`.

## 7. Outras rotas (fora das sub-skills)

`GET /ping` saúde · `POST /leads` fala com um humano (preço por volume, contrato; só com e-mail que a
pessoa deu para isso) · `POST /keys/painel-link` manda o link do painel ao e-mail da chave ·
`GET /pix/keys/lookup` titular de chave Pix quando disponível (`verified=false` não é erro nem bloqueia) ·
`GET /comissao`, `/comissao/extrato`, `POST /comissao/sacar` (sub fee de quem revende) · Mesh
(`GET /mesh`) é a rede de agentes autônomos, fora desta skill; o cadastro de agente pela API também
fechou (403 `sandbox_somente_no_painel`).

## 8. Referências desta skill

- `references/conta-e-liberacao.md` — chave pelo painel, upgrade de conta, liberação de cobranças, manutenção, o que dizer ao dono.
- `references/estados.md` — estados de cash-in, cash-out, payout, saque, carteira; quando liberar; motivos de retenção.
- `references/erros.md` — códigos de erro, `acao` e o que fazer.
- `references/checklist-producao.md` — gate antes de ligar `lun_live_`.
- `references/faq-dono.md` — perguntas que o dono do app faz (taxas, retenção, limites, contestação, saques).
- `references/prompts.md` — pedidos típicos de vibe coder e o que o agente faz em cada um.
- `references/mcp.md` — usar a LuniumPay por MCP: o que funciona sem chave, com chave e o que fica só na REST.
- `references/producao.md` — deploy por stack, variáveis, go-live, primeira cobrança, operação, rotação de segredos.
- `references/novidades.md` — o que mudou na API e na skill desde a 2.2.0.
- `scripts/chave.mjs` — guarda a chave gerada no painel (sem eco, 0600, `.gitignore`).
- `scripts/init.mjs` — monta a integração no projeto (detecta a stack, grava rotas/webhook/.env.example).
- `scripts/doctor.mjs` — diagnóstico da chave e prontidão para produção.
- `scripts/go-live.mjs` — confere a `lun_live_`, cadastra o webhook, leva os segredos ao host e prova a entrega.
- Provas no sandbox: `luniumpay-pix-charge/scripts/smoke.mjs`, `luniumpay-custody/scripts/smoke-custody.mjs`,
  `luniumpay-crypto-sale/scripts/smoke-cashout.mjs`, `luniumpay-webhooks/scripts/verify-webhook.test.mjs`.

Suporte humano: contato@luniumpay.com · https://wa.me/27722944340 · comunidade Lunium Partners
(Telegram): https://t.me/+FerOZMRRP_g5MDk5 (recomendada).
