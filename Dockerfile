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
    ffmpeg \
    sqlite

# Install PHP extensions
RUN docker-php-ext-install pdo pdo_mysql bcmath

# Install Composer
COPY --from=composer:latest /usr/bin/composer /usr/bin/composer

# Install python dependencies for YouTube audio bridge
RUN pip3 install --no-cache-dir --break-system-packages yt-dlp ytmusicapi requests

WORKDIR /app

# Copy application files
COPY . .

# Set environment variables for production runtime
ENV APP_NAME="Bandy's Music"
ENV APP_ENV=production
ENV APP_KEY="base64:YiBXQk7ssKH4KR9pmOQSfxmuMj/ufbmVwqVq595R/AI="
ENV APP_DEBUG=true
ENV DB_CONNECTION=sqlite
ENV DB_DATABASE=/app/database/database.sqlite
ENV SESSION_DRIVER=file
ENV CACHE_STORE=file

# Install dependencies and build assets
RUN composer install --no-dev --optimize-autoloader
RUN npm install
RUN npm run build

# Make entrypoint script executable
RUN chmod +x /app/entrypoint.sh
RUN chmod -R 777 /app/storage /app/bootstrap/cache

EXPOSE 8000

CMD ["/app/entrypoint.sh"]
