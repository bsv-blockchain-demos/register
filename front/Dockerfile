# Stage 1: Build the application
FROM node:18-alpine AS builder

WORKDIR /app

# Copy QuarkID packages first for better Docker layer caching
COPY ../Paquetes-NPMjs ./Paquetes-NPMjs

# Copy package files and install dependencies
COPY front/package*.json ./
RUN npm install

# Copy frontend source and build static assets
COPY front/ .
RUN npm run build

# Stage 2: Serve static assets with nginx
FROM nginx:1.23-alpine

# Copy the built assets from the builder stage
COPY --from=builder /app/dist /usr/share/nginx/html

# Create nginx config for SPA routing
RUN echo 'server { \
    listen 80; \
    server_name localhost; \
    root /usr/share/nginx/html; \
    index index.html; \
    location / { \
        try_files $uri $uri/ /index.html; \
    } \
    # Cache static assets \
    location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg)$ { \
        expires 1y; \
        add_header Cache-Control "public, immutable"; \
    } \
}' > /etc/nginx/conf.d/default.conf

# Nginx listens on port 80 by default
EXPOSE 80

# When the container starts, nginx will serve the files
CMD ["nginx", "-g", "daemon off;"]