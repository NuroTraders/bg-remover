# BG Remover

Free, on-device background removal for product photos and everyday images.

**Crafted with ❤️ by NasirPintu.** The app processes images on your device. An internet connection is used when you choose to download the optional high-quality model and when the Windows app checks for updates.

## Creator

**NasirPintu** (Mohammad Nasiruddin Pintu) · Creator and Product Architect

- GitHub: [@nasiropintu](https://github.com/nasiropintu)
- X: [@nasiropintu](https://x.com/nasiropintu)
- Instagram: [@the_np2](https://www.instagram.com/the_np2/)
- Facebook: [mohammadnasiruddin.pintu](https://www.facebook.com/mohammadnasiruddin.pintu/)

## Models and open-source acknowledgements

- [**U²-Net / U2Netp**](https://github.com/xuebinqin/U-2-Net) powers the built-in fast model (Apache 2.0).
- [**BiRefNet Lite**](https://huggingface.co/shozebDev/birefnet-lite-512-onnx) is the optional high-quality model (MIT). Its license is included at [`www/models/BIREFNET-LICENSE.txt`](www/models/BIREFNET-LICENSE.txt).
- [**ONNX Runtime Web**](https://github.com/microsoft/onnxruntime) runs image models in the browser.
- [**Electron**](https://www.electronjs.org/) provides the Windows desktop app; [**electron-updater**](https://github.com/electron-userland/electron-builder/tree/master/packages/electron-updater) handles its update checks.

Each model and software dependency retains its own license. This repository does not declare a separate license for the complete application.

## Run locally

```sh
npm ci
npm run setup
npm run start
```

To open the Windows desktop app during development, run `npm run desktop` after setup.
