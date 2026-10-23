# Реверс x.com — что взято и откуда

Снято 2026-10-24 с помощью REA (`capture_browser_scenario`, Chromium 152, тёмная тема, 1366×900).

## Как снимали

| Шаг | Инструмент | Результат |
|---|---|---|
| Открыть `https://x.com/` и `https://x.com/XDevelopers` | REA browser scenario (headful — headless получает 403 от Cloudflare) | скриншоты, DOM профиля (220 КБ) |
| Найти стили | разбор DOM: `<link rel=stylesheet href=".../x-web/assets/styles-DwsUIA6i.css">` | новый веб-клиент X — **Tailwind CSS v4.3.3** + собственные токены `--x-*` |
| Достать токены | парсинг `styles-*.css` | палитра, семантические цвета light/dark, шкала шрифтов, раскладка |

Evidence ID захвата профиля: `ev_561bc138335b444aceed3ae4b22520e94f7f66af8d1cd72ed4d6596252624279`.

## Токены (перенесены в `src/index.css`)

**Палитра:** `--x-blue-500 #1d9bf0` (бренд), `--x-green-500 #00ba7c` (репост), `--x-magenta-500 #f91880` (лайк), `--x-red-500 #f4212e`, `--x-yellow-500 #ffd400`, `--x-purple-500 #7856ff`; нейтральные `#f2f2f2 … #0d0d0d`; альфа-шкалы `--x-black-NN` / `--x-white-NN`.

**Семантика (тёмная тема):**

| Токен | Значение |
|---|---|
| `--x-bg-primary` | `#000` |
| `--x-bg-secondary` / `tertiary` | `#141414` / `#262626` |
| `--x-fg-primary` / `secondary` / `tertiary` | `#fff` / `white-60` / `white-30` |
| `--x-border-normal` / `divider` | `white-15` / `white-20` |
| `--x-btn-primary` | `#fff` (основная кнопка — белая, текст чёрный) |
| `--x-btn-ghost-hover` | `white-08` |
| `--x-hover-subtle` / `faint` | `white-08` / `white-03` |

Светлая тема — зеркальные значения на `black-NN` (см. `src/index.css`).

**Типографика** (`calc(N / root * 1rem)`): title1 34/40, title2 30/36, title3 26/32, title4 23/28, headline1 20/24, headline2 17/20, **body 15/20**, subtext1 14/16, subtext2 13/16, subtext3 11/12. Шрифт `TwitterChirp` (проприетарный, не копируется — используется Inter Variable).

**Раскладка:** `--layout-width-primary: 600px`, `--layout-min-right: 258px`, `--spacing-horizontal: 16px`, `--layout-height-tab-bar: 56px`, сайдбар `max(72px, 256px * --x-sidebar-wide)` (раскрывается на `xl`).

**Скругления:** `--radius-md: 16px`, `--radius-lg: 24px` (× `--x-radius-m`), кнопки `9999px`, медиа `rounded-md`.

## Компоненты (по DOM)

- **Пост** — `article.flex.flex-col.gap-1` → строка `w-10` аватар + `gap-2` + колонка `gap-3`; шапка `.x-middot-group` (имя · @handle · время, разделитель `·` через `::before`); текст `text-body whitespace-pre-wrap`.
- **Панель действий** — `-mx-2 w-[calc(100%+16px)] h-5 justify-between @container`; каждая кнопка `.x-engagement-pill h-9 px-2.5`, иконка `18.75px`, счётчик `text-subtext2 tabular-nums ps-1`; ховер-подложка `before:bg-brand/10` (зелёная для репоста, розовая для лайка).
- **Аватары** — `rounded-[10%]` у организаций, круг у людей → в Xgram каналы квадратные, люди круглые.
- **Карточка ссылки** — `rounded-md border bg-secondary`, плашка заголовка `bg-black/75 rounded-xs h-5 px-2 text-subtext2`, подпись «From domain» → «Из domain».
- **Кнопки** — `.x-button`: `rounded-full`, `font-medium`, `gap-8px`, disabled `opacity .7`.

## Что сделано своим (не копируется)

Логотип X, шрифт Chirp и иконки X не переносились: свой знак (бумажный самолётик), Inter, иконки lucide.
