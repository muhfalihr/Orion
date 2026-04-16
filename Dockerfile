# Stage 1: Build Frontend
FROM node:20-slim AS frontend-builder
WORKDIR /app/client
COPY client/package*.json ./
RUN npm install
COPY client/ ./
RUN npm run build

# Stage 2: Build Backend & Final Image
FROM node:20-slim
WORKDIR /app

# Install system dependencies
RUN apt-get update && apt-get install -y \
    git \
    bash \
    curl \
    ca-certificates \
    && rm -rf /var/lib/apt/lists/*

# Install nfpm directly from GitHub Releases
RUN NFPM_VERSION="2.41.2" && \
    curl -sfL -o nfpm.deb "https://github.com/goreleaser/nfpm/releases/download/v${NFPM_VERSION}/nfpm_${NFPM_VERSION}_amd64.deb" && \
    dpkg -i nfpm.deb && \
    rm nfpm.deb

# Copy root package files
COPY package*.json ./
RUN npm install --omit=dev

# Copy backend server code
COPY server/ ./server/

# Copy built frontend from Stage 1
COPY --from=frontend-builder /app/client/dist ./public

# Create necessary directories
RUN mkdir -p workdir builds

# Environment variables
ENV PORT=3001
ENV NODE_ENV=production

# Expose the application port
EXPOSE 3001

# Command to run the application
# Note: config.yaml should be mounted as a volume in production
CMD ["node", "server/index.js"]
