# BG Remover Development Plan

This plan turns BG Remover into a dependable, easy-to-use background remover for people who process product photos and other everyday images. Work in small milestones, keep the fast model free and offline, and use feedback from real users to choose later features.

## Product direction

**Primary user for the first release:** a small online seller who needs to remove backgrounds from product photos in batches without uploading images to a service.

**Product promise:** remove backgrounds on the user's device, export clean images quickly, and make it clear when a feature needs an internet connection.

**Guiding principles**

- Keep the fast model and basic exports free and usable offline after setup.
- Keep image processing on the user's device; disclose network use for model downloads and updates.
- Prefer reliable batch processing and clear recovery over adding many features at once.
- Keep the web app and Windows app on the same `www/` codebase where practical.
- Do not add accounts, telemetry, or image uploads without a clear product need and explicit privacy design.

## Milestone 0: Confirm the baseline

**Goal:** establish what is currently shipped and which deployment path is authoritative.

**Work**

- Confirm the GitHub `main` branch and local project are synchronized before implementation.
- Verify the current release version, installer assets, GitHub Pages configuration, and Cloudflare deployment setup.
- Record a baseline checklist for web, installed PWA, and Windows app behavior.
- Check the current fast and high-quality model sources, licenses, sizes, and runtime compatibility.

**Done when**

- The active hosting path and release process are documented.
- The team can reproduce the current web and Windows builds from a clean checkout.

## Milestone 1: Make releases reliable

**Goal:** avoid conflicting deployments and catch broken packages before release.

**Work**

- Choose one GitHub Pages deployment workflow and remove the competing publishing path.
- Keep Cloudflare deployment separate and document which host is primary versus backup.
- Run the existing Electron `--smoke-test` against the packaged Windows app in CI before artifacts are uploaded or released.
- Make required fast-model downloads fail clearly on HTTP errors, validate expected file size/format, and verify a committed checksum before packaging.
- Keep optional high-quality models out of the Windows installer. Download them only after the user chooses that model, explain the download size and license, and retain the downloaded model and selection between app launches.
- Use least-privilege workflow permissions per job and avoid release permissions on pull request jobs.
- Make release steps run only for the intended branch or version tag; check tag and package version agree.

**Done when**

- A main-branch build deploys the PWA once, without competing workflows.
- A tagged build verifies its packaged app before publishing installer files.
- A failed, truncated, or changed required model download stops the build with a useful error; optional high-quality models are absent from the Windows installer.

## Milestone 2: Improve the core batch workflow

**Goal:** help sellers process a set of product photos with fewer surprises.

**Work**

- Show useful per-image states for queued, processing, completed, and failed images.
- Let users retry failed images without restarting the whole batch.
- Make batch progress, cancel/clear behavior, and memory limits understandable.
- Improve export naming and ZIP export for batches; prevent accidental filename collisions.
- Review transparency, JPG background fill, WebP quality, resize, and target-size behavior.
- Add a small set of practical background presets (transparent, white, and a selected solid color) and preserve settings between sessions.
- Handle unsupported, corrupt, and unusually large images with clear recovery guidance.

**Done when**

- A user can add a batch, see which images need attention, retry failures, and export the results without losing completed work.
- Exports use predictable names and the selected format/background settings.

## Milestone 3: Build trust and improve onboarding

**Goal:** make privacy, offline use, and model choices easy to understand.

**Work**

- Explain that images are processed locally and identify the network actions that do occur (model downloads, updates, and optional external resources).
- Explain storage use and how to remove downloaded high-quality models.
- Show model download size, progress, compatibility requirements, and retry actions before starting a download.
- Improve first-run guidance for the fast offline model and optional high-quality model.
- Add version/update information and a clear path to report a problem.
- Review keyboard access, contrast, screen-reader labels, and small-screen layout.

**Done when**

- A first-time user can choose a model with a clear understanding of performance, download, and compatibility tradeoffs.
- Privacy and offline behavior are described accurately in the UI and project documentation.

## Milestone 4: Validate with target users

**Goal:** choose future work from evidence instead of assumptions.

**Work**

- Recruit 5–10 small sellers or product-photo users to try the current workflow.
- Ask them to complete a short task: process a small batch, correct an output if needed, and export marketplace-ready files.
- Collect feedback directly; do not add behavioral analytics by default.
- Track where users hesitate, what fails, output quality issues, and requested dimensions/formats.
- Rank follow-up work by user impact, implementation cost, and maintenance burden.

**Done when**

- A short findings note identifies the top three usability or output problems and their evidence.
- The next milestone is selected based on those findings.

## Milestone 5: Add one audience-specific upgrade

Choose only after Milestone 4. Candidate directions:

- **Marketplace export presets:** common image dimensions, white background, padding, and file-size targets for selected marketplaces.
- **Product-photo presets:** shadow preservation, subtle outline cleanup, and consistent background colors.
- **Higher-resolution processing:** improve detail on large source images while managing memory and device performance.
- **Desktop quality-of-life:** file/folder workflows, drag-and-drop folders, and a polished Windows installer/update experience.

For each candidate, validate the workflow and licensing requirements before implementation. Keep a free path for ordinary background removal. Do not add subscriptions or payment processing until users demonstrate a recurring need for a paid capability.

**Done when**

- One validated user problem has a complete, documented workflow and acceptance criteria.
- The upgrade works in the target environments and does not compromise the offline basic workflow.

## Ongoing quality bar

- Keep model files, runtime versions, and licenses traceable.
- Keep generated build output and downloaded dependencies out of source control unless intentionally needed.
- Review Electron navigation and external-link handling when adding new links or remote content.
- Keep error messages actionable and avoid exposing stack traces to ordinary users.
- For each code change, add or update focused automated checks where practical and manually verify the affected web/PWA/Windows path.
- Update `HANDOVER.md` when release steps or important product decisions change.

## Suggested first Codex task

Implement **Milestone 1: Make releases reliable**. Start by inspecting current GitHub Pages settings and release behavior, then propose the smallest workflow change that leaves exactly one Pages publisher. Add model integrity checks and run the existing packaged-app smoke test in the release workflow. Keep the change scoped, update `HANDOVER.md`, and report the exact verification performed.
