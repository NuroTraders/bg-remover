# HANDOVER: BG Remover (PWA + APK + EXE)

One file for the whole project. New entries are added to the Task log at the bottom after each task.

## 1. Goal
Free, offline image background remover, **PC first**. Delivered as:
1. **PWA** (primary): hosted free on Cloudflare (and GitHub Pages as a backup), installable, works offline
2. **EXE**: Windows app (Electron): installer and portable
3. **APK**: Android app (Capacitor). **ON HOLD** by the user's decision.

Everything must be free. One web codebase (`www/`) serves all three.

## 2. Decisions
| Topic | Decision |
|---|---|
| Core | HTML + CSS + JavaScript, no framework |
| AI | onnxruntime-web (wasm, multi-threaded if headers allow) + U2Netp model |
| Hosting | Cloudflare (main) and GitHub Pages (backup via Actions) |
| Quality strategy | Optional **High quality mode** = user-initiated BiRefNet Lite download (100MB/192MB), cached on the device and omitted from the Windows installer. Remember the selected model between launches. |
| Work rules | Claude writes all code. Only changed or new files are delivered, with their folder. One HANDOVER.md only |

## 3. Environment (user's PC)
Windows, Node.js v24.22.0, npm 11.19.1, Git 2.56.0, VS Code. onnxruntime-web v1.31.1.

## 4. Project structure
- Lockfile: ran npm install, package-lock.json had real changes (missing electron-builder packages), committed as c41466c and pushed to origin/main. Next: verify GitHub Actions build passes.
- Release fix: build.yml only creates a GitHub Release on a `v*` tag push (not on main). Added latest.yml and *.blockmap to artifact and release uploads for the auto-updater. Next: match tag to package.json version, then push tag.
- Release: package.json version is 1.5.0 (only old tag was v0.1.0). Created tag v1.5.0 on bfa39ff and pushed it to trigger the Release build. Next: verify the Release page has .exe, .blockmap and latest.yml.
- Tag v1.5.0 pushed to origin. Waiting on the GitHub Actions run to confirm the Release has .exe, .blockmap and latest.yml.
- Actions run #7 (v1.5.0 build) started and in progress. Next: confirm green check, then check the Releases page for .exe, .blockmap and latest.yml.
- Release v1.5.0 published on GitHub (marked Latest) by the tag build. Next: confirm Assets list .exe, .blockmap and latest.yml.
- Release v1.5.0 verified: Assets list Setup .exe, Portable .exe, .blockmap and latest.yml. Windows installer now downloads from the Releases page, not the Actions zip. Future releases: bump version in package.json, then push a matching v* tag.
- Startup crash fix (v1.5.1): the installed v1.5.0 EXE showed "Cannot find module 'electron-updater'" because electron-updater was in devDependencies and was not bundled into app.asar. Commit 12cd4dd moved it to dependencies, but the version stayed 1.5.0 so no new Release EXE was built. v1.5.1: bumped package.json to 1.5.1, updated the version strings and Change Log in www/index.html, and made the electron-updater require optional in electron/main.js so the app always starts. Next: run npm install (syncs package-lock.json version), commit, push tag v1.5.1 to trigger the Release build, then verify Release assets (.exe, .blockmap, latest.yml) and test the installed EXE.

## 5. Current release workflow
- Cloudflare remains the primary host through its separate deployment setup; `.github/workflows/deploy.yml` is the sole GitHub Pages publisher and serves as backup. `.github/workflows/build.yml` only builds Windows artifacts and publishes tagged GitHub Releases.
- Windows builds verify U2Netp against its expected byte count and SHA-256. BiRefNet Lite is offered as an explicit on-demand download from the app, saved in browser storage, and excluded from Windows installer resources even if a local model file exists. Its MIT license is included under `www/models/BIREFNET-LICENSE.txt`.
- A `v*` release tag must match `package.json`; the packaged Windows app must pass `--smoke-test` before artifact upload. Build and pull request jobs use read-only contents permission; only the tagged release job receives release write permission.

## 6. Task log
- 2026-11-27: Implemented the first planned release-reliability work. Removed the competing Pages deploy from `build.yml`, kept the official `deploy.yml` publisher, added U2Netp integrity verification, added tag/version validation and packaged app smoke testing, and isolated release write permissions. Reviewed the workflow and script changes locally; GitHub Actions must verify the Windows package and deployment.
- 2026-11-27: Prepared release version 1.5.2 and updated the app display version and npm lockfile to match. The 1.5.2 tag was created before the HQ packaging failure was reported.
- 2026-11-27: Fixed high-quality model behavior after the v1.5.2 build found the bundled model checksum did not match. Removed HQ model bundling from CI and the installer path, restored explicit on-demand downloads, persisted model choice, and added automatic restoration of a cached selected model when the app reopens. Release v1.5.3 is tagged.
- 2026-11-27: The v1.5.3 packaged smoke log showed `electron-updater` was missing from `app.asar`. Removed the blanket `node_modules` exclusion so electron-builder includes production dependencies, moved the build-only ONNX package to development dependencies, changed the workflow to capture the process exit code directly, and made the smoke test fail clearly if the updater is absent. Prepared version 1.5.4.
