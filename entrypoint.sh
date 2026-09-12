#!/bin/sh
set -e

# Generate SQLite database file if not exists
touch /app/database/database.sqlite
chmod 777 /app/database/database.sqlite

# Run Laravel migrations and cache
php artisan migrate --force || true
php artisan config:clear
php artisan route:clear
php artisan view:clear

# Set full storage permissions
chmod -R 777 /app/storage /app/bootstrap/cache /app/database

# Start Laravel Server on Railway Dynamic Port
PORT=${PORT:-8000}
echo "Starting Laravel server on port $PORT..."
exec php artisan serve --host=0.0.0.0 --port=$PORT
