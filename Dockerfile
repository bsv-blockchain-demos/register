# Single container deployment for BlockMed
FROM node:18-alpine

# Install system dependencies
RUN apk add --no-cache \
    nginx \
    supervisor \
    mongodb \
    mongodb-tools \
    bash

# Install tsx globally for TypeScript execution
RUN npm install -g tsx

WORKDIR /app

# Copy QuarkID packages
COPY ../Paquetes-NPMjs ./Paquetes-NPMjs

# Setup backend
COPY back/package*.json ./back/
RUN cd back && npm install

COPY back/ ./back/

# Setup frontend
COPY front/package*.json ./front/
RUN cd front && npm install

COPY front/ ./front/
RUN cd front && npm run build

# Configure nginx for frontend
RUN mkdir -p /var/www/html
RUN cp -r front/dist/* /var/www/html/

# Create nginx config for SPA
RUN echo 'server { \
    listen 80; \
    server_name localhost; \
    root /var/www/html; \
    index index.html; \
    location / { \
        try_files $uri $uri/ /index.html; \
    } \
    location /api { \
        proxy_pass http://localhost:3000; \
        proxy_set_header Host $host; \
        proxy_set_header X-Real-IP $remote_addr; \
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for; \
        proxy_set_header X-Forwarded-Proto $scheme; \
    } \
}' > /etc/nginx/http.d/default.conf

# Create supervisor configuration
RUN echo '[supervisord] \
nodaemon=true \
user=root \
\
[program:mongodb] \
command=mongod --bind_ip_all --dbpath /data/db \
user=root \
autostart=true \
autorestart=true \
stdout_logfile=/var/log/mongodb.log \
stderr_logfile=/var/log/mongodb.log \
\
[program:backend] \
command=npm run dev \
directory=/app/back \
user=root \
autostart=true \
autorestart=true \
stdout_logfile=/var/log/backend.log \
stderr_logfile=/var/log/backend.log \
environment=NODE_ENV=development,PORT=3000,MONGODB_URI=mongodb://localhost:27017,APP_DB_NAME=quarkid_prescriptions_db \
\
[program:nginx] \
command=nginx -g "daemon off;" \
user=root \
autostart=true \
autorestart=true \
stdout_logfile=/var/log/nginx.log \
stderr_logfile=/var/log/nginx.log' > /etc/supervisord.conf

# Create directories
RUN mkdir -p /data/db /var/log/supervisor

# Environment variables for single container
ENV NODE_ENV=development
ENV PORT=3000
ENV MONGODB_URI=mongodb://localhost:27017
ENV APP_DB_NAME=quarkid_prescriptions_db
ENV MOCK_UTXOS=false

# Expose ports
EXPOSE 80 3000

# Start all services with supervisor
CMD ["/usr/bin/supervisord", "-c", "/etc/supervisord.conf"]