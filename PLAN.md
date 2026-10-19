# Plan: NW.js Local Browser

## Goal
Build initial version of a NW.js desktop app that is both a local-only web server and a browser for files in a chosen directory.

## Approach
- Use NW.js with a Node.js backend inside the app.
- Parse target directory from CLI args; if missing, show a directory picker dialog.
- Start an HTTP server bound to 127.0.0.1 on port 1024 serving the chosen directory.
- Provide directory listing when no index.html exists.
- Render navigated HTML with NW.js node integration (allownw).
- Reject/block any request not originating from loopback.

## Files
- package.json
- index.html (app shell)
- src/main.js (bootstrap)
- src/server.js (local HTTP server)
- src/dialog.js (directory picker helpers)
- assets/styles.css
- tmp/ (scratch)

## Direct Window Navigation with Injected Toolbar
- Remove `<webview>` element; window navigates directly to `http://localhost:1024/...`
- Server injects `src/toolbar.js` into every HTML response
- `index.html` becomes a shell with only the directory picker
- `src/shell.js` handles picker, starts server, then sets `window.location.href` to the server URL
- Injected `src/toolbar.js` recreates the toolbar on each loaded page
- Back/Forward use native `window.history.back()` / `window.history.forward()`
- Address bar shows `window.location.href` and updates on `popstate`

## Address Bar
- Add `<input>` to toolbar showing current URL
- Listen to `<webview>` `urlupdate` event to refresh displayed URL
- Validate typed URLs: allow only `127.0.0.1:1024` / `localhost:1024`
- Add "Go" button at the right end of the address bar
- Add Back/Forward navigation buttons to the left of the address bar
- Navigate on Enter key or Go button click

## TypeScript Migration
- Convert all `src/*.js` files to `src/*.ts` with strict typing
- Add `tsconfig.json` with `strict: true`
- Build step compiles `src/*.ts` (including `toolbar.ts`) to `dist/*.js` before NW.js launch
- Server serves compiled `dist/toolbar.js` at `/__toolbar.js`
- Update `package.json` scripts: `build` and `start` (build then launch)
- Update server test to run via `ts-node` or compiled output

## Bugfix: App Shell Not Loading Compiled JS (2026-10-19)
- Symptom: `npm run start -- /dir` shows only the directory input; Start button does nothing.
- Root cause hypothesis: `index.html` still references `src/shell.js`, but `tsc` outputs to `dist/shell.js` (`src/shell.js` no longer exists), so no script runs at all.
- Related issues to check: stale `./src/*.js` paths in `shell.ts` / `toolbar.ts` `nw.require` calls, duplicate `nw` declaration in `types.d.ts`.
- Fix: point `index.html` at `dist/shell.js`; point all runtime `nw.require` calls at `./dist/*.js`; dedupe `nw` global declaration.
- Verify: `npm run build` clean, server tests pass, plus an automated shell-logic test (mocked DOM + mocked `nw`) covering CLI-dir autostart and Start-button flow, and an HTTP end-to-end check (listing, file, 404, toolbar injection).

## node-remote Fix (Node API in Served Pages)
- Discovery (verified via NW.js probe): pages served over `http://127.0.0.1:1024` had no Node integration (`require`/`nw`/`process` undefined), contradicting the original requirement that the Node API be available to browsed pages.
- Fix: add `"node-remote": ["http://localhost:1024/*", "http://127.0.0.1:1024/*"]` to `package.json`.
- Verified: served page now exposes `require` (function), `nw` (object), `process`, `fs.readdirSync`, `os.homedir()`.
- Also fixes the injected toolbar's "Choose Directory" button (previously had no `nw`).
- Module format (verified): ES modules (`<script type="module">`) work and retain Node access; use `module: es2020` for showcase apps.

## Showcase: File Manager (showcase/filemanager)
- Pure HTML + CSS + TypeScript, no external dependencies.
- Uses the NW.js-exposed Node API for typical file-manager operations:
  - List directory entries (name, size, modified date), sorted folders-first.
  - Create directories and empty files (safe name validation, no overwrite).
  - View file metadata (type, size, timestamps, permissions, symlink flag, readable/writable).
  - Preview text-file contents (binary detection, truncation cap).
  - Navigate (up/home/refresh/jump-to-path) and delete entries.
- Architecture: ES modules (`src/*.ts` -> `dist/*.js`), own `tsconfig.json`, built via `npm run build:showcase`.
- Start directory: `?dir=` query param -> `window.__SERVED_DIR__` -> OS home.

## Testing
- Download/run NW.js binary once available.
- Start server manually via node to validate listing and traversal protection.
- Showcase integration test: launch NW.js, load real compiled modules in a served page, exercise fs operations and DOM, report results back over HTTP.

## CLI File Argument (2026-10-19)
- Goal: `npm start -- /path/to/file.html` serves the containing directory and loads the file immediately.
- `src/shell.ts`: add `resolveServeTarget(raw)` — `statSync` check; if file, `rootDir=dirname`, `initialPath=/<basename-encoded>`; else `rootDir=input`, `initialPath=/`.
- `startServerFor(input)` resolves target, then navigates to `base + initialPath` on ready.
- Same logic applies to manual path input in the picker and to CLI argv (`pickTargetFromArgv`).
- Nonexistent paths fall through to directory behavior so the server surfaces the error.
- Verify: `npm run build` clean, unit check of `resolveServeTarget` (file/dir/missing/space-in-name), existing `test:server` passes.

## Regression Fix: shell exports + index.html argv filter (2026-10-19)
- Symptom: after the CLI-file change, the app only shows the directory picker; CLI dir, CLI file and the Start button all do nothing.
- Root cause 1: `export` keywords added to `src/shell.ts` make `tsc` (commonjs) emit top-level `Object.defineProperty(exports, ...)` in `dist/shell.js`. That file loads via a plain `<script>` tag in `index.html`, where `exports` does not exist, so the whole script throws before `init` registers — every entry path dies.
- Fix 1: no `export` in `src/shell.ts` (plain script output, as before); expose test hooks via `(globalThis as any)` instead.
- Root cause 2: `getArgv()` fallback filter drops every arg matching `/index\.html$/`, which discards a legitimate user target like `showcase/filemanager/index.html`.
- Fix 2: only drop the app's own shell (`<cwd>/index.html` or bare `index.html`), never a user's file in another directory.
- Verify: `dist/shell.js` contains no `exports`; `getArgv` keeps `.../filemanager/index.html`; stubbed-DOM init test for CLI dir, CLI file (incl. `index.html`), manual Start-button flow; HTTP end-to-end; `test:server` passes.

## Distribution Packaging with nw-builder (2026-10-19)
- Goal: reproducible desktop packages (starting with Linux x64) via the official `nw-builder`, NW.js pinned to 0.118.0.
- Steps: `npm install -D nw@0.118.0 nw-builder`, update `allowScripts` to `nw@0.118.0`, add `dist`/`dist:linux` scripts (`npm run build && nwbuild --platforms linux --arch x64 -o ./release ./`), exclude dev-only files from the package.
- Verify: `npm run dist:linux` succeeds and `./release/` contains a runnable Linux executable.
- Verified 2026-10-19: `npm run dist:linux` produced `./release/nwjs-local-browser` (NW.js 0.118.0 normal, linux x64) with a clean `package.nw` (only `package.json`, `index.html`, `dist/`, `assets/`, `showcase/` — no `node_modules`/`tmp`/tarballs). Launched the packaged binary with a test dir, got HTTP 200 with page content + toolbar injection on `127.0.0.1:1024`.
- Verified 2026-10-19: packaged binary with a relative path arg (`showcase/filemanager/index.html`) served the File Manager page (HTTP 200, `fm-toolbar` present); `npm start -- <path>` forwards the arg to `nw . <path>` and serves correctly.
- `README.md` written: app overview, requirements, install, build, packaging (`nw-builder`), executable usage (directory / HTML file / no args), toolbar, security, project layout, scripts, showcase, troubleshooting.
