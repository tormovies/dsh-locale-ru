// Extract English/Chinese dictionaries from asar client bundles, keyed by the
// locale namespace each `ctx.locale.register(...)` call actually uses.
//
// namespace resolution: the first call argument, read as a string literal or
// through a `const NAME = "..."` declaration in the same bundle. The dictionary
// arguments accept both the object form `{ zh, en }` / `{ zh: a, en: b }` and
// the per-locale form `register(ns, "ru", dict)`.
//
// usage: node extract-en-dicts.mjs <archive> <outDir> [--only settings] [--quiet]
import fs from 'node:fs';
import path from 'node:path';

const archive = process.argv[2];
const outDir = process.argv[3];
const onlyArg = process.argv.indexOf('--only');
const only = onlyArg >= 0 ? process.argv[onlyArg + 1] : null;
const quiet = process.argv.includes('--quiet');
if (!archive || !outDir) {
  console.error('usage: node extract-en-dicts.mjs <archive> <outDir> [--only prefix] [--quiet]');
  process.exit(2);
}

const fd = fs.openSync(archive, 'r');
const sizeBuf = Buffer.alloc(8);
fs.readSync(fd, sizeBuf, 0, 8, 0);
const headerSize = sizeBuf.readUInt32LE(4);
const headerBuf = Buffer.alloc(headerSize);
fs.readSync(fd, headerBuf, 0, headerSize, 8);
const jsonStart = headerBuf.indexOf('{"files"');
const header = JSON.parse(headerBuf.subarray(jsonStart).toString('utf8').replace(/\0+$/, '').replace(/\}\s*$/, '}'));
const base = 8 + headerSize;

function walk(node, prefix, out) {
  for (const [name, entry] of Object.entries(node.files || {})) {
    const p = prefix ? prefix + '/' + name : name;
    if (entry.files) walk(entry, p, out);
    else out.push({ path: p, size: Number(entry.size || 0), offset: Number(entry.offset || 0), unpacked: !!entry.unpacked });
  }
  return out;
}

const files = walk(header, '', []).filter((f) => /\/lib\/client\.js$/.test(f.path) && !f.unpacked);

/** Balanced block starting at the first `{` at or after `from`. */
function blockAt(text, from, open = '{', close = '}') {
  const start = text.indexOf(open, from);
  if (start < 0) return null;
  let depth = 0;
  let quote = null;
  let line = false;
  let blk = false;
  for (let i = start; i < text.length; i++) {
    const c = text[i];
    const next = text[i + 1];
    if (line) { if (c === '\n') line = false; continue; }
    if (blk) { if (c === '*' && next === '/') { blk = false; i++; } continue; }
    if (quote) { if (c === '\\') { i++; continue; } if (c === quote) quote = null; continue; }
    if (c === '/' && next === '/') { line = true; i++; continue; }
    if (c === '/' && next === '*') { blk = true; i++; continue; }
    if (c === '"' || c === "'" || c === '`') { quote = c; continue; }
    if (c === open) depth++;
    else if (c === close) { depth--; if (!depth) return { start, end: i + 1, text: text.slice(start, i + 1) }; }
  }
  return null;
}

/** Split an argument list at top-level commas. */
function splitArgs(text) {
  const out = [];
  let depth = 0;
  let quote = null;
  let current = '';
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (quote) {
      current += c;
      if (c === '\\') { current += text[i + 1] ?? ''; i++; continue; }
      if (c === quote) quote = null;
      continue;
    }
    if (c === '"' || c === "'" || c === '`') { quote = c; current += c; continue; }
    if (c === '(' || c === '{' || c === '[') depth++;
    if (c === ')' || c === '}' || c === ']') depth--;
    if (c === ',' && depth === 0) { out.push(current.trim()); current = ''; continue; }
    current += c;
  }
  if (current.trim()) out.push(current.trim());
  return out;
}

function stringLiteral(expr, strings) {
  const trimmed = expr.trim();
  let m = /^"((?:[^"\\]|\\.)*)"$/.exec(trimmed) ?? /^'((?:[^'\\]|\\.)*)'$/.exec(trimmed);
  if (m) return m[1];
  if (/^[A-Za-z_$][\w$]*$/.test(trimmed) && strings.has(trimmed)) return strings.get(trimmed);
  return null;
}

function parseFlatDict(block) {
  const out = {};
  const re = /(?:^|[\s,{])(?:"((?:[^"\\]|\\.)*)"|'((?:[^'\\]|\\.)*)'|([A-Za-z_$][\w$]*))\s*:\s*(?:"((?:[^"\\]|\\.)*)"|'((?:[^'\\]|\\.)*)'|`((?:[^`\\]|\\.)*)`)/g;
  let m;
  while ((m = re.exec(block))) {
    const key = m[1] ?? m[2] ?? m[3];
    const value = m[4] ?? m[5] ?? m[6];
    if (key === undefined || value === undefined || key in out) continue;
    out[key] = value.replace(/\\(["'`\\])/g, '$1').replace(/\\n/g, '\n');
  }
  return out;
}

const nsResult = new Map(); // ns -> { en, zh, bundles:Set }
const stats = { files: 0, calls: 0, unresolvedNs: [], unresolvedDicts: [] };

for (const file of files) {
  const buf = Buffer.alloc(file.size);
  fs.readSync(fd, buf, 0, file.size, base + file.offset);
  const text = buf.toString('utf8');
  const pkg = file.path.replace(/^.*node_modules\//, '').split('/lib/')[0];
  stats.files++;

  // String constants and object constants declared in this bundle.
  const strings = new Map();
  for (const m of text.matchAll(/const\s+([A-Za-z_$][\w$]*)\s*=\s*"([^"]*)"/g)) strings.set(m[1], m[2]);
  for (const m of text.matchAll(/const\s+([A-Za-z_$][\w$]*)\s*=\s*'([^']*)'/g)) strings.set(m[1], m[2]);
  const objects = new Map();
  for (const m of text.matchAll(/const\s+([A-Za-z_$][\w$]*)\s*=\s*\{/g)) {
    const blk = blockAt(text, m.index + m[0].length - 1);
    if (blk) objects.set(m[1], blk.text);
  }

  const callRe = /\.locale\.register\(/g;
  let call;
  while ((call = callRe.exec(text))) {
    const paren = blockAt(text, call.index + call[0].length - 1, '(', ')');
    if (!paren) continue;
    callRe.lastIndex = paren.end;
    stats.calls++;
    const args = splitArgs(paren.text.slice(1, -1));
    if (args.length < 2) continue;
    const ns = stringLiteral(args[0], strings);
    if (!ns) {
      stats.unresolvedNs.push(`${pkg}: ${args[0].slice(0, 60)}`);
      continue;
    }
    const pairs = [];
    if (/^\{/.test(args[1])) {
      const body = blockAt(args[1], 0);
      for (const part of splitArgs(body ? body.text.slice(1, -1) : '')) {
        const kv = /^([A-Za-z_$][\w$]*)\s*:\s*(.+)$/s.exec(part);
        if (kv) pairs.push([kv[1], kv[2].trim()]);
        else if (/^[A-Za-z_$][\w$]*$/.test(part.trim())) pairs.push([part.trim(), part.trim()]);
      }
    } else if (args.length >= 3) {
      const locale = stringLiteral(args[1], strings);
      if (locale) pairs.push([locale, args[2].trim()]);
    }
    const entry = nsResult.get(ns) ?? { en: {}, zh: {}, bundles: new Set() };
    entry.bundles.add(pkg);
    for (const [locale, expr] of pairs) {
      let body = null;
      const inline = blockAt(expr, 0);
      if (/^\{/.test(expr) && inline) body = inline.text;
      else if (/^[A-Za-z_$][\w$]*$/.test(expr) && objects.has(expr)) body = objects.get(expr);
      if (!body) {
        stats.unresolvedDicts.push(`${pkg} ns=${ns} locale=${locale}: ${expr.slice(0, 60)}`);
        continue;
      }
      const dict = parseFlatDict(body);
      const target = locale === 'en' ? entry.en : locale === 'zh' ? entry.zh : null;
      if (!target) continue;
      for (const [k, v] of Object.entries(dict)) if (!(k in target)) target[k] = v;
    }
    nsResult.set(ns, entry);
  }
}

const selected = [...nsResult.entries()]
  .filter(([ns]) => !only || ns.startsWith(only))
  .sort((a, b) => Object.keys(b[1].en).length - Object.keys(a[1].en).length);

for (const [ns, entry] of selected) {
  const dir = path.join(outDir, ns);
  fs.mkdirSync(dir, { recursive: true });
  const sorted = Object.fromEntries(Object.keys(entry.en).sort().map((k) => [k, entry.en[k]]));
  fs.writeFileSync(path.join(dir, 'en.json'), `${JSON.stringify(sorted, null, 2)}\n`);
  const sortedZh = Object.fromEntries(Object.keys(entry.zh).sort().map((k) => [k, entry.zh[k]]));
  fs.writeFileSync(path.join(dir, 'zh.json'), `${JSON.stringify(sortedZh, null, 2)}\n`);
}

const total = selected.reduce((sum, [, e]) => sum + Object.keys(e.en).length, 0);
if (!quiet) {
  for (const [ns, entry] of selected) {
    console.log(`${String(Object.keys(entry.en).length).padStart(5)} keys  zh=${String(Object.keys(entry.zh).length).padStart(5)}  ${ns}  <- ${[...entry.bundles].join(', ')}`);
  }
  console.log(`# namespaces: ${selected.length}, en keys: ${total}, register calls: ${stats.calls}`);
  if (stats.unresolvedNs.length) console.log(`# unresolved namespaces:\n  ${stats.unresolvedNs.join('\n  ')}`);
  if (stats.unresolvedDicts.length) console.log(`# unresolved dictionaries:\n  ${stats.unresolvedDicts.join('\n  ')}`);
}
console.log(`# wrote ${selected.length} namespace(s) under ${outDir}`);
