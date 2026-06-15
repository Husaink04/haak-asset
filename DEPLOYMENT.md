# Deploy on Kali Linux with Docker

These commands deploy the app from GitHub to a Kali Linux server using Docker Compose.

## 1. Push this project to GitHub from Windows

```powershell
cd C:\Users\ADMIN\Desktop\Assest-Management
git init
git add .
git commit -m "Add Docker deployment"
git branch -M main
git remote add origin https://github.com/YOUR_GITHUB_USERNAME/YOUR_REPOSITORY_NAME.git
git push -u origin main
```

If GitHub asks for a password, use a GitHub personal access token instead of your account password.

## 2. Install Docker on Kali

```bash
sudo apt update
sudo apt install -y docker.io docker-compose-plugin git
sudo systemctl enable --now docker
sudo usermod -aG docker "$USER"
newgrp docker
```

## 3. Clone and configure the app on Kali

```bash
git clone https://github.com/YOUR_GITHUB_USERNAME/YOUR_REPOSITORY_NAME.git
cd YOUR_REPOSITORY_NAME
cp .env.production.example .env
nano .env
```

Set these values in `.env`:

```text
APP_PORT=4000
POSTGRES_PASSWORD=use-a-strong-postgres-password
JWT_SECRET=use-a-long-random-secret
VITE_API_URL=/api
PUBLIC_API_URL=http://YOUR_SERVER_IP:4000
PUBLIC_APP_URL=http://YOUR_SERVER_IP:4000
CORS_ORIGIN=http://YOUR_SERVER_IP:4000
```

For email notifications, also set SMTP values:

```text
SMTP_HOST=smtp.example.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=your-smtp-user
SMTP_PASS=your-smtp-password
MAIL_FROM="HAAK Asset Management <no-reply@yourdomain.com>"
```

Generate a strong JWT secret with:

```bash
openssl rand -hex 32
```

## 4. Start the app

```bash
docker compose up -d --build
docker compose ps
docker compose logs -f app
```

Open:

```text
http://YOUR_SERVER_IP:4000
```

## 5. Update after pushing new code

```bash
cd YOUR_REPOSITORY_NAME
git pull
docker compose up -d --build
```

## Useful commands

```bash
docker compose logs -f
docker compose restart app
docker compose down
docker compose down -v
```

`docker compose down -v` deletes the PostgreSQL database and uploads volume. Use it only when you intentionally want to wipe all app data.
