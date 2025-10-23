# ---- Use Shared QuarkID Base ----
FROM quarkid-base:latest AS base

# ---- Dependencies Stage ----
FROM base AS deps
# QuarkID packages already installed in base image
# Just add frontend-specific dependencies
COPY register/front/package*.json register/front/yarn.lock* ./register/front/

# Update workspace to include frontend and install
RUN cd Paquetes-NPMjs && \
    cp package.json package.json.backup && \
    echo '{"private":true,"name":"extrimian","version":"1.0.0","workspaces":["packages/did/core","packages/did/resolver","packages/core/**","packages/vc/core","packages/kms/core","packages/vc/**","packages/dwn/client","packages/dwn/scheduler","packages/kms/suite/vc/jsonld","packages/kms/suite/**","packages/kms/client","packages/kms/storage/**","packages/kms/storage/vault","packages/modena/sdk","packages/did/registry","packages/waci/core","packages/agent/core","packages/one-click","packages/agent/plugins/one-click","packages/ami/ami-core","packages/ami/ami-sdk","packages/agent/plugins/ami","../register/front"],"scripts":{"build":"yarn workspaces run build","clean":"find . \\\\( -name '\''node_modules'\'' -o -name '\''dist'\'' -o -name '\''lib'\'' \\\\) -type d -prune -exec rm -rf '\''{}'\'' +"}}' > package.json && \
    yarn install --network-timeout 300000

# ---- Build Stage ----
FROM base AS builder
# Copy entire workspace structure from deps stage
COPY --from=deps /app ./

# Copy frontend source code - maintain host structure (excluding node_modules)
COPY register/front/src ./register/front/src
COPY register/front/public ./register/front/public
COPY register/front/index.html ./register/front/
COPY register/front/package.json ./register/front/
COPY register/front/tsconfig*.json ./register/front/
COPY register/front/vite.config.ts ./register/front/
COPY register/front/tailwind.config.js ./register/front/
COPY register/front/postcss.config.js ./register/front/
COPY register/front/eslint.config.js ./register/front/

# Build the static assets using yarn workspace command from workspace root
WORKDIR /app/Paquetes-NPMjs
# Link all workspace node_modules into frontend so Vite can find all dependencies
RUN for dep in /app/Paquetes-NPMjs/node_modules/*; do \
      depname=$(basename "$dep"); \
      if [ ! -e "/app/register/front/node_modules/$depname" ]; then \
        ln -sf "$dep" "/app/register/front/node_modules/$depname"; \
      fi; \
    done
RUN yarn workspace did-creator build

# ---- Development Stage ----
FROM base AS development
# Copy entire workspace structure from deps stage
COPY --from=deps /app ./

# Copy frontend source code - maintain host structure (excluding node_modules)
COPY register/front/src ./register/front/src
COPY register/front/public ./register/front/public
COPY register/front/index.html ./register/front/
COPY register/front/package.json ./register/front/
COPY register/front/tsconfig*.json ./register/front/
COPY register/front/vite.config.ts ./register/front/
COPY register/front/tailwind.config.js ./register/front/
COPY register/front/postcss.config.js ./register/front/
COPY register/front/eslint.config.js ./register/front/

# Set working directory to workspace root for yarn workspace commands
WORKDIR /app/Paquetes-NPMjs

# Expose Vite dev server port
EXPOSE 5174

# Start Vite development server using workspace command
CMD ["yarn", "workspace", "did-creator", "dev", "--host", "0.0.0.0"]

# ---- Production Stage ----
FROM nginx:1.23-alpine AS production

# Copy the built assets from the builder stage - maintain host structure
COPY --from=builder /app/register/front/dist /usr/share/nginx/html

# Create optimized nginx config for React SPA
RUN echo 'server { \
    listen 80; \
    server_name localhost; \
    root /usr/share/nginx/html; \
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
    # Cache static assets with versioning \
    location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2|ttf|eot)$ { \
        expires 1y; \
        add_header Cache-Control "public, immutable"; \
        add_header X-Content-Type-Options "nosniff"; \
    } \
    \
    # Security headers \
    add_header X-Frame-Options "SAMEORIGIN" always; \
    add_header X-XSS-Protection "1; mode=block" always; \
    add_header X-Content-Type-Options "nosniff" always; \
    add_header Referrer-Policy "no-referrer-when-downgrade" always; \
    \
    # API proxy (if needed) \
    location /api { \
        proxy_pass http://backend:3000; \
        proxy_set_header Host $host; \
        proxy_set_header X-Real-IP $remote_addr; \
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for; \
        proxy_set_header X-Forwarded-Proto $scheme; \
    } \
}' > /etc/nginx/conf.d/default.conf

# Nginx listens on port 80 by default
EXPOSE 80

# When the container starts, nginx will serve the files
CMD ["nginx", "-g", "daemon off;"]