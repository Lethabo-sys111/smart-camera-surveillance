#!/usr/bin/env bash
# One-time setup: installs a fresh Laravel 12 and merges this project's backend files into it.
# Run from the repo root:  bash setup-backend.sh
set -euo pipefail

cd "$(dirname "$0")"

if [ -f backend/artisan ]; then
  echo "backend/ is already a full Laravel app. Skipping install."
else
  echo "==> Installing fresh Laravel 12 into a temp folder..."
  rm -rf .laravel-tmp
  composer create-project laravel/laravel:^12.0 .laravel-tmp --no-interaction

  echo "==> Merging Laravel with this project's files (project files win)..."
  cp -rn .laravel-tmp/. backend/
  rm -rf .laravel-tmp
fi

cd backend

[ -f .env ] || cp .env.example .env

# Generate a random device key the Pi will use, if none is set yet.
if ! grep -q '^DEVICE_KEY=.\+' .env; then
  KEY=$(php -r 'echo bin2hex(random_bytes(16));')
  sed -i.bak '/^DEVICE_KEY=/d' .env && rm -f .env.bak
  printf '\nDEVICE_KEY=%s\n' "$KEY" >> .env
  echo "==> Generated DEVICE_KEY=$KEY  (put this in pi/config.ini)"
fi

grep -q '^APP_KEY=.\+' .env || php artisan key:generate
[ -f database/database.sqlite ] || touch database/database.sqlite
php artisan migrate --force
php artisan storage:link || true

echo
echo "Done. Start the API with:"
echo "  cd backend && php artisan serve --host=0.0.0.0 --port=8080"
