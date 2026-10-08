# Установка и распространение

Пакет — обычный внешний плагин DSH: он объявляет `dsh.bundle.patch` (слой
профиля) и `dsh.client` (браузерный бандл). Поэтому его можно поставить любым
из четырёх способов.

## 1. Из npm (проще всего для других людей)

```powershell
dsh plugin --profile desktop add @tormovies/dsh-locale-ru
```

Затем перезапустить приложение и выбрать **Настройки → Общие → Язык → Русский**.

> Пакет публикуется под скоупом автора: `@tormovies/dsh-locale-ru`.
> Незанятое имя без скоупа (`dsh-locale-ru`) уже используется сторонней
> русификацией, поэтому здесь выбран скоуп.

## 2. Из git-репозитория

```powershell
dsh plugin --profile desktop add github:<логин>/dsh-locale-ru
```

Сборка не требуется: `lib/client.js` уже лежит в репозитории. Если pnpm
заблокирует `prepare`-скрипты, добавьте пакет в `allowBuilds` файла
`~/.dsh/profiles/desktop/pnpm-workspace.yaml` — но у этого пакета
`prepare` отсутствует, поэтому блокировки быть не должно.

## 3. Из tarball (передать файлом, без публикации)

```powershell
# собрать архив (в папке пакета)
npm pack                     # или: pnpm pack
# у получателя
dsh plugin --profile desktop add "C:\путь\tormovies-dsh-locale-ru-0.1.0.tgz"
```

## 4. Папкой или ссылкой (для разработки)

```powershell
dsh plugin --profile desktop add "link:C:\путь\к\dsh-locale-ru"   # junction, правки видны сразу
dsh plugin --profile desktop add "file:C:\путь\к\dsh-locale-ru"   # копия в node_modules профиля
```

После установки убедитесь, что имя пакета есть в `dsh.profile.bundles` файла
`~/.dsh/profiles/desktop/package.json` (менеджер плагинов добавляет его сам),
и перезапустите приложение.

## Удаление

```powershell
dsh plugin --profile desktop remove @tormovies/dsh-locale-ru
```

Интерфейс возвращается к английскому, язык `Русский` исчезает из списка.

## Публикация в npm (для автора)

```powershell
# 1. поднять версию и пересобрать бандл
npm version patch
# 2. проверить, что попадёт в пакет
npm pack --dry-run
# 3. опубликовать
npm publish --access public
```

Проверка перед публикацией:

```powershell
node scripts/build.mjs .   # пересобрать lib/client.js из locale/ru/*.json
node scripts/verify.mjs    # полнота ключей, плейсхолдеры, латиница
node --check lib/client.js # синтаксис бандла
```

## Обновление словарей после новой версии DSH

```powershell
# эталонные английские словари из установленного DSH
node scripts/extract-ref.mjs "C:\Users\<вы>\AppData\Local\Programs\DeepSeek Harness\resources\app.asar" locale/ref
node scripts/verify.mjs    # покажет новые непереведённые ключи
node scripts/build.mjs .   # пересобрать бандл
```

Новые ключи до перевода показываются на английском — работает цепочка
`ru → en`, поэтому интерфейс никогда не ломается.
