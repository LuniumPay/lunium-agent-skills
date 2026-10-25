# Para agentes de código

Este repositório contém as Agent Skills da LuniumPay (Pix ⇄ stablecoin no Brasil).
Comece por `luniumpay/SKILL.md`. A fonte de verdade da API é https://docs.luniumpay.com/openapi.json
e o contrato para máquina é https://docs.luniumpay.com/llms.txt. Nunca invente endpoint, taxa, rede,
QR ou endereço: use o que a API devolve. Scripts em `*/scripts/` só rodam com chave de sandbox (`lun_test_`).
