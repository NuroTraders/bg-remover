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
| Hosting | Cloudflare (main) and GitHub Pages (backup) |
| Quality strategy | Optional **High quality mode** = download of BiRefNet lite (100MB/192MB) running locally via WebGPU. |
| Work rules | Claude writes all code. Only changed or new files are delivered, with their folder. One HANDOVER.md only |

## 3. Environment (user's PC)
Windows, Node.js v24.22.0, npm 11.19.1, Git 2.56.0, VS Code. onnxruntime-web v1.31.1.

## 4. Project structure