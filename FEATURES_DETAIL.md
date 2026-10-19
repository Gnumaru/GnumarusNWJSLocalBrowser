# Features Detail

## Local HTTP Server
`src/server.ts` exports `startServer(rootDir, onReady, onError)`. It creates an `http.Server` bound to `127.0.0.1:1024`. Every request is checked:
- `req.socket.remoteAddress` must be loopback.
- `Host` header must be localhost/127.0.0.1/::1.
Otherwise 403.

## Static File Serving
Files are resolved under the chosen root with `safeJoin`, preventing path traversal. MIME types are inferred from extension. Missing files return 404.

## Directory Listing
If a directory has no `index.html`, an HTML list of entries is generated with links, allowing navigation.

## CLI Directory
`src/shell.ts` reads `nw.App.argv` (or `process.argv`) for a directory argument.

## CLI File Argument
If the CLI (or manual picker input) path points to a file instead of a directory, `resolveServeTarget()` in `src/shell.ts` serves the file's containing directory (`dirname`) and navigates immediately to `/<basename>` (URL-encoded via `encodeURIComponent`). Directory inputs keep the previous behavior (navigate to `/`). Nonexistent paths fall through to directory handling so the server reports the error. Example: `npm start -- /path/to/page.html` serves `/path/to` and opens `http://127.0.0.1:1024/page.html`. Argument parsing only ignores the app's own shell (`<cwd>/index.html`); a user file that happens to be named `index.html` in another directory is kept. `src/shell.ts` must stay free of top-level `export` keywords because `dist/shell.js` loads via a plain `<script>` tag where CommonJS `exports` does not exist (a previous regression broke the whole shell this way); test hooks are exposed via `globalThis.__lbShellTest` instead.

## Directory Picker
If no directory is provided, a native OS directory dialog is opened (zenity/kdialog on Linux, osascript on macOS, FolderBrowserDialog on Windows). A manual path input is also available as fallback.

## Browsing View
Content is loaded directly in the NW.js window (no `<webview>`). The window config enables `nodejs` and `allownw`, preserving Node.js access for browsed pages.

## Node API in Served Pages (`node-remote`)
By default NW.js disables Node integration for pages loaded over `http://` (remote pages). A probe confirmed that served pages had `require`, `nw` and `process` all `undefined`. To satisfy the requirement that the Node API be available to browsed pages, `package.json` declares:

```json
"node-remote": ["http://localhost:1024/*", "http://127.0.0.1:1024/*"]
```

After this, served pages expose `require` (function), `nw` (object), `process`, and Node core modules such as `fs` and `os`. This also fixes the injected toolbar's "Choose Directory" button, which previously had no `nw`. ES modules (`<script type="module">`) keep Node access too.


## Port
Default port is 1024 (changed from 80 per user request).

## Navigation Buttons
Immediately to the left of the address bar, two buttons (`lb-btnBack` and `lb-btnForward`) call `window.history.back()` and `window.history.forward()` respectively, using native browser history.

## TypeScript
All scripts are written in TypeScript with strict mode enabled (`strict: true` in `tsconfig.json`). The build step (`npm run build`) compiles `src/*.ts` to `dist/*.js` via `tsc`. A shared type declaration file `src/types.d.ts` defines the NW.js `nw` global.

### Runtime module loading
At runtime, the app loads modules from `dist/`:
- `src/shell.ts` loads `dist/dialog.js` and `dist/server.js` via `nw.require`
- The HTTP server (`src/server.ts`) serves `dist/toolbar.js` at `/__toolbar.js`

## Direct Window Navigation
The app no longer uses a `<webview>`. Instead:
- `index.html` is a shell with only the directory picker and loads the compiled `dist/shell.js`
- `src/shell.ts` handles the picker, starts the server, then sets `window.location.href` to the server URL
- The HTTP server (`src/server.ts`) injects the compiled toolbar (`src/toolbar.ts` → `dist/toolbar.js`) into every HTML response via `injectToolbar()`
- The injected toolbar script recreates the full toolbar (back, forward, address bar, go, reload, choose directory) on each page
- Navigation uses `window.location.href` and native `window.history` for back/forward
- The server serves the toolbar script at `/__toolbar.js`

## Address Bar
The toolbar includes an `<input id="lb-addressBar">` and a "Go" button (`lb-btnGo`) at the far right. On load, the input is populated with `window.location.href`, and a `popstate` listener keeps it in sync. When the user types a URL and presses Enter (or clicks Go), the address bar value is normalized in two steps: (1) if it does not start with `http://` or `https://`, the prefix `http://` is automatically prepended; (2) `addPortIfAbsent()` checks whether a port digit already exists in the host portion — if not, `:1024` is inserted before the first `/`, `?`, `#`, or at the end of the string. The normalized value is written back to the input and then validated by `isAllowedUrl()`:
- Only `http://` or `https://` schemes (http is auto-prepended if missing).
- Host must be `127.0.0.1`, `localhost`, or `::1`.
- Port must be `1024` or empty (defaulting to 80 for http, which fails validation).

If validation fails, a status message is shown and navigation is aborted. On success, `window.location.href` is set to the typed URL.

## Toolbar ID Namespacing
The injected toolbar used generic element IDs (`toolbar`, `addressBar`, `btnGo`, ...). Any served page that used the same IDs collided with the toolbar — e.g. clicking a served page's own "Go" button triggered the toolbar's navigation handler and reloaded the page (observed as a ~430 ms reload loop while testing the showcase File Manager, which also had a `btnGo`). All toolbar element IDs were renamed with a `lb-` ("local browser") prefix: `lb-toolbar`, `lb-btnPickDir`, `lb-currentDir`, `lb-btnBack`, `lb-btnForward`, `lb-addressBar`, `lb-btnGo`, `lb-btnReload`. This keeps the toolbar isolated from arbitrary served content.

## Showcase: File Manager (`showcase/filemanager`)
A self-contained file manager built with pure HTML, CSS and TypeScript, with no external dependencies and no CDN. It uses the Node API exposed by NW.js (available thanks to `node-remote`).

### Files
- `index.html` — UI shell, loads `dist/main.js` as an ES module
- `styles.css` — dark theme, list + details/preview split layout
- `src/types.ts` — `EntryInfo`, `Listing`, `FileMetadata`, `TextResult`
- `src/format.ts` — `formatBytes`, `formatDate`, `modeToString`, `fileKind`
- `src/fsapi.ts` — Node `fs`/`path` operations
- `src/app.ts` — `FileManagerApp` (DOM wiring, rendering, actions)
- `src/main.ts` — entry point; resolves the start directory
- `src/globals.d.ts` — `nw`, `require`, `process`, `Buffer` declarations
- `tsconfig.json` — strict config, `src` → `dist`, `module: ES2020`
- Built by `npm run build:showcase` (also part of `npm run build`)

### Node API usage (`src/fsapi.ts`)
- `listDirectory(dir)` — `readdirSync(dir, { withFileTypes: true })` plus `lstatSync` per entry; sorted folders-first then case-insensitive alphabetical; returns `parentDir`.
- `createDirectory(dir, name)` — `mkdirSync` (fails if it already exists).
- `createFile(dir, name)` — `writeFileSync(..., { flag: 'wx' })`, creating an empty file without overwriting.
- `validateName` — rejects empty, `.`, `..`, path separators and NUL bytes (defense against traversal).
- `getMetadata(target)` — size, type, timestamps, `modeToString` permissions, octal mode, symlink flag, readable/writable via `accessSync`.
- `readTextFile(target, maxBytes)` — reads a capped buffer, detects binary via NUL byte, strips a UTF-8 BOM, reports truncation.
- `deleteEntry(target)` — `rmdirSync` for directories (fails on non-empty), `unlinkSync` otherwise.
- `isAvailable()` / `homeDir()` — capability detection and home resolution.

### UI (`src/app.ts`)
- Toolbar: Up, Home, Refresh, editable path input + Go, New Folder, New File, Delete.
- File list: name (with folder/file icon, symlink badge), size, modified date; clicking selects (shows details + preview), double-clicking a folder enters it.
- Details pane: name, path, type, size, modified/created/accessed, permissions, readable, writable.
- Preview pane: text content of the selected file (binary files and directories show a placeholder).
- Status bar for errors (e.g. opening an invalid path); `prompt`/`confirm` guard create and delete operations.

### Start directory
The app starts in, in order of precedence: the `?dir=` query parameter → `window.__SERVED_DIR__` (injected by the toolbar) → the OS home directory.

### ID isolation
All File Manager element IDs are prefixed `fm-` (e.g. `fm-btn-go`, `fm-path-input`) so they never collide with the injected `lb-*` toolbar.

## Distribution (`nw-builder`, NW.js 0.118.0)
Desktop packages are built with the official `nw-builder` (`nw-builder@4.24.0` devDependency, NW.js runtime pinned via `--version=0.118.0`, normal flavor). Scripts:
- `npm run dist:linux` — Linux x64 package in `./release/`.
- `npm run dist` — Linux + Windows + macOS x64 packages in `./release/`.

Both run `npm run build` first so the compiled `dist/` is included. Only app files are packaged (`package.json`, `index.html`, `dist/`, `assets/`, `showcase/` — no `node_modules`, `tmp/` or tarballs). Runtime `dependencies` are empty, so no `managedManifest` handling is needed. `./release/` and `./cache/` (binary download cache) are gitignored. The `nw` runner package is also pinned to `0.118.0` (with matching `allowScripts`) so `npm start` uses the same runtime as the packages.

## Integration Test Harness
`tmp/fmtest-run.js` launches the real NW.js app serving `tmp/fmtest`, whose `index.html` imports the compiled File Manager modules, exercises the fs API and the DOM (including the injected toolbar coexistence), and reports results back to a local HTTP listener. Run with `node tmp/fmtest-run.js`. It currently reports 38/38 assertions passing.
