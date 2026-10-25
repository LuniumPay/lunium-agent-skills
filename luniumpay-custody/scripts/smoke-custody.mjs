#!/usr/bin/env node
// Custódia no SANDBOX: Pix → saldo (subconta) → transferir → payout Pix → saque cripto. Dinheiro fictício.
// Uso: LUNIUM_API_KEY=lun_test_... node smoke-custody.mjs   (ou LUNIUM_SANDBOX_EMAIL para criar a chave)
const BASE = 'https://api.luniumpay.com';
let key = process.env.LUNIUM_API_KEY;
const call = async (p, init = {}) => { const r = await fetch(BASE + p, { ...init, headers: { 'Content-Type': 'application/json', ...(key ? { 'X-API-Key': key } : {}) } }); const b = await r.json().catch(() => ({})); if (!r.ok) throw new Error(`${init.method || 'GET'} ${p} → ${r.status} ${b.erro || ''}: ${b.detail || ''} | ${b.agent_guidance || ''}`); return b; };
const sleep = (ms) => new Promise(r => setTimeout(r, ms));
if (key && !key.startsWith('lun_test_')) { console.error('Recusado: só chave de sandbox (lun_test_).'); process.exit(2); }
if (!key) { const email = process.env.LUNIUM_SANDBOX_EMAIL; if (!email) { console.error('Defina LUNIUM_API_KEY ou LUNIUM_SANDBOX_EMAIL.'); process.exit(2); } key = (await call('/keys/sandbox', { method: 'POST', body: JSON.stringify({ email, name: 'smoke-custody' }) })).api_key; console.log('chave de teste criada (não impressa)'); }
const ref = `cli-${Date.now().toString(36)}`; const tag = Date.now();

const c = await call('/cashin/charge', { method: 'POST', body: JSON.stringify({ amount_cents: 30000, payer_tax_number: '12345678909', destino: 'saldo', customer_ref: ref, external_id: `cust-${tag}`, sandbox_scenario: 'success' }) });
console.log('cobrança saldo:', c.cashin_id, c.status, 'líquido', c.net_cents);
await call(`/sandbox/cashin/${c.cashin_id}/pay`, { method: 'POST', body: '{}' });
let s; for (let i = 0; i < 10; i++) { s = await call(`/cashin/${c.cashin_id}/status`); if (s.settlement_status === 'sent') break; await sleep(3000); }
console.log('status:', s.status, '/', s.settlement_status);
let saldo = await call(`/saldo?customer_ref=${ref}`); console.log('saldo subconta:', saldo.disponivel_cents, 'disponível,', saldo.bloqueado_cents, 'bloqueado');

const tr = await call('/saldo/transferir', { method: 'POST', body: JSON.stringify({ from_customer_ref: ref, to_customer_ref: 'casa', amount_cents: 1000, descricao: 'smoke', external_id: `tr-${tag}` }) });
console.log('transferência → casa:', JSON.stringify(tr).slice(0, 160));

const po = await call('/payouts', { method: 'POST', body: JSON.stringify({ amount_cents: 5000, pix_key: 'sandbox@example.invalid', pix_key_type: 'email', tax_number: '12345678909', customer_ref: ref, external_id: `po-${tag}`, sandbox_scenario: 'success' }) });
let p = po; for (let i = 0; i < 8 && ['pending', 'processing'].includes(p.status); i++) { await sleep(3000); p = await call(`/payouts/${po.payout_id}`); }
console.log('payout:', p.payout_id, p.status, 'taxa', p.fee_cents, 'e2e', p.e2e);

const sq = await call('/saldo/sacar-cripto', { method: 'POST', body: JSON.stringify({ amount_cents: 10000, asset: 'usdt', chain: 'polygon', payout_address: '0x000000000000000000000000000000000000dEaD', tax_number: '12345678909', customer_ref: ref, external_id: `sq-${tag}`, sandbox_scenario: 'success' }) });
console.log('saque cripto:', JSON.stringify(sq).slice(0, 220));
saldo = await call(`/saldo?customer_ref=${ref}`); console.log('saldo final subconta:', saldo.disponivel_cents, 'disponível');
