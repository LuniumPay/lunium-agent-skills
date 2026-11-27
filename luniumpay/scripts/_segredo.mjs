// Utilitários de segredo compartilhados pelos scripts da skill `luniumpay`.
// Regra: nenhuma função daqui imprime chave, segredo ou o conteúdo de um .env.
import { readFileSync, writeFileSync, existsSync, chmodSync } from 'node:fs';
import { join, basename } from 'node:path';

export const FORMATO_CHAVE = /^lun_(test|live)_[0-9a-f]{48}$/;
export const PAINEL = 'https://parceiros.luniumpay.com';
export const UPGRADE = 'https://parceiros.luniumpay.com/upgrade';

/** Prefixo seguro para mostrar (ex.: "lun_test_215a…"). Nunca a chave inteira. */
export const prefixo = (k) => (typeof k === 'string' && k.length > 13 ? `${k.slice(0, 13)}…` : '(sem chave)');

/** Lê KEY=VALOR de um arquivo .env sem interpretar shell. Não imprime nada. */
export function lerEnv(arquivo) {
  if (!existsSync(arquivo)) return {};
  const out = {};
  for (const linha of readFileSync(arquivo, 'utf8').split(/\r?\n/)) {
    const m = linha.match(/^\s*(?:export\s+)?([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (!m) continue;
    let v = m[2];
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1);
    else v = v.replace(/\s+#.*$/, '');
    out[m[1]] = v;
  }
  return out;
}

/** LUNIUM_API_KEY do ambiente ou, se faltar, do primeiro .env da pasta que tiver uma. */
export function chaveDoAmbiente(dir = process.cwd(), arquivos = ['.env.local', '.env', '.env.lunium.production']) {
  if (process.env.LUNIUM_API_KEY) return { chave: process.env.LUNIUM_API_KEY.trim(), origem: 'variável de ambiente' };
  for (const a of arquivos) {
    const v = lerEnv(join(dir, a)).LUNIUM_API_KEY;
    if (v) return { chave: v.trim(), origem: a };
  }
  return { chave: null, origem: null };
}

/** Grava (ou troca) NOME=valor num .env com permissão 0600 e garante o arquivo no .gitignore. */
export function gravarVar(arquivo, nome, valor, { dir = process.cwd() } = {}) {
  let atual = existsSync(arquivo) ? readFileSync(arquivo, 'utf8') : '';
  atual = atual.replace(new RegExp(`^[ \\t]*(?:export[ \\t]+)?${nome}[ \\t]*=.*(?:\\r?\\n|$)`, 'gm'), '');
  if (atual && !atual.endsWith('\n')) atual += '\n';
  writeFileSync(arquivo, `${atual}${nome}=${valor}\n`, { mode: 0o600 });
  chmodSync(arquivo, 0o600);
  const gi = join(dir, '.gitignore');
  const linhas = existsSync(gi) ? readFileSync(gi, 'utf8') : '';
  const nomeArq = basename(arquivo);
  if (!linhas.split(/\r?\n/).includes(nomeArq)) writeFileSync(gi, `${linhas.replace(/\n?$/, linhas ? '\n' : '')}${nomeArq}\n`);
}

/**
 * Lê um segredo sem eco. Terminal: modo cru, nada aparece na tela (nem asteriscos).
 * Pipe (`… | node chave.mjs`): lê o stdin inteiro. Nunca escreve o valor em stdout/stderr.
 */
export function lerSegredo(pergunta) {
  const entrada = process.stdin;
  if (!entrada.isTTY) {
    return new Promise((ok, falha) => {
      let buf = '';
      entrada.setEncoding('utf8');
      entrada.on('data', (d) => { buf += d; });
      entrada.on('end', () => ok(buf.trim()));
      entrada.on('error', falha);
    });
  }
  return new Promise((ok, falha) => {
    process.stderr.write(pergunta);
    let buf = '';
    entrada.setRawMode(true);
    entrada.resume();
    entrada.setEncoding('utf8');
    const fim = (erro) => {
      entrada.setRawMode(false);
      entrada.pause();
      entrada.removeListener('data', aoTeclar);
      process.stderr.write('\n');
      erro ? falha(erro) : ok(buf.trim());
    };
    const aoTeclar = (pedaco) => {
      for (const c of pedaco) {
        if (c === '\r' || c === '\n' || c === '\u0004') return fim();
        if (c === '\u0003') return fim(Object.assign(new Error('cancelado'), { cancelado: true }));
        if (c === '\u007f' || c === '\b') { buf = buf.slice(0, -1); continue; }
        if (c >= ' ') buf += c;
      }
    };
    entrada.on('data', aoTeclar);
  });
}

/** GET /keys/me com a chave informada. Devolve { ok, status, body } sem lançar. */
export async function lerConta(chave, base = 'https://api.luniumpay.com') {
  try {
    const r = await fetch(`${base}/keys/me`, { headers: { 'X-API-Key': chave } });
    return { ok: r.ok, status: r.status, body: await r.json().catch(() => ({})) };
  } catch (e) {
    return { ok: false, status: 0, body: { erro: 'sem_rede', detail: e.message } };
  }
}
