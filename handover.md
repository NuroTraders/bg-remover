# HANDOVER: BG Remover (PWA + APK + EXE)

One file for the whole project. New entries are added to the Task log at the bottom after each task.

## 1. Goal
Free, offline image background remover, **PC first**. Delivered as:
1. **PWA** (primary): hosted free on Cloudflare (and GitHub Pages as a backup), installable, works offline
2. **EXE**: Windows app (Electron): installer and portable
3. **APK**: Android app (Capacitor). **ON HOLD** by the user's decision (Task 6/7 results: about 12 s per photo on the phone). The `android/` folder and `capacitor.config.json` stay in the repo untouched. The phone Save / Share code (Capacitor Filesystem + Share) was removed from `app.js` in Task 8 and is still in the Git history (Task 7 version).

Everything must be free. One web codebase (`www/`) serves all three.

## 2. Decisions
| Topic | Decision |
|---|---|
| Core | HTML + CSS + JavaScript, no framework |
| AI | onnxruntime-web (wasm, single thread) + U2Netp model (Apache 2.0, about 4.5 MB) |
| Avoid | RMBG-1.4 (non-commercial license) |
| Hosting | Cloudflare (main, much faster in Bangladesh, free) and GitHub Pages (backup) |
| Quality strategy | A server ("online mode") is NOT needed: no free always-on GPU server exists, and the quality comes from the model, not from being online. Plan: optional **High quality mode** = one-time download of a better model (BiRefNet lite, MIT license) that runs locally on the PC's graphics card with WebGPU, falling back to the fast model |
| Windows | Electron (planned) |
| Android | Capacitor (planned) |
| Work rules | Claude writes all code. Only changed or new files are delivered, with their folder. One HANDOVER.md only |

## 3. Environment (user's PC)
Windows, Node.js v24.22.0, npm 11.19.1, Git 2.56.0, VS Code. onnxruntime-web v1.31.1.

## 4. Project structure