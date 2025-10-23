# ---- Base Stage ----
FROM node:20-alpine AS base
WORKDIR /app

# ---- Dependencies Stage ----
FROM base AS deps
# Copy QuarkID packages from parent directory build context
COPY Paquetes-NPMjs ./Paquetes-NPMjs
# Install QuarkID dependencies first with DNS fixes
# Configure yarn for better DNS handling in Alpine
RUN cd Paquetes-NPMjs && \
    yarn config set network-timeout 300000 && \
    yarn config set network-concurrency 1 && \
    yarn install --network-timeout 300000 || \
    (sleep 10 && yarn install --network-timeout 300000)

# Update QuarkID workspace to include register projects and install all dependencies
COPY register/back/package*.json register/back/yarn.lock* ./register/back/
RUN cd Paquetes-NPMjs && cp package.json package.json.backup
RUN cd Paquetes-NPMjs && echo '{"private":true,"name":"extrimian","version":"1.0.0","workspaces":["packages/did/core","packages/did/resolver","packages/core/**","packages/vc/core","packages/kms/core","packages/vc/**","packages/dwn/client","packages/dwn/scheduler","packages/kms/suite/vc/jsonld","packages/kms/suite/**","packages/kms/client","packages/kms/storage/**","packages/kms/storage/vault","packages/modena/sdk","packages/did/registry","packages/waci/core","packages/agent/core","packages/one-click","packages/agent/plugins/one-click","packages/ami/ami-core","packages/ami/ami-sdk","packages/agent/plugins/ami","../register/back"],"scripts":{"build":"yarn workspaces run build","clean":"find . \\\\( -name '\''node_modules'\'' -o -name '\''dist'\'' -o -name '\''lib'\'' \\\\) -type d -prune -exec rm -rf '\''{}'\'' +"}}' > package.json
# Install all workspace dependencies including backend project (do this from workspace root)
# Remove any existing node_modules in register/back to prevent symlink conflicts
RUN rm -rf /app/register/back/node_modules
RUN cd Paquetes-NPMjs && \
    yarn config set network-timeout 300000 && \
    yarn config set network-concurrency 1 && \
    yarn install --network-timeout 300000 --force || \
    (echo "Workspace install failed, retrying..." && sleep 10 && \
    yarn install --network-timeout 300000 --force)

# ---- Development Stage ----
FROM base AS development
# Install tsx globally for TypeScript execution
RUN yarn global add tsx

# Copy entire workspace structure from deps stage
COPY --from=deps /app ./

# Copy backend source code - maintain host structure, exclude node_modules to avoid conflicts
COPY register/back/src ./register/back/src
COPY register/back/*.ts ./register/back/
COPY register/back/*.js* ./register/back/
COPY register/back/tsconfig*.json ./register/back/
# Copy .env file if it exists
COPY register/back/.env ./register/back/.env

# Create directory for any generated keys/data
RUN mkdir -p register/back/data

# Link all workspace node_modules into backend so dependencies can be found
RUN for dep in /app/Paquetes-NPMjs/node_modules/*; do \
      depname=$(basename "$dep"); \
      if [ ! -e "/app/register/back/node_modules/$depname" ]; then \
        ln -sf "$dep" "/app/register/back/node_modules/$depname"; \
      fi; \
    done

# Set working directory for the app - maintain host structure
WORKDIR /app/register/back

# Expose the backend port
EXPOSE 3000

# Use tsx to run TypeScript directly in development
CMD ["yarn", "dev"]

# ---- Build Stage ----
FROM base AS build
# Copy dependencies from deps stage - maintain host structure
COPY --from=deps /app/register/back/node_modules ./register/back/node_modules
COPY --from=deps /app/Paquetes-NPMjs ./Paquetes-NPMjs

# Copy backend source and build - maintain host structure, exclude node_modules
COPY register/back/src ./register/back/src
COPY register/back/*.ts ./register/back/
COPY register/back/*.js* ./register/back/
COPY register/back/tsconfig*.json ./register/back/
WORKDIR /app/register/back
RUN yarn build

# ---- Production Stage ----
FROM base AS production
# Copy QuarkID packages and install production deps
COPY Paquetes-NPMjs ./Paquetes-NPMjs
RUN cd Paquetes-NPMjs && \
    yarn config set network-timeout 300000 && \
    yarn config set network-concurrency 1 && \
    yarn install --production --network-timeout 300000 || \
    (sleep 10 && yarn install --production --network-timeout 300000)

# Copy backend package files and install production deps - maintain host structure
COPY register/back/package*.json register/back/yarn.lock* ./register/back/
RUN cd register/back && \
    yarn config set network-timeout 300000 && \
    yarn config set network-concurrency 1 && \
    yarn install --production --network-timeout 300000 || \
    (sleep 10 && yarn install --production --network-timeout 300000)

# Copy built application from build stage - maintain host structure
COPY --from=build /app/register/back/dist ./register/back/dist

# Create directory for any generated keys/data
RUN mkdir -p register/back/data

# Set working directory - maintain host structure
WORKDIR /app/register/back

# Expose the backend port
EXPOSE 3000

# Run the compiled JavaScript
CMD ["node", "dist/app.js"]