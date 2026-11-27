// Testes do repositório das Agent Skills (não chamam a API). Rode: node --test tests/
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, existsSync, mkdtempSync, writeFileSync, statSync, rmSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { FORMATO_CHAVE, lerEnv, gravarVar, prefixo } from '../luniumpay/scripts/_segredo.mjs';

const raiz = join(dirname(fileURLToPath(import.meta.url)), '..');
const skills = readdirSync(raiz).filter(d => existsSync(join(raiz, d, 'SKILL.md')));
const ler = (p) => readFileSync(join(raiz, p), 'utf8');
const todosArquivos = (dir = raiz) => readdirSync(dir, { withFileTypes: true }).flatMap(e =>
  e.name === '.git' || e.name === 'node_modules' ? [] : e.isDirectory() ? todosArquivos(join(dir, e.name)) : [join(dir, e.name)]);

test('cada SKILL.md tem frontmatter válido, nome = pasta, descrição ≤ 1024 e versão = plugin.json', () => {
  assert.ok(skills.length >= 7);
  const versao = JSON.parse(ler('luniumpay/.claude-plugin/plugin.json')).version;
  for (const s of skills) {
    const md = ler(`${s}/SKILL.md`);
    const fm = md.match(/^---\n([\s\S]*?)\n---\n/);
    assert.ok(fm, `${s}: frontmatter`);
    assert.match(fm[1], new RegExp(`^name: ${s}$`, 'm'), `${s}: name`);
    const desc = fm[1].match(/^description: "(.*)"$/m)?.[1];
    assert.ok(desc && desc.length <= 1024, `${s}: description (${desc?.length})`);
    assert.match(fm[1], new RegExp(`version: "${versao}"`), `${s}: metadata.version`);
    assert.equal(JSON.parse(ler(`${s}/.claude-plugin/plugin.json`)).version, versao, `${s}: plugin.json`);
  }
  const mk = JSON.parse(ler('.claude-plugin/marketplace.json'));
  assert.deepEqual(mk.plugins.map(p => p.name).sort(), [...skills].sort());
});

test('nenhum texto manda criar chave pela API (porta fechada desde 25/11/2026)', () => {
  for (const f of todosArquivos().filter(f => /\.(md|mjs|json)$/.test(f) && !f.includes('/tests/'))) {
    const t = readFileSync(f, 'utf8');
    assert.doesNotMatch(t, /fetch\([^)]*\/keys\/sandbox|call\('\/keys(\/sandbox)?',\s*\{\s*method:\s*'POST'/, `${f}: cria chave pela API`);
    assert.doesNotMatch(t, /curl[^\n]*POST[^\n]*api\.luniumpay\.com\/keys(\/sandbox)?['" ]/, `${f}: curl cria chave`);
    assert.doesNotMatch(t, /sem aprovação humana|chave de produção em (1|uma) chamada|na hora \(sem aprovação\)/i, `${f}: promessa antiga`);
  }
});

test('init.mjs encontra todos os blocos das receitas (ordem dos blocos preservada)', () => {
  const casos = { next: { 'package.json': '{"dependencies":{"next":"15"}}' }, express: { 'package.json': '{"dependencies":{"express":"4"}}' },
    fastapi: { 'requirements.txt': 'fastapi' }, supabase: { 'supabase/config.toml': '' } };
  for (const [stack, arquivos] of Object.entries(casos)) {
    const d = mkdtempSync(join(tmpdir(), `lunium-init-${stack}-`));
    try {
      for (const [n, c] of Object.entries(arquivos)) { const p = join(d, n); spawnSync('mkdir', ['-p', dirname(p)]); writeFileSync(p, c); }
      const r = spawnSync(process.execPath, [join(raiz, 'luniumpay/scripts/init.mjs'), '--dir', d, '--dry'], { encoding: 'utf8' });
      assert.equal(r.status, 0, `${stack}: ${r.stderr}`);
      assert.match(r.stdout, new RegExp(`stack: ${stack}`));
      assert.doesNotMatch(r.stdout + r.stderr, /Receita incompleta/);
    } finally { rmSync(d, { recursive: true, force: true }); }
  }
});

test('_segredo: formato, leitura de .env, gravação 0600 + .gitignore, prefixo', () => {
  assert.ok(FORMATO_CHAVE.test('lun_test_' + 'a'.repeat(48)));
  assert.ok(FORMATO_CHAVE.test('lun_live_' + '0'.repeat(48)));
  assert.ok(!FORMATO_CHAVE.test('lun_test_' + 'g'.repeat(48)));
  const d = mkdtempSync(join(tmpdir(), 'lunium-seg-'));
  try {
    const env = join(d, '.env');
    writeFileSync(env, 'A=1\nexport LUNIUM_API_KEY="velha"\nLUNIUM_API_KEY=duplicada\nB=2 # comentário\n');
    assert.equal(lerEnv(env).B, '2');
    gravarVar(env, 'LUNIUM_API_KEY', 'nova', { dir: d });
    const t = readFileSync(env, 'utf8');
    assert.equal((t.match(/LUNIUM_API_KEY=/g) || []).length, 1, 'sem duplicata');
    assert.equal(lerEnv(env).LUNIUM_API_KEY, 'nova');
    assert.equal(lerEnv(env).A, '1');
    assert.equal(statSync(env).mode & 0o777, 0o600);
    assert.ok(readFileSync(join(d, '.gitignore'), 'utf8').split('\n').includes('.env'));
    gravarVar(env, 'X', 'y', { dir: d });
    assert.equal((readFileSync(join(d, '.gitignore'), 'utf8').match(/^\.env$/gm) || []).length, 1, '.gitignore sem repetição');
    assert.equal(prefixo('lun_test_' + 'b'.repeat(48)), 'lun_test_bbbb…');
  } finally { rmSync(d, { recursive: true, force: true }); }
});

test('chave.mjs recusa texto fora do formato sem gravar e sem ecoar', () => {
  const d = mkdtempSync(join(tmpdir(), 'lunium-chave-'));
  try {
    const segredo = 'nao-e-chave-' + 'z'.repeat(30);
    const r = spawnSync(process.execPath, [join(raiz, 'luniumpay/scripts/chave.mjs'), '--dir', d], { input: segredo, encoding: 'utf8' });
    assert.notEqual(r.status, 0);
    assert.ok(!(r.stdout + r.stderr).includes(segredo), 'não ecoa o que recebeu');
    assert.ok(!existsSync(join(d, '.env')), 'não grava');
  } finally { rmSync(d, { recursive: true, force: true }); }
});

test('smoke scripts recusam lun_live_ e explicam o painel quando falta chave', () => {
  const smokes = ['luniumpay-pix-charge/scripts/smoke.mjs', 'luniumpay-custody/scripts/smoke-custody.mjs', 'luniumpay-crypto-sale/scripts/smoke-cashout.mjs'];
  const vazio = mkdtempSync(join(tmpdir(), 'lunium-smoke-'));
  try {
    for (const s of smokes) {
      const semChave = spawnSync(process.execPath, [join(raiz, s)], { cwd: vazio, encoding: 'utf8', env: { PATH: process.env.PATH } });
      assert.equal(semChave.status, 2, `${s}: sem chave`);
      assert.match(semChave.stderr, /parceiros\.luniumpay\.com/);
      const live = spawnSync(process.execPath, [join(raiz, s)], { cwd: vazio, encoding: 'utf8', env: { PATH: process.env.PATH, LUNIUM_API_KEY: 'lun_live_' + 'c'.repeat(48) } });
      assert.equal(live.status, 2, `${s}: lun_live_`);
      assert.match(live.stderr, /sandbox|lun_test_/);
    }
  } finally { rmSync(vazio, { recursive: true, force: true }); }
});
