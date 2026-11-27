#!/usr/bin/env node
// Custódia no SANDBOX: Pix → saldo (subconta) → transferir → payout Pix → saque cripto. Dinheiro fictício.
// Uso: LUNIUM_API_KEY=lun_test_... node smoke-custody.mjs   (ou com a chave de teste em .env.local/.env)
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
const call = async (p, init = {}) => { const r = await fetch(BASE + p, { ...init, headers: { 'Content-Type': 'application/json', ...(key ? { 'X-API-Key': key } : {}) } }); const b = await r.json().catch(() => ({})); if (!r.ok) throw new Error(`${init.method || 'GET'} ${p} → ${r.status} ${b.erro || ''}: ${b.detail || ''} | ${b.agent_guidance || ''}`); return b; };
const sleep = (ms) => new Promise(r => setTimeout(r, ms));
if (key && !key.startsWith('lun_test_')) { console.error('Recusado: só chave de sandbox (lun_test_).'); process.exit(2); }
const ref = `cli-${Date.now().toString(36)}`; const tag = Date.now();

const c = await call('/cashin/charge', { method: 'POST', body: JSON.stringify({ amount_cents: 30000, payer_tax_number: '12345678909', destino: 'saldo', customer_ref: ref, external_id: `cust-${tag}`, sandbox_scenario: 'success' }) });
console.log('cobrança saldo:', c.cashin_id, c.status, 'líquido', c.net_cents);
await call(`/sandbox/cashin/${c.cashin_id}/pay`, { method: 'POST', body: '{}' });
let s; for (let i = 0; i < 10; i++) { s = await call(`/cashin/${c.cashin_id}/status`); if (s.settlement_status === 'sent') break; await sleep(3000); }
console.log('status:', s.status, '/', s.settlement_status);
let saldo = await call(`/saldo?customer_ref=${ref}`); console.log('saldo subconta:', saldo.disponivel_cents, 'disponível,', saldo.bloqueado_cents, 'bloqueado');

// Carência (cenário held): o crédito entra bloqueado, com data de liberação. Não é falha; não peça outro Pix.
const refH = `${ref}-held`;
const h = await call('/cashin/charge', { method: 'POST', body: JSON.stringify({ amount_cents: 10000, payer_tax_number: '12345678909', destino: 'saldo', customer_ref: refH, external_id: `held-${tag}`, sandbox_scenario: 'held' }) });
await call(`/sandbox/cashin/${h.cashin_id}/pay`, { method: 'POST', body: '{}' });
let hs; for (let i = 0; i < 10; i++) { hs = await call(`/cashin/${h.cashin_id}/status`); if (hs.settlement_status === 'sent') break; await sleep(3000); }
const sh = await call(`/saldo?customer_ref=${refH}`);
const lib = sh.proximas_liberacoes?.[0];
console.log(`carência (held): ${sh.bloqueado_cents} bloqueado, ${sh.disponivel_cents} disponível, em_carencia=${sh.em_carencia}, libera em ${lib?.disponivel_em || '-'}`, sh.bloqueado_cents > 0 ? '→ RETENÇÃO VISÍVEL' : '→ ATENÇÃO: nada bloqueado');

const tr = await call('/saldo/transferir', { method: 'POST', body: JSON.stringify({ from_customer_ref: ref, to_customer_ref: 'casa', amount_cents: 1000, descricao: 'smoke', external_id: `tr-${tag}` }) });
console.log('transferência → casa:', JSON.stringify(tr).slice(0, 160));

const po = await call('/payouts', { method: 'POST', body: JSON.stringify({ amount_cents: 5000, pix_key: 'sandbox@example.invalid', pix_key_type: 'email', tax_number: '12345678909', customer_ref: ref, external_id: `po-${tag}`, sandbox_scenario: 'success' }) });
let p = po; for (let i = 0; i < 8 && ['pending', 'processing'].includes(p.status); i++) { await sleep(3000); p = await call(`/payouts/${po.payout_id}`); }
console.log('payout:', p.payout_id, p.status, 'taxa', p.fee_cents, 'e2e', p.e2e);

const sq = await call('/saldo/sacar-cripto', { method: 'POST', body: JSON.stringify({ amount_cents: 10000, asset: 'usdt', chain: 'polygon', payout_address: '0x000000000000000000000000000000000000dEaD', tax_number: '12345678909', customer_ref: ref, external_id: `sq-${tag}`, sandbox_scenario: 'success' }) });
console.log('saque cripto:', JSON.stringify(sq).slice(0, 220));
saldo = await call(`/saldo?customer_ref=${ref}`); console.log('saldo final subconta:', saldo.disponivel_cents, 'disponível');
