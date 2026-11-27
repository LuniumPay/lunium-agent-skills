#!/usr/bin/env node
// Guarda a chave de API que a pessoa gerou no painel da LuniumPay, sem que ela passe pelo chat.
//
// Desde 25/11/2026 a API não cria chave (POST /keys e /keys/sandbox respondem 403): a chave de teste
// (lun_test_) e a de produção (lun_live_) nascem no painel, com login. Este script:
//   1. pede a chave sem mostrar nada na tela (ou lê de um pipe);
//   2. confere o formato e a própria conta em GET /keys/me;
//   3. grava LUNIUM_API_KEY num .env com permissão 0600 e põe o arquivo no .gitignore.
// Nunca imprime a chave. Não cria operação e não move dinheiro.
//
// Uso:
//   node luniumpay/scripts/chave.mjs                 # pergunta a chave (nada aparece enquanto você cola)
//   node luniumpay/scripts/chave.mjs --env .env.local --substituir
//   pbpaste | node luniumpay/scripts/chave.mjs       # macOS: cola direto da área de transferência
//
//   --env ARQ      arquivo de destino. Padrão: .env.local (Next.js), .env (demais) para lun_test_;
//                  .env.lunium.production para lun_live_ (depois: go-live.mjs leva ao host).
//   --dir PASTA    pasta do projeto (padrão: a atual).
//   --substituir   troca uma LUNIUM_API_KEY que já exista no arquivo.
import { existsSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { FORMATO_CHAVE, PAINEL, UPGRADE, prefixo, lerEnv, gravarVar, lerSegredo, lerConta } from './_segredo.mjs';

const args = process.argv.slice(2);
const opt = (k) => { const i = args.indexOf(k); return i >= 0 && args[i + 1] && !args[i + 1].startsWith('--') ? args[i + 1] : null; };
const dir = resolve(opt('--dir') || '.');
const substituir = args.includes('--substituir');
const sair = (msg, codigo = 2) => { console.error(msg); process.exit(codigo); };

console.error(`LuniumPay · guardar a chave de API
A chave nasce no painel: ${PAINEL} → entre com Google → "Conta real e testes"
→ "Acessar testes" (ou fique na conta real) → menu "Integração por API" › "Chaves de API" → "Gerar chave deste projeto".
Ela aparece uma vez só. Cole aqui, não no chat.\n`);

let chave;
try { chave = await lerSegredo('Cole a chave lun_test_… ou lun_live_… (nada aparece na tela) e tecle Enter: '); }
catch (e) { sair(e.cancelado ? 'Cancelado. Nada foi gravado.' : `Não consegui ler a chave: ${e.message}`); }
chave = String(chave || '').replace(/^LUNIUM_API_KEY=/, '').trim();
if (!chave) sair('Nenhuma chave recebida. Nada foi gravado.');
if (!FORMATO_CHAVE.test(chave)) sair('Isso não parece uma chave LuniumPay (lun_test_ ou lun_live_ seguida de 48 caracteres hexadecimais). Nada foi gravado.');

const live = chave.startsWith('lun_live_');
const conta = await lerConta(chave);
if (!conta.ok && [401, 403].includes(conta.status) && !conta.body?.key)
  sair(`A API recusou esta chave (${conta.status} ${conta.body?.erro || ''}). Gere outra em "Chaves de API" no painel. Nada foi gravado.`, 1);
if (conta.status === 0) console.error(`⚠️  Sem conexão com a API para conferir (${conta.body?.detail || 'rede'}). Gravo mesmo assim; rode doctor.mjs depois.`);

const k = conta.body?.key || {};
if (conta.ok && Boolean(k.sandbox) === live) sair('O tipo da chave não confere com a conta lida na API. Nada foi gravado.', 1);

const next = existsSync(join(dir, 'package.json')) && /"next"\s*:/.test(readFileSync(join(dir, 'package.json'), 'utf8'));
const destino = resolve(dir, opt('--env') || (live ? '.env.lunium.production' : next ? '.env.local' : '.env'));
const existente = lerEnv(destino).LUNIUM_API_KEY;
if (existente && existente !== chave && !substituir)
  sair(`${destino} já tem uma LUNIUM_API_KEY (${prefixo(existente)}). Rode de novo com --substituir para trocar, ou escolha outro arquivo com --env.`);

gravarVar(destino, 'LUNIUM_API_KEY', chave, { dir });
console.log(`✅ chave ${live ? 'de PRODUÇÃO' : 'de TESTE (sandbox)'} ${prefixo(chave)} gravada em ${destino} (0600, no .gitignore). Não imprimo a chave.`);
if (conta.ok) {
  console.log(`   conta: ${k.name || '(sem nome)'} · cobranças Pix ${k.cashin_enabled ? 'liberadas' : 'ainda NÃO liberadas'}`);
  const vt = conta.body.verificacao_titular;
  if (live && vt?.exigida && !vt.api_producao_liberada)
    console.log(`   ⚠️  esta chave só opera depois do upgrade de conta (verificação de identidade do titular): ${vt.onde || UPGRADE}`);
}
console.log(live
  ? '\nPróximo: node luniumpay/scripts/go-live.mjs --webhook https://<seu-dominio>/<rota-do-webhook> [--vercel] (leva a chave e o segredo ao host).'
  : '\nPróximo: node luniumpay/scripts/doctor.mjs  →  node luniumpay-pix-charge/scripts/smoke.mjs cripto success');
