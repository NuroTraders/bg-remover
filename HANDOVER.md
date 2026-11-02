<!-- ... [Keep sections 1 through 7 exactly the same] ... -->

## 8. Task log
<!-- ... [Keep the old tasks] ... -->
- **Task 10 (done, tested):** **AI model card inside the app**. Choices: Fast (built in), High quality (BiRefNet lite 512 fp16, about 100 MB), High quality compatible (fp32, about 192 MB). Download with progress, kept in Cache Storage. `Redo all images with ...` button re-runs every image. If High quality fails, it falls back to Fast. Masks stored with size. Models are successfully loading and generating high-quality results via WebGPU. 
- **Task 11 (Phase 1 Complete): Commercial Polish & UI** 
    - **Menu & Modals:** Added a hamburger menu in the top bar containing Modals for Help/Tutorial, About, Change Log, and Contact.
    - **Theme Toggle:** Added a manual Light/Dark theme toggle button next to the menu. Saves preference to `localStorage`.
    - **Cleanup:** Instructed user to delete `android/`, `dist/`, and `node_modules/` from the repo to prepare for GitHub Actions. Confirmed `.gitignore` ignores `models` and `ort`.
    - Files: `www/index.html`, `www/style.css`, `www/app.js`.
- **Task 12 (Phase 2 Complete): Core UX Wins**
    - **Background Blur:** Added a "Blur" swatch to the background options. It creates a blurred version of the original image using a canvas filter and caches it as a data URL for preview and export.
    - **Touch-up Brush:** Added a floating brush toolbar over the viewer. Users can toggle "Restore" (paint subject back) or "Erase" (remove background). Includes a brush size slider and an Undo button.
    - **Brush Architecture:** Strokes are recorded as arrays of points in `item.brushStrokes`. During `composeCutout`, these strokes are drawn onto a temporary mask canvas (using `destination-out` for erase and `source-over` for restore) before the `destination-in` composite is applied to the final image.
    - Files: `www/index.html`, `www/style.css`, `www/app.js`.

## 9. Next Steps
1. **AI & Performance:** Implement COOP/COEP headers in `wrangler.jsonc` and `electron/server.js` to enable multi-threading for the Fast model.
2. **Export:** Add "Copy to Clipboard" button and custom batch naming.
3. **Desktop (EXE):** Bundle the Fast and 100MB HQ models directly into the EXE using `extraResources` in `electron-builder.yml` (exclude the 192MB model to save space).
4. **GitHub Actions:** Write `.github/workflows/build.yml` to automate building the Windows `.exe` and deploying the PWA.