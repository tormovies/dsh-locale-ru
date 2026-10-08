// Verify the Russian dictionaries against the extracted English reference:
// key parity, placeholder parity, empty values, untranslated values and
// unexpected Latin script.
//
// usage: node scripts/verify.mjs [--ns <namespace>] [--strict]
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const refDir = path.join(root, 'locale', 'ref');
const ruDir = path.join(root, 'locale', 'ru');
const nsFilter = process.argv.includes('--ns') ? process.argv[process.argv.indexOf('--ns') + 1] : null;
const strict = process.argv.includes('--strict');

/** Latin fragments allowed to survive translation. */
const ALLOWED_LATIN = [
  'DeepSeek', 'DSH', 'Harness', 'JSON', 'Markdown', 'GitHub', 'GitLab', 'npm', 'pnpm', 'npx', 'React',
  'API', 'MCP', 'ACP', 'SDK', 'CLI', 'TUI', 'GUI', 'HTTP', 'HTTPS', 'HTML', 'CSS', 'URL', 'URI',
  'SSE', 'SSH', 'OAuth', 'IDE', 'VS Code', 'YAML', 'TOML', 'PNG', 'JPEG', 'PDF', 'DOCX', 'XLSX',
  'PPTX', 'CSV', 'ZIP', 'UTF', 'Base64', 'SQL', 'SQLite', 'CPU', 'GPU', 'RAM', 'PC',
  'Ctrl', 'Cmd', 'Shift', 'Alt', 'Enter', 'Esc', 'Tab', 'Space', 'Home', 'End', 'Page', 'Del',
  'Backspace', 'CapsLock', 'F1', 'F2', 'F3', 'F4', 'F5', 'F6', 'F7', 'F8', 'F9', 'F10', 'F11', 'F12',
  'PowerShell', 'bash', 'zsh', 'sh', 'node', 'pnpm', 'Python', 'Windows', 'macOS', 'Linux',
  'id', 'ID', 'OK', 'Token', 'Web', 'Agent', 'Ralph', 'PTC', 'Key', 'OpenAI', 'Anthropic', 'Kimi',
  'Messages', 'Completions', 'Mod', 'Option', 'Control', 'Backslash', 'Backquote', 'EXP',
  'Account', 'Chat', 'Responses', 'Command', 'Mac', 'en',
  'Cordis', 'Host', 'compact', 'export', 'feedback', 'goal', 'permission', 'plan',
  'MB', 'GB', 'KB', 'Hugging Face', 'Hugging', 'Face', 'HF-Mirror', 'Python', 'DNS',
  'off', 'allowBuilds', 'tgz', 'Git', 'author', 'plugin', 'add', 'README', 'bundle', 'HMR', 'npmrc', 'v',
  'LLM', 'TPS', 'TTFT', 'cron', 'Cron', 'IANA', 'UTC', 'BOM', 'Office', 'Finder', 'Markdown', 'HTML',
  'surface', 'N', 'Unix', 'Tab', 'PDF', 'Inspect', 'ru',
  'JPG', 'JPEG', 'WebP', 'GIF', 'Png', 'Pwsh', 'Asia', 'Shanghai', 'edit', 'pause', 'resume', 'clear',
  'cordis.patch.yml', 'gateway.example', 'example', 'localStorage', 'userData', 'keybindings.json',
  'dsh.keybindings.v1', 'K', 'M', 'px', 'ms', 's', 'v1',
];

const placeholders = (value) => [...value.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort().join(',');
/** A zero-length string is a missing translation; a whitespace-only one can be a separator. */
const isEmpty = (value) => value === '';
const sameAsEnglish = (ru, en) => ru.trim() === en.trim() && en.trim() !== '';
/** English copy that legitimately stays as-is (brands, protocol names, samples). */
const KEEP_AS_IS = [
  'DeepSeek Harness', 'DeepSeek', 'Anthropic Messages', 'OpenAI Chat Completions', 'OpenAI Responses',
  'JSON', 'EXP', 'userData/keybindings.json', 'dsh-plugin-whale-pet',
  'PDF', 'HTML', 'Markdown', 'Finder', 'Tab', 'TTFT', 'Hugging Face',
  'compact', 'export', 'feedback', 'goal', 'permission', 'plan', 'Asia/Shanghai',
  'Cron {expression} ({zone})', 'Bash', 'Pwsh', 'HTTP',
];

/** Values with no prose to translate: URLs, units, bare codes, placeholder-only templates. */
const isNonProse = (value) => {
  const trimmed = value.trim();
  if (/^https?:\/\//.test(trimmed)) return true;
  const stripped = trimmed.replace(/\{\w+\}/g, '').replace(/[^A-Za-z]/g, '');
  return stripped.length < 3;
};

function latinWords(value) {
  const stripped = value.replace(/\{\w+\}/g, ' ').replace(/https?:\/\/\S+/g, ' ');
  const words = stripped.match(/[A-Za-z][A-Za-z0-9.+#-]*/g) ?? [];
  return [...new Set(words)].filter((word) => {
    if (word.includes('+')) return false;
    return !ALLOWED_LATIN.some((allowed) => {
      const a = allowed.toLowerCase();
      const w = word.toLowerCase();
      return w === a || w.startsWith(a + '.') || w.startsWith(a + '/') || w.startsWith(a + '-');
    });
  });
}

const namespaces = fs.readdirSync(refDir, { withFileTypes: true })
  .filter((entry) => entry.isDirectory())
  .map((entry) => entry.name)
  .filter((ns) => !nsFilter || ns === nsFilter)
  .sort();

const problems = [];
let translatedNs = 0;
let translatedKeys = 0;
let totalKeys = 0;

for (const ns of namespaces) {
  const en = JSON.parse(fs.readFileSync(path.join(refDir, ns, 'en.json'), 'utf8'));
  const enKeys = Object.keys(en);
  totalKeys += enKeys.length;
  const ruFile = path.join(ruDir, `${ns}.json`);
  if (!fs.existsSync(ruFile)) continue;
  translatedNs++;
  const ru = JSON.parse(fs.readFileSync(ruFile, 'utf8'));
  const ruKeys = Object.keys(ru);
  translatedKeys += ruKeys.length;

  const missing = enKeys.filter((key) => !(key in ru));
  const extra = ruKeys.filter((key) => !(key in en));
  if (missing.length) problems.push(`${ns}: нет ${missing.length} ключей (${missing.slice(0, 5).join(', ')})`);
  if (extra.length) problems.push(`${ns}: лишние ключи (${extra.slice(0, 5).join(', ')})`);

  for (const key of ruKeys) {
    const value = ru[key];
    if (typeof value !== 'string') {
      problems.push(`${ns}: значение "${key}" не строка`);
      continue;
    }
    const enValue = en[key];
    if (isEmpty(value) && enValue !== '') problems.push(`${ns}: пустое значение "${key}"`);
    if (enValue === undefined) continue;
    if (placeholders(enValue) !== placeholders(value)) {
      problems.push(`${ns}: плейсхолдеры "${key}": en=[${placeholders(enValue)}] ru=[${placeholders(value)}]`);
    }
    if (sameAsEnglish(value, enValue) && !KEEP_AS_IS.includes(enValue.trim()) && !isNonProse(enValue)) {
      problems.push(`${ns}: не переведено "${key}" = ${JSON.stringify(enValue)}`);
    }
    const latin = latinWords(value);
    if (latin.length) problems.push(`${ns}: латиница "${key}" -> ${JSON.stringify(value)} [${latin.join(', ')}]`);
  }
}

console.log(`namespace'ов с переводом: ${translatedNs} из ${namespaces.length}`);
console.log(`ключей переведено: ${translatedKeys} из ${totalKeys}`);
if (problems.length) {
  console.log(`\nзамечаний: ${problems.length}`);
  for (const problem of problems) console.log(`  - ${problem}`);
  if (strict) process.exit(1);
} else {
  console.log('\nзамечаний нет');
}
