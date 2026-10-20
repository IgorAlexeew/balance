#!/usr/bin/env bash
# Разовая подготовка VPS (Ubuntu 22.04+/Debian 12) под деплой из GitHub Actions. Запуск от root:
#   DOMAIN=lucerna-studio.ru bash setup.sh
# DOMAIN — домен, смотрящий на сервер (Caddy сам получит HTTPS); без него сайт будет на http://<IP>.
set -euo pipefail

SITE=${DOMAIN:-:80}
ROOT=/opt/balance
IP=$(hostname -I | awk '{print $1}')

# Node.js 22 и Caddy из официальных репозиториев
apt-get update
apt-get install -y curl ca-certificates gnupg openssh-client debian-keyring debian-archive-keyring apt-transport-https
curl -fsSL https://deb.nodesource.com/setup_22.x | bash -
curl -1sLf https://dl.cloudsmith.io/public/caddy/stable/gpg.key | gpg --dearmor --yes -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
curl -1sLf https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt > /etc/apt/sources.list.d/caddy-stable.list
apt-get update
apt-get install -y nodejs caddy

# Пользователь деплоя: может только перезапускать сервис приложения
id balance &> /dev/null || useradd --system --create-home --shell /bin/bash balance
usermod -aG systemd-journal balance
install -d -m 700 -o balance -g balance /home/balance/.ssh
# Ключ для GitHub Actions: публичная часть остаётся здесь, приватная печатается в конце для секрета
KEY=$(mktemp -u)
ssh-keygen -q -t ed25519 -N '' -C balance-deploy -f "$KEY"
mv "$KEY.pub" /home/balance/.ssh/authorized_keys
chown balance:balance /home/balance/.ssh/authorized_keys && chmod 600 /home/balance/.ssh/authorized_keys
cat > /etc/sudoers.d/balance << 'EOF'
balance ALL=(root) NOPASSWD: /usr/bin/systemctl start balance, /usr/bin/systemctl stop balance, /usr/bin/systemctl restart balance
EOF
chmod 440 /etc/sudoers.d/balance

install -d -o balance -g balance $ROOT $ROOT/releases $ROOT/shared $ROOT/shared/data
if [ ! -f $ROOT/shared/.env ]; then
  APP_URL=$([ -n "${DOMAIN:-}" ] && echo "https://$DOMAIN" || echo "http://$IP")
  cat > $ROOT/shared/.env << EOF
NODE_ENV=production
PORT=3001
APP_URL=$APP_URL
DATABASE_URL=file:$ROOT/shared/data/balance.db
WEB_DIST_DIR=web
DEFAULT_TIMEZONE=Europe/Moscow
EOF
  chown balance:balance $ROOT/shared/.env && chmod 600 $ROOT/shared/.env
fi

cat > /etc/systemd/system/balance.service << EOF
[Unit]
Description=Balance API
After=network.target

[Service]
User=balance
WorkingDirectory=$ROOT/current
EnvironmentFile=$ROOT/shared/.env
# Ключи интеграций (Яндекс ID, ИИ) — пишет деплой из секретов GitHub
EnvironmentFile=-$ROOT/shared/secrets.env
ExecStart=/usr/bin/node --max-old-space-size=256 dist/main.js
Restart=always
RestartSec=3

[Install]
WantedBy=multi-user.target
EOF
systemctl daemon-reload
systemctl enable balance

cat > /etc/caddy/Caddyfile << EOF
$SITE {
	encode zstd gzip
	reverse_proxy 127.0.0.1:3001
}
EOF
# www.<домен> → <домен>, если у www есть DNS-запись
if [ -n "${DOMAIN:-}" ] && getent hosts "www.$DOMAIN" > /dev/null; then
  cat >> /etc/caddy/Caddyfile << EOF

www.$DOMAIN {
	redir https://$DOMAIN{uri} permanent
}
EOF
fi
systemctl reload caddy

echo
echo "Готово. Добавьте в GitHub (Settings → Environments → production):"
echo
echo "Переменная DEPLOY_HOST: ${DOMAIN:-$IP}"
echo
echo "Секрет DEPLOY_KNOWN_HOSTS:"
ssh-keyscan -t ed25519 localhost 2> /dev/null | sed "s/^localhost/${DOMAIN:-$IP}/"
echo
echo "Секрет DEPLOY_SSH_KEY (все строки, включая BEGIN/END):"
cat "$KEY"
rm -f "$KEY"
