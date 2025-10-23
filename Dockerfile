# Single container deployment for BlockMed
FROM node:20-alpine

# Install system dependencies (except MongoDB)
RUN apk add --no-cache \
    nginx \
    supervisor \
    bash \
    yarn \
    curl \
    tar

# Install MongoDB from official tarball
RUN addgroup mongodb && adduser -D -s /bin/bash -G mongodb mongodb \
    && mkdir -p /data/db /var/log/mongodb \
    && chown -R mongodb:mongodb /data/db /var/log/mongodb

# Download and install MongoDB 6.0.11 for Alpine Linux
RUN curl -fSL https://fastdl.mongodb.org/linux/mongodb-linux-x86_64-rhel80-6.0.11.tgz -o mongodb.tgz \
    && tar -xzf mongodb.tgz \
    && mv mongodb-linux-x86_64-rhel80-6.0.11/bin/* /usr/local/bin/ \
    && rm -rf mongodb.tgz mongodb-linux-x86_64-rhel80-6.0.11 \
    && chmod +x /usr/local/bin/mongo* \
    && ln -s /usr/local/bin/mongod /usr/bin/mongod \
    && ln -s /usr/local/bin/mongo /usr/bin/mongo

# Install tsx globally for TypeScript execution
RUN yarn global add tsx

WORKDIR /app

# Copy and build QuarkID packages first (correct path for project root context)
COPY Paquetes-NPMjs ./Paquetes-NPMjs
RUN cd Paquetes-NPMjs && yarn install --frozen-lockfile

# Add register project as a workspace within the QuarkID workspace
COPY register/back/package*.json register/back/yarn.lock* ./register/back/
COPY register/front/package*.json register/front/yarn.lock* ./register/front/

# Update QuarkID workspace to include register projects
RUN cd Paquetes-NPMjs && yarn config set workspaces-experimental true
RUN cd Paquetes-NPMjs && echo '{"private":true,"workspaces":["packages/**","../register/back","../register/front"]}' > package.json.tmp && mv package.json.tmp package.json

# Install all dependencies within workspace context
RUN cd Paquetes-NPMjs && yarn install --frozen-lockfile

# Copy source code after dependencies are installed (preserve node_modules from workspace install)
COPY register/back/src ./register/back/src
COPY register/back/*.ts ./register/back/
COPY register/back/tsconfig*.json ./register/back/

# For now, skip frontend build and copy everything except node_modules
COPY register/front ./register/front/temp
RUN rm -rf register/front/temp/node_modules
RUN mv register/front/temp/* register/front/ && rm -rf register/front/temp

# Build frontend (this might fail but we'll continue for now)
RUN cd register/front && yarn build || echo "Frontend build failed, continuing with development files"

# Configure nginx for frontend
RUN mkdir -p /var/www/html
RUN if [ -d "register/front/dist" ]; then cp -r register/front/dist/* /var/www/html/; else echo "No dist folder found, using development setup"; fi

# Create enhanced nginx config for SPA with security headers
RUN echo 'server { \
    listen 80; \
    server_name localhost; \
    root /var/www/html; \
    index index.html; \
    \
    # Enable gzip compression \
    gzip on; \
    gzip_vary on; \
    gzip_min_length 1024; \
    gzip_types text/plain text/css text/xml text/javascript application/javascript application/xml+rss application/json; \
    \
    # Handle React Router (SPA routing) \
    location / { \
        try_files $uri $uri/ /index.html; \
    } \
    \
    # API proxy to backend \
    location /api { \
        proxy_pass http://localhost:3000; \
        proxy_set_header Host $host; \
        proxy_set_header X-Real-IP $remote_addr; \
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for; \
        proxy_set_header X-Forwarded-Proto $scheme; \
    } \
    \
    # Cache static assets \
    location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2|ttf|eot)$ { \
        expires 1y; \
        add_header Cache-Control "public, immutable"; \
    } \
    \
    # Security headers \
    add_header X-Frame-Options "SAMEORIGIN" always; \
    add_header X-XSS-Protection "1; mode=block" always; \
    add_header X-Content-Type-Options "nosniff" always; \
    add_header Referrer-Policy "no-referrer-when-downgrade" always; \
}' > /etc/nginx/http.d/default.conf

# Create enhanced supervisor configuration
RUN echo '[supervisord] \
nodaemon=true \
user=root \
logfile=/var/log/supervisord.log \
logfile_maxbytes=10MB \
logfile_backups=3 \
loglevel=info \
pidfile=/var/run/supervisord.pid \
\
[program:mongodb] \
command=/usr/local/bin/mongod --bind_ip_all --dbpath /data/db --logpath /var/log/mongodb.log \
user=root \
autostart=true \
autorestart=true \
priority=100 \
stdout_logfile=/var/log/mongodb-supervisor.log \
stderr_logfile=/var/log/mongodb-supervisor.log \
\
[program:backend] \
command=yarn dev \
directory=/app/register/back \
user=root \
autostart=true \
autorestart=true \
priority=200 \
stdout_logfile=/var/log/backend.log \
stderr_logfile=/var/log/backend.log \
environment=NODE_ENV="development",PORT="3000",MONGODB_URI="mongodb://localhost:27017",APP_DB_NAME="quarkid_prescriptions_db",MOCK_UTXOS="false" \
\
[program:nginx] \
command=nginx -g "daemon off;" \
user=root \
autostart=true \
autorestart=true \
priority=300 \
stdout_logfile=/var/log/nginx.log \
stderr_logfile=/var/log/nginx.log' > /etc/supervisord.conf

# Create directories and set permissions
RUN mkdir -p /data/db /var/log/supervisor /var/run/supervisord
RUN chown -R mongodb:mongodb /data/db /var/log/mongodb
RUN chown -R root:root /var/log/supervisor /var/run/supervisord

# Environment variables for single container
ENV NODE_ENV=development
ENV PORT=3000
ENV MONGODB_URI=mongodb://localhost:27017
ENV APP_DB_NAME=quarkid_prescriptions_db
ENV MOCK_UTXOS=false

# Expose ports
EXPOSE 80 3000

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=60s --retries=3 \
    CMD curl -f http://localhost/ && curl -f http://localhost:3000/health || exit 1

# Start all services with supervisor
CMD ["/usr/bin/supervisord", "-c", "/etc/supervisord.conf"]