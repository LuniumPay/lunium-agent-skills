#!/usr/bin/env node
// Prova ponta a ponta no SANDBOX: cria cobrança, simula o Pix, lê o estado final.
// Uso: LUNIUM_API_KEY=lun_test_... node smoke.mjs [destino=cripto|saldo] [cenario=success]
// Sem LUNIUM_API_KEY: cria uma chave de teste com LUNIUM_SANDBOX_EMAIL (obrigatório).
// Recusa chaves de produção. Nenhum dinheiro real é movimentado.
const BASE = 'https://api.luniumpay.com';
const destino = process.argv[2] || 'cripto';
const cenario = process.argv[3] || 'success';
let key = process.env.LUNIUM_API_KEY;

async function call(path, init = {}) {
  const r = await fetch(BASE + path, { ...init, headers: { 'Content-Type': 'application/json', ...(key ? { 'X-API-Key': key } : {}), ...(init.headers || {}) } });
  const body = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(`${init.method || 'GET'} ${path} → ${r.status} ${body.erro || ''}: ${body.detail || ''} | ${body.agent_guidance || ''}`);
  return body;
}
const sleep = (ms) => new Promise(r => setTimeout(r, ms));

if (key && !key.startsWith('lun_test_')) { console.error('Recusado: este script só roda com chave de sandbox (lun_test_).'); process.exit(2); }
if (!key) {
  const email = process.env.LUNIUM_SANDBOX_EMAIL;
  if (!email) { console.error('Defina LUNIUM_API_KEY (lun_test_) ou LUNIUM_SANDBOX_EMAIL para criar uma chave de teste.'); process.exit(2); }
  const k = await call('/keys/sandbox', { method: 'POST', body: JSON.stringify({ email, name: 'smoke-skill' }) });
  key = k.api_key; console.log('chave de teste criada (não impressa); guarde-a no .env se quiser reutilizar');
}

const me = await call('/keys/me');
console.log('conta:', me.key.prefix, 'cashin:', me.key.cashin_enabled, 'nivel:', me.nivel_conta?.nivel);

const body = {
  amount_cents: 10000, payer_tax_number: '12345678909', destino, external_id: `smoke-${Date.now()}`,
  sandbox_scenario: cenario,
  ...(destino === 'cripto' ? { asset: 'USDT', chain: 'polygon', payout_address: '0x000000000000000000000000000000000000dEaD' } : { customer_ref: 'smoke-cliente' }),
};
if (destino === 'cripto') {
  const p = await call('/cashin/preview', { method: 'POST', body: JSON.stringify({ amount_cents: body.amount_cents, destino, asset: 'USDT', chain: 'polygon' }) });
  console.log('prévia: líquido', p.net_cents, 'centavos ≈', p.asset_amount, 'USDT (estimativa), mínimo', p.min_brl_cents);
}
const c = await call('/cashin/charge', { method: 'POST', body: JSON.stringify(body) });
console.log('cobrança:', c.cashin_id, c.status, '| QR:', c.qr_copypaste, '| expira', c.expires_at);
const again = await call('/cashin/charge', { method: 'POST', body: JSON.stringify(body) });
console.log('idempotência:', again.cashin_id === c.cashin_id ? 'OK (mesmo cashin_id)' : 'FALHOU');

await call(`/sandbox/cashin/${c.cashin_id}/pay`, { method: 'POST', body: '{}' });
let s;
for (let i = 0; i < 12; i++) {
  s = await call(`/cashin/${c.cashin_id}/status`);
  console.log(`status #${i + 1}:`, s.status, '/', s.settlement_status, '/', s.settlement_proof);
  if (['sent', 'failed', 'incerto'].includes(s.settlement_status) || ['failed', 'refunded', 'expired'].includes(s.status)) break;
  await sleep(3000);
}
const liberado = s.status === 'paid' && (destino === 'saldo' ? true : s.settlement_status === 'sent');
console.log(liberado ? 'LIBERADO' : 'NÃO LIBERADO', '| e2e:', s.e2e, '| tx:', s.settlement_tx_hash, '| USDT:', s.usdt_amount);
if (destino === 'saldo') { const saldo = await call('/saldo?customer_ref=smoke-cliente'); console.log('saldo:', JSON.stringify(saldo).slice(0, 300)); }
