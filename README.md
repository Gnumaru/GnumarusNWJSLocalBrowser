# NW.js Local Browser

A cross-platform desktop app (Windows, Linux, and macOS) that acts as both:

- a **local web server** that publishes a directory from your machine at `http://127.0.0.1:1024`;
- a **browser** for the HTML pages inside that directory, rendered inside the app's own window.

It is built for web development: you open your own page as if it were a real site
(`http://localhost:1024/...`) with the **Node.js API available inside the page**, something a
regular Chrome browser cannot offer.

---

## Table of Contents

- [What the app does](#what-the-app-does)
- [Requirements](#requirements)
- [Installation](#installation)
- [Building the code](#building-the-code)
- [Generating the executable](#generating-the-executable)
- [Using the executable](#using-the-executable)
  - [Serving a directory](#serving-a-directory)
  - [Opening an HTML page directly](#opening-an-html-page-directly)
  - [Running with no arguments](#running-with-no-arguments)
- [The shell screen](#the-shell-screen)
- [The injected toolbar](#the-injected-toolbar)
- [Security](#security)
- [Project layout](#project-layout)
- [Available scripts](#available-scripts)
- [Showcase example: file manager](#showcase-example-file-manager)
- [Troubleshooting](#troubleshooting)

---

## What the app does

1. You provide a **directory** (or an **HTML file**) on the command line, or pick a directory
   through a native operating system dialog.
2. The app starts an HTTP server bound to `127.0.0.1` on **port 1024**, publishing the
   contents of that directory.
3. The app window then browses the served pages, with a toolbar injected into every page
   (back, forward, address bar, reload).
4. If a directory has no `index.html`, the server generates a navigable **file listing**.
5. Served pages run with **Node.js enabled** (`require`, `nw`, `process`, `fs`, `os`, and so
   on), thanks to the `node-remote` setting in `package.json`.

---

## Requirements

- **Node.js 18+** (developed and tested with Node 24).
- **npm 10+**.
- To produce packages: internet access on the first run (the `nw-builder` downloads the
  NW.js runtime, roughly 100 MB per platform).

---

## Installation

```bash
npm install
```

> `npm install` downloads the NW.js 0.118.0 runtime (the `nw` dependency, pinned to the
> exact version `0.118.0`). That dependency's `postinstall` needs permission: in environments
> with restrictive `allowScripts`/`ignore-scripts` settings, approve the package first:
>
> ```bash
> npm install-scripts approve nw
> ```

---

## Building the code

The source code is **TypeScript** (`src/*.ts` and `showcase/filemanager/src/*.ts`) and is
compiled to JavaScript in the `dist/` folder:

```bash
npm run build
```

This runs:

| Command                                             | What it does                                            |
| --------------------------------------------------- | ------------------------------------------------------- |
| `tsc`                                               | compiles `src/*.ts` into `dist/*.js` (main app)         |
| `tsc -p showcase/filemanager/tsconfig.json`         | compiles the showcase into `showcase/filemanager/dist/*.js` |

Optional sub-commands:

```bash
npm run build:app        # main app only
npm run build:showcase   # showcase (file manager) only
```

> `dist/` is listed in `.gitignore` and is **not** versioned. That is why the build runs
> automatically before `npm start` and before the executables are produced.

---

## Generating the executable

Packaging uses the official [`nw-builder`](https://github.com/nwutils/nw-builder) (version
`4.24.0`), with the NW.js runtime pinned to **0.118.0** (normal flavor, no developer tools).

### Linux

```bash
npm run dist:linux
```

### Linux, Windows, and macOS

```bash
npm run dist
```

The output lands in `./release/`:

```
release/
|-- nwjs-local-browser          # Linux x64 executable
|-- nwjs-local-browser.desktop  # menu entry (Linux)
|-- package.nw/                 # app files (HTML, compiled JS, assets)
`-- lib/  locales/  *.pak  ...  # Chromium/NW.js runtime
```

### Equivalent command (advanced)

```bash
npm run build && nwbuild --mode=build --version=0.118.0 --flavor=normal \
  --platform=linux,win,osx --arch=x64 --outDir=./release \
  "./package.json ./index.html ./dist/** ./assets/** ./showcase/**"
```

- `--version=0.118.0` pins the runtime version for reproducible builds.
- `--flavor=normal` selects the production build, without developer tools.
- The final list of paths defines what goes into the package: only `package.json`,
  `index.html`, `dist/`, `assets/`, and `showcase/`. No `node_modules`, no `tmp/`, no
  tarballs.

### Where to host and distribute

The app is a **desktop** app, not a website: "web distribution" means hosting the files in
`./release/` (one directory per platform) for download.

- **Linux**: ship the whole `release/` folder (or a `.tar.gz`/AppImage, if you package it
  yourself).
- **Windows**: the generated folder contains `nwjs-local-browser.exe`.
- **macOS**: the generated folder contains `nwjs-local-browser.app`.

> Unsigned binaries trigger a security warning (SmartScreen on Windows, Gatekeeper on
> macOS). Broad distribution requires code signing (Microsoft Authenticode / Apple
> Developer ID plus notarization).

---

## Using the executable

The executable accepts a single argument: a path to a directory **or** to an HTML file.
Paths containing spaces must be quoted.

### Serving a directory

```bash
# Linux
./release/nwjs-local-browser /home/user/my-site

# Windows
release\nwjs-local-browser.exe "C:\Users\me\my-site"

# macOS
./release/nwjs-local-browser.app/Contents/MacOS/nwjs-local-browser /Users/me/my-site
```

The app serves `/home/user/my-site` and opens `http://127.0.0.1:1024/` in the built-in
browser. If the directory contains an `index.html`, that page is opened; otherwise a file
listing is shown.

### Opening an HTML page directly

```bash
# absolute path
./release/nwjs-local-browser /home/user/my-site/index.html

# relative path (from the current directory)
./release/nwjs-local-browser showcase/filemanager/index.html
```

In this case the app:

1. **serves the directory that contains the file** (its `dirname`);
2. **opens the page immediately** at `http://127.0.0.1:1024/index.html`.

The directory remains browsable through the file listing and the address bar, but the first
load is the file you pointed at.

> The same logic applies to the app's text field: typing the path of an `.html` file starts
> the server on its parent directory and opens that file.

### Running with no arguments

Started without an argument, the app shows the selection screen with two options:

- **Choose Directory** opens the native system dialog (zenity/kdialog on Linux, AppleScript
  on macOS, `FolderBrowserDialog` on Windows);
- text field plus **Start**, where you type the path of a directory or of an HTML file.

### Checking that the server is up

```bash
curl -I http://127.0.0.1:1024/
```

---

## The shell screen

The main window (`index.html`) is only a shell: it collects the target directory, starts the
server, and navigates to `http://127.0.0.1:1024/`. From that point on, the served page is
what you see: the app behaves like a browser, with the real URL in the address bar.

---

## The injected toolbar

The server injects `dist/toolbar.js` into **every** HTML response, creating the toolbar at
the top of the page:

| Element            | Function                                                 |
| ------------------ | -------------------------------------------------------- |
| `Choose Directory` | switches the served directory without restarting the app  |
| `Left` / `Right`   | back and forward (native history)                        |
| address bar        | shows the current URL; press `Enter` to navigate         |
| `Go`               | navigates to the typed address                           |
| `Reload`           | reloads the page                                         |

Rules:

- only local addresses are accepted (`127.0.0.1:1024`, `localhost:1024`, `::1:1024`); the
  `:1024` port is added automatically when missing;
- toolbar element IDs use the `lb-` prefix so they never collide with IDs from served pages
  (a served page may have its own `#toolbar`, `#btnGo`, and so on).

---

## Security

- The server listens on `127.0.0.1` only, so it is not reachable over the network.
- Every request is checked: the source address must be loopback and the `Host` header must
  be `localhost`, `127.0.0.1`, or `::1`; otherwise the response is **403**.
- File resolution goes through `safeJoin()`, which blocks path traversal attempts such as
  `../../etc/passwd`.
- Served pages **do have access to Node.js**, so treat any content served by this app as
  trusted code, equivalent to running a local script.

---

## Project layout

```
.
|-- index.html                  # app shell (directory selection)
|-- package.json                # manifest plus build/dist scripts
|-- tsconfig.json               # strict TypeScript config (main app)
|-- assets/styles.css           # shell styles
|-- src/
|   |-- shell.ts                # boot: reads argv, resolves target, starts server
|   |-- server.ts               # local HTTP server (loopback only, port 1024)
|   |-- toolbar.ts              # toolbar injected into served pages
|   |-- dialog.ts               # native directory selection dialogs
|   |-- server.test.ts          # server test (real HTTP)
|   `-- types.d.ts              # type declarations for the `nw` global
|-- showcase/filemanager/       # example: file manager (plain HTML/CSS/TS)
`-- dist/                       # build output (gitignored)
```

---

## Available scripts

| Script                    | Description                                                      |
| ------------------------- | ---------------------------------------------------------------- |
| `npm start -- <path>`     | builds and launches the app with the given path                  |
| `npm run build`           | builds the app and the showcase                                  |
| `npm run build:app`       | builds the app only                                              |
| `npm run build:showcase`  | builds the showcase only                                         |
| `npm run dist:linux`      | builds the Linux x64 executable in `./release/`                  |
| `npm run dist`            | builds the Linux, Windows, and macOS executables in `./release/` |
| `npm run test:server`     | runs the HTTP server test (listing, file, traversal, host block) |

> With `npm start`, everything after `--` is forwarded to the app:
> `npm start -- /path/to/folder` or `npm start -- /path/to/page.html`.

---

## Showcase example: file manager

`showcase/filemanager/` is a complete file manager (HTML, CSS, and TypeScript, with no
external dependencies) that uses the Node API exposed inside the served page: directory
listing, folder and file creation, metadata (size, permissions, dates), text preview, and
item deletion.

```bash
npm start -- showcase/filemanager
```

It starts in the first location that is available: the `?dir=` query parameter, then
`window.__SERVED_DIR__` (the served directory), then the user's home directory.

---

## Troubleshooting

**The window stays on the selection screen and nothing happens when clicking Start.**
Make sure the build is up to date (`npm run build`) and that `dist/shell.js` exists.
`dist/shell.js` is loaded through a plain `<script>` tag, so it **must not** use TypeScript
`export` statements: the generated CommonJS module breaks the whole shell.

**`Cannot find module 'nw'`, or the app does not open after `npm install`.**
The `postinstall` of the `nw` dependency (the one that downloads the runtime) may have been
blocked. Run `npm install-scripts approve nw` followed by `npm rebuild nw`.

**Port 1024 is already in use.**
The app always uses the fixed port 1024. Close the process holding it (`lsof -i :1024` on
Linux) or terminate a previous instance of the app.

**A served page shows up without the toolbar.**
The toolbar is injected only into HTML responses served by the app. Pages generated
dynamically, or resources loaded through `file://`, do not get it.

**Security warning when opening the executable on Windows or macOS.**
The binary is unsigned. Choose "Run anyway" on Windows, or run
`xattr -d com.apple.quarantine <app>` on macOS.
