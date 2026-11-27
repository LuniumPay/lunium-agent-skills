#!/usr/bin/env node
// Diagnóstico da chave LuniumPay: o que está pronto e o que falta para operar.
// Uso: node luniumpay/scripts/doctor.mjs     (lê LUNIUM_API_KEY do ambiente ou de .env.local/.env/.env.lunium.production)
// Funciona com lun_test_ e lun_live_. Só LÊ: nunca cria operação, nunca imprime a chave.
import { PAINEL, UPGRADE, prefixo, chaveDoAmbiente } from './_segredo.mjs';

const BASE = 'https://api.luniumpay.com';
const { chave: key, origem } = chaveDoAmbiente();
if (!key) {
  console.error(`Sem LUNIUM_API_KEY. A API não cria chave (POST /keys e /keys/sandbox respondem 403).
1. Entre em ${PAINEL} com Google → "Conta real e testes" → "Acessar testes".
2. Menu "Integração por API" › "Chaves de API" → "Gerar chave deste projeto".
3. Guarde sem passar pelo chat: node luniumpay/scripts/chave.mjs`);
  process.exit(2);
}
const live = key.startsWith('lun_live_');
const get = async (p) => {
  try { const r = await fetch(BASE + p, { headers: { 'X-API-Key': key } }); return { ok: r.ok, status: r.status, body: await r.json().catch(() => ({})) }; }
  catch (e) { return { ok: false, status: 0, body: { erro: 'sem_rede', detail: e.message } }; }
};
const ok = (c, msg) => console.log(`${c ? '✅' : '⚠️ '} ${msg}`);
const faltas = [];

console.log(`LuniumPay doctor · chave ${prefixo(key)} (${origem}) · ${live ? 'PRODUÇÃO' : key.startsWith('lun_test_') ? 'SANDBOX' : 'formato desconhecido'}\n`);
const ping = await fetch(BASE + '/ping').then(r => r.ok).catch(() => false); ok(ping, 'API alcançável (/ping)');
const me = await get('/keys/me');
if (!me.ok) { console.log(`❌ /keys/me ${me.status}: ${me.body.erro || ''} ${me.body.detail || ''}\n   ${me.body.agent_guidance || ''}`); process.exit(1); }
const k = me.body.key || {};
if (Boolean(k.sandbox) === live) ok(false, 'o prefixo da chave não confere com o ambiente da conta: gere outra no painel');
ok(true, `conta: ${k.name || '(sem nome)'} · prefixo ${k.prefix} · nível ${me.body.nivel_conta?.rotulo || '-'}`);

// Prontidão de produção (contas novas): verificação do titular e liberação das cobranças
const vt = me.body.verificacao_titular;
if (live && vt) {
  const pend = vt.exigida && !vt.api_producao_liberada;
  ok(!pend, !vt.exigida ? 'verificação de identidade do titular: não exigida para esta conta'
    : vt.api_producao_liberada ? 'verificação de identidade do titular aprovada: a chave de produção opera'
    : `verificação de identidade do titular PENDENTE (${vt.situacao || 'não iniciada'}): toda escrita responde 403 verificacao_titular_pendente. Upgrade de conta: ${vt.onde || UPGRADE}`);
  if (pend) faltas.push('upgrade de conta (verificação do titular)');
}
ok(k.cashin_enabled, `cobranças Pix (receber) ${k.cashin_enabled ? 'liberadas' : 'NÃO liberadas: POST /cashin/charge responde 403 recebimento_sem_autorizacao; peça no painel (Criar cobrança › Solicitar liberação)'}`);
if (!k.cashin_enabled) faltas.push('liberação das cobranças Pix');
const po = me.body.payout || {};
ok(po.enabled, `Pix com saldo em reais (POST /payouts) ${po.enabled ? 'ativo' : po.via === 'manutencao' ? 'EM MANUTENÇÃO: 503 em_manutencao (use saque em cripto, carteira USDT ou venda de cripto)' : 'desligado nesta conta'}`);
ok(k.cashout_enabled, `venda de cripto por Pix (cash-out) ${k.cashout_enabled ? 'ativa' : 'desligada'}`);
if (me.body.conta_nova) console.log(`ℹ️  conta nova: ${me.body.conta_nova.explicacao || me.body.conta_nova.mensagem || JSON.stringify(me.body.conta_nova).slice(0, 200)}`);
ok(!!k.email, k.email ? `e-mail cadastrado (${k.email.replace(/(.).+(@.+)/, '$1***$2')})` : 'sem e-mail na chave: cadastre com PATCH /keys/me para avisos e recuperação');
ok(k.webhook_configured, k.webhook_configured ? 'webhook configurado' : 'webhook NÃO configurado: PATCH /keys/me {"webhook_url": "https://…"} e guarde o webhook_secret (go-live.mjs faz)');
if (!k.webhook_configured) faltas.push('webhook');
ok(!!k.settlement_address, k.settlement_address ? `carteira padrão da chave definida (${k.chain})` : 'sem carteira padrão: informe payout_address em cada cobrança, ou use destino "saldo"');
const b = me.body.nivel_conta?.beneficios || {};
console.log(`   taxa de compra: ${k.fee_bps ?? '-'} bps + ${b.taxa_fixa_pix_cents ?? '-'} centavos/Pix · documento do pagador: ${b.documento_pagador || '-'} · escada por pagador: ${b.escada_por_pagador ?? '-'}`);

const cat = await get('/cashin/catalog');
if (cat.ok) {
  const rotas = [...(cat.body.instant || []), ...(cat.body.convert || [])].filter(r => r.entregavel);
  const usd = rotas.filter(r => /^usd[tc]$/i.test(r.asset)).map(r => `${r.asset}/${r.network}`);
  ok(rotas.length > 0, `${rotas.length} rotas entregáveis agora · stablecoins: ${[...new Set(usd)].join(', ') || 'nenhuma'}${cat.body.stale ? ' · ⚠️ catálogo em cache (stale)' : ''}`);
} else ok(false, `catálogo indisponível (${cat.status} ${cat.body.erro || ''})`);
const saldo = await get('/saldo');
if (saldo.ok) ok(true, `saldo da casa: disponível ${saldo.body.disponivel_cents} c · bloqueado ${saldo.body.bloqueado_cents} c · carência ${saldo.body.carencia_horas ?? '-'} h`);
const wh = await get('/webhooks/deliveries?limit=5');
if (wh.ok) ok((wh.body.failed_count || 0) === 0, `webhooks: ${wh.body.deliveries?.length || 0} entregas recentes · ${wh.body.failed_count || 0} falhas`);
if (me.body.monitor_url) console.log('🔒 monitor_url presente em /keys/me: privado, nunca exponha a clientes.');

if (live) console.log(faltas.length
  ? `\nFalta para cobrar em produção: ${faltas.join(', ')}. Tudo pelo painel: ${PAINEL}. Não repita chamadas recusadas em laço.`
  : '\nProdução pronta. Siga luniumpay/references/checklist-producao.md antes da primeira cobrança real.');
else console.log('\nSandbox: dinheiro fictício. Prove com luniumpay-pix-charge/scripts/smoke.mjs. Produção: upgrade de conta no painel → chave lun_live_ em "Chaves de API" → go-live.mjs.');
