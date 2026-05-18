# VPS Deployment Guide

Panduan deploy untuk Ubuntu/Debian VPS.

## 1. Install Dependency Server

```bash
sudo apt update
sudo apt install -y git curl build-essential python3 python3-pip ffmpeg mysql-server nginx
```

Install Node.js 20:

```bash
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs
```

Install PM2 dan yt-dlp:

```bash
sudo npm install -g pm2
python3 -m pip install -U yt-dlp --break-system-packages
```

Cek:

```bash
node -v
npm -v
ffmpeg -version
yt-dlp --version
```

## 2. Setup MySQL

Masuk MySQL:

```bash
sudo mysql
```

Jalankan:

```sql
CREATE DATABASE IF NOT EXISTS youtube_clipper_maker CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE USER IF NOT EXISTS 'clipper_user'@'localhost' IDENTIFIED BY 'strong_password';
GRANT ALL PRIVILEGES ON youtube_clipper_maker.* TO 'clipper_user'@'localhost';
FLUSH PRIVILEGES;
EXIT;
```

## 3. Upload Project

Contoh lokasi:

```bash
sudo mkdir -p /var/www/youtube-clipper-maker
sudo chown -R $USER:$USER /var/www/youtube-clipper-maker
```

Upload/copy isi project ke folder tersebut.

## 4. Environment

```bash
cd /var/www/youtube-clipper-maker
cp .env.production.example .env
nano .env
```

Isi minimal:

```env
DATABASE_URL="mysql://clipper_user:strong_password@127.0.0.1:3306/youtube_clipper_maker"
OPENAI_API_KEY="sk-your-key-here"
APP_ENCRYPTION_KEY="long-random-secret"
ADMIN_USERNAME="admin"
ADMIN_PASSWORD="strong-dashboard-password"
AUTH_SESSION_SECRET="another-long-random-secret"
PYTHON_EXE="python3"
YTDLP_EXE="yt-dlp"
FFMPEG_EXE="ffmpeg"
```

## 5. Install, Migrate, Build

```bash
npm ci
npx prisma generate
npx prisma migrate deploy
npm run prisma:seed
npm run build
```

## 6. Run Dengan PM2

```bash
pm2 start ecosystem.config.cjs
pm2 save
pm2 startup
```

Ikuti command yang ditampilkan oleh `pm2 startup`.

## 7. Nginx Reverse Proxy

Copy contoh config:

```bash
sudo cp deploy/nginx.conf.example /etc/nginx/sites-available/youtube-clipper-maker
sudo nano /etc/nginx/sites-available/youtube-clipper-maker
```

Ubah `server_name`.

Aktifkan:

```bash
sudo ln -s /etc/nginx/sites-available/youtube-clipper-maker /etc/nginx/sites-enabled/youtube-clipper-maker
sudo nginx -t
sudo systemctl reload nginx
```

## 8. SSL

```bash
sudo apt install -y certbot python3-certbot-nginx
sudo certbot --nginx -d your-domain.com -d www.your-domain.com
```

## 9. Update Deploy Berikutnya

```bash
cd /var/www/youtube-clipper-maker
git pull
npm ci
npx prisma migrate deploy
npx prisma generate
npm run build
pm2 restart youtube-clipper-maker
```
