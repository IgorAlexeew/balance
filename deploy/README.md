# Деплой

Схема для одного небольшого VPS без Docker:

- **CI** (`.github/workflows/ci.yml`) — prettier, lint, typecheck, тесты и сборка на каждый PR и push.
- **Deploy** (job `deploy` там же) — после зелёных проверок на push в `develop`/`master` собирает самодостаточный бандл
  (API с prod-зависимостями + сборка фронтенда), копирует его на сервер по SSH и запускает `deploy/release.sh`.
  Сервер ничего не собирает, ему нужен только Node.js.
- Стенды независимы и живут на одном сервере:

  | Ветка     | Окружение GitHub | Стенд          | Порт |
  | --------- | ---------------- | -------------- | ---- |
  | `develop` | `develop`        | `balance-dev`  | 3002 |
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

Вся конфигурация стенда — в его окружении GitHub (Settings → Environments). При деплое все **переменные**
окружения, кроме служебных `DEPLOY_*`, и секреты `YANDEX_CLIENT_SECRET`, `AI_API_KEY` попадают в `shared/.env`
на сервере; имена — как в `apps/api/.env.example`. Пустое значение выключает функцию. По умолчанию
`APP_URL=https://<DEPLOY_HOST>` (можно переопределить переменной); `NODE_ENV`, `PORT`, `DATABASE_URL` и
`WEB_DIST_DIR` задаёт деплой. Новый секретный ключ нужно один раз добавить в `ci.yml` по имени (GitHub
блокирует workflow, передающий все секреты разом). После изменения настроек перезапустите деплой.

| Имя                                                                 | Тип        | Что это                                   |
| ------------------------------------------------------------------- | ---------- | ----------------------------------------- |
| `DEPLOY_HOST`                                                       | переменная | домен или IP стенда (печатает `setup.sh`) |
| `DEPLOY_KNOWN_HOSTS`, `DEPLOY_SSH_KEY`                              | секреты    | доступ к серверу (печатает `setup.sh`)    |
| `DEFAULT_TIMEZONE`, `YANDEX_CLIENT_ID`, `AI_API_URL`, `AI_MODEL`, … | переменные | настройки приложения                      |
| `YANDEX_CLIENT_SECRET`, `AI_API_KEY`                                | секреты    | ключи интеграций                          |

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
3. В GitHub создайте окружение стенда (`develop` или `production`) и добавьте напечатанное: `DEPLOY_HOST`,
   `DEPLOY_KNOWN_HOSTS`, `DEPLOY_SSH_KEY`, плюс нужные настройки приложения.
4. Запушьте в ветку стенда (или перезапустите её последний прогон CI в Actions).

## Обслуживание

```bash
systemctl status balance-dev      # состояние
journalctl -u balance-dev -f      # логи
```

Откат на прошлую версию — перезапуск job `deploy` нужного прогона CI в GitHub Actions (Re-run jobs).
