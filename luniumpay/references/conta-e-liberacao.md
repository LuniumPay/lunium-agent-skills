# Conta, chave e liberação — do teste à produção

Painel do parceiro: https://parceiros.luniumpay.com (entrar com Google). Tudo o que libera a conta
acontece lá, com login. A API só informa o estado e recusa com o motivo.

## A escada

| Degrau | Onde | Como o agente confere |
|---|---|---|
| 1. Conta criada | painel → "Criar conta com Google"; aceite do termo ao configurar o negócio | a pessoa consegue entrar |
| 2. Chave de teste | "Conta real e testes" → "Acessar testes" → "Integração por API" › "Chaves de API" → "Gerar chave deste projeto" | `chave.mjs` grava; `doctor.mjs` mostra `SANDBOX` |
| 3. Integração provada | código do app + smoke no sandbox | `smoke.mjs` termina em `LIBERADO` |
| 4. Upgrade de conta | conta real → menu "Upgrade de conta" (documento, prova de vida e selfie do titular) | `GET /keys/me` → `verificacao_titular.api_producao_liberada: true` |
| 5. Cobranças Pix liberadas | "Criar cobrança" › "Solicitar liberação" (na conta nova o upgrade abre o pedido) | `GET /keys/me` → `key.cashin_enabled: true` |
| 6. Chave de produção | conta real → "Chaves de API" → "Gerar chave deste projeto" | `chave.mjs` ou `go-live.mjs` aceitam `lun_live_` |
| 7. Go-live | deploy + `go-live.mjs --webhook …` | `POST /webhooks/test` 2xx; `doctor.mjs` sem faltas |

A chave de produção pode ser gerada antes do degrau 4, mas só opera depois dele (contas sujeitas à
verificação). Só Dono ou Financeiro do projeto gera e gerencia chaves. A chave aparece uma vez: perdeu,
gere outra no mesmo menu e revogue a antiga lá.

## Recusas e a resposta certa

| HTTP · `erro` | Quando | Diga ao dono | Não faça |
|---|---|---|---|
| 403 `sandbox_somente_no_painel` | `POST /keys/sandbox`, `POST /mesh/agents`, MCP `lunium_create_sandbox_key` / `lunium_start_sandbox_demo` | "A chave de teste nasce no painel: entre com Google e gere em Chaves de API." | repetir, trocar de rede, usar outra ferramenta de criação |
| 403 `producao_somente_no_painel` | `POST /keys` | "A chave de produção nasce no painel, depois do upgrade de conta." | idem |
| 403 `verificacao_titular_pendente` (`acao: parar`) | escrita com `lun_live_` de conta nova sem verificação aprovada | "Falta o upgrade de conta (verificação de identidade do titular): {`painel` da resposta}." | repetir em laço; trocar para outra chave de produção |
| 403 `recebimento_sem_autorizacao` | `POST /cashin/charge`, `POST /cashin/preview`, `GET /cashin/limits` sem liberação | conforme `liberacao.status`: `nao_solicitado` → "peça em Criar cobrança › Solicitar liberação"; `pendente` → "pedido em análise desde {`solicitado_em`}"; `recusado` → "fale com o suporte" | pedir de novo em laço; prometer prazo |
| 503 `em_manutencao` (`acao: esperar`) | `POST /payouts` (Pix com saldo em reais) | "O Pix com saldo em reais está em manutenção. Dá para sacar em cripto ou pagar o Pix pela carteira USDT." | repetir a criação; o replay idempotente só devolve a operação original |
| 403 `pagador_bloqueado` (`acao: parar`) | CPF/CNPJ do pagador bloqueado nesta conta ou na Lunium | "Este CPF/CNPJ não pode pagar por aqui. O desbloqueio é pedido ao suporte por e-mail." | trocar o documento para fazer o QR sair |
| 400 `email_nao_aceito` | criar conta/usuário novo com e-mail de privacidade, apelido ou temporário | "Use um e-mail comum (o mesmo do Google funciona)." | contas que já existem não são afetadas |

Leituras (`GET`) e a gestão da própria chave (`/keys/*`: dados, webhook, link do painel) continuam
funcionando durante as recusas acima, para o integrador ver o motivo e configurar o resto.

## O que nunca dizer

- Que a verificação do titular é opcional ou tem atalho, ou que a liberação é garantida ou tem prazo.
- O nome de qualquer fornecedor por trás da LuniumPay (verificação de identidade, liquidação, corretora).
- Que dá para "pular" a fila criando outra conta: uma pessoa, uma conta; a segunda é bloqueada.
