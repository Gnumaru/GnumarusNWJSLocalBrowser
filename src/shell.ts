'use strict';

/// <reference path="./types.d.ts" />

interface DialogModule {
  chooseDirectory(): Promise<string | null>;
}

interface ServerModule {
  startServer(rootDir: string, onReady: (url: string) => void, onError: (err: Error) => void): void;
}

const isNW: boolean = typeof nw !== 'undefined' && !!nw && !!nw.Window;

function isSelfIndexArg(a: string): boolean {
  if (a === 'index.html') return true;
  try {
    const p = require('path');
    try {
      if (p.resolve(a) === p.resolve(p.join(process.cwd(), 'index.html'))) return true;
    } catch (e) {}
  } catch (e) {}
  try {
    if (/^file:\/\//.test(a)) {
      const u = new URL(a);
      const fp = decodeURIComponent(u.pathname);
      if (fp === '/index.html') return true;
      try {
        const p = require('path');
        if (p.resolve(fp) === p.resolve(p.join(process.cwd(), 'index.html'))) return true;
      } catch (e) {}
    }
  } catch (e) {}
  return false;
}

function getArgv(): string[] {
  let argv: string[] = [];
  try {
    if (isNW && nw.App && Array.isArray(nw.App.argv)) argv = nw.App.argv.slice();
  } catch (e) {}
  if (!argv.length && Array.isArray(process.argv)) {
    argv = process.argv.slice(1).filter((a: string) => a && !/nw$/.test(a) && !isSelfIndexArg(a));
  }
  return argv;
}

function pickTargetFromArgv(): string | null {
  const argv = getArgv();
  for (const a of argv) {
    if (a && !a.startsWith('--') && !a.startsWith('-')) {
      return a;
    }
  }
  return null;
}

function pickDirFromArgv(): string | null {
  return pickTargetFromArgv();
}

interface ServeTarget {
  rootDir: string;
  initialPath: string;
}

function resolveServeTarget(rawInput: string): ServeTarget {
  const trimmed = (rawInput || '').trim();
  let fsMod: any = null;
  let pathMod: any = null;
  try { fsMod = require('fs'); } catch (e) {}
  if (!fsMod && typeof nw !== 'undefined' && nw && typeof nw.require === 'function') {
    try { fsMod = nw.require('fs'); } catch (e) {}
  }
  try { pathMod = require('path'); } catch (e) {}
  if (!pathMod && typeof nw !== 'undefined' && nw && typeof nw.require === 'function') {
    try { pathMod = nw.require('path'); } catch (e) {}
  }
  if (!fsMod || !pathMod || !trimmed) {
    return { rootDir: trimmed, initialPath: '/' };
  }
  try {
    const stat = fsMod.statSync(trimmed);
    if (stat && typeof stat.isFile === 'function' && stat.isFile()) {
      return {
        rootDir: pathMod.dirname(trimmed),
        initialPath: '/' + encodeURIComponent(pathMod.basename(trimmed))
      };
    }
  } catch (e) {}
  return { rootDir: trimmed, initialPath: '/' };
}

function loadDialogModule(): DialogModule | null {
  if (typeof nw !== 'undefined' && nw && typeof nw.require === 'function') {
    try { return nw.require('./dist/dialog.js') as DialogModule; } catch (e) {}
    try { return nw.require('dist/dialog.js') as DialogModule; } catch (e) {}
  }
  try { return require('./dialog.js') as DialogModule; } catch (e) {}
  try { return require('./dist/dialog.js') as DialogModule; } catch (e) {}
  try {
    const p = require('path').resolve(process.cwd(), 'dist', 'dialog.js');
    return require(p) as DialogModule;
  } catch (e) {}
  return null;
}

function loadServerModule(): ServerModule | null {
  if (typeof nw !== 'undefined' && nw && typeof nw.require === 'function') {
    try { return nw.require('./dist/server.js') as ServerModule; } catch (e) {}
    try { return nw.require('dist/server.js') as ServerModule; } catch (e) {}
  }
  try { return require('./server.js') as ServerModule; } catch (e) {}
  try { return require('./dist/server.js') as ServerModule; } catch (e) {}
  try {
    const p = require('path').resolve(process.cwd(), 'dist', 'server.js');
    return require(p) as ServerModule;
  } catch (e) {}
  return null;
}

async function chooseDirectory(): Promise<string | null> {
  const mod = loadDialogModule();
  if (mod && typeof mod.chooseDirectory === 'function') {
    return mod.chooseDirectory();
  }
  return null;
}

function startServerFor(input: string, statusEl: HTMLElement): void {
  const mod = loadServerModule();
  if (!mod || !mod.startServer) {
    statusEl.textContent = 'Failed to load server module';
    statusEl.classList.remove('hidden');
    return;
  }
  const target = resolveServeTarget(input);
  mod.startServer(target.rootDir, (url: string) => {
    statusEl.classList.add('hidden');
    const base = url.replace(/\/$/, '');
    const finalUrl = target.initialPath === '/' ? base + '/' : base + target.initialPath;
    window.location.href = finalUrl;
  }, (err: Error) => {
    statusEl.textContent = 'Server error: ' + (err && err.message ? err.message : String(err));
    statusEl.classList.remove('hidden');
  });
}

function init(): void {
  const picker = document.getElementById('picker') as HTMLElement;
  const dirInput = document.getElementById('dirInput') as HTMLInputElement;
  const btnChoose = document.getElementById('btnChoose') as HTMLButtonElement;
  const btnStart = document.getElementById('btnStart') as HTMLButtonElement;
  const status = document.getElementById('status') as HTMLElement;

  btnChoose.addEventListener('click', async () => {
    status.textContent = 'Opening directory dialog...';
    status.classList.remove('hidden');
    const dir = await chooseDirectory();
    if (dir) {
      dirInput.value = dir;
      status.classList.add('hidden');
    } else {
      status.textContent = 'No directory selected';
    }
  });

  btnStart.addEventListener('click', () => {
    const input = (dirInput.value || '').trim();
    if (!input) {
      status.textContent = 'Please enter or choose a directory or HTML file';
      status.classList.remove('hidden');
      return;
    }
    startServerFor(input, status);
  });

  const initialTarget = pickTargetFromArgv();
  if (initialTarget) {
    startServerFor(initialTarget, status);
  } else {
    status.textContent = 'No directory provided. Please choose one.';
    status.classList.remove('hidden');
  }
}

document.addEventListener('DOMContentLoaded', init);

try {
  (globalThis as any).__lbShellTest = { getArgv, pickTargetFromArgv, resolveServeTarget, isSelfIndexArg };
} catch (e) {}
