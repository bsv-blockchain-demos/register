FROM node:18-alpine

# Install tsx for TypeScript execution
RUN npm install -g tsx

WORKDIR /app

# Copy QuarkID packages first for better Docker layer caching
COPY ../Paquetes-NPMjs ./Paquetes-NPMjs

# Copy package files and install dependencies
COPY back/package*.json ./
RUN npm install

# Copy backend source code
COPY back/ .

# Create directory for any generated keys/data
RUN mkdir -p data

# Expose the backend port
EXPOSE 3000

# Use tsx to run TypeScript directly in development
CMD ["npm", "run", "dev"]