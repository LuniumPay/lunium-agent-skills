# O que mudou (skill 2.2.0 → 3.0.x · API 1.45.2 → 1.55.0 + estado vivo de 27/11/2026)

**3.0.1:** acompanha a documentação 1.55.0 (revisão 2026-11-27.1), que passou a dizer o mesmo que esta skill:
chave só pelo painel, `POST /keys` e `POST /keys/sandbox` documentados como 403, códigos novos no contrato.

Integração feita com a skill 2.x? Confira estes pontos, na ordem.

## Quebra: chave só pelo painel (25/11/2026)
- `POST /keys/sandbox` → 403 `sandbox_somente_no_painel`; `POST /keys` → 403 `producao_somente_no_painel`;
  `POST /mesh/agents` e as tools MCP de criação também. Chaves já emitidas seguem valendo.
- A chave de teste e a de produção nascem em https://parceiros.luniumpay.com (entrar com Google) › "Chaves de API".
- Scripts: `chave.mjs` (novo) guarda a chave sem eco; `init.mjs` e os `smoke*.mjs` não criam mais chave (leem do
  ambiente ou do `.env`); `go-live.mjs` não chama `POST /keys`: recebe a `lun_live_` do painel e confere a
  prontidão antes de cadastrar o webhook.

## Quebra: produção de conta nova exige o upgrade de conta (21/11/2026)
- Chave `lun_live_` de conta criada a partir de 19/11/2026 só opera (qualquer escrita, inclusive venda de
  cripto) com a verificação de identidade do titular aprovada: senão 403 `verificacao_titular_pendente`
  (`acao: parar`). `GET /keys/me` → `verificacao_titular {exigida, situacao, api_producao_liberada, onde}`.
  Leituras e `/keys/*` seguem livres.

## Quebra: cobrança Pix só com autorização prévia (19/11/2026, API 1.54.0)
- Conta sem liberação → `POST /cashin/charge`, `POST /cashin/preview` e `GET /cashin/limits` respondem 403
  `recebimento_sem_autorizacao` com `liberacao {status: nao_solicitado|pendente|recusado, solicitado_em, decidido_em}`.
  Conta nova nasce sem cobrança; o pedido é feito no painel. Consultas, catálogo e sandbox não mudam.

## Manutenção: Pix com saldo em reais (21/11/2026)
- `POST /payouts` em produção → 503 `em_manutencao` (`acao: esperar`), sem débito; `GET /keys/me` →
  `payout.via: "manutencao"`. Consultas e comprovantes antigos seguem; sandbox simula. Alternativas: saque em
  cripto, carteira USDT, venda de cripto.

## Campos novos (aditivos)
- `payer_email` opcional em `POST /cashin/charge` (1.51.0): identifica o pagador no QR; sem ele vai o da conta.
- `hold_reason` (`new_payer` · `new_account`) na criação, no status e nos webhooks de cash-in (1.52.0/1.53.0);
  `conta_nova` em `GET /keys/me` e `GET /cashin/limits`; `hold_policy: new_account_hold` (1.53.0).
- Webhooks da carteira USDT: `wallet.deposit_credited`, `wallet.payment_completed`, `wallet.payment_failed`,
  `wallet.withdrawal.completed`, `wallet.withdrawal.failed`. Evento desconhecido = no-op.
- `GET /sandbox/qr/{cashin_id}.svg`: imagem do QR de teste (não pagável).

## Desligados
- Assinatura legada `X-Webhook-Signature` e o alias de erro `code`: desligados em 09/11/2026. Valide só
  `X-Lunium-Signature` (v2) e ramifique por `erro`.

## Segurança da borda (25/11/2026)
- Caminho com `.`/`..` (inclusive `%2e`) → redirecionado na borda e recusado com 400 `caminho_invalido`.
  Monte URLs só com IDs devolvidos pela API.
- Cadastro novo com e-mail de privacidade, apelido ou temporário → 400 `email_nao_aceito` (contas existentes
  seguem entrando).

## O que a skill passou a ensinar
- Prontidão da conta antes de cobrar (`conta-e-liberacao.md`), catálogo de erros por grupo (`erros.md`),
  retenção dita com clareza ao pagador (horas + data em Brasília; motivo só com `hold_reason`), receitas que
  devolvem o erro da API ao frontend em vez de 500, comparação de assinatura em tempo constante no Supabase.
