#!/usr/bin/env bash
# Выкатывает загруженный бандл /tmp/<app>-<sha>.tgz в стенд /opt/<app>. Запускается на сервере из GitHub Actions.
# Порядок: распаковка → остановка → бэкап БД → миграции → переключение current → запуск → проверка.
set -euo pipefail

APP=$1
SHA=$2
ROOT=/opt/$APP
DIR=$ROOT/releases/$SHA
ARCHIVE=/tmp/$APP-$SHA.tgz
KEEP=3

mkdir -p "$DIR"
tar -xzf "$ARCHIVE" -C "$DIR"
touch "$DIR" # tar ставит каталогу время сборки, а очистка ниже сортирует по mtime
rm -f "$ARCHIVE"

# .env пишет деплой; отсюда нужны только БД и порт (не source: значения могут быть без кавычек)
env_get() { grep "^$1=" "$ROOT/shared/.env" | tail -n 1 | cut -d= -f2-; }
export DATABASE_URL
DATABASE_URL=$(env_get DATABASE_URL)
PORT=$(env_get PORT)

PREV=$(readlink -f "$ROOT/current" || true)
DB=${DATABASE_URL#file:}

sudo systemctl stop "$APP"
if [ -f "$DB" ]; then
  mkdir -p "$ROOT/shared/backups"
  cp "$DB" "$ROOT/shared/backups/$(date +%Y%m%d-%H%M%S)-${SHA:0:7}.db"
fi
(cd "$DIR" && node_modules/.bin/prisma migrate deploy)
ln -sfn "$DIR" "$ROOT/current"
sudo systemctl start "$APP"

for _ in $(seq 20); do
  if curl -fsS "http://127.0.0.1:${PORT:-3001}/api/config" > /dev/null; then
    echo "Released $SHA"
    # Чистим старые релизы и бэкапы
    ls -1dt "$ROOT"/releases/* | tail -n +$((KEEP + 1)) | xargs -r rm -rf
    ls -1t "$ROOT"/shared/backups/*.db 2> /dev/null | tail -n +11 | xargs -r rm -f
    exit 0
  fi
  sleep 1
done

echo "Health check failed, rolling back to $PREV" >&2
journalctl -u "$APP" -n 50 --no-pager >&2 || true
if [ -n "$PREV" ] && [ "$PREV" != "$DIR" ]; then
  ln -sfn "$PREV" "$ROOT/current"
  sudo systemctl restart "$APP"
  rm -rf "$DIR"
fi
exit 1
