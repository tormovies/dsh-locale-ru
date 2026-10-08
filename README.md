# dsh-locale-ru

Русский языковой пакет для веб-интерфейса **DeepSeek Harness (DSH)**. Внешний
клиентский плагин: регистрирует язык `ru` и русские словари через сервис
`@deepseek-ai/dsh-client-locale`. Непереведённые ключи берутся из `en` по
цепочке fallback, поэтому пакет можно пополнять по namespace'ам, ничего не
ломая.

**Покрытие: 2389 из 2389 строк интерфейса, 57 namespace'ов** — диалог, чат,
рабочая область, настройки, модели, цели, задания, субагенты, траектория,
расписания, плагины, предпросмотр документов, горячие клавиши и остальное.

## Установка

```bash
dsh plugin --profile desktop add @tormovies/dsh-locale-ru
```

Затем перезапустить приложение и выбрать **Настройки → Общие → Язык → Русский**.
Подробно про все способы (npm, git, tarball, локальная папка) — в
[INSTALL.md](INSTALL.md).

## Состав

| Путь | Роль |
| --- | --- |
| `package.json` | объявление пакета: `dsh.bundle.patch` (слой профиля) и `dsh.client` (браузерный бандл) |
| `cordis.patch.yml` | вставляет строку браузерного реестра: `locale-ru` → пакет |
| `lib/index.js` | host-половина: пустой `apply`, нужна только чтобы Loader смонтировал пакет |
| `lib/client.js` | **генерируемый** браузерный бандл: `addLanguage` + `register(ns, 'ru', dict)` |
| `locale/ru/<ns>.json` | источник правды: русские словари по namespace'ам |
| `locale/ref/<ns>/{en,zh}.json` | эталонные словари DSH, извлечённые из `app.asar` |
| `scripts/` | сборка бандла, проверка переводов, обновление эталонов |
| `GLOSSARY.md` | согласованная терминология |

## Команды

```powershell
node scripts/build.mjs .   # собрать lib/client.js из locale/ru/*.json
node scripts/verify.mjs    # полнота ключей, плейсхолдеры, пустые значения, латиница
node --check lib/client.js # синтаксис бандла
```

Обновление эталонов после новой версии DSH:

```powershell
node scripts/extract-ref.mjs "C:\Users\<вы>\AppData\Local\Programs\DeepSeek Harness\resources\app.asar" locale/ref
node scripts/verify.mjs    # покажет новые непереведённые ключи
node scripts/build.mjs .   # пересобрать бандл
```

## Ограничения

- Текст вне словарей (имена инструментов, диагностика pnpm и Loader, сообщения
  модели) остаётся английским — в DSH он не локализуется.
- Новые ключи после обновления DSH приходят с английским значением; их находит
  `scripts/verify.mjs`.

## Лицензия

MIT. Русские словари — перевод строк интерфейса DeepSeek Harness (MIT,
Copyright (c) 2026 DeepSeek); исходные строки сохранены в `locale/ref/`.
Подробности — в [LICENSE](LICENSE).
