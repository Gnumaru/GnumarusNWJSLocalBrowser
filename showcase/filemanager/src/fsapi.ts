import type { EntryInfo, Listing, FileMetadata, TextResult } from './types.js';
import { modeToString } from './format.js';

// The Node API is exposed by NW.js. Prefer nw.require, fall back to plain require.
function nodeRequire(name: string): any {
  if (typeof nw !== 'undefined' && nw && typeof nw.require === 'function') {
    return nw.require(name);
  }
  if (typeof require === 'function') {
    return require(name);
  }
  throw new Error('Node.js integration is not available. Open this app inside NW.js with node-remote enabled.');
}

let fsCache: any = null;
let pathCache: any = null;

function fs(): any {
  if (!fsCache) fsCache = nodeRequire('fs');
  return fsCache;
}

function path(): any {
  if (!pathCache) pathCache = nodeRequire('path');
  return pathCache;
}

export function isAvailable(): boolean {
  try {
    fs();
    path();
    return true;
  } catch {
    return false;
  }
}

export function homeDir(): string {
  try {
    const os = nodeRequire('os');
    return os.homedir();
  } catch {
    return '/';
  }
}

function toEntry(dir: string, dirent: any): EntryInfo {
  const p = path();
  const f = fs();
  const fullPath: string = p.join(dir, dirent.name);
  let isDirectory = false;
  let isFile = false;
  let isSymlink = false;
  let size = 0;
  let mtimeMs = 0;
  let ctimeMs = 0;
  let birthtimeMs = 0;
  try {
    const st = f.lstatSync(fullPath);
    isDirectory = st.isDirectory();
    isFile = st.isFile();
    isSymlink = st.isSymbolicLink();
    size = st.size;
    mtimeMs = st.mtimeMs;
    ctimeMs = st.ctimeMs;
    birthtimeMs = st.birthtimeMs;
  } catch {
    // Keep defaults if the entry cannot be statted (e.g. permission denied).
  }
  return {
    name: String(dirent.name),
    fullPath,
    isDirectory,
    isFile,
    isSymlink,
    size,
    mtimeMs,
    ctimeMs,
    birthtimeMs,
    ext: isDirectory ? '' : p.extname(String(dirent.name)).toLowerCase(),
  };
}

export function listDirectory(dir: string): Listing {
  const p = path();
  const f = fs();
  const abs: string = p.resolve(dir);
  const dirents = f.readdirSync(abs, { withFileTypes: true });
  const entries: EntryInfo[] = [];
  for (const dirent of dirents) {
    entries.push(toEntry(abs, dirent));
  }
  entries.sort((a: EntryInfo, b: EntryInfo): number => {
    if (a.isDirectory !== b.isDirectory) return a.isDirectory ? -1 : 1;
    return a.name.localeCompare(b.name, undefined, { sensitivity: 'base' });
  });
  const parent: string = p.dirname(abs);
  return { dir: abs, parentDir: parent === abs ? null : parent, entries };
}

function validateName(name: string): string {
  const n = (name || '').trim();
  if (!n) throw new Error('Name cannot be empty');
  if (n === '.' || n === '..') throw new Error('Invalid name');
  if (n.indexOf('/') !== -1 || n.indexOf('\\') !== -1) throw new Error('Name cannot contain path separators');
  if (n.indexOf('\0') !== -1) throw new Error('Invalid name');
  return n;
}

export function createDirectory(dir: string, name: string): string {
  const p = path();
  const f = fs();
  const target: string = p.join(p.resolve(dir), validateName(name));
  f.mkdirSync(target);
  return target;
}

export function createFile(dir: string, name: string): string {
  const p = path();
  const f = fs();
  const target: string = p.join(p.resolve(dir), validateName(name));
  f.writeFileSync(target, '', { flag: 'wx' });
  return target;
}

function canAccess(target: string, mode: number): boolean {
  try {
    fs().accessSync(target, mode);
    return true;
  } catch {
    return false;
  }
}

export function getMetadata(target: string): FileMetadata {
  const p = path();
  const f = fs();
  const abs: string = p.resolve(target);
  const lst = f.lstatSync(abs);
  let st = lst;
  try {
    st = f.statSync(abs);
  } catch {
    st = lst;
  }
  const isDirectory: boolean = st.isDirectory();
  return {
    name: p.basename(abs),
    fullPath: abs,
    isDirectory,
    isFile: st.isFile(),
    isSymlink: lst.isSymbolicLink(),
    size: st.size,
    mtimeMs: st.mtimeMs,
    ctimeMs: st.ctimeMs,
    birthtimeMs: st.birthtimeMs,
    atimeMs: st.atimeMs,
    ext: isDirectory ? '' : p.extname(abs).toLowerCase(),
    permissions: modeToString(st.mode, isDirectory),
    modeOctal: '0' + (st.mode & 0o777).toString(8),
    isReadable: canAccess(abs, f.constants.R_OK),
    isWritable: canAccess(abs, f.constants.W_OK),
  };
}

export function readTextFile(target: string, maxBytes: number): TextResult {
  const p = path();
  const f = fs();
  const abs: string = p.resolve(target);
  const st = f.statSync(abs);
  if (st.isDirectory()) throw new Error('Is a directory');
  const size: number = st.size;
  const toRead: number = Math.min(size, maxBytes);
  const fd = f.openSync(abs, 'r');
  let binary = false;
  let text = '';
  try {
    const buf = Buffer.alloc(toRead);
    let read = 0;
    while (read < toRead) {
      const n = f.readSync(fd, buf, read, toRead - read, read);
      if (n <= 0) break;
      read += n;
    }
    const slice = buf.subarray(0, read);
    for (let i = 0; i < slice.length; i++) {
      if (slice[i] === 0) {
        binary = true;
        break;
      }
    }
    if (!binary) text = slice.toString('utf8');
  } finally {
    f.closeSync(fd);
  }
  if (text.charCodeAt(0) === 0xfeff) text = text.slice(1);
  return { content: text, size, truncated: size > maxBytes, binary };
}

export function deleteEntry(target: string): void {
  const p = path();
  const f = fs();
  const abs: string = p.resolve(target);
  const st = f.lstatSync(abs);
  if (st.isDirectory()) {
    f.rmdirSync(abs);
  } else {
    f.unlinkSync(abs);
  }
}
