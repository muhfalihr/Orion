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

# Install system dependencies & compilers
RUN apt-get update && apt-get install -y \
    git \
    bash \
    curl \
    ca-certificates \
    gnupg \
    python3 \
    python3-pip \
    binutils \
    build-essential \
    make \
    cmake \
    golang \
    default-jdk \
    && rm -rf /var/lib/apt/lists/*

# Install Docker CLI
RUN install -m 0755 -d /etc/apt/keyrings && \
    curl -fsSL https://download.docker.com/linux/debian/gpg | gpg --dearmor -o /etc/apt/keyrings/docker.gpg && \
    chmod a+r /etc/apt/keyrings/docker.gpg && \
    echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/debian $(. /etc/os-release && echo "$VERSION_CODENAME") stable" | \
    tee /etc/apt/sources.list.d/docker.list > /dev/null && \
    apt-get update && apt-get install -y docker-ce-cli && \
    rm -rf /var/lib/apt/lists/*

# Install Rust
RUN curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh -s -- -y
ENV PATH="/root/.cargo/bin:${PATH}"

# Install uv (Fast Python package manager)
COPY --from=ghcr.io/astral-sh/uv:latest /uv /uvx /bin/
ENV UV_SYSTEM_PYTHON=1
ENV UV_BREAK_SYSTEM_PACKAGES=1

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
RUN mkdir -p workdir builds data

# Environment variables
ENV PORT=3001
ENV NODE_ENV=production
# Pastikan DOCKER_HOST mengarah ke socket default
ENV DOCKER_HOST=unix:///var/run/docker.sock

# Expose the application port
EXPOSE 3001

# Command to run the application
CMD ["node", "server/index.js"]
