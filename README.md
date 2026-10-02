# LifeBalance

Задачи с гибкими напоминаниями, семейный бюджет, общий календарь и семейные группы.

## Структура

Монорепозиторий на **pnpm workspaces + Turborepo**:

| Пакет                                       | Что внутри                                                                                      |
| ------------------------------------------- | ----------------------------------------------------------------------------------------------- |
| `apps/api` (`@balance/api`)                 | Бэкенд: NestJS (Express) + Prisma (SQLite), авторизация, планировщик напоминаний                |
| `apps/web` (`@balance/web`)                 | Фронтенд: React 19 + Vite + React Router + TanStack Query, UI на shadcn/ui, архитектура **FSD** |
| `packages/contracts` (`@balance/contracts`) | Общие zod-схемы и DTO — единый контракт API для фронта и бэка (для API собирается в CJS)        |

### Фронтенд: Feature-Sliced Design

```
apps/web/src
├── app/        # точка входа, провайдеры, маршруты, глобальные стили
├── pages/      # страницы: dashboard, tasks, budget, calendar, family, login
├── widgets/    # крупные блоки: каркас приложения, графики бюджета, сетка календаря…
├── features/   # действия пользователя: редактирование задачи, вход, вступление в группу…
├── entities/   # сущности: session, task, transaction, event, family-group, notification
└── shared/     # ui-кит (shadcn/ui new-york-v4), http-клиент, форматирование, конфиг
```

Правила: слой импортирует только нижележащие слои, а слайсы — только через публичный
`index.ts`. Это проверяет [steiger](https://github.com/feature-sliced/steiger) в `pnpm lint`.

Формы — `react-hook-form` + zod + компоненты `Field` из shadcn; даты — `DatePicker`/`DateTimePicker`
на `Calendar` (react-day-picker). Компоненты shadcn лежат в `shared/ui` и обновляются из
[исходников new-york-v4](https://github.com/shadcn-ui/ui/tree/main/apps/v4/registry/new-york-v4/ui)
или через `pnpm dlx shadcn@latest add <component> --overwrite` (из `apps/web`).

### Бэкенд (NestJS)

- Модули по доменам в `apps/api/src/modules/*`: контроллер → сервис → `PrismaService`.
- Вход валидируется zod-схемами из `@balance/contracts` через `ZodPipe`; ошибки — `{ error }` из глобального фильтра.
- Глобальные guards: `CsrfGuard` и `SessionGuard` (`@Public()` — открытый эндпоинт, `@CurrentUser()` — пользователь).
- Фоновые задачи — `@nestjs/schedule`, лимиты — `@nestjs/throttler`; сборка — Nest CLI + SWC.
- Сессии хранятся в БД (в cookie — случайный токен, в базе — его SHA-256), cookie `httpOnly` + `SameSite=Lax`.
- CSRF: изменяющие запросы принимаются только с `Origin` фронтенда и только как `application/json`.
- Деньги — целые копейки, даты операций — `YYYY-MM-DD`.
- Напоминания считает сервер: у каждого есть `nextFireAt` в часовом поясе получателя,
  фоновый планировщик создаёт уведомления — открытая вкладка не нужна.

## Локальный запуск

Нужны Node.js 22+ и pnpm (`corepack enable` подтянет версию из `package.json`).

```bash
pnpm install
cp apps/api/.env.example apps/api/.env   # при необходимости поправьте значения
pnpm db:migrate                           # создаст SQLite-базу apps/api/prisma/dev.db
pnpm db:seed                              # необязательно: демо-данные
pnpm dev                                  # API на :3001, фронтенд на http://localhost:5173
```

Vite проксирует `/api` на API, поэтому фронтенд и бэкенд работают с одного origin.

В dev включён **демо-вход** без пароля (`DEMO_LOGIN=true`). В `NODE_ENV=production` он
отключается принудительно, независимо от настроек.

### Вход через Яндекс ID

1. Создайте приложение на https://oauth.yandex.ru/client/new (платформа «Веб-сервисы»).
2. Redirect URI: `http://localhost:5173/api/auth/yandex/callback` (в проде — `${APP_URL}/api/auth/yandex/callback`).
3. Права: «Доступ к адресу электронной почты», «Доступ к портрету пользователя».
4. Пропишите `YANDEX_CLIENT_ID` и `YANDEX_CLIENT_SECRET` в `apps/api/.env` и перезапустите API.

### ИИ-анализ бюджета

Работает с любым OpenAI-совместимым API (Chat Completions): задайте `AI_API_URL`, `AI_API_KEY`
и `AI_MODEL` в `apps/api/.env`. Без них кнопка анализа скрыта. Учтите, что провайдеру
отправляются операции за месяц: суммы, категории и описания.

## Команды

| Команда           | Что делает                                                 |
| ----------------- | ---------------------------------------------------------- |
| `pnpm dev`        | API и фронтенд в режиме разработки                         |
| `pnpm check`      | линтеры (ESLint + steiger), типы и тесты во всех пакетах   |
| `pnpm build`      | сборка API (`apps/api/dist`) и фронтенда (`apps/web/dist`) |
| `pnpm db:migrate` | применить/создать миграции Prisma в dev                    |
| `pnpm db:seed`    | демо-данные (в production запрещено)                       |
| `pnpm db:studio`  | Prisma Studio                                              |

## Ветки и окружения

- `master` — production;
- `develop` — dev-окружение; изменения вливаются в `master` через pull request.

## Продакшен

```bash
pnpm install --frozen-lockfile
pnpm build
cd apps/api
DATABASE_URL="file:/data/lifebalance.db" pnpm db:deploy   # миграции
NODE_ENV=production \
DATABASE_URL="file:/data/lifebalance.db" \
APP_URL="https://lifebalance.example.ru" \
WEB_DIST_DIR="../web/dist" \
YANDEX_CLIENT_ID=… YANDEX_CLIENT_SECRET=… \
node dist/main.js
```

С `WEB_DIST_DIR` API сам отдаёт собранный фронтенд (SPA), так что достаточно одного процесса
за reverse-proxy с TLS (nginx/Caddy). На `https://` cookie сессии получает флаги `Secure` и
префикс `__Host-`.
