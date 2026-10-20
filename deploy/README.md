# Деплой

Схема для одного небольшого VPS без Docker:

- **CI** (`.github/workflows/ci.yml`) — prettier, lint, typecheck, тесты и сборка на каждый PR и push.
- **Deploy** (`.github/workflows/deploy.yml`) — после зелёного CI (или вручную) собирает самодостаточный бандл
  (API с prod-зависимостями + сборка фронтенда), копирует его на сервер по SSH и запускает `deploy/release.sh`.
  Сервер ничего не собирает, ему нужен только Node.js.
- Стенды независимы и живут на одном сервере:

  | Ветка     | Окружение GitHub | Стенд          | Порт |
  | --------- | ---------------- | -------------- | ---- |
  | `develop` | `dev`            | `balance-dev`  | 3002 |
  | `master`  | `production`     | `balance-prod` | 3001 |

- API работает как systemd-сервис стенда и сам раздаёт фронтенд (`WEB_DIST_DIR`), перед ним — Caddy
  (HTTPS через Let's Encrypt, если есть домен).

```
/opt/balance-<stage>/
├── current -> releases/<sha>   # активный релиз
├── releases/                   # последние 3 релиза
└── shared/
    ├── .env                    # конфигурация, пишется при каждом деплое
    ├── data/balance.db         # SQLite
    └── backups/                # копия БД перед каждым релизом, последние 10
```

Релиз: остановка сервиса → бэкап БД → `prisma migrate deploy` → переключение `current` → запуск → проверка
`/api/config`. Если приложение не поднялось, `current` возвращается на прошлый релиз (миграции не
откатываются — при необходимости база восстанавливается из `shared/backups`).

## Конфигурация

Вся конфигурация стенда — переменные и секреты его окружения в GitHub (Settings → Environments). При
деплое все они, кроме служебных `DEPLOY_*`, попадают в `shared/.env` на сервере; имена — как в
`apps/api/.env.example`. Пустое значение выключает функцию. По умолчанию выставлены `APP_URL=https://<DEPLOY_HOST>`
и `NODE_ENV=production`; `PORT`, `DATABASE_URL` и `WEB_DIST_DIR` задаёт деплой. После изменения переменной
перезапустите Deploy.

| Имя                                                      | Тип        | Что это                                   |
| -------------------------------------------------------- | ---------- | ----------------------------------------- |
| `DEPLOY_HOST`                                            | переменная | домен или IP стенда (печатает `setup.sh`) |
| `DEPLOY_KNOWN_HOSTS`, `DEPLOY_SSH_KEY`                   | секреты    | доступ к серверу (печатает `setup.sh`)    |
| `DEFAULT_TIMEZONE`, `AI_API_URL`, `AI_MODEL`, …          | переменные | настройки приложения                      |
| `YANDEX_CLIENT_ID`, `YANDEX_CLIENT_SECRET`, `AI_API_KEY` | секреты    | ключи интеграций                          |

## Первичная настройка стенда

Нужен Ubuntu 22.04+ или Debian 12 (Prisma собирается под glibc + OpenSSL 3).

1. Направьте A-запись домена стенда на сервер, например `dev.lucerna-studio.ru`.
2. На сервере от root:
   ```bash
   curl -fsSLO https://raw.githubusercontent.com/IgorAlexeew/balance/develop/deploy/setup.sh
   STAGE=dev DOMAIN=dev.lucerna-studio.ru bash setup.sh   # прод: STAGE=prod DOMAIN=lucerna-studio.ru
   ```
   Скрипт ставит Node.js 22 и Caddy, создаёт пользователя `balance` (может только перезапускать сервисы),
   ключ для деплоя, каталоги стенда, systemd-юнит и сайт Caddy, а в конце печатает всё для GitHub.
3. В GitHub создайте окружение стенда (`dev` или `production`) и добавьте напечатанное: `DEPLOY_HOST`,
   `DEPLOY_KNOWN_HOSTS`, `DEPLOY_SSH_KEY`, плюс нужные настройки приложения.
4. Запустите Actions → Deploy → Run workflow из нужной ветки или запушьте в неё.

## Обслуживание

```bash
systemctl status balance-dev      # состояние
journalctl -u balance-dev -f      # логи
```

Откат на прошлую версию — перезапуск нужного прогона Deploy в GitHub Actions (Re-run jobs).
