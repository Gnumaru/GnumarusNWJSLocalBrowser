# Features Summary

- Local-only HTTP server on port 1024 serving a user-selected directory.
- Directory listing when no index.html is present.
- Path traversal protection.
- Loopback-only request filtering.
- CLI directory argument with fallback directory picker.
- CLI file argument: serving the containing directory and loading the file immediately.
- NW.js window with node integration for browsed content.
- Address bar displaying current URL with local-only navigation (port 1024).
- Back/Forward navigation buttons immediately to the left of the address bar.
- Direct window navigation with injected toolbar (no webview).
- Node.js API available inside every served page via NW.js `node-remote`.
- Injected toolbar element IDs namespaced (`lb-*`) to avoid collisions with served pages.
- TypeScript with strict typing.
- Showcase "File Manager" app (`showcase/filemanager`): pure HTML/CSS/TypeScript, no external dependencies, using the NW.js Node API for listing, creating folders/empty files, metadata and text preview.
- Desktop distribution via `nw-builder` (NW.js 0.118.0 pinned): `npm run dist:linux` and `npm run dist` (linux/win/osx).
- `README.md` documenting the app, build, packaging and usage of the generated executable.
