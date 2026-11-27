#!/usr/bin/env node
// Go-live LuniumPay: confere a chave de PRODUÇÃO gerada no painel, cadastra o webhook, leva os segredos ao host
// e prova a entrega. Nunca imprime chave nem segredo. Não cria cobrança e não move dinheiro.
//
// A chave lun_live_ NÃO nasce aqui: desde 25/11/2026 POST /keys responde 403 producao_somente_no_painel.
// Caminho: painel (https://parceiros.luniumpay.com, entre com Google) → "Upgrade de conta" (verificação de identidade
// do titular) → "Integração por API" › "Chaves de API" → "Gerar chave deste projeto" na conta real.
//
// Uso:
//   node luniumpay/scripts/go-live.mjs --webhook https://seu-dominio.com/api/webhooks/lunium [--vercel [--deploy] | --env .env.lunium.production]
//        [--settlement 0x...] [--destino saldo|cripto] [--dry]
//
//   chave         LUNIUM_API_KEY=lun_live_… no ambiente, ou no arquivo de --env (chave.mjs grava lá), ou colada aqui
//                 sem eco quando nenhuma das duas existir.
//   --webhook     URL https pública do endpoint da receita (Next: /api/webhooks/lunium · Express/FastAPI: /webhooks/lunium
//                 · Supabase: /functions/v1/lunium-webhook).
//   --settlement  carteira padrão da chave (destino cripto). Sem ela: LUNIUM_DESTINO=saldo ou payout_address por cobrança.
//   --destino     saldo | cripto: grava LUNIUM_DESTINO junto com os segredos.
//   --vercel      grava LUNIUM_API_KEY e LUNIUM_WEBHOOK_SECRET no projeto Vercel (production) via `vercel env add`.
//   --deploy      (com --vercel) roda `vercel --prod --yes` depois, para o teste de webhook bater no código novo.
//   --env ARQ     arquivo 0600 (padrão sem --vercel): .env.lunium.production, já no .gitignore.
//   --dry         mostra o plano e a prontidão da conta; não grava nada.
import { spawnSync } from 'node:child_process';
import { resolve } from 'node:path';
import { FORMATO_CHAVE, PAINEL, UPGRADE, prefixo, lerEnv, gravarVar, lerSegredo } from './_segredo.mjs';

const BASE = 'https://api.luniumpay.com';
const args = process.argv.slice(2);
const opt = (k, d = null) => { const i = args.indexOf(k); return i >= 0 && args[i + 1] && !args[i + 1].startsWith('--') ? args[i + 1] : d; };
const flag = (k) => args.includes(k);
const log = (m) => console.log(m);
const die = (m, c = 2) => { console.error(m); process.exit(c); };
const sleep = (ms) => new Promise(r => setTimeout(r, ms));

const webhook = opt('--webhook'), settlement = opt('--settlement'), destinoOpt = opt('--destino');
const useVercel = flag('--vercel'), dry = flag('--dry'), deploy = flag('--deploy');
const envFile = resolve(opt('--env', '.env.lunium.production'));
if (flag('--name') || flag('--email'))
  log('ℹ️  --name/--email não são mais usados: a chave de produção é gerada no painel, com login (POST /keys responde 403).');
if (destinoOpt && !['saldo', 'cripto'].includes(destinoOpt)) die('--destino aceita saldo ou cripto.');
if (deploy && !useVercel) die('--deploy só com --vercel.');
if (webhook && !/^https:\/\/[^/]+\/.+/.test(webhook)) die('--webhook precisa ser https público com caminho (ex.: https://app.com/api/webhooks/lunium).');

// 1. a chave de produção: ambiente → arquivo → colada sem eco
let key = (process.env.LUNIUM_API_KEY || '').trim(), origem = 'variável de ambiente';
if (key.startsWith('lun_test_')) console.error('ℹ️  LUNIUM_API_KEY do ambiente é de TESTE: go-live procura a lun_live_ da conta real.');
if (!key.startsWith('lun_live_')) { key = (lerEnv(envFile).LUNIUM_API_KEY || '').trim(); origem = envFile; }
let chaveNova = false;
if (!key.startsWith('lun_live_')) {
  if (dry) die(`Sem lun_live_ no ambiente nem em ${envFile}. Gere a chave no painel (${PAINEL}) e rode node luniumpay/scripts/chave.mjs.`);
  console.error(`A chave de produção nasce no painel: ${PAINEL} → conta real → "Integração por API" › "Chaves de API".`);
  try { key = await lerSegredo('Cole a chave lun_live_… (nada aparece na tela) e tecle Enter: '); }
  catch (e) { die(e.cancelado ? 'Cancelado. Nada foi gravado.' : `Não consegui ler a chave: ${e.message}`); }
  key = String(key).replace(/^LUNIUM_API_KEY=/, '').trim(); origem = 'colada agora'; chaveNova = true;
}
if (!FORMATO_CHAVE.test(key) || !key.startsWith('lun_live_'))
  die('go-live só roda com chave de PRODUÇÃO (lun_live_ + 48 hex). Para testar use a chave de teste com doctor.mjs e os smoke.');

async function call(path, init = {}) {
  const r = await fetch(BASE + path, { ...init, headers: { 'Content-Type': 'application/json', 'X-API-Key': key } });
  const b = await r.json().catch(() => ({}));
  if (!r.ok) throw Object.assign(new Error(`${init.method || 'GET'} ${path} → ${r.status} ${b.erro || ''}: ${b.detail || ''}${b.agent_guidance ? ' | ' + b.agent_guidance : ''}`), { status: r.status, body: b });
  return b;
}

log(`LuniumPay go-live${dry ? ' · DRY RUN' : ''}`);
log(`• chave: ${prefixo(key)} (${origem})`);
log(`• webhook: ${webhook || 'não cadastrar agora (faça depois com PATCH /keys/me)'}`);
log(`• segredos → ${useVercel ? 'Vercel (production)' : envFile + ' (0600)'}${deploy ? ' · depois `vercel --prod`' : ''}`);

// 2. prontidão da conta (leitura; funciona mesmo antes do upgrade de conta)
let me;
try { me = await call('/keys/me'); } catch (e) { die(`A API recusou a chave: ${e.message}`, 1); }
const k = me.key || {};
if (k.sandbox) die('Esta chave é de TESTE na API. Use a lun_live_ da conta real.', 1);
const vt = me.verificacao_titular || null;
const kycPendente = Boolean(vt?.exigida && !vt.api_producao_liberada);
log(`${kycPendente ? '⛔' : '✅'} verificação de identidade do titular: ${!vt || !vt.exigida ? 'não exigida para esta conta' : vt.api_producao_liberada ? 'aprovada (a chave opera)' : `pendente (${vt.situacao || 'não iniciada'}) → faça o upgrade de conta: ${vt.onde || UPGRADE}`}`);
log(`${k.cashin_enabled ? '✅' : '⚠️ '} cobranças Pix ${k.cashin_enabled ? 'liberadas' : 'ainda NÃO liberadas: peça no painel (Criar cobrança › Solicitar liberação). Sem isso POST /cashin/charge responde 403 recebimento_sem_autorizacao.'}`);
log(`${me.payout?.enabled ? '✅' : 'ℹ️ '} Pix com saldo em reais (POST /payouts): ${me.payout?.enabled ? 'ativo' : me.payout?.via === 'manutencao' ? 'em manutenção (503 em_manutencao); saque em cripto e carteira USDT seguem' : 'desligado nesta conta'}`);
log(`   venda de cripto por Pix: ${k.cashout_enabled ? 'ativa' : 'desligada'} · conta ${k.name || ''} · nível ${me.nivel_conta?.rotulo || '-'}`);
if (dry) process.exit(0);

// 3. webhook e carteira padrão (gestão da própria chave: liberada mesmo com a verificação pendente)
const secrets = {};
// a chave vai ao destino quando ele ainda não a tem (Vercel: sempre; arquivo: só se for outra ou faltar)
if (useVercel || chaveNova || lerEnv(envFile).LUNIUM_API_KEY !== key) secrets.LUNIUM_API_KEY = key;
if (destinoOpt) secrets.LUNIUM_DESTINO = destinoOpt;
if (webhook || settlement) {
  const p = await call('/keys/me', { method: 'PATCH', body: JSON.stringify({ ...(webhook ? { webhook_url: webhook } : {}), ...(settlement ? { settlement_address: settlement } : {}) }) });
  if (p.webhook_secret) secrets.LUNIUM_WEBHOOK_SECRET = p.webhook_secret;
  else if (webhook && !process.env.LUNIUM_WEBHOOK_SECRET && !lerEnv(envFile).LUNIUM_WEBHOOK_SECRET) {
    const r = await call('/keys/me', { method: 'PATCH', body: JSON.stringify({ rotate_webhook_secret: true }) });
    if (r.webhook_secret) { secrets.LUNIUM_WEBHOOK_SECRET = r.webhook_secret; log('🔁 webhook_secret girado (a chave já tinha um e você não o tinha guardado)'); }
  }
  log('✅ chave atualizada (PATCH /keys/me)');
}
const me2 = await call('/keys/me'); const k2 = me2.key || {};
log(`${k2.webhook_configured ? '✅' : '⚠️ '} webhook ${k2.webhook_configured ? 'configurado' : 'NÃO configurado'}${k2.settlement_address ? ' · carteira padrão definida' : ' · sem carteira padrão (use LUNIUM_DESTINO=saldo ou payout_address por cobrança)'}`);

// 4. segredos no host
if (Object.keys(secrets).length) {
  if (useVercel) {
    const vercel = process.env.VERCEL_BIN || 'vercel';
    for (const [n, v] of Object.entries(secrets)) {
      const r = spawnSync(vercel, ['env', 'add', n, 'production', '--force'], { input: v, encoding: 'utf8' });
      if (r.status !== 0) die(`vercel env add ${n} falhou: ${(r.stderr || r.stdout || '').trim().slice(0, 300)}\nGrave manualmente no painel da Vercel (Settings → Environment Variables → Production).`);
      log(`🔐 ${n} gravada na Vercel (production). Faça um novo deploy para valer.`);
    }
  } else {
    for (const [n, v] of Object.entries(secrets)) gravarVar(envFile, n, v);
    log(`🔐 ${Object.keys(secrets).join(', ')} gravados em ${envFile} (0600, no .gitignore). Leve ao host de produção; nunca ao repositório ou ao chat.`);
  }
} else log('ℹ️  nenhum segredo novo para gravar.');

if (deploy) {
  const vercel = process.env.VERCEL_BIN || 'vercel';
  log('🚀 vercel --prod --yes …');
  const r = spawnSync(vercel, ['--prod', '--yes'], { encoding: 'utf8' });
  if (r.status !== 0) die(`deploy falhou: ${(r.stderr || r.stdout || '').trim().slice(0, 400)}`);
  const url = ((r.stdout || '') + (r.stderr || '')).match(/https:\/\/[^\s"]+\.vercel\.app/g)?.pop();
  log(`✅ deploy de produção publicado${url ? ': ' + url : ''}`);
}

// 5. provar a entrega do webhook (operação da chave: exige a verificação do titular quando ela é exigida)
if (k2.webhook_configured) {
  if (kycPendente) log(`⏸  teste de entrega adiado: com a verificação do titular pendente, POST /webhooks/test responde 403 verificacao_titular_pendente. Depois do upgrade de conta, rode go-live de novo.`);
  else {
    if (!secrets.LUNIUM_WEBHOOK_SECRET && !process.env.LUNIUM_WEBHOOK_SECRET && !lerEnv(envFile).LUNIUM_WEBHOOK_SECRET) log('⚠️  seu endpoint só valida a assinatura se LUNIUM_WEBHOOK_SECRET estiver no host.');
    if (deploy) await sleep(5000);
    try {
      const t = await call('/webhooks/test', { method: 'POST', body: '{}' });   // síncrono: devolve o que o SEU endpoint respondeu
      const okResp = t.ok === true || (t.status_code >= 200 && t.status_code < 300);
      log(`${okResp ? '✅' : '❌'} POST /webhooks/test → seu endpoint ${t.url || ''} respondeu HTTP ${t.status_code ?? '?'} em ${t.ms ?? '?'} ms (event_id ${t.event_id || '-'})`);
      if (!okResp) log('   401 = assinatura recusada (LUNIUM_WEBHOOK_SECRET errado ou corpo não cru) · 404 = rota errada · 5xx = erro no seu código. Corrija e rode de novo (máx. 6 testes/min).');
      else log('   assinatura validada pelo seu código em produção. Falhas futuras: GET /webhooks/deliveries?status=failed.');
    } catch (e) { log(`❌ teste de entrega não rodou: ${e.message}`); }
  }
}

const faltas = [kycPendente && 'upgrade de conta', !k2.cashin_enabled && 'liberação das cobranças Pix', !k2.webhook_configured && 'webhook'].filter(Boolean);
log(faltas.length
  ? `\nFalta para cobrar em produção: ${faltas.join(', ')}. Painel: ${PAINEL}.`
  : '\nPronto. Próximo: luniumpay/references/checklist-producao.md → primeira cobrança real pequena (ex. R$ 5,00) paga por você e acompanhada até `sent`.');
log('Acompanhe: GET /webhooks/deliveries · GET /cashin/charges · GET /saldo/extrato · painel. monitor_url (GET /keys/me) é privado.');
