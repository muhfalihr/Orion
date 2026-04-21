# Changelog

All notable changes to this project will be documented in this file.

## [v1.2.1] - 2026-04-21
### Added
- Docker socket mounting (`/var/run/docker.sock`) in `docker-compose.yml` and `README.md`.
- `DOCKER_HOST` environment variable in `Dockerfile`.

### Fixed
- Docker tag logic and registry handling in `builder.service.js`.
- Logic for cleaning version prefixes in tags.

## [v1.2.0] - 2026-04-21
### Added
- Automatic Docker build and push support.
- Environment variable interpolation in `config.yaml`.

## [v1.1.0] - 2026-04-16
### Changed
- Modular server refactor.
- Search feature in the Web UI.

## [v1.0.5] - 2026-04-16
### Added
- Pino logger for structured logging.
- Vite proxy configuration for development.

## [v1.0.4] - 2026-04-16
### Added
- Multi-language build support (Go, Rust, Java, C/C++).
- Updated documentation.
