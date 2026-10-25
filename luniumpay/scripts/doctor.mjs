#!/usr/bin/env node
// Diagnóstico da chave LuniumPay: o que está pronto e o que falta para operar.
// Uso: LUNIUM_API_KEY=... node doctor.mjs      (funciona com lun_test_ e lun_live_; só LÊ, nunca cria operação)
const BASE = 'https://api.luniumpay.com';
const key = process.env.LUNIUM_API_KEY;
if (!key) { console.error('Defina LUNIUM_API_KEY. Sem chave? POST /keys/sandbox com {"email": "..."} cria uma de teste.'); process.exit(2); }
const live = key.startsWith('lun_live_');
const get = async (p) => { const r = await fetch(BASE + p, { headers: { 'X-API-Key': key } }); return { ok: r.ok, status: r.status, body: await r.json().catch(() => ({})) }; };
const ok = (c, msg) => console.log(`${c ? '✅' : '⚠️ '} ${msg}`);

console.log(`LuniumPay doctor · chave ${live ? 'PRODUÇÃO (lun_live_)' : key.startsWith('lun_test_') ? 'SANDBOX (lun_test_)' : 'formato desconhecido'}\n`);
const ping = await fetch(BASE + '/ping').then(r => r.ok).catch(() => false); ok(ping, 'API alcançável (/ping)');
const me = await get('/keys/me');
if (!me.ok) { console.log(`❌ /keys/me ${me.status}: ${me.body.erro || ''} ${me.body.detail || ''}\n   ${me.body.agent_guidance || ''}`); process.exit(1); }
const k = me.body.key || {};
ok(true, `conta: ${k.name || '(sem nome)'} · prefixo ${k.prefix} · nível ${me.body.nivel_conta?.rotulo || '-'}`);
ok(k.cashin_enabled, `cash-in (receber Pix) ${k.cashin_enabled ? 'habilitado' : 'DESABILITADO'}`);
ok(k.payout_enabled, `payout (Pix com saldo) ${k.payout_enabled ? 'habilitado' : 'desabilitado'}`);
ok(k.cashout_enabled, `cash-out (cripto → Pix) ${k.cashout_enabled ? 'habilitado' : 'desabilitado'}`);
ok(!!k.email, k.email ? `e-mail cadastrado (${k.email.replace(/(.).+(@.+)/, '$1***$2')})` : 'sem e-mail: cadastre com PATCH /keys/me para avisos e recuperação');
ok(k.webhook_configured, k.webhook_configured ? 'webhook configurado' : 'webhook NÃO configurado: PATCH /keys/me {"webhook_url": "https://…"} e guarde o webhook_secret');
ok(!!k.settlement_address, k.settlement_address ? `carteira padrão da chave definida (${k.chain})` : 'sem carteira padrão: informe payout_address em cada cobrança, ou use destino "saldo"');
const b = me.body.nivel_conta?.beneficios || {};
console.log(`   taxa: ${k.fee_bps} bps + ${b.taxa_fixa_pix_cents ?? '-'} centavos/Pix · documento do pagador: ${b.documento_pagador || '-'} · escada por pagador: ${b.escada_por_pagador ?? '-'}`);
const cat = await get('/cashin/catalog');
if (cat.ok) {
  const rotas = [...(cat.body.instant || []), ...(cat.body.convert || [])].filter(r => r.entregavel);
  const usdt = rotas.filter(r => /^usd[tc]$/i.test(r.asset)).map(r => `${r.asset}/${r.network}`);
  ok(rotas.length > 0, `${rotas.length} rotas entregáveis agora · stablecoins: ${usdt.join(', ') || 'nenhuma'}${cat.body.stale ? ' · ⚠️ catálogo marcado stale' : ''}`);
} else ok(false, `catálogo indisponível (${cat.status})`);
const saldo = await get('/saldo');
if (saldo.ok) ok(true, `saldo casa: disponível ${saldo.body.disponivel_cents} c · bloqueado ${saldo.body.bloqueado_cents} c · carência ${saldo.body.carencia_horas ?? '-'} h`);
const wh = await get('/webhooks/deliveries?limit=5');
if (wh.ok) ok((wh.body.failed_count || 0) === 0, `webhooks: ${wh.body.deliveries?.length || 0} entregas recentes · ${wh.body.failed_count || 0} falhas`);
if (me.body.monitor_url) console.log('🔒 monitor_url presente em /keys/me: privado, nunca exponha a clientes.');
console.log(`\n${live ? 'Produção: siga luniumpay/references/checklist-producao.md antes da primeira cobrança real.' : 'Sandbox: dinheiro fictício. Prove com luniumpay-pix-charge/scripts/smoke.mjs; depois POST /keys para a chave de produção.'}`);
