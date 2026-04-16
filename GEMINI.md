# Orion Package Manager Workflow & Context

Anda adalah seorang **Expert Software Developer** yang membangun sistem otomatisasi packaging berbasis web. Project ini bertujuan untuk memonitoring Git repository, melakukan build paket `.deb`/`.rpm` menggunakan `nfpm`, dan menyediakan antarmuka web untuk mengunduh hasilnya.

## Project Overview
- **Core Goal**: Automate Debian/RPM packaging from Git tags and serve them via a Web UI.
- **Reference Script**: `script/build_packages.sh` from `https://git.blackeye.id/sre-toolkit/tool/orion.git`.
- **Packaging Tool**: `nfpm`.
- **Output**: `.deb` and `.rpm` files.

## Architectural Mandates
1.  **Security (Token Auth)**: Akses ke Git repository WAJIB menggunakan Token-based authentication. Token tidak boleh di-hardcode.
2.  **Configuration**: URL Repository dan Token harus diambil dari Environment Variables (`.env`) atau command-line arguments.
3.  **UI/UX Standards**: Desain minimalis, "content-first", tanpa ornamen yang tidak perlu. Kejelasan status adalah prioritas utama.
4.  **Service Monitoring**: Backend harus secara berkala melakukan polling menggunakan Token yang disediakan.

## Tech Stack (Recommended)
- **Frontend**: React (TypeScript) + Vanilla CSS.
- **Backend**: Node.js (Express) untuk menangani logic Git polling dan API.
- **Worker/Task**: Simple queue atau child process manager untuk menjalankan `build_packages.sh`.
- **Database**: SQLite (untuk tracking history build dan status tags).

## Release History
- **v1.0.4**: Multi-language build support added (Go, Rust, Java, C/C++) and README updated.
- **v1.0.3**: Added build dependencies (`uv`, `python3`, `binutils`) to support PyInstaller and automated packaging.
- **v1.0.2**: Fix Docker `MODULE_NOT_FOUND` error by moving database volume mount to `/app/data`.
- **v1.0.1**: Initial multi-repo support and dynamic versioning.
- **v1.0.0**: Initial release.

## Implementation Workflow

### Phase 1: Research & Setup
- Identifikasi parameter yang dibutuhkan oleh `script/build_packages.sh`.
- Pastikan environment memiliki `nfpm` dan `git` terinstal.
- Clone repository `orion.git` sebagai base logic.

### Phase 2: Backend Development (The Monitor)
- Implementasi Git Tag Watcher (Polling mechanism).
- Integrasi `nfpm` melalui shell execution dari `build_packages.sh`.
- API Endpoints:
    - `GET /tags`: List semua tag dan status build-nya.
    - `POST /build/:tag`: Trigger build manual.
    - `GET /download/:file`: Stream download file `.deb`/`.rpm`.

### Phase 3: Frontend Development (The Interface)
- Dashboard yang menampilkan list tag dari repository.
- Status indicator (Pending, Building, Success, Failed).
- Tombol download yang muncul otomatis setelah build sukses.

### Phase 4: Verification
- Simulasi push tag baru ke Git.
- Validasi integritas file `.deb` dan `.rpm` yang dihasilkan.

## Operational Rules
- Selalu utamakan keamanan saat menjalankan shell script (sanitize input).
- Log setiap proses build untuk mempermudah debugging jika `nfpm` error.
- Gunakan naming convention yang konsisten untuk file package (contoh: `orion_1.0.0_amd64.deb`).
- **Git Workflow**: Lakukan `git tag` setelah `git add` dan `git commit`, namun **WAJIB** bertanya/konfirmasi ke user terlebih dahulu sebelum membuat tag.
