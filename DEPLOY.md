# Deployment Guide

**Stack:** Docker Compose (mysql + backend + frontend) + aaPanel/OpenLiteSpeed (domain + SSL only)
**Strategy:** Push to `master` on GitHub → GitHub Actions SSHes into the VPS → `git pull` + `docker compose build/up`

## Architecture

```mermaid
flowchart TD
    Dev[Developer] -->|git push origin master| GH[GitHub Repo]
    GH -->|triggers on push to master| GA[GitHub Actions]
    GA -->|SSH: git pull + docker compose build/up| VPSHost

    Browser[Browser] -->|https://audit.quickyx.xyz| OLS

    subgraph VPSHost["VPS — aaPanel, Ubuntu 20"]
        OLS["aaPanel OpenLiteSpeed<br/>domain + Let's Encrypt SSL"]

        subgraph DockerNet["docker-compose.prod.yml network"]
            FE["frontend container<br/>nginx:alpine · 127.0.0.1:8080→80<br/>serves dist/, proxies /api/*"]
            BE["backend container<br/>node:20-slim · :3001<br/>(internal only, not published)"]
            DB[("mysql container<br/>mysql:8.4<br/>(internal only, not published)")]
        end

        OLS -->|reverse proxy| FE
        FE -->|/api/*| BE
        BE --> DB
    end
```

Only `aaPanel OpenLiteSpeed` is exposed to the internet (for the domain + free SSL). Everything else — frontend, backend, MySQL — runs inside a private Docker network and is never reachable directly from outside the VPS.

---

## 1. One-Time VPS Setup

### A. Install Docker

In aaPanel → **App Store**, search **Docker** and install the "Docker Manager" plugin. This installs Docker Engine + the `docker compose` plugin on Ubuntu 20.

Verify via SSH:

```bash
docker --version
docker compose version
```

### B. Clone the Repository

```bash
mkdir -p /var/www
git clone https://github.com/qtopup-dev/sales-auditor.git /var/www/alejinput
cd /var/www/alejinput
```

If the repo is private, either use a GitHub [deploy key](https://docs.github.com/en/authentication/connecting-to-github-with-ssh/managing-deploy-keys) added read-only to this repo, or a personal access token in the clone URL.

### C. Create the Production `.env`

```bash
nano /var/www/alejinput/.env
```

```env
# MySQL — must match the docker-compose.prod.yml service name ("mysql"), not localhost
DB_HOST=mysql
DB_PORT=3306
DB_USER=alejinput
DB_PASSWORD=STRONG_PASSWORD_HERE
DB_NAME=alejinput_db

# Used by mysql:8.4's own bootstrap AND by mysqladmin in the healthcheck
DB_ROOT_PASSWORD=DIFFERENT_STRONG_PASSWORD_HERE

# Used by Prisma CLI (generate / migrate) — host must also be "mysql"
DATABASE_URL="mysql://alejinput:STRONG_PASSWORD_HERE@mysql:3306/alejinput_db?timezone=UTC"

PORT=3001
NODE_ENV=production

# Generate with: openssl rand -hex 32
SESSION_SECRET=replace_with_64_char_hex_string

CLIENT_ORIGIN=https://audit.quickyx.xyz
```

This file is `.gitignore`d and never leaves the VPS. `docker-compose.prod.yml` loads it via `env_file`, and the official `mysql:8.4` image auto-creates the `alejinput_db` database and `alejinput` user from `MYSQL_DATABASE` / `MYSQL_USER` / `MYSQL_PASSWORD` on first boot — no manual `CREATE DATABASE` step needed.

### D. Add the Deploy SSH Key

Generate a dedicated keypair for CI (don't reuse your personal key):

```bash
ssh-keygen -t ed25519 -f ~/.ssh/gh_deploy -N ""
cat ~/.ssh/gh_deploy.pub >> ~/.ssh/authorized_keys
cat ~/.ssh/gh_deploy   # copy this private key into a GitHub secret next
```

In the GitHub repo → **Settings → Secrets and variables → Actions**, add:

| Secret | Value |
|---|---|
| `VPS_HOST` | VPS IP address |
| `VPS_USER` | SSH user (e.g. `root`) |
| `VPS_SSH_KEY` | contents of `~/.ssh/gh_deploy` (private key) |
| `VPS_PORT` | SSH port (usually `22`) |

The workflow is already committed at `.github/workflows/deploy.yml` — it triggers on every push to `master`.

### E. First Manual Deploy

Run the stack once by hand to confirm everything boots before handing off to CI:

```bash
cd /var/www/alejinput
docker compose -f docker-compose.prod.yml build
docker compose -f docker-compose.prod.yml run --rm backend npx prisma migrate deploy
docker compose -f docker-compose.prod.yml up -d
docker compose -f docker-compose.prod.yml ps
```

Seed the database (first time only):

```bash
docker compose -f docker-compose.prod.yml run --rm backend npx prisma db seed
```

### F. aaPanel — Reverse Proxy + SSL

In aaPanel → **Website** → **Add Site**:
- Domain: `audit.quickyx.xyz`
- No document root needed — this site is proxy-only, Docker serves the actual content.

**Reverse Proxy** (Website → your domain → **Reverse Proxy** → Add):
| Field | Value |
|---|---|
| Proxy name | `docker` |
| Target URL | `http://127.0.0.1:8080` |
| Proxy directory | `/` |

**SSL**: Website → your domain → **SSL** → Let's Encrypt → one-click issue (after DNS points at the VPS).

---

## 2. Subsequent Deploys

```bash
git push origin master
```

GitHub Actions takes it from there: SSH in → `git reset --hard origin/master` → rebuild images → run pending migrations → `up -d` → prune old images. No manual SSH required. Watch progress under the repo's **Actions** tab.

---

## 3. Useful Commands on the Server

```bash
cd /var/www/alejinput

# Container status
docker compose -f docker-compose.prod.yml ps

# Live logs
docker compose -f docker-compose.prod.yml logs -f backend
docker compose -f docker-compose.prod.yml logs -f frontend
docker compose -f docker-compose.prod.yml logs -f mysql

# Restart a single service
docker compose -f docker-compose.prod.yml restart backend

# Run a migration manually
docker compose -f docker-compose.prod.yml run --rm backend npx prisma migrate deploy

# Open a MySQL shell
docker compose -f docker-compose.prod.yml exec mysql mysql -u root -p

# Full rebuild + restart (equivalent to what CI does)
docker compose -f docker-compose.prod.yml build
docker compose -f docker-compose.prod.yml up -d --remove-orphans
```

---

## Rollback

```bash
git revert <bad-commit>
git push origin master   # re-triggers the same pipeline
```

Or, if the previous images are still on disk (i.e. `docker image prune` hasn't run since), SSH in and check out the prior commit, then `docker compose -f docker-compose.prod.yml up -d` without rebuilding.

---

## Files Added to the Project

| File | Purpose |
|---|---|
| `packages/backend/Dockerfile` | Builds the backend (tsc + `prisma generate`) into a `node:20-slim` runtime image |
| `packages/frontend/Dockerfile` | Multi-stage: builds the Vite app, serves it from `nginx:alpine` |
| `packages/frontend/nginx.conf` | SPA fallback + `/api/*` reverse proxy to the backend container |
| `docker-compose.prod.yml` | Production stack: mysql + backend + frontend on a private network |
| `.dockerignore` | Keeps `node_modules`, `.git`, `.env`, build output out of build contexts |
| `.github/workflows/deploy.yml` | CI: SSH into the VPS and redeploy on every push to `master` |

`docker-compose.yml` (root, mysql-only) is unchanged and still used for **local development** — `docker-compose.prod.yml` is a separate file for the VPS.
