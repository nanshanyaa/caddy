# SFO Docker Deployment

This repository is the source of truth for the SFO K-Vault image hosting service.

Server layout:

- App checkout: `/opt/k-vault`
- Local secrets: `/opt/k-vault/.env` (never commit this file)
- Persistent runtime data: Docker volumes such as `k-vault_kvault_data`
- Public web port on SFO: `7648` via `WEB_PORT=7648`

First-time deployment:

```bash
git clone https://github.com/nanshanyaa/caddy.git /opt/k-vault
cd /opt/k-vault
cp .env.example .env
# edit .env, then start
sh scripts/deploy-update.sh
```

Routine update after GitHub changes:

```bash
cd /opt/k-vault
sh scripts/deploy-update.sh
```

The update script runs `git pull --ff-only` and then `docker compose up -d --build`. It keeps `.env` and Docker volumes on the server, so updating code does not erase runtime configuration or uploaded metadata.

If the script stops because the working tree has tracked local changes, inspect them first with:

```bash
git status --short
```

For a deployment-only server, the working tree should stay clean and all source edits should go through GitHub.
