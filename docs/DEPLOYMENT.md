# Deployment & Local Development

Two applications share one public domain:

| Path on the domain | Served by |
|---|---|
| `/api/*`, `/sanctum/*`, `/storage/*` | Laravel (`api/`) via PHP-FPM |
| everything else | Next.js (`project/`) via `next start` |

Serving both from the **same origin** is what makes Sanctum cookie sessions and CSRF protection work without CORS. Do not put the API on a different domain unless you also reconfigure Sanctum, cookies and CORS.

## Requirements

- Ubuntu 22.04/24.04
- PHP 8.3+ with `pdo_mysql`, `mbstring`, `xml`, `curl`, `zip`, `gd` (with JPEG/PNG/WebP), `intl`, `fileinfo`, `exif` (recommended — keeps photo orientation)
- Composer 2.x
- Node.js 20 or 22 LTS, npm 10
- MySQL 8.0
- Nginx, Certbot

## Local development

### 1. Database

Any MySQL 8. The development setup used during the build is a Docker container:

```bash
docker run -d --name jalaram-mysql -p 127.0.0.1:3307:3306 \
  -e MYSQL_ROOT_PASSWORD=change-me -e MYSQL_DATABASE=jalaram \
  -e MYSQL_USER=jalaram -e MYSQL_PASSWORD=change-me \
  -v jalaram-mysql-data:/var/lib/mysql mysql:8.0 \
  --character-set-server=utf8mb4 --collation-server=utf8mb4_unicode_ci

# Separate database for automated tests
docker exec jalaram-mysql mysql -uroot -pchange-me -e \
  "CREATE DATABASE jalaram_test CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci; GRANT ALL ON jalaram_test.* TO 'jalaram'@'%';"
```

### 2. API

```bash
cd api
composer install
cp .env.example .env            # set DB_* (port 3307 for the container above)
php artisan key:generate
php artisan migrate --seed      # reference data + demo data (demo only when APP_ENV=local)
php artisan storage:link
php artisan serve --port=8000
```

Demo accounts (local only, password `Password123`): `admin@jalaram.test`, `lead@jalaram.test` (team member with all permissions), `team@jalaram.test`, `owner@jalaram.test`, `owner2@jalaram.test`.

To start over: `php artisan migrate:fresh --seed` (**deletes all data in that database**).

### 3. Website

```bash
cd project
npm install
cp .env.example .env.local      # defaults point at http://127.0.0.1:8000
npm run dev                     # http://localhost:3000
```

In development, `next.config.js` proxies `/api`, `/sanctum` and `/storage` to `API_PROXY_TARGET`.

`project/.env` is left over from the Bolt/Supabase version. The app no longer uses those keys, so you can delete the file.

### 4. Checks

```bash
cd api && php artisan test                 # 51 feature/unit tests, uses jalaram_test
cd project && npm run typecheck && npm run lint && npm test && npm run build
```

`NEXT_DIST_DIR=.next-build npm run build` builds into a separate folder, so it doesn't disturb a running `npm run dev`.

## Production

### Environment — `api/.env`

```
APP_ENV=production
APP_DEBUG=false
APP_URL=https://www.your-domain.example
FRONTEND_URL=https://www.your-domain.example
APP_TIMEZONE=Asia/Kolkata

DB_CONNECTION=mysql
DB_HOST=127.0.0.1
DB_PORT=3306
DB_DATABASE=jalaram
DB_USERNAME=jalaram
DB_PASSWORD=<strong password>

SESSION_DRIVER=database
SESSION_SECURE_COOKIE=true
SESSION_SAME_SITE=lax
SESSION_DOMAIN=www.your-domain.example
SANCTUM_STATEFUL_DOMAINS=www.your-domain.example
TRUSTED_PROXIES=127.0.0.1

MAIL_MAILER=smtp               # needed for password reset & email verification
MAIL_HOST=... MAIL_PORT=587 MAIL_USERNAME=... MAIL_PASSWORD=...
MAIL_FROM_ADDRESS=no-reply@your-domain.example

PROPERTY_IMAGE_DISK=public     # or s3 — see "Image storage"
DEAL_DOCUMENT_DISK=local       # must remain private
QUEUE_CONNECTION=database
```

### Environment — `project/.env.production`

```
NEXT_PUBLIC_SITE_URL=https://www.your-domain.example
API_INTERNAL_URL=http://127.0.0.1:8080     # Laravel, reachable from the Node server
```

`API_INTERNAL_URL` is only used server-side, for rendering public pages; the browser never sees it. No secrets go in `NEXT_PUBLIC_*` variables.

### First deploy

```bash
# API
cd /var/www/jalaram/api
composer install --no-dev --optimize-autoloader
php artisan key:generate                     # first time only
php artisan migrate --force
php artisan db:seed --class=ReferenceDataSeeder --force   # localities, amenities, settings keys — NO demo data
php artisan storage:link
php artisan config:cache && php artisan route:cache && php artisan view:cache
sudo chown -R www-data:www-data storage bootstrap/cache

# Create the first admin (owners self-register; staff are created from /admin/users)
php artisan tinker --execute="App\Models\User::create(['name'=>'Your Name','email'=>'you@your-domain.example','phone'=>'...','password'=>'<strong password>','role'=>'admin'])->forceFill(['email_verified_at'=>now()])->save();"

# Website
cd /var/www/jalaram/project
npm ci && npm run build
```

`DatabaseSeeder` only runs `DevelopmentSeeder` when `APP_ENV` is local/development/testing, and `DevelopmentSeeder` refuses to run in production. Never run `migrate:fresh` on production.

### Processes (systemd)

`/etc/systemd/system/jalaram-web.service`:
```ini
[Unit]
Description=Jalaram Next.js
After=network.target

[Service]
WorkingDirectory=/var/www/jalaram/project
ExecStart=/usr/bin/npm run start -- -p 3000
Environment=NODE_ENV=production
User=www-data
Restart=always

[Install]
WantedBy=multi-user.target
```

The scheduler (expires listings hourly) needs a cron entry for `www-data`:
```
* * * * * cd /var/www/jalaram/api && php artisan schedule:run >> /dev/null 2>&1
```

A queue worker is optional, since notifications currently run synchronously. Run `php artisan queue:work --tries=3` under systemd if you later queue mail.

### Nginx

```nginx
server {
    listen 443 ssl http2;
    server_name www.your-domain.example;
    # ssl_certificate lines added by certbot

    client_max_body_size 60M;   # 10 photos × 5 MB + form data

    root /var/www/jalaram/api/public;

    # Laravel: API, Sanctum CSRF cookie, uploaded photos
    location ~ ^/(api|sanctum)/ {
        try_files $uri /index.php?$query_string;
    }
    location /storage/ {
        try_files $uri =404;
        add_header X-Content-Type-Options nosniff;
        expires 30d;
    }
    location = /index.php {
        include fastcgi_params;
        fastcgi_param SCRIPT_FILENAME $realpath_root/index.php;
        fastcgi_pass unix:/run/php/php8.3-fpm.sock;
    }

    # Everything else: Next.js
    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_set_header Host $host;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}

# Internal API listener for server-side rendering (API_INTERNAL_URL)
server {
    listen 127.0.0.1:8080;
    root /var/www/jalaram/api/public;
    location / { try_files $uri /index.php?$query_string; }
    location = /index.php {
        include fastcgi_params;
        fastcgi_param SCRIPT_FILENAME $realpath_root/index.php;
        fastcgi_pass unix:/run/php/php8.3-fpm.sock;
    }
}

server { listen 80; server_name your-domain.example www.your-domain.example; return 301 https://www.your-domain.example$request_uri; }
```

### HTTPS

```bash
sudo apt install certbot python3-certbot-nginx
sudo certbot --nginx -d your-domain.example -d www.your-domain.example
```

Keep `SESSION_SECURE_COOKIE=true` once HTTPS is live.

## Image storage

- **Local (`PROPERTY_IMAGE_DISK=public`)**: files are stored in `api/storage/app/public/properties/{id}/` and served at `/storage/...`. Include this folder in backups.
- **S3-compatible (`PROPERTY_IMAGE_DISK=s3`)**: works with AWS S3, Cloudflare R2, DigitalOcean Spaces or MinIO. Set the `AWS_*` variables in `api/.env`, plus `AWS_ENDPOINT` for non-AWS providers and `AWS_URL` for the public/CDN base URL. The bucket (or a CDN in front of it) must allow public reads of `properties/*`. Credentials stay on the server only.
- **Cloudinary**: not integrated. Use S3-compatible storage, or add a Cloudinary Flysystem adapter later behind the same disk setting.
- **Deal documents** are always private. Use the `local` disk, or a separate private bucket configured as its own disk. They are streamed only through the authorised download endpoint.

All uploads are validated by file content, re-encoded (which strips EXIF/GPS data) and given random filenames.

## Backups

```bash
# Nightly database dump (cron), keep 30 days
mysqldump --single-transaction --routines -u jalaram -p"$DB_PASSWORD" jalaram | gzip > /backups/jalaram-$(date +%F).sql.gz
find /backups -name 'jalaram-*.sql.gz' -mtime +30 -delete

# Files: uploaded photos and private deal documents
rsync -a /var/www/jalaram/api/storage/app/ /backups/storage/
```

Copy backups off the server, for example to an object-storage bucket. Test a restore regularly.

## Logs and monitoring

- Laravel: `api/storage/logs/laravel.log`. Set `LOG_CHANNEL=daily` and `LOG_LEVEL=warning` in production.
- Next.js: `journalctl -u jalaram-web`
- Nginx: `/var/log/nginx/access.log`, `error.log`
- Health check: `GET /up` (Laravel). Point an uptime monitor at it and at the homepage.
- Business audit trail: `/admin/audit-logs`.

## Updating and rollback

```bash
# Before updating
mysqldump ... > /backups/pre-release-$(date +%F-%H%M).sql.gz

cd /var/www/jalaram && git pull            # or deploy a release folder
cd api && composer install --no-dev --optimize-autoloader && php artisan migrate --force && php artisan optimize
cd ../project && npm ci && npm run build && sudo systemctl restart jalaram-web
sudo systemctl reload php8.3-fpm
```

To roll back, redeploy the previous release, then restore the pre-release dump **only if** a migration changed data. Every migration has a `down()` method, but don't run `migrate:rollback` on production without a backup.

## Marketing and SEO setup (manual steps)

1. **Business details**: enter the real phone, WhatsApp, email, address, hours and any RERA registration in `/admin/settings`. The site hides anything left blank. Don't enter details you can't verify.
2. **Google Business Profile**: create or verify the listing at business.google.com, using the same name, address and phone as the website settings.
3. **Google Search Console**: verify the domain using a DNS TXT record, then submit `https://www.your-domain.example/sitemap.xml`.
4. **Analytics**: add GA4 or Plausible in `project/app/layout.tsx` after updating the privacy policy to mention it. No analytics is included by default.
5. **WhatsApp**: set `business_whatsapp` (digits with country code). Every WhatsApp button links to `wa.me` with a pre-filled message.
6. **Domain and HTTPS**: point A records for `@` and `www` at the server, then run Certbot (see above).
7. **Legal**: have the privacy policy and terms (and any GST treatment of brokerage) reviewed by a professional before launch.
