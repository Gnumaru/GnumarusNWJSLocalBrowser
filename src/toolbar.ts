'use strict';

/// <reference path="./types.d.ts" />

(function () {
  const TOOLBAR_CSS: string = `
    #lb-toolbar{position:fixed;top:0;left:0;right:0;display:flex;align-items:center;gap:8px;padding:8px;background:#222;color:#eee;z-index:2147483647;font-family:system-ui,sans-serif;box-sizing:border-box}
    #lb-toolbar button{padding:6px 10px;cursor:pointer;white-space:nowrap}
    #lb-toolbar input{flex:1;padding:6px 10px;font-size:14px;box-sizing:border-box;min-width:0}
    #lb-toolbar span{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
    body{padding-top:50px!important}
  `;

  function addPortIfAbsent(raw: string): string {
    const afterProto: string = raw.replace(/^https?:\/\//i, '');
    if (afterProto.length === 0) return raw;
    const match = afterProto.match(/^[^/?#]+/);
    const hostPart: string = match ? match[0] : '';
    if (!hostPart) return raw;
    if (/\d/.test(hostPart)) return raw;
    const rest: string = afterProto.slice(hostPart.length);
    const protoMatch = raw.match(/^https?:\/\//i);
    const proto: string = protoMatch ? protoMatch[0] : 'http://';
    return proto + hostPart + ':1024' + rest;
  }

  function isAllowedUrl(raw: string): boolean {
    try {
      const u = new URL(raw);
      const host: string = u.hostname;
      const port: string = u.port || (u.protocol === 'http:' ? '80' : u.protocol === 'https:' ? '443' : '');
      if ((host === '127.0.0.1' || host === 'localhost' || host === '::1') && (port === '1024' || port === '')) return true;
      return false;
    } catch (e) { return false; }
  }

  function navigateToAddressBar(addressBar: HTMLInputElement): void {
    let raw: string = (addressBar.value || '').trim();
    if (!raw) return;
    if (!/^https?:\/\//i.test(raw)) raw = 'http://' + raw;
    raw = addPortIfAbsent(raw);
    addressBar.value = raw;
    if (!isAllowedUrl(raw)) {
      alert('Only local addresses on port 1024 are allowed (127.0.0.1:1024 or localhost:1024)');
      return;
    }
    window.location.href = raw;
  }

  function injectToolbar(): void {
    if (document.getElementById('lb-toolbar')) return;

    const style = document.createElement('style');
    style.textContent = TOOLBAR_CSS;
    document.head.appendChild(style);

    const toolbar = document.createElement('header');
    toolbar.id = 'lb-toolbar';
    toolbar.innerHTML = `
      <button id="lb-btnPickDir" type="button">Choose Directory</button>
      <span id="lb-currentDir"></span>
      <button id="lb-btnBack" type="button">&larr;</button>
      <button id="lb-btnForward" type="button">&rarr;</button>
      <input id="lb-addressBar" type="text" placeholder="http://localhost:1024/" spellcheck="false">
      <button id="lb-btnGo" type="button">Go</button>
      <button id="lb-btnReload" type="button">Reload</button>
    `;
    document.body.insertBefore(toolbar, document.body.firstChild);

    const currentDirEl = document.getElementById('lb-currentDir');
    if (currentDirEl && (window as any).__SERVED_DIR__) {
      currentDirEl.textContent = (window as any).__SERVED_DIR__;
    }

    const addressBar = document.getElementById('lb-addressBar') as HTMLInputElement;
    const btnBack = document.getElementById('lb-btnBack') as HTMLButtonElement;
    const btnForward = document.getElementById('lb-btnForward') as HTMLButtonElement;
    const btnGo = document.getElementById('lb-btnGo') as HTMLButtonElement;
    const btnReload = document.getElementById('lb-btnReload') as HTMLButtonElement;
    const btnPickDir = document.getElementById('lb-btnPickDir') as HTMLButtonElement;

    function updateAddressBar(): void {
      addressBar.value = window.location.href;
    }
    updateAddressBar();
    window.addEventListener('popstate', updateAddressBar);

    btnBack.addEventListener('click', () => window.history.back());
    btnForward.addEventListener('click', () => window.history.forward());
    btnReload.addEventListener('click', () => window.location.reload());

    btnGo.addEventListener('click', () => navigateToAddressBar(addressBar));
    addressBar.addEventListener('keydown', (e: KeyboardEvent) => {
      if (e.key === 'Enter') { e.preventDefault(); navigateToAddressBar(addressBar); }
    });

    btnPickDir.addEventListener('click', async () => {
      try {
        const dialog = nw.require('./dist/dialog.js') as { chooseDirectory(): Promise<string | null> };
        const dir = await dialog.chooseDirectory();
        if (dir) {
          const server = nw.require('./dist/server.js') as { restartServer(dir: string, onReady: () => void, onError: (err: Error) => void): void };
          server.restartServer(dir, () => {
            window.location.href = 'http://localhost:1024/';
          }, (err: Error) => {
            alert('Failed to restart server: ' + (err && err.message ? err.message : String(err)));
          });
        }
      } catch (e) {
        alert('Failed to change directory: ' + (e instanceof Error ? e.message : String(e)));
      }
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', injectToolbar);
  } else {
    injectToolbar();
  }
})();
