#!/usr/bin/env bash
# Разовая подготовка стенда на VPS (Ubuntu 22.04+/Debian 12) под деплой из GitHub Actions. Запуск от root:
#   STAGE=dev DOMAIN=dev.lucerna-studio.ru bash setup.sh
# STAGE — dev (ветка develop) или prod (ветка master); стенды живут на одном сервере независимо.
# DOMAIN — домен, смотрящий на сервер (Caddy сам получит HTTPS); без него сайт будет на http://<IP>.
set -euo pipefail

STAGE=${STAGE:-dev}
case $STAGE in
  dev) PORT=3002 ;;
  prod) PORT=3001 ;;
  *) echo "STAGE должен быть dev или prod" >&2 && exit 1 ;;
esac
APP=balance-$STAGE
SITE=${DOMAIN:-:80}
ROOT=/opt/$APP
IP=$(hostname -I | awk '{print $1}')

# Node.js 22 и Caddy из официальных репозиториев
apt-get update
apt-get install -y curl ca-certificates gnupg openssh-client debian-keyring debian-archive-keyring apt-transport-https
curl -fsSL https://deb.nodesource.com/setup_22.x | bash -
curl -1sLf https://dl.cloudsmith.io/public/caddy/stable/gpg.key | gpg --dearmor --yes -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
curl -1sLf https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt > /etc/apt/sources.list.d/caddy-stable.list
apt-get update
apt-get install -y nodejs caddy

# Пользователь деплоя: может только перезапускать сервисы приложения
id balance &> /dev/null || useradd --system --create-home --shell /bin/bash balance
usermod -aG systemd-journal balance
install -d -m 700 -o balance -g balance /home/balance/.ssh
# Ключ стенда для GitHub Actions: публичная часть остаётся здесь, приватная печатается в конце для секрета
KEY=$(mktemp -u)
ssh-keygen -q -t ed25519 -N '' -C "$APP-deploy" -f "$KEY"
AUTH=/home/balance/.ssh/authorized_keys
touch $AUTH && sed -i "/ $APP-deploy\$/d" $AUTH && cat "$KEY.pub" >> $AUTH && rm -f "$KEY.pub"
chown balance:balance $AUTH && chmod 600 $AUTH
cat > /etc/sudoers.d/$APP << EOF
balance ALL=(root) NOPASSWD: /usr/bin/systemctl start $APP, /usr/bin/systemctl stop $APP, /usr/bin/systemctl restart $APP
EOF
chmod 440 /etc/sudoers.d/$APP

install -d -o balance -g balance $ROOT $ROOT/releases $ROOT/shared $ROOT/shared/data

cat > /etc/systemd/system/$APP.service << EOF
[Unit]
Description=Balance ($STAGE)
After=network.target

[Service]
User=balance
WorkingDirectory=$ROOT/current
# Конфигурацию пишет деплой из переменных и секретов окружения GitHub
EnvironmentFile=$ROOT/shared/.env
ExecStart=/usr/bin/node --max-old-space-size=256 dist/main.js
Restart=always
RestartSec=3

[Install]
WantedBy=multi-user.target
EOF
systemctl daemon-reload
systemctl enable $APP

# У каждого стенда свой файл сайта
install -d /etc/caddy/sites
echo "import /etc/caddy/sites/*.caddy" > /etc/caddy/Caddyfile
cat > /etc/caddy/sites/$APP.caddy << EOF
$SITE {
	encode zstd gzip
	reverse_proxy 127.0.0.1:$PORT
}
EOF
# www.<домен> → <домен>, если у www есть DNS-запись
if [ -n "${DOMAIN:-}" ] && getent hosts "www.$DOMAIN" > /dev/null; then
  cat >> /etc/caddy/sites/$APP.caddy << EOF

www.$DOMAIN {
	redir https://$DOMAIN{uri} permanent
}
EOF
fi
systemctl reload caddy

echo
echo "Готово. Добавьте в GitHub (Settings → Environments → $([ $STAGE = prod ] && echo production || echo dev)):"
echo
echo "Переменная DEPLOY_HOST: ${DOMAIN:-$IP}"
echo
echo "Секрет DEPLOY_KNOWN_HOSTS:"
ssh-keyscan -t ed25519 localhost 2> /dev/null | sed "s/^localhost/${DOMAIN:-$IP}/"
echo
echo "Секрет DEPLOY_SSH_KEY (все строки, включая BEGIN/END):"
cat "$KEY"
rm -f "$KEY"
