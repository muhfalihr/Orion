# 🌌 Orion Package Manager

Orion is an automated packaging system that monitors Git repositories for new tags, builds Debian (`.deb`) and RPM (`.rpm`) packages using `nfpm`, and serves them through a minimalist Web UI.

![Orion UI Placeholder](https://via.placeholder.com/800x400?text=Orion+Package+Manager+Dashboard)

## 🚀 Features

- **Multi-Repository Support**: Monitor multiple Git repositories simultaneously.
- **YAML Configuration**: Easy management of repositories and build settings.
- **Automated Tag Monitoring**: Periodically polls repositories for new tags.
- **Auto-Build**: Automatically triggers a build process when a new tag is detected.
- **Packaging Support**: Generates both `.deb` and `.rpm` packages using `nfpm`.
- **Package Hosting**: Built packages are stored and served directly from the application.
- **Production-Ready**: Uses shallow clones (`--depth 1`) for efficient builds.

## 🛠 Tech Stack

- **Frontend**: React (TypeScript), Vite, Vanilla CSS.
- **Backend**: Node.js (Express), SQLite (`better-sqlite3`), `simple-git`, `js-yaml`.
- **Packaging**: `nfpm`.
- **Deployment**: Docker (Multi-stage build).

---

## 📋 Prerequisites

- **Docker**: Recommended for production.
- **Node.js 20+**: If running locally.
- **nfpm**: Required for local builds.
- **Git**: Required for repository cloning.

---

## ⚙️ Configuration

### 1. Environment Variables (`.env`)

| Variable | Description | Default |
| :--- | :--- | :--- |
| `PORT` | The port the server will listen on. | `3001` |
| `POLLING_INTERVAL` | Time between tag checks in milliseconds. | `60000` (1 min) |

### 2. Repository Configuration (`config.yaml`)

Define your repositories in `config.yaml`:

```yaml
repositories:
  - name: "my-project"               # Display name (optional)
    url: "https://github.com/u/p.git" # Git repository URL
    token: "your-git-token"          # Access token for auth
    build_script: "build.sh"         # Path to script inside repo
```

---

## 📦 Deployment (Docker)

1.  **Build the image:**
    ```bash
    docker build -t orion-builder .
    ```

2.  **Run the container:**
    ```bash
    docker run -d \
      -p 3001:3001 \
      --env-file .env \
      -v $(pwd)/config.yaml:/app/config.yaml \
      -v orion_data:/app/builds \
      --name orion-app \
      orion-builder
    ```

---

## 🔄 Workflow

1.  **Polling**: The server reads `config.yaml` and checks all repositories every `POLLING_INTERVAL`.
2.  **Detection**: New tags are added to SQLite with `pending` status.
3.  **Cloning**: Uses `git clone --depth 1` for fast, lightweight retrieval.
4.  **Building**: Executes the configured `build_script` and moves results to `dist/`.
5.  **Serving**: Packages are hosted hierarchicaly: `/builds/:repo/:tag/:file`.

---

## 🛡 Security

- **Token Auth**: All repository access is authenticated via tokens.
- **Isolation**: Each repository and tag has a separate build directory.
- **Environment**: Sensitive tokens are stored in `config.yaml` (keep this file secure).

---

## 📄 License

ISC License.
