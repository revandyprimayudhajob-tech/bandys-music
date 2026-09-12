FROM php:8.3-cli-alpine

# Install system dependencies, python3, yt-dlp requirements
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
    ffmpeg

# Install PHP extensions
RUN docker-php-ext-install pdo pdo_mysql bcmath

# Install Composer
COPY --from=composer:latest /usr/bin/composer /usr/bin/composer

# Install python dependencies for YouTube audio bridge
RUN pip3 install --no-cache-dir --break-system-packages yt-dlp ytmusicapi requests

WORKDIR /app

# Copy application files
COPY . .

# Install dependencies and build assets
RUN composer install --no-dev --optimize-autoloader
RUN npm install
RUN npm run build

# Generate app key if needed and set permissions
RUN chmod -R 777 storage bootstrap/cache

EXPOSE 8000

CMD ["php", "artisan", "serve", "--host=0.0.0.0", "--port=8000"]
