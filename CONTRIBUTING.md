# Contributing to Orion Package Manager

Thank you for your interest in contributing to Orion Package Manager! This document provides guidelines for contributing to this project.

## Development Setup

1.  **Fork the repository**: Click the "Fork" button on the top right of the repository page.

2.  **Clone your fork**:

    ```bash
    git clone https://git.blackeye.id/your-username/orion.git
    cd orion
    ```

3.  **Add upstream remote**:

    ```bash
    git remote add upstream https://git.blackeye.id/sre-toolkit/tool/orion.git
    ```

4.  **Install dependencies**:

    ```bash
    npm install
    cd client && npm install
    cd ..
    ```

5.  **Setup Environment Variables**:
    Copy `.env.example` to `.env` and fill in the required values (Git Token, etc.).

6.  **Run in Development Mode**:
    ```bash
    npm run dev
    ```

## Coding Standards

We use **Prettier** to maintain a consistent code style. Please ensure your code is formatted before submitting a pull request.

- **Format code**: `npm run format`
- **Check formatting**: `npm run format:check`

### General Guidelines

- Use TypeScript for frontend components.
- Follow the existing directory structure.
- Ensure all new features include necessary documentation.

## Git Workflow

1.  Create a new branch for your feature or bugfix: `git checkout -b feature/your-feature-name`.
2.  Commit your changes with clear and concise messages.
3.  Push your changes to your fork: `git push origin feature/your-feature-name`.
4.  **Create a Pull Request**: Go to the original repository and create a Pull Request from your branch.
5.  **Tagging**: Always confirm with the maintainers before creating a new Git tag.

## Building Packages

The project uses `nfpm` for packaging. Ensure you have it installed if you plan to test the build process locally.

```bash
# Build packages manually
script/build_packages.sh
```

## Reporting Issues

If you find a bug or have a feature request, please open an issue in the repository.
