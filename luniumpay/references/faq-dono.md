# Perguntas que o dono do app faz (respostas que o agente pode dar)

**Como pego a chave?** No painel: https://parceiros.luniumpay.com, entrar com Google. Para testar:
"Conta real e testes" → "Acessar testes" → "Integração por API" › "Chaves de API" → "Gerar chave deste
projeto". Ela aparece uma vez; guarde com `node luniumpay/scripts/chave.mjs` (não cole no chat). A API não
cria chave desde 25/11/2026.

**E para produção?** Na conta real: "Upgrade de conta" (verificação de identidade do titular: documento,
prova de vida e selfie) → liberação das cobranças Pix → "Chaves de API" → `lun_live_`. O estado aparece em
`GET /keys/me` (`verificacao_titular`, `key.cashin_enabled`). A Lunium decide a liberação; não prometa prazo.

**Pedi a liberação e nada.** `liberacao.status` na recusa diz onde está: `pendente` = em análise (não peça
de novo), `recusado` = fale com o suporte. Enquanto isso, o sandbox funciona igual.

**Quanto custa?** As taxas são da conta e aparecem em `GET /keys/me` (`fee_bps`, taxa fixa por Pix em
`nivel_conta.beneficios`, sub fees em `comissao`) e em cada prévia (`POST /cashin/preview` →
`fee_total_cents`, `net_cents`). Mostre a prévia; não cite números de memória.

**Preciso de carteira?** Não. Com `destino: "saldo"` o valor fica em reais na custódia e o saque em cripto é
feito quando quiser (`POST /saldo/sacar-cripto`), para uma rota entregável do catálogo, sem teto comercial
por valor. Com carteira, use `destino: "cripto"` e receba a cada Pix.

**O cliente precisa de conta na LuniumPay?** Não. Ele paga um Pix normal no app do banco dele. A API pede o
CPF/CNPJ do pagador (`payer_tax_number`) para limites e proteção contra fraude; o e-mail dele
(`payer_email`) é opcional e só identifica o pagador no QR.

**Por que a cobrança ficou retida?** Em geral, Pix pequeno sai na hora; acima da faixa instantânea, CPF/CNPJ
que ainda não cumpriu a retenção inicial fica retido algumas horas (`hold_hours`, `liberar_em`,
`hold_reason: "new_payer"`). Cumprida a retenção sem contestação, o mesmo documento tende a sair na hora. A
faixa atual de cada CPF/CNPJ está em `GET /cashin/limits?payer_tax=`; não a fixe no código. Não é falha e não
exige novo Pix. Mostre "EM RETENÇÃO" com a data de liberação no horário de Brasília.

**Qual é o valor mínimo/máximo?** Mínimo vem da prévia (`min_brl_cents`) e da rota (`minBuyAmount` no
catálogo). Máximo por pagador vem de `GET /cashin/limits` (`max_amount_cents`, `next_stage`). Venda de
cripto: limites por transação e por recebedor em `GET /keys/me` (`limits`).

**Em quanto tempo o USDT chega?** Depois do Pix pago, a entrega passa por `sending/entregando` até `sent`;
`tempos_tipicos` no status dá a referência do momento. Não prometa prazo fixo nem use "instantâneo".

**E se o cliente contestar o Pix (MED)?** A LuniumPay aplica retenção e revisão automáticas por faixa de
pagador justamente para isso. Ensine o app a guardar `e2e`, `payer_tax_number` (mascarado) e o comprovante.
Comissão e entrega só acontecem após liquidação; nada é adiantado. CPF/CNPJ com problema pode ser bloqueado
(`pagador_bloqueado`): não troque o documento para o QR sair.

**Posso receber em outra moeda além de USDT?** O catálogo (`GET /cashin/catalog`) lista ativos e redes com
`entregavel: true` (USDT, USDC e outros, em várias redes). Leia na hora; muda.

**Posso ter vários clientes com saldo separado?** Sim: `customer_ref` cria subcontas no saldo;
`GET /saldo?customer_ref=`, `GET /saldo/clientes`, `POST /saldo/transferir` entre subcontas e a casa.

**Posso pagar fornecedores em Pix com esse saldo?** O Pix com saldo em reais (`POST /payouts`) está em
manutenção desde 21/11/2026 (`payout.via: "manutencao"`, 503 `em_manutencao`, nada debitado). Hoje: sacar
o saldo em cripto e pagar o Pix pela carteira USDT (`luniumpay-usdt-wallet`) ou pela venda de cripto
(`luniumpay-crypto-sale`). Quando voltar, `payout.enabled` volta a `true`.

**Como acompanho tudo?** Painel do parceiro; `monitor_url` em `/keys/me` (privado, nunca para clientes);
webhooks assinados; `GET /cashin/charges`, `GET /cashin/events`, `GET /saldo/extrato`,
`GET /webhooks/deliveries`. `POST /keys/painel-link` manda o link do painel ao e-mail da chave.

**Perdi a chave.** Não há recuperação por API. No painel, "Chaves de API": gere outra, troque no host e
revogue a antiga. Vazou? Revogue na hora e avise contato@luniumpay.com.

**Revendo a LuniumPay para meus clientes; ganho algo?** Sub fees por produto (`partner_fee_bps`,
`partner_cashout_fee_bps`, `partner_saque_fee_bps`, `partner_deposito_fee_bps`) em `PATCH /keys/me`; saldo e
saque em `GET /comissao` e `POST /comissao/sacar`. Indicações de outros parceiros: "Indique e ganhe" no painel.

**Tem comunidade/suporte?** Lunium Partners no Telegram (https://t.me/+FerOZMRRP_g5MDk5), suporte humano em
contato@luniumpay.com e https://wa.me/27722944340. Recomendado, não obrigatório.
