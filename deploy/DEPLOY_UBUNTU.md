# NeXaos deploy on Ubuntu (Nginx + systemd)

## 0) Assumptions
- Server IP: `130.49.148.245`
- App path:
  - `/var/www/nexaos/front` (Vite build output in `/var/www/nexaos/front/dist`)
  - `/var/www/nexaos/backend`
- Backend listens on `127.0.0.1:5000` (not exposed)
- Nginx serves front and proxies `/api` + `/uploads`.

## 1) Install packages
```bash
sudo apt update
sudo apt install -y nginx nodejs npm postgresql
```

## 1.1) Create service user
```bash
sudo useradd -r -m -d /var/www/nexaos -s /usr/sbin/nologin nexaos || true
```

## 2) Prepare folders
```bash
sudo mkdir -p /var/www/nexaos
sudo chown -R $USER:$USER /var/www/nexaos
```

After upload/build, give backend user access to uploads:
```bash
sudo mkdir -p /var/www/nexaos/backend/src/public/uploads
sudo chown -R nexaos:nexaos /var/www/nexaos/backend/src/public/uploads
```

## 3) Upload code
Upload repo to `/var/www/nexaos` (scp/rsync/git clone).

## 3.1) PostgreSQL database
Create DB + user (пример):
```bash
sudo -u postgres psql
```
```sql
CREATE USER nexaos WITH PASSWORD 'change_me';
CREATE DATABASE nexaos OWNER nexaos;
GRANT ALL PRIVILEGES ON DATABASE nexaos TO nexaos;
\q
```

## 4) Backend env
Create `/etc/nexaos/backend.env`:
```bash
sudo mkdir -p /etc/nexaos
sudo nano /etc/nexaos/backend.env
```
Use `deploy/backend.env.example` as template.

## 5) Install backend deps
```bash
cd /var/www/nexaos/backend
npm ci
```

Node version note:
- Prefer Node 18+ (LTS). If your ubuntu repo ships older node, install via NodeSource.

## 6) systemd service
Copy service:
```bash
sudo cp /var/www/nexaos/deploy/nexaos-backend.service /etc/systemd/system/nexaos-backend.service
sudo systemctl daemon-reload
sudo systemctl enable nexaos-backend
sudo systemctl start nexaos-backend
sudo systemctl status nexaos-backend --no-pager
```
Logs:
```bash
sudo journalctl -u nexaos-backend -f
```

If you change `/etc/nexaos/backend.env`, restart backend:
```bash
sudo systemctl restart nexaos-backend
```

## 7) Build frontend
```bash
cd /var/www/nexaos/front
npm ci
npm run build
```

## 8) Nginx
```bash
sudo cp /var/www/nexaos/deploy/nginx-nexaos.conf /etc/nginx/sites-available/nexaos
sudo ln -sf /etc/nginx/sites-available/nexaos /etc/nginx/sites-enabled/nexaos
sudo nginx -t
sudo systemctl reload nginx
```

Notes:
- Backend port `5000` is **not** exposed publicly (nginx proxies to `127.0.0.1:5000`).
- Frontend is served from `/var/www/nexaos/front/dist`.

## 9) Firewall
Open only 80/443:
```bash
sudo ufw allow 80
sudo ufw allow 443
sudo ufw enable
```

## 10) HTTPS (recommended)
If you have a domain, use certbot. With only IP you can still run HTTP.

---

## Notes
- Front uses `/api` in production (no localhost hardcode).
- Images are served via `/uploads/*`.
- DB migrations run automatically at backend start.
