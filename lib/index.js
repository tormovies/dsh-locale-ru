/**
 * Host half of the Russian language pack.
 *
 * Everything this pack contributes is browser-side: the language definition
 * and the dictionaries are registered by `lib/client.js` through the
 * `dsh-client-locale` service. The Host row exists so the Loader mounts the
 * package and the client module system can serve its browser bundle.
 */
export function apply() {}
