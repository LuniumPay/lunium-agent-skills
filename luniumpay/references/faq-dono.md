# Perguntas que o dono do app faz (respostas que o agente pode dar)

**Quanto custa?** As taxas são da conta e aparecem em `GET /keys/me` (`fee_bps`, taxa fixa por Pix em `nivel_conta.beneficios`) e em cada prévia (`POST /cashin/preview` → `fee_total_cents`, `net_cents`). Mostre a prévia; não cite números de memória.

**Preciso de carteira?** Não. Com `destino: "saldo"` o valor fica em reais na custódia e o saque em cripto é feito quando quiser (`POST /saldo/sacar-cripto`), para qualquer rede do catálogo, sem teto comercial por valor. Com carteira, use `destino: "cripto"` e receba a cada Pix.

**O cliente precisa de conta na LuniumPay?** Não. Ele paga um Pix normal no app do banco dele. O que a API pede é o CPF/CNPJ do pagador (`payer_tax_number`) para limites e proteção contra fraude.

**Por que a cobrança ficou retida?** Faixa de confiança do pagador: CPF que nunca pagou tem teto baixo e pode ter retenção em horas (`hold_hours`, `liberar_em`). Sobe com o histórico (`GET /cashin/limits?payer_tax=`). Não é falha e não exige novo Pix.

**Qual é o valor mínimo/máximo?** Mínimo vem da prévia (`min_brl_cents`) e da rota (`minBuyAmount` no catálogo). Máximo por pagador vem de `GET /cashin/limits` (`max_amount_cents`, `next_stage`). Payout Pix com saldo: até R$ 6.000,00 por Pix, sujeito a limites menores da conta.

**Em quanto tempo o USDT chega?** Depois do Pix pago, a entrega passa por `sending/entregando` até `sent`; `tempos_tipicos` no status dá a referência do momento. Não prometa prazo fixo nem use "instantâneo".

**E se o cliente contestar o Pix (MED)?** A LuniumPay aplica retenção e revisão automáticas por faixa de pagador justamente para isso. Ensine o app a guardar `e2e`, `payer_tax_number` (mascarado) e o comprovante. Comissão e entrega só acontecem após liquidação; nada é adiantado.

**Posso receber em outra moeda além de USDT?** O catálogo (`GET /cashin/catalog`) lista ativos e redes com `entregavel: true` (USDT, USDC e outros, em várias redes). Leia na hora; muda.

**Posso ter vários clientes com saldo separado?** Sim: `customer_ref` cria subcontas no saldo; `GET /saldo?customer_ref=`, `GET /saldo/clientes`, `POST /saldo/transferir` entre subcontas e a casa.

**Posso pagar fornecedores em Pix com esse saldo?** Sim: `POST /payouts` debita o saldo em reais e envia o Pix (CPF/CNPJ do recebedor obrigatório; chave de e-mail/telefone exige `tax_number`).

**Como acompanho tudo?** `monitor_url` em `/keys/me` (privado, nunca para clientes), webhooks assinados, `GET /cashin/charges`, `GET /cashin/events`, `GET /saldo/extrato`. Painel do parceiro: `POST /keys/painel-link` manda o link ao e-mail da chave.

**Perdi a chave.** Não há recuperação da chave antiga por API. `POST /keys/painel-link` recupera o acesso ao monitor; para nova chave, `POST /keys` de novo e troque no `.env`.

**Tem comunidade/suporte?** Lunium Partners no Telegram (https://t.me/+FerOZMRRP_g5MDk5), suporte humano em contato@luniumpay.com e https://wa.me/27722944340. Recomendado, não obrigatório.
