FROM php:8.3-cli-alpine

RUN apk add --no-cache \
    git \
    curl \
    libpng-dev \
    libxml2-dev \
    zip \
    unzip \
    nodejs \
    npm \
    python3 \
    py3-pip \
    ffmpeg \
    sqlite

RUN docker-php-ext-install pdo pdo_mysql bcmath

COPY --from=composer:latest /usr/bin/composer /usr/bin/composer

RUN pip3 install --no-cache-dir --break-system-packages yt-dlp ytmusicapi requests

WORKDIR /app

COPY . .

ENV APP_NAME="Bandy's Music"
ENV APP_ENV=production
ENV APP_KEY="base64:YiBXQk7ssKH4KR9pmOQSfxmuMj/ufbmVwqVq595R/AI="
ENV APP_DEBUG=true
ENV DB_CONNECTION=sqlite
ENV DB_DATABASE=/app/database/database.sqlite
ENV SESSION_DRIVER=file
ENV CACHE_STORE=file

RUN composer install --no-dev --optimize-autoloader
RUN npm install
RUN npm run build

RUN mkdir -p database storage/logs storage/framework/views storage/framework/cache storage/framework/sessions bootstrap/cache
RUN touch database/database.sqlite
RUN chmod -R 777 storage bootstrap/cache database

EXPOSE 8000

CMD php artisan migrate --force && php artisan serve --host=0.0.0.0 --port=8000
