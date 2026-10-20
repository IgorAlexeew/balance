# Деплой

Схема для одного небольшого VPS без Docker:

- **CI** (`.github/workflows/ci.yml`) — prettier, lint, typecheck, тесты и сборка на каждый PR и push.
- **Deploy** (`.github/workflows/deploy.yml`) — после зелёного CI в `master` (или вручную) собирает
  самодостаточный бандл (API с prod-зависимостями + сборка фронтенда), копирует его на сервер по SSH и
  запускает `deploy/release.sh`. Сервер ничего не собирает, ему нужен только Node.js.
- На сервере API работает как systemd-сервис `balance` и сам раздаёт фронтенд (`WEB_DIST_DIR`), перед ним —
  Caddy (HTTPS через Let's Encrypt, если есть домен).

```
/opt/balance/
├── current -> releases/<sha>   # активный релиз
├── releases/                   # последние 3 релиза
└── shared/
    ├── .env                    # конфигурация (см. apps/api/.env.example)
    ├── data/balance.db         # SQLite
    └── backups/                # копия БД перед каждым релизом, последние 10
```

Релиз: остановка сервиса → бэкап БД → `prisma migrate deploy` → переключение `current` → запуск → проверка
`/api/config`. Если приложение не поднялось, `current` возвращается на прошлый релиз (миграции не
откатываются — при необходимости база восстанавливается из `shared/backups`).

## Первичная настройка

Нужен Ubuntu 22.04+ или Debian 12 (Prisma собирается под glibc + OpenSSL 3).

1. Локально создайте ключ для деплоя: `ssh-keygen -t ed25519 -N '' -f balance_deploy`.
2. Если есть домен, направьте его A-запись на сервер.
3. На сервере от root:
   ```bash
   curl -fsSLO https://raw.githubusercontent.com/IgorAlexeew/balance/master/deploy/setup.sh
   DOMAIN=lucerna-studio.ru DEPLOY_PUBKEY="$(cat balance_deploy.pub)" bash setup.sh   # без домена: не задавайте DOMAIN
   ```
   Скрипт ставит Node.js 22 и Caddy, создаёт пользователя `balance` (может только перезапускать сервис),
   каталоги, `shared/.env`, systemd-юнит и конфиг Caddy, а в конце печатает строку для `DEPLOY_KNOWN_HOSTS`.
4. Заполните `/opt/balance/shared/.env` (Яндекс ID, ИИ) — `APP_URL` уже выставлен по домену или IP.
5. В GitHub → Settings → Environments создайте окружение `production` и добавьте:
   - секрет `DEPLOY_SSH_KEY` — содержимое приватного `balance_deploy`;
   - секрет `DEPLOY_KNOWN_HOSTS` — строка из шага 3;
   - переменную `DEPLOY_HOST` — домен или IP сервера (тот же, что в `DEPLOY_KNOWN_HOSTS`).
6. Запустите Actions → Deploy → Run workflow или влейте изменения в `master`.

## Обслуживание

```bash
systemctl status balance          # состояние
journalctl -u balance -f          # логи
sudo -u balance nano /opt/balance/shared/.env && systemctl restart balance   # смена настроек
```

Откат на прошлую версию — перезапуск нужного прогона Deploy в GitHub Actions (Re-run jobs).
