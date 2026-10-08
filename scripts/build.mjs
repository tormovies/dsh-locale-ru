// Build the browser bundle of the Russian language pack from its dictionaries.
//
// Source of truth: <packDir>/locale/ru/<namespace>.json — the file name is the
// locale namespace registered with `ctx.locale.register(ns, 'ru', dict)`.
// Output: <packDir>/lib/client.js in the DSH client-module bundle form.
//
// usage: node build-ru-pack.mjs <packDir> [--check]
import fs from 'node:fs';
import path from 'node:path';

const packDir = process.argv[2];
const checkOnly = process.argv.includes('--check');
if (!packDir) {
  console.error('usage: node build-ru-pack.mjs <packDir> [--check]');
  process.exit(2);
}

const dictDir = path.join(packDir, 'locale', 'ru');
const outFile = path.join(packDir, 'lib', 'client.js');

const entries = fs
  .readdirSync(dictDir)
  .filter((name) => name.endsWith('.json'))
  .sort()
  .map((name) => {
    const ns = name.slice(0, -'.json'.length);
    const raw = fs.readFileSync(path.join(dictDir, name), 'utf8');
    const dict = JSON.parse(raw);
    for (const [key, value] of Object.entries(dict)) {
      if (typeof value !== 'string') throw new Error(`${name}: value of "${key}" is not a string`);
    }
    return { ns, dict };
  });

const dictionaries = entries
  .map(({ ns, dict }) => `\t\t\t${JSON.stringify(ns)}: ${JSON.stringify(dict, null, '\t\t\t').replace(/\n/g, '\n\t\t\t')}`)
  .join(',\n');

const bundle = `/**
 * Browser half of the Russian language pack — GENERATED FILE, do not edit by
 * hand. Dictionaries live in locale/ru/<namespace>.json; rebuild with:
 *   node tools/build-ru-pack.mjs dsh-locale-ru
 *
 * The pack registers the \`ru\` language definition and one dictionary per
 * namespace through the public locale service of
 * \`@deepseek-ai/dsh-client-locale\`. Missing keys fall back along the declared
 * chain (\`ru\` -> \`en\`), so partial coverage never breaks a surface.
 */
window.__ModuleLoader__.load({
	id: "dsh-locale-ru",
	factory: (require) => {
		var module = { exports: {} };
		var exports = module.exports;
		Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });

		//#region lib/locale-ru.js
		/** Language id registered by this pack; ASCII BCP 47-style tag. */
		const LOCALE_ID = "ru";
		/** Display label shown in the Language settings row. */
		const LOCALE_LABEL = "Русский";
		/** Required service: the locale registry this pack extends. */
		const inject = ["locale"];
		/** Russian dictionaries keyed by locale namespace. */
		const dictionaries = {
${dictionaries}
		};

		/**
		 * Register the language definition and every dictionary as owned effects:
		 * unloading the plugin withdraws all of them.
		 * @param ctx - client cordis context carrying the locale service.
		 */
		function apply(ctx) {
			ctx.effect(() => ctx.locale.addLanguage({
				id: LOCALE_ID,
				label: LOCALE_LABEL,
				fallback: "en"
			}), "locale-ru: language");
			for (const [ns, dict] of Object.entries(dictionaries)) ctx.effect(() => ctx.locale.register(ns, LOCALE_ID, dict), \`locale-ru: \${ns} dictionary\`);
		}
		//#endregion

		exports.apply = apply;
		exports.inject = inject;
		return module.exports;
	}
});
`;

const keys = entries.reduce((total, { dict }) => total + Object.keys(dict).length, 0);
if (checkOnly) {
  const current = fs.existsSync(outFile) ? fs.readFileSync(outFile, 'utf8') : '';
  if (current !== bundle) {
    console.error(`${outFile} is out of date (${entries.length} namespaces, ${keys} keys)`);
    process.exit(1);
  }
  console.log(`${outFile} is up to date (${entries.length} namespaces, ${keys} keys)`);
} else {
  fs.mkdirSync(path.dirname(outFile), { recursive: true });
  fs.writeFileSync(outFile, bundle);
  console.log(`wrote ${outFile}: ${entries.length} namespaces, ${keys} keys`);
}
