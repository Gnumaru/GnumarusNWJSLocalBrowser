import type { EntryInfo } from './types.js';

export function formatBytes(n: number): string {
  if (!Number.isFinite(n) || n < 0) return '-';
  if (n < 1024) return n + ' B';
  const units = ['KB', 'MB', 'GB', 'TB', 'PB'];
  let value = n / 1024;
  let i = 0;
  while (value >= 1024 && i < units.length - 1) {
    value /= 1024;
    i++;
  }
  return value.toFixed(value < 10 ? 2 : 1) + ' ' + units[i];
}

export function formatDate(ms: number): string {
  if (!ms || !Number.isFinite(ms)) return '-';
  const d = new Date(ms);
  if (isNaN(d.getTime())) return '-';
  const pad = (x: number): string => String(x).padStart(2, '0');
  return (
    d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()) +
    ' ' + pad(d.getHours()) + ':' + pad(d.getMinutes()) + ':' + pad(d.getSeconds())
  );
}

export function modeToString(mode: number, isDirectory: boolean): string {
  const perms = ['r', 'w', 'x'];
  let s = isDirectory ? 'd' : '-';
  for (let i = 0; i < 9; i++) {
    const bit = (mode >> (8 - i)) & 1;
    s += bit ? perms[i % 3] : '-';
  }
  return s;
}

export function fileKind(entry: EntryInfo): string {
  if (entry.isDirectory) return 'Folder';
  if (entry.ext) return entry.ext.slice(1).toUpperCase() + ' file';
  return 'File';
}
