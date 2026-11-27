#!/usr/bin/env node
// Off-ramp no SANDBOX: catálogo → prévia → ordem → aceite → depósito simulado → Pix pago com E2E. Dinheiro fictício.
// Uso: LUNIUM_API_KEY=lun_test_... node smoke-cashout.mjs [asset=USDT] [network=polygon] [cenario=success]
//      Ex.: node smoke-cashout.mjs DEPIX liquid settlement_uncertain   (prova o fecho do estado incerto)
// Sem LUNIUM_API_KEY no ambiente, lê lun_test_ de .env.local/.env. Recusa chaves de produção.
import { readFileSync } from 'node:fs';
// Chave de TESTE: do ambiente ou do .env.local/.env da pasta atual (só lun_test_). A API não cria chave:
// gere no painel (https://parceiros.luniumpay.com → "Conta real e testes" → "Acessar testes" → "Chaves de API")
// e guarde com `node luniumpay/scripts/chave.mjs`.
function chaveDeTeste() {
  if (process.env.LUNIUM_API_KEY) return process.env.LUNIUM_API_KEY.trim();
  for (const f of ['.env.local', '.env']) {
    try { const m = readFileSync(f, 'utf8').match(/^[ \t]*(?:export[ \t]+)?LUNIUM_API_KEY[ \t]*=[ \t]*["']?(lun_test_[0-9a-f]{48})/m); if (m) return m[1]; } catch {}
  }
  return null;
}
const SEM_CHAVE = 'Sem chave de teste. Gere no painel (https://parceiros.luniumpay.com, entre com Google → "Conta real e testes" → '
  + '"Acessar testes" → "Integração por API" › "Chaves de API") e guarde com node luniumpay/scripts/chave.mjs, '
  + 'ou exporte LUNIUM_API_KEY=lun_test_… . A API não cria chave (403 sandbox_somente_no_painel).';
let key = chaveDeTeste();
if (!key) { console.error(SEM_CHAVE); process.exit(2); }
const BASE = 'https://api.luniumpay.com';
const asset = (process.argv[2] || 'USDT').toUpperCase();
const network = (process.argv[3] || 'polygon').toLowerCase();
const cenario = process.argv[4] || 'success';
const sleep = (ms) => new Promise(r => setTimeout(r, ms));
async function call(path, init = {}) {
  const r = await fetch(BASE + path, { ...init, headers: { 'Content-Type': 'application/json', ...(key ? { 'X-API-Key': key } : {}) } });
  const b = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(`${init.method || 'GET'} ${path} → ${r.status} ${b.erro || ''}: ${b.detail || ''} | ${b.agent_guidance || ''}`);
  return b;
}
if (key && !key.startsWith('lun_test_')) { console.error('Recusado: só chave de sandbox (lun_test_).'); process.exit(2); }

const cat = await call('/catalog');
const emFast = (cat.fast || []).some(r => r.asset?.toUpperCase() === asset && r.network?.toLowerCase() === network);
const emConvert = (cat.convert || []).some(r => r.asset?.toUpperCase() === asset && (r.networks || []).map(n => n.toLowerCase()).includes(network));
console.log(`catálogo: ${asset}/${network} ${emFast ? 'em fast' : emConvert ? 'em convert' : 'NÃO ENCONTRADO (a API dirá rota_indisponivel)'}${cat.synthetic ? ' · sintético (sandbox)' : ''}`);

const brl = '100.00';
const prev = await call('/cash-outs/preview', { method: 'POST', body: JSON.stringify({ asset, network, brl_amount: brl }) });
console.log(`prévia: R$ ${prev.brl_amount} ≈ ${prev.amount} ${asset} (sem ordem${prev.expires_at ? ", válida até " + prev.expires_at : ""})`);

const body = { asset, network, brl_amount: brl, pix_key: '12345678909', pix_key_type: 'cpf', external_id: `smoke-co-${Date.now()}`, sandbox_scenario: cenario };
const co = await call('/cash-outs', { method: 'POST', body: JSON.stringify(body) });
console.log(`ordem: ${co.cashout_id} ${co.state} · envia ${co.amount} ${asset} · recebedor ganha R$ ${co.brl_amount} · expira ${co.expires_at}`);
const again = await call('/cash-outs', { method: 'POST', body: JSON.stringify(body) });
console.log('idempotência:', again.cashout_id === co.cashout_id ? 'OK (mesma ordem)' : 'FALHOU (ordem nova)');

const acc = await call(`/cash-outs/${co.cashout_id}/accept`, { method: 'POST', body: '{}' });
console.log(`aceite: ${acc.state} · depósito em ${acc.network}: ${acc.deposit_address}${acc.deposit_tag ? ' · tag ' + acc.deposit_tag : ''}  ← SANDBOX, NÃO ENVIE FUNDOS`);

const terminal = ['COMPLETED', 'FAILED', 'REFUNDED', 'EXPIRED'];
let s = acc, resolved = false;
for (let i = 0; i < 20; i++) {
  await sleep(3000);
  s = await call(`/cash-outs/${co.cashout_id}`);
  console.log(`estado #${i + 1}: ${s.state}${s.refund_address_required ? ' · refund_address_required' : ''}`);
  if (terminal.includes(s.state)) break;
  if (s.state === 'AWAITING_REFUND_ADDRESS') {
    await call(`/cash-outs/${co.cashout_id}/refund-address`, { method: 'POST', body: JSON.stringify({ refund_address: '0x000000000000000000000000000000000000dEaD' }) });
    console.log('devolução: carteira do cliente informada (POST /cash-outs/{id}/refund-address)');
  }
  if (cenario === 'settlement_uncertain' && ['PROCESSING', 'MANUAL_REVIEW'].includes(s.state) && !resolved) {
    await call(`/sandbox/operations/${co.cashout_id}/resolve`, { method: 'POST', body: JSON.stringify({ outcome: 'sent' }) });
    resolved = true; console.log('incerto: resolvido no sandbox com outcome=sent (POST /sandbox/operations/{id}/resolve)');
  }
}
const esperaFalha = ['failed', 'expired', 'refunded', 'no_deposit', 'route_unavailable', 'provider_unavailable'].includes(cenario);
if (s.state === 'COMPLETED') console.log(`PIX PAGO | e2e: ${s.pix_e2e} | verificar: ${s.verify_url || '-'} | comprovante: ${s.receipt_url || 'ainda não (cashout.receipt_ready)'}`);
else console.log(`${esperaFalha ? 'FALHA ESPERADA' : 'NÃO CONCLUIU'} | estado final: ${s.state} | motivo: ${s.failure_reason || '-'}`);
process.exit(s.state === 'COMPLETED' || esperaFalha ? 0 : 1);
