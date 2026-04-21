# Orion Package Manager & Image Distributor

Orion is an automated delivery system that monitors Git repositories for new tags, builds Debian (`.deb`) and RPM (`.rpm`) packages, and/or builds and pushes Docker images to any registry.

## 🚀 Features

- **Multi-Repository Support**: Monitor multiple Git repositories simultaneously.
- **YAML Configuration**: Flexible management of repositories and build settings.
- **Automated Tag Monitoring**: Periodically polls repositories for new tags.
- **Hybrid Build Pipeline**: Support for OS packages (`nfpm`), Docker images, or both.
- **Docker Integration**: Built-in support for `docker build` and `docker push` with registry authentication.
- **Multi-Language Build Support**: Pre-configured runtimes for **Python, Go, Rust, and Java**.
- **Package & Image Hosting**: OS packages are served directly via a minimalist Web UI, and Docker images are pushed to your preferred registry.
- **Production-Ready**: Uses shallow clones (`--depth 1`) for efficient builds.

## 🛠 Tech Stack & Runtimes

The Docker image comes pre-installed with the following compilers and runtimes to support virtually any project:

- **Runtimes**: Node.js 20, Python 3, Go, Rust, OpenJDK (Java).
- **Docker CLI**: For building and pushing container images.
- **Build Tools**: `uv` (Python), `build-essential`, `make`, `cmake`, `binutils`.
- **Packaging**: `nfpm`.
- **Backend**: Node.js (Express), SQLite (`better-sqlite3`), `simple-git`, `js-yaml`.
- **Frontend**: React (TypeScript), Vite, Vanilla CSS.

---

## 📋 Prerequisites

- **Docker**: Required for both hosting Orion and executing Docker builds within it.
- **Node.js 20+**: If running locally.
- **nfpm**: Required for local OS package builds.
- **Git**: Required for repository cloning.

---

## ⚙️ Configuration

### 1. Environment Variables (`.env`)

| Variable           | Description                              | Default         |
| :----------------- | :--------------------------------------- | :-------------- |
| `PORT`             | The port the server will listen on.      | `3001`          |
| `POLLING_INTERVAL` | Time between tag checks in milliseconds. | `60000` (1 min) |

### 2. Repository Configuration (`config.yaml`)

Define your repositories in `config.yaml`. Orion supports environment variable interpolation (e.g., `${DOCKER_PASSWORD}`) for sensitive values.

A repository must have a `url` and `token`, plus at least one build configuration (either OS packages or Docker).

```yaml
repositories:
  - name: 'my-project'
    url: 'https://github.com/user/project.git'
    token: 'your-git-token'

    # Optional: OS Package Build (deb/rpm)
    build_script: 'scripts/build.sh'
    nfpm_config: 'nfpm.yaml'

    # Optional: Docker Build & Push
    docker:
      image: 'user/project' # Repository name
      registry: 'docker.io' # Optional, defaults to docker.io
      username: '${DOCKER_USER}' # Supports env interpolation
      password: '${DOCKER_PASSWORD}'
      strategy: 'direct' # 'direct' (standard build/push) or 'script'
      dockerfile: 'Dockerfile' # Optional, defaults to 'Dockerfile'
      context: '.' # Optional, defaults to '.'
      # script: 'scripts/docker.sh' # Required if strategy is 'script'
```

---

## 📦 Deployment

### Using Docker Compose (Recommended)

To enable Docker builds inside Orion, you **must** mount the Docker socket.

```yaml
services:
  orion:
    build: .
    image: muhfalihr/orion:latest
    container_name: orion-app
    restart: unless-stopped
    ports:
      - '3001:3001'
    env_file:
      - .env
    volumes:
      # Mount Docker socket to enable Docker builds
      - /var/run/docker.sock:/var/run/docker.sock
      # Mount the repository configuration
      - ./config.yaml:/app/config.yaml:ro
      # Persist the SQLite database
      - orion_db:/app/data
      # Persist the built packages
      - orion_builds:/app/builds
      # Optional: Persist workdir
      - orion_workdir:/app/workdir

volumes:
  orion_db:
  orion_builds:
  orion_workdir:
```

1.  **Start the application**:
    ```bash
    docker-compose up -d
    ```

---

## 🔄 Workflow

1.  **Polling**: The server checks all repositories every `POLLING_INTERVAL`.
2.  **Detection**: New tags are added to SQLite with `pending` status.
3.  **Cloning**: Uses `git clone --depth 1` for fast retrieval.
4.  **Package Phase**: If `build_script` is present, it builds `.deb`/`.rpm` packages.
5.  **Docker Phase**: If `docker` config is present, it authenticates, builds, and pushes the image.
6.  **Serving**: OS packages are hosted at `/builds/:repo/:tag/`, and Docker pull commands are displayed in the UI.

---

## 🛡 Security

- **Token Auth**: All repository access is authenticated via tokens.
- **Isolation**: Each repository and tag has a separate build directory.
- **Environment**: Sensitive tokens are stored in `config.yaml` (keep this file secure).

---

## 📄 License

MIT License.
