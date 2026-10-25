#!/usr/bin/env node
// Go-live LuniumPay: chave de PRODUÇÃO em uma chamada, webhook cadastrado, segredos no host, entrega de teste provada.
// Nunca imprime chave nem segredo. Não cria cobrança nem move dinheiro.
//
// Uso:
//   node luniumpay/scripts/go-live.mjs --name "Minha Empresa" --email voce@empresa.com \
//        --webhook https://seu-dominio.com/api/webhooks/lunium  [--settlement 0x...] [--vercel | --env .env.lunium.production] [--dry]
//
//   --webhook     URL https pública do endpoint da receita (Next: /api/webhooks/lunium · Express/FastAPI: /webhooks/lunium · Supabase: functions/v1/lunium-webhook)
//   --settlement  carteira Polygon padrão da chave (destino cripto). Sem ela, use LUNIUM_DESTINO=saldo ou payout_address por cobrança.
//   --destino     saldo | cripto: grava LUNIUM_DESTINO junto com os segredos (saldo = sem carteira).
//   --vercel      grava LUNIUM_API_KEY e LUNIUM_WEBHOOK_SECRET no projeto Vercel (ambiente production) via `vercel env add`.
//   --deploy      (com --vercel) roda `vercel --prod --yes` depois de gravar as variáveis, para o teste de webhook bater no código novo.
//   --env ARQ     grava num arquivo 0600 (padrão quando não há --vercel): .env.lunium.production, já no .gitignore.
//   --dry         mostra o plano, não cria nada.
//   LUNIUM_API_KEY=lun_live_... no ambiente → reutiliza a chave (não cria outra); só cadastra webhook e prova.
import { readFileSync, writeFileSync, existsSync, chmodSync } from 'node:fs';
import { spawnSync } from 'node:child_process';

const BASE = 'https://api.luniumpay.com';
const args = process.argv.slice(2);
const opt = (k, d = null) => { const i = args.indexOf(k); return i >= 0 ? (args[i + 1] ?? true) : d; };
const flag = (k) => args.includes(k);
const name = opt('--name'), email = opt('--email'), webhook = opt('--webhook'), settlement = opt('--settlement'), destinoOpt = opt('--destino');
if (destinoOpt && !['saldo', 'cripto'].includes(destinoOpt)) die('--destino aceita saldo ou cripto.');
const useVercel = flag('--vercel'), dry = flag('--dry'), deploy = flag('--deploy');
const envFile = opt('--env', '.env.lunium.production');
let key = process.env.LUNIUM_API_KEY && process.env.LUNIUM_API_KEY.startsWith('lun_live_') ? process.env.LUNIUM_API_KEY : null;
const log = (m) => console.log(m);
const die = (m, c = 2) => { console.error(m); process.exit(c); };
const sleep = (ms) => new Promise(r => setTimeout(r, ms));

async function call(path, init = {}) {
  const r = await fetch(BASE + path, { ...init, headers: { 'Content-Type': 'application/json', ...(key ? { 'X-API-Key': key } : {}) } });
  const b = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(`${init.method || 'GET'} ${path} → ${r.status} ${b.erro || ''}: ${b.detail || ''} | ${b.agent_guidance || ''}`);
  return b;
}
if (webhook && !/^https:\/\/[^/]+\/.+/.test(webhook)) die('--webhook precisa ser https público com caminho (ex.: https://app.com/api/webhooks/lunium).');
if (!key && !name) die('Informe --name "<negócio>" (e --email) para criar a chave de produção, ou exporte LUNIUM_API_KEY=lun_live_... para reutilizar.');
if (!key && !email) log('⚠️  sem --email a chave não chega por e-mail e a conta fica sem recuperação. Recomendado informar.');

log(`LuniumPay go-live${dry ? ' · DRY RUN' : ''}`);
log(`• chave: ${key ? 'reutilizar lun_live_ do ambiente' : `criar com POST /keys (${name}${email ? ', ' + email : ''})`}`);
log(`• webhook: ${webhook || 'não cadastrar agora (faça depois com PATCH /keys/me)'}`);
log(`• segredos → ${useVercel ? 'Vercel (production)' : envFile + ' (0600)'}${deploy ? ' · depois `vercel --prod`' : ''}`);
if (deploy && !useVercel) die('--deploy só com --vercel.');
if (dry) process.exit(0);

const secrets = {};
if (destinoOpt) secrets.LUNIUM_DESTINO = destinoOpt;
if (!key) {
  const body = { name, ...(email ? { email } : {}), ...(webhook ? { webhook_url: webhook } : {}), ...(settlement ? { settlement_address: settlement } : {}) };
  const k = await call('/keys', { method: 'POST', body: JSON.stringify(body) });
  key = k.api_key; secrets.LUNIUM_API_KEY = key;
  if (k.webhook_secret) secrets.LUNIUM_WEBHOOK_SECRET = k.webhook_secret;
  log(`✅ chave de PRODUÇÃO criada (prefixo ${key.slice(0, 13)}…)${k.email_sent ? ' · enviada por e-mail' : ''} · não impressa`);
} else if (webhook || settlement) {
  const p = await call('/keys/me', { method: 'PATCH', body: JSON.stringify({ ...(webhook ? { webhook_url: webhook } : {}), ...(settlement ? { settlement_address: settlement } : {}) }) });
  if (p.webhook_secret) secrets.LUNIUM_WEBHOOK_SECRET = p.webhook_secret;
  else if (webhook && !process.env.LUNIUM_WEBHOOK_SECRET) {
    const r = await call('/keys/me', { method: 'PATCH', body: JSON.stringify({ rotate_webhook_secret: true }) });
    if (r.webhook_secret) { secrets.LUNIUM_WEBHOOK_SECRET = r.webhook_secret; log('🔁 webhook_secret girado (a chave já tinha um e você não o tinha no ambiente)'); }
  }
  log('✅ chave existente atualizada (PATCH /keys/me)');
}

const me = await call('/keys/me'); const k = me.key || {};
log(`✅ conta ${k.name || ''} · nível ${me.nivel_conta?.rotulo || '-'} · cash-in ${k.cashin_enabled ? 'ok' : 'DESABILITADO'} · payout ${k.payout_enabled ? 'ok' : 'off'} · cash-out ${k.cashout_enabled ? 'ok' : 'off'}`);
log(`${k.webhook_configured ? '✅' : '⚠️ '} webhook ${k.webhook_configured ? 'configurado' : 'NÃO configurado'}${k.settlement_address ? ' · carteira padrão definida' : ' · sem carteira padrão (use LUNIUM_DESTINO=saldo ou payout_address por cobrança)'}`);

// persistir segredos
if (Object.keys(secrets).length) {
  if (useVercel) {
    const vercel = process.env.VERCEL_BIN || 'vercel';
    for (const [n, v] of Object.entries(secrets)) {
      const r = spawnSync(vercel, ['env', 'add', n, 'production', '--force'], { input: v, encoding: 'utf8' });
      if (r.status !== 0) die(`vercel env add ${n} falhou: ${(r.stderr || r.stdout || '').trim().slice(0, 300)}\nGrave manualmente no painel da Vercel (Settings → Environment Variables → Production).`);
      log(`🔐 ${n} gravada na Vercel (production). Faça um novo deploy para valer.`);
    }
  } else {
    let cur = existsSync(envFile) ? readFileSync(envFile, 'utf8') : '';
    for (const [n, v] of Object.entries(secrets)) { cur = cur.replace(new RegExp(`^${n}=.*\\n?`, 'm'), ''); cur += `${n}=${v}\n`; }
    writeFileSync(envFile, cur); chmodSync(envFile, 0o600);
    const gi = existsSync('.gitignore') ? readFileSync('.gitignore', 'utf8') : '';
    if (!gi.split('\n').includes(envFile)) writeFileSync('.gitignore', gi.replace(/\n?$/, '\n') + envFile + '\n');
    log(`🔐 ${Object.keys(secrets).join(', ')} gravados em ${envFile} (0600, no .gitignore). Copie para o host de produção; nunca para o repositório ou o chat.`);
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

// provar a entrega do webhook
if (k.webhook_configured) {
  if (!secrets.LUNIUM_WEBHOOK_SECRET && !process.env.LUNIUM_WEBHOOK_SECRET) log('⚠️  seu endpoint só valida a assinatura se LUNIUM_WEBHOOK_SECRET estiver no host.');
  if (deploy) await sleep(5000);
  const t = await call('/webhooks/test', { method: 'POST', body: '{}' });   // síncrono: devolve o que o SEU endpoint respondeu
  const okResp = t.ok === true || (t.status_code >= 200 && t.status_code < 300);
  log(`${okResp ? '✅' : '❌'} POST /webhooks/test → seu endpoint ${t.url || ''} respondeu HTTP ${t.status_code ?? '?'} em ${t.ms ?? '?'} ms (event_id ${t.event_id || '-'})`);
  if (!okResp) log('   401 = assinatura recusada (LUNIUM_WEBHOOK_SECRET errado ou corpo não cru) · 404 = rota errada · 5xx = erro no seu código. Corrija e rode de novo (máx. 6 testes/min).');
  else log('   assinatura validada pelo seu código em produção. Falhas futuras: GET /webhooks/deliveries?status=failed.');
}

log('\nPróximo: luniumpay/references/checklist-producao.md → primeira cobrança real pequena (ex. R$ 5,00) paga por você e acompanhada até `sent`.');
log('Acompanhe: GET /webhooks/deliveries · GET /cashin/charges · GET /saldo/extrato · painel por POST /keys/painel-link (link no e-mail da chave). monitor_url está em GET /keys/me: privado.');
