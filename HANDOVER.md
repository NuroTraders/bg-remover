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
| Quality strategy | Optional **High quality mode** = download of BiRefNet lite (100MB/192MB). 100MB bundled directly inside the EXE. |
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
