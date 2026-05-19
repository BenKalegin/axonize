# OSS release TODO

Phased plan for taking axonize from private repo to a clean public OSS release with code-signed Mac + Windows binaries. Each item marks owner (**you** or **claude**) so the work can be handed back when a phase is unblocked.

---

## Phase 1 — Repo hygiene (before flipping public)

### You
- [ ] **Scan git history for committed secrets.** `gitleaks detect --no-banner` or `trufflehog filesystem --directory=.`. Any hits → rewrite history with `git filter-repo` before going public.
- [ ] **Confirm `.gitignore`** covers `.env*`, `secrets.*`, `*.p12`, `*.pfx`, `credentials.json`, `dist/`, build artifacts.
- [ ] **Audit hardcoded references.** Search the codebase for internal URLs, your real email beyond commit metadata, in-house service hostnames, customer names:
  ```bash
  rg -i "infor|internal|veniamin.kalegin@" src/
  ```
- [ ] **Decide on a license.** MIT (matches doodles/filigree) is the default; tell claude which to use.

### Claude (when greenlit)
- [ ] Add top-level `LICENSE` (MIT, your name as copyright holder, current year).
- [ ] Add a real `README.md` — what axonize is, screenshots, quick install link to the GitHub release, link to docs.
- [ ] Add `CONTRIBUTING.md` with dev setup (`pnpm install`, `pnpm dev`, `pnpm test`).
- [ ] Add `SECURITY.md` with a "report security issues to <email>" line.
- [ ] Add issue templates (`.github/ISSUE_TEMPLATE/bug.yml`, `feature.yml`).
- [ ] Add PR template (`.github/PULL_REQUEST_TEMPLATE.md`).
- [ ] Polish `package.json` — `description`, `homepage`, `bugs.url`, `repository.url`, `keywords`, `author`.

## Phase 2 — Flip the repo public

### You
- [ ] `gh repo edit BenKalegin/axonize --visibility public` (or web UI for the confirmation dialog).
- [ ] Set repo description + topics on the About panel (e.g. `electron`, `markdown`, `mermaid`, `obsidian-alternative`).
- [ ] (Optional) Enable Discussions as the support channel.
- [ ] (Optional) Enable GitHub Pages on a `gh-pages` branch if you want a project landing page.

## Phase 3 — macOS signing (Apple Developer)

### You — Apple side (~1 hr first time)
- [ ] Sign up at https://developer.apple.com/programs/ — $99/yr, ~24 hr for verification.
- [ ] Enable 2FA on the Apple ID if not already.
- [ ] At https://developer.apple.com/account/resources/certificates → create a **Developer ID Application** certificate. Install into Keychain.
- [ ] In Keychain Access, export the cert + private key as `.p12`. Strong password.
- [ ] Base64-encode: `base64 -i Developer_ID_Application.p12 -o cert.b64`
- [ ] At https://appleid.apple.com → Sign-In and Security → App-Specific Passwords → generate one named "axonize CI notarization". Save it.
- [ ] Find your **Team ID** at https://developer.apple.com/account (top of page).

### You — add 5 repo secrets (https://github.com/BenKalegin/axonize/settings/secrets/actions)
- [ ] `MAC_CERT_P12_BASE64` — contents of `cert.b64`
- [ ] `MAC_CERT_PASSWORD` — the `.p12` password
- [ ] `APPLE_ID` — Apple ID email
- [ ] `APPLE_APP_SPECIFIC_PASSWORD` — from the App-Specific Passwords page
- [ ] `APPLE_TEAM_ID` — 10-character team ID

### Claude
- [ ] Update electron-builder config: `"hardenedRuntime": true`, `"gatekeeperAssess": false`, `"entitlements"` file, `"notarize": true`.
- [ ] Add `build/entitlements.mac.plist` with electron-builder defaults + any extras axonize needs.
- [ ] Wire the 5 env vars into the Mac job of `.github/workflows/release.yml`.
- [ ] Bump axonize, tag, watch CI.

### You — verify
- [ ] Download the DMG from the release on a clean Mac, confirm it opens with no Gatekeeper warning.

## Phase 4 — Windows signing (SignPath.io OSS)

### You — SignPath side (~10 min config + 1–3 day approval wait)
- [ ] Apply at https://signpath.org/foundation → fill in axonize repo URL, OSS license, project description.
- [ ] Once approved: create a project in your SignPath dashboard linked to `BenKalegin/axonize`.
- [ ] Create a **signing policy** (e.g. `release-signing` — choose certificate, allow public release).
- [ ] Generate an **API token** scoped to the project.
- [ ] Note `organization ID`, project slug, signing policy slug.

### You — add repo secret + 3 vars
- [ ] Secret: `SIGNPATH_API_TOKEN` — the API token
- [ ] Variable: `SIGNPATH_ORG_ID`
- [ ] Variable: `SIGNPATH_PROJECT_SLUG`
- [ ] Variable: `SIGNPATH_SIGNING_POLICY_SLUG`
  (Variables live at https://github.com/BenKalegin/axonize/settings/variables/actions)

### Claude
- [ ] Update workflow: after the Windows build, upload unsigned artifact via `signpath/github-action-submit-signing-request`, wait for completion, download signed artifact, attach to release.

### You — verify
- [ ] Download the installer + portable from a release on a clean Windows VM, confirm no SmartScreen "Unknown publisher" warning.

## Phase 5 — Auto-update (optional)

- [ ] **Decide**: should axonize auto-update from GitHub releases?
- [ ] If yes — claude adds `electron-updater` + check-for-updates flow in the renderer.
- [ ] Confirm electron-builder's `publish: { provider: 'github' }` is set; signed artifacts on the release are the update channel — nothing more server-side.

---

## Estimates

| Phase | Cost | Time-to-done |
|---|---|---|
| 1. Hygiene | $0 | ½ day |
| 2. Flip public | $0 | 5 min |
| 3. Mac signing | $99/yr | 1 hr after Apple verifies you |
| 4. Windows signing (SignPath OSS) | $0 | 1 day wait + 30 min config |
| 5. Auto-update | $0 | 1 hr |

Total: **$99/yr**, ~2 days elapsed (mostly waiting on Apple + SignPath approvals).

---

## Notes for claude when resuming

- Phase 3 + 4 "claude" items can be done in parallel with the user's certificate/approval work. The workflow changes are isolated from the rest of the codebase.
- Phase 1 "claude" items (LICENSE, README, templates, package.json polish) can be done first as a single PR — they don't block anything else.
- When updating `.github/workflows/release.yml`, preserve the existing structure and just add env vars / steps; the matrix (windows-latest, macos-latest) stays the same.
