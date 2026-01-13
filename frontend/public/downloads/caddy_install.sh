#!/bin/bash
API_URL=$2
CUSTOM_NAME=${3:-$(hostname)}
PUBLIC_IP=$(curl -s https://api.ipify.org || curl -s https://ifconfig.me || echo "")
if [ -z "$API_URL" ]; then API_URL=$1; fi
if ! command -v caddy &> /dev/null; then
    apt update && apt install -y debian-keyring debian-archive-keyring apt-transport-https curl
    curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' | gpg --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
    curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt' | tee /etc/apt/sources.list.d/caddy-stable.list
    apt update && apt install caddy -y
fi
cat > /etc/caddy/Caddyfile <<CADDY
{
    admin :2019 {
        origins *
    }
}
:80 {
    respond "Caddy Node managed by CaddyHub (V14)"
}
CADDY
systemctl reload caddy 2>/dev/null || systemctl restart caddy 2>/dev/null || service caddy restart 2>/dev/null || true
NAME=$CUSTOM_NAME
TARGET_URL=$(echo $API_URL | sed 's|/api$||')/api/servers/register
payload="{\"name\": \"$NAME\""
if [ -n "$PUBLIC_IP" ]; then
  payload="$payload, \"ip\": \"$PUBLIC_IP\", \"public_ip\": \"$PUBLIC_IP\""
fi
payload="$payload}"
curl -X POST -H "Content-Type: application/json" -d "$payload" "$TARGET_URL"
echo "✅ Node Registered!"
