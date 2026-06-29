# Deployment Guide

**Stack:** aaPanel + OpenLiteSpeed 1.8.2 + MySQL 8.0.24 + PM2  
**Strategy:** Git push to bare repo on VPS → `post-receive` hook builds and restarts

## Architecture

```
Browser
  └── OpenLiteSpeed (yourdomain.com)
        ├── /* → serves packages/frontend/dist/ (static)
        └── /api/* → reverse proxy → Node.js :3001 (PM2)
                                          └── MySQL :3306
```

---

## 1. Server Prerequisites

SSH into the VPS and run:

```bash
# Install NVM + Node.js 20 LTS
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.7/install.sh | bash
source ~/.bashrc
nvm install 20
nvm use 20
nvm alias default 20

# Install PM2 globally
npm install -g pm2

# Enable PM2 to start on reboot
pm2 startup   # run the printed command, then:
pm2 save
```

---

## 2. Create the MySQL Database

```bash
mysql -u root -p
```

```sql
CREATE DATABASE alejinput_db CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE USER 'alejinput'@'localhost' IDENTIFIED BY 'STRONG_PASSWORD_HERE';
GRANT ALL PRIVILEGES ON alejinput_db.* TO 'alejinput'@'localhost';
FLUSH PRIVILEGES;
EXIT;
```

---

## 3. Create the Work Directory and `.env`

```bash
mkdir -p /var/www/alejinput
nano /var/www/alejinput/.env
```

Paste and fill in real values:

```env
DB_HOST=localhost
DB_PORT=3306
DB_USER=alejinput
DB_PASSWORD=STRONG_PASSWORD_HERE
DB_NAME=alejinput_db

# Used by Prisma CLI for migrations
DATABASE_URL="mysql://alejinput:STRONG_PASSWORD_HERE@localhost:3306/alejinput_db?timezone=UTC"

PORT=3001
NODE_ENV=production

# Generate with: openssl rand -hex 32
SESSION_SECRET=replace_with_64_char_hex_string

CLIENT_ORIGIN=https://yourdomain.com
```

---

## 4. Set Up the Bare Git Repo and Hook

```bash
mkdir -p /var/repo/alejinput.git
git init --bare /var/repo/alejinput.git
```

Install the hook (copy contents of `scripts/post-receive`):

```bash
nano /var/repo/alejinput.git/hooks/post-receive
# paste contents of scripts/post-receive, save
chmod +x /var/repo/alejinput.git/hooks/post-receive
```

---

## 5. Push from Local Machine

```bash
git remote add prod root@YOUR_VPS_IP:/var/repo/alejinput.git
git push prod master
```

The hook runs automatically and:
1. Checks out code to `/var/www/alejinput`
2. `npm ci` (all deps including devDeps needed for build)
3. `prisma generate` (regenerates gitignored client)
4. `npm run build` (tsc + vite)
5. `prisma migrate deploy` (applies pending migrations)
6. PM2 reload

First push takes 2–3 minutes.

---

## 6. OpenLiteSpeed Configuration (via aaPanel)

### A. Create the Website

In aaPanel → **Website** → **Add Site**:
- Domain: `yourdomain.com`
- Document root: `/var/www/alejinput/packages/frontend/dist`

### B. SPA Rewrite Rules

In aaPanel → Website → your domain → **Configuration** → **Rewrite**, paste:

```
RewriteEngine On
RewriteBase /
RewriteRule ^index\.html$ - [L]
RewriteCond %{REQUEST_FILENAME} !-f
RewriteCond %{REQUEST_FILENAME} !-d
RewriteRule . /index.html [L]
```

### C. Reverse Proxy for `/api`

**Option 1 — aaPanel UI** (Website → your domain → **Reverse Proxy** → Add):
| Field | Value |
|---|---|
| Proxy name | `api` |
| Target URL | `http://127.0.0.1:3001` |
| Proxy directory | `/api/` |

**Option 2 — OLS WebAdmin** (`https://YOUR_IP:7080`):  
Virtual Hosts → your domain → **Context** → Add → Type: **Proxy**
- URI: `/api/`
- Web Server Address: `http://127.0.0.1:3001`

### D. SSL

aaPanel → Website → your domain → **SSL** → Let's Encrypt → one-click issue.  
Do this after DNS is pointed at the VPS.

---

## 7. Subsequent Deploys

```bash
git push prod master
```

The hook handles everything — no SSH required.

---

## Useful Commands on the Server

```bash
# Check API process status
pm2 status

# View live logs
pm2 logs alejinput-api

# Restart manually
pm2 restart alejinput-api

# Run a migration manually
cd /var/www/alejinput/packages/backend
npx prisma migrate deploy

# Seed the database (first time only)
cd /var/www/alejinput
npm run db:seed
```

---

## Files Added to the Project

| File | Purpose |
|---|---|
| `ecosystem.config.cjs` | PM2 process definition |
| `scripts/post-receive` | Git hook — copy to `/var/repo/alejinput.git/hooks/` on VPS |
