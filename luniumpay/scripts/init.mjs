#!/usr/bin/env node
// LuniumPay init — monta a integração "receber Pix → USDT" dentro do seu projeto.
// Uso: node luniumpay/scripts/init.mjs [--stack next|express|fastapi|supabase] [--email voce@empresa.com] [--dir .] [--force] [--dry]
//  - detecta a stack (package.json, pyproject/requirements, pasta supabase/) se --stack não vier
//  - grava os arquivos da receita oficial (nunca sobrescreve sem --force)
//  - grava .env.example; com --email cria uma chave de SANDBOX (lun_test_) e grava no .env local (0600), sem imprimir
//  - não cria chave de produção, não movimenta dinheiro
import { readFileSync, writeFileSync, existsSync, mkdirSync, readdirSync, chmodSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const args = Object.fromEntries(process.argv.slice(2).map((a, i, all) => a.startsWith('--') ? [a.slice(2), all[i + 1] && !all[i + 1].startsWith('--') ? all[i + 1] : true] : []).filter(Boolean));
const dir = resolve(args.dir || '.');
const here = dirname(fileURLToPath(import.meta.url));
const refs = resolve(here, '../../luniumpay-pix-charge/references');
const log = (s) => console.log(s);

function detectStack() {
  const pkg = join(dir, 'package.json');
  if (existsSync(pkg)) {
    const p = JSON.parse(readFileSync(pkg, 'utf8')); const d = { ...(p.dependencies || {}), ...(p.devDependencies || {}) };
    if (d.next) return 'next'; if (d.express) return 'express';
  }
  if (existsSync(join(dir, 'supabase')) && readdirSync(join(dir, 'supabase')).some(f => f === 'config.toml' || f === 'functions')) return 'supabase';
  for (const f of ['pyproject.toml', 'requirements.txt']) if (existsSync(join(dir, f)) && /fastapi/i.test(readFileSync(join(dir, f), 'utf8'))) return 'fastapi';
  return null;
}
const stack = args.stack || detectStack();
if (!stack) { console.error('Não detectei a stack. Use --stack next|express|fastapi|supabase'); process.exit(2); }

const blocks = (file) => [...readFileSync(join(refs, file), 'utf8').matchAll(/```[a-z]*\n([\s\S]*?)```/g)].map(m => m[1]);
const PLANS = {
  next:     { ref: 'nextjs.md',        env: '.env.local', files: [[1, 'lib/lunium.ts'], [2, 'app/api/cobranca/route.ts'], [3, 'app/api/cobranca/[id]/route.ts'], [4, 'app/api/webhooks/lunium/route.ts']], extra: [['checkout-react.md', 0, 'components/CheckoutPix.tsx']] },
  express:  { ref: 'express.md',       env: '.env',       files: [[0, 'lunium-server.mjs']] },
  fastapi:  { ref: 'fastapi.md',       env: '.env',       files: [[0, 'lunium_api.py']] },
  supabase: { ref: 'supabase-edge.md', env: '.env',       files: [[0, 'supabase/migrations/20261024000000_lunium.sql'], [1, 'supabase/functions/lunium-cobranca/index.ts'], [2, 'supabase/functions/lunium-webhook/index.ts']] },
};
const plan = PLANS[stack];
const src = blocks(plan.ref);
const out = plan.files.map(([i, path]) => ({ path, code: src[i] }));
for (const [ref, i, path] of plan.extra || []) out.push({ path, code: blocks(ref)[i] });
if (out.some(o => !o.code)) { console.error('Receita incompleta em references/. Atualize a skill (npx skills add LuniumPay/lunium-agent-skills).'); process.exit(1); }

const ENV_EXAMPLE = `# LuniumPay — copie para ${plan.env} e preencha. Nunca commite o arquivo preenchido.
LUNIUM_API_KEY=lun_test_...          # sandbox: POST https://api.luniumpay.com/keys/sandbox {"email": "..."}; produção: POST /keys → lun_live_
LUNIUM_WEBHOOK_SECRET=               # devolvido por PATCH /keys/me {"webhook_url": "https://seu-app/webhooks/lunium"}
LUNIUM_PAYOUT_ADDRESS=0x...          # carteira do dono (destino=cripto); omita se usar destino=saldo
LUNIUM_CHAIN=polygon                 # rede da rota escolhida em GET /cashin/catalog
`;
log(`LuniumPay init · stack: ${stack} · pasta: ${dir}${args.dry ? ' · DRY RUN' : ''}\n`);
const write = (rel, content, mode) => {
  const p = join(dir, rel);
  if (existsSync(p) && !args.force) { log(`⏭  ${rel} já existe (use --force para sobrescrever)`); return false; }
  if (args.dry) { log(`📝 ${rel} (${content.length} bytes)`); return true; }
  mkdirSync(dirname(p), { recursive: true }); writeFileSync(p, content); if (mode) chmodSync(p, mode); log(`✅ ${rel}`); return true;
};
for (const o of out) write(o.path, o.code);
write('.env.example', ENV_EXAMPLE);

if (args.email && typeof args.email === 'string') {
  if (args.dry) log(`🔑 criaria chave de sandbox para ${args.email}`);
  else {
    const r = await fetch('https://api.luniumpay.com/keys/sandbox', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: args.email, name: 'init-skill' }) });
    const b = await r.json();
    if (!r.ok) log(`⚠️  chave de sandbox não criada: ${b.erro || r.status} ${b.detail || ''}`);
    else {
      const envPath = join(dir, plan.env);
      const line = `LUNIUM_API_KEY=${b.api_key}\n`;
      if (existsSync(envPath) && /^LUNIUM_API_KEY=/m.test(readFileSync(envPath, 'utf8'))) log(`⏭  ${plan.env} já tem LUNIUM_API_KEY; não alterei`);
      else { writeFileSync(envPath, (existsSync(envPath) ? readFileSync(envPath, 'utf8').replace(/\n?$/, '\n') : '') + line); chmodSync(envPath, 0o600); log(`🔑 chave de SANDBOX gravada em ${plan.env} (0600). Não imprimo a chave.`); }
      const gi = join(dir, '.gitignore'); const cur = existsSync(gi) ? readFileSync(gi, 'utf8') : '';
      if (!cur.split('\n').includes(plan.env)) { writeFileSync(gi, cur.replace(/\n?$/, '\n') + plan.env + '\n'); log(`🙈 ${plan.env} adicionado ao .gitignore`); }
    }
  }
}
log(`
Próximos passos
1. Preencha ${plan.env} (LUNIUM_PAYOUT_ADDRESS, LUNIUM_CHAIN; LUNIUM_WEBHOOK_SECRET após cadastrar o webhook).
2. Diagnóstico:  LUNIUM_API_KEY=... node luniumpay/scripts/doctor.mjs
3. Prova:        LUNIUM_API_KEY=... node luniumpay-pix-charge/scripts/smoke.mjs cripto success
4. Webhook:      PATCH /keys/me {"webhook_url": "https://seu-app/webhooks/lunium"} → guarde webhook_secret → POST /webhooks/test
5. Produção:     POST https://api.luniumpay.com/keys {"name": "...", "email": "..."} → troque LUNIUM_API_KEY. Checklist: luniumpay/references/checklist-producao.md
${stack === 'next' ? 'Frontend: importe components/CheckoutPix.tsx e passe o retorno de POST /api/cobranca.' : ''}`);
