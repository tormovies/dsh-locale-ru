# dsh-locale-ru

Русский языковой пакет для веб-интерфейса DSH. Внешний клиентский плагин: он
регистрирует язык `ru` и русские словари через сервис
`@deepseek-ai/dsh-client-locale`. Непереведённые ключи автоматически берутся из
`en`, поэтому пакет можно пополнять по namespace'ам, ничего не ломая.

## Состав

| Путь | Роль |
| --- | --- |
| `package.json` | объявление пакета: `dsh.bundle.patch` (слой профиля) и `dsh.client` (браузерный бандл) |
| `cordis.patch.yml` | вставляет одну строку браузерного реестра: `locale-ru` → `dsh-locale-ru` |
| `lib/index.js` | host-половина: пустой `apply`, нужна только чтобы Loader смонтировал пакет |
| `lib/client.js` | **генерируемый** браузерный бандл: `addLanguage` + `register(ns, 'ru', dict)` |
| `locale/ru/<ns>.json` | источник правды: русские словари по namespace'ам |
| `locale/ref/<ns>/en.json`, `zh.json` | извлечённые эталонные словари DSH (для перевода и сверки) |
| `GLOSSARY.md` | согласованная терминология |

## Команды

```powershell
$node = "C:\Users\torle\.dsh\dsh-runtimes\dsh-primary-runtime\dependencies\node\bin\node.exe"
$asar = "C:\Users\torle\AppData\Local\Programs\DeepSeek Harness\resources\app.asar"

# 1. обновить эталонные словари из установленного DSH (после обновления приложения)
& $node tools\extract-en-dicts.mjs $asar dsh-locale-ru\locale\ref

# 2. собрать lib/client.js из locale/ru/*.json
& $node tools\build-ru-pack.mjs dsh-locale-ru

# 3. проверить переводы: полнота ключей, плейсхолдеры, пустые значения, латиница
& $node tools\verify-ru-pack.mjs

# 4. проверить сам бандл (id, inject, словари) без запуска GUI
& $node tools\check-locale-ru.mjs dsh-locale-ru\lib\client.js
```

## Установка и обновление

Пакет установлен в профиль `desktop` как `link:` — junction в
`~/.dsh/profiles/desktop/node_modules/dsh-locale-ru` указывает на эту папку,
поэтому после пересборки `lib/client.js` достаточно **перезагрузить окно
приложения** (Ctrl+R): переустанавливать пакет не нужно.

```powershell
# если link потерялся (например, после обновления профиля)
dsh plugin --profile desktop add "link:<путь к этой папке>"
```

`dsh.profile.bundles` в `~/.dsh/profiles/desktop/package.json` уже содержит
`dsh-locale-ru`, поэтому пакет включён постоянно.

## Выбор языка

Settings → General → Language → **Русский**. Выбор сохраняется в настройках
профиля и применяется без перезапуска.

## Ограничения

- Текст вне словарей (имена инструментов, сообщения хоста и модели, диагностика
  pnpm и Loader) остаётся английским.
- Обновление DSH не ломает пакет, но новые ключи приходят с английским
  значением по цепочке fallback; чтобы их найти, обновите `locale/ref` и
  запустите `verify-ru-pack.mjs`.
