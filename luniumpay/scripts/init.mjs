#!/usr/bin/env node
// LuniumPay init — monta a integração "receber Pix → USDT" dentro do seu projeto.
// Uso: node luniumpay/scripts/init.mjs [--stack next|express|fastapi|supabase] [--dir .] [--force] [--dry]
//  - detecta a stack (package.json, pyproject/requirements, pasta supabase/) se --stack não vier
//  - grava os arquivos da receita oficial (nunca sobrescreve sem --force) e o .env.example
//  - NÃO cria chave: desde 25/11/2026 a chave de teste e a de produção nascem no painel, com login.
//    Depois de gerar a chave no painel, guarde com: node luniumpay/scripts/chave.mjs --dir <pasta>
//  - não move dinheiro
import { readFileSync, writeFileSync, existsSync, mkdirSync, readdirSync, chmodSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { PAINEL, lerEnv } from './_segredo.mjs';

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
  next:     { ref: 'nextjs.md',        env: '.env.local', files: [[1, 'lib/lunium.ts'], [2, 'app/api/cobranca/route.ts'], [3, 'app/api/cobranca/[id]/route.ts'], [4, 'app/api/webhooks/lunium/route.ts']], extra: [['checkout-react.md', 0, 'components/CheckoutPix.tsx'], ['checkout-react.md', 1, 'app/pagar/page.tsx']] },
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
# A chave nasce no painel (${PAINEL}, entre com Google): "Conta real e testes" → "Acessar testes" →
# "Integração por API" › "Chaves de API" → "Gerar chave deste projeto". Guarde com: node luniumpay/scripts/chave.mjs
LUNIUM_API_KEY=lun_test_...          # produção: lun_live_ da conta real, depois do upgrade de conta (go-live.mjs leva ao host)
LUNIUM_WEBHOOK_SECRET=               # devolvido por PATCH /keys/me {"webhook_url": "https://seu-app/webhooks/lunium"} (go-live.mjs faz isso)
LUNIUM_DESTINO=saldo                 # saldo = custódia em reais, sem carteira · cripto = USDT direto na carteira abaixo
LUNIUM_PAYOUT_ADDRESS=0x...          # carteira do dono (só destino=cripto)
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

if (args.email) log('ℹ️  --email não cria mais chave: a API recusa (403 sandbox_somente_no_painel). A chave de teste nasce no painel.');
const temChave = /^lun_(test|live)_[0-9a-f]{48}$/.test(lerEnv(join(dir, plan.env)).LUNIUM_API_KEY || process.env.LUNIUM_API_KEY || '');
const rotaWebhook = stack === 'next' ? '/api/webhooks/lunium' : stack === 'supabase' ? '/functions/v1/lunium-webhook' : '/webhooks/lunium';
log(`
Próximos passos
1. Chave de teste: ${temChave ? `já existe em ${plan.env} ✅` : `entre em ${PAINEL} com Google → "Conta real e testes" → "Acessar testes" →
                 "Integração por API" › "Chaves de API" → "Gerar chave deste projeto". Depois:
                 node luniumpay/scripts/chave.mjs --dir ${dir}   (cola sem eco, grava em ${plan.env} 0600)`}
2. Preencha ${plan.env}: LUNIUM_DESTINO=saldo (sem carteira) ou cripto + LUNIUM_PAYOUT_ADDRESS e LUNIUM_CHAIN.
3. Diagnóstico:  node luniumpay/scripts/doctor.mjs
4. Prova:        node luniumpay-pix-charge/scripts/smoke.mjs cripto success   (e um cenário ruim: failed, payer_mismatch)
5. Deploy:       publique o app (precisa de URL https). Guia por stack: luniumpay/references/producao.md
6. Produção:     no painel, conta real → "Upgrade de conta" (verificação do titular) → cobranças Pix liberadas →
                 "Chaves de API" → lun_live_. Então:
                 node luniumpay/scripts/go-live.mjs --webhook https://<dominio>${rotaWebhook}${stack === 'next' ? ' --vercel --deploy' : ' --env .env.lunium.production'}
                 Depois: luniumpay/references/checklist-producao.md
${stack === 'next' ? 'Frontend: /pagar já está pronto (app/pagar/page.tsx usa components/CheckoutPix.tsx).' : ''}`);
