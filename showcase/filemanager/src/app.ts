import type { EntryInfo, FileMetadata } from './types.js';
import * as api from './fsapi.js';
import { formatBytes, formatDate, fileKind } from './format.js';

const PREVIEW_MAX_BYTES = 200000;

function errMsg(e: unknown): string {
  return e instanceof Error ? e.message : String(e);
}

function byId<T extends HTMLElement>(id: string): T {
  const el = document.getElementById(id);
  if (!el) throw new Error('Missing required element #' + id);
  return el as T;
}

export class FileManagerApp {
  private readonly startDir: string;
  private currentDir = '';
  private parentDir: string | null = null;
  private displayEntries: EntryInfo[] = [];
  private selected: EntryInfo | null = null;

  private pathInput!: HTMLInputElement;
  private tbody!: HTMLTableSectionElement;
  private detail!: HTMLElement;
  private preview!: HTMLElement;
  private status!: HTMLElement;
  private count!: HTMLElement;

  constructor(startDir: string) {
    this.startDir = startDir;
  }

  start(): void {
    this.pathInput = byId<HTMLInputElement>('fm-path-input');
    this.tbody = byId<HTMLTableSectionElement>('fm-rows');
    this.detail = byId<HTMLElement>('fm-detail');
    this.preview = byId<HTMLElement>('fm-preview');
    this.status = byId<HTMLElement>('fm-status');
    this.count = byId<HTMLElement>('fm-count');

    this.on('fm-btn-up', () => this.goUp());
    this.on('fm-btn-home', () => this.navigate(api.homeDir()));
    this.on('fm-btn-refresh', () => this.refresh());
    this.on('fm-btn-go', () => this.navigate(this.pathInput.value.trim()));
    this.on('fm-btn-new-folder', () => this.createFolder());
    this.on('fm-btn-new-file', () => this.createFile());
    this.on('fm-btn-delete', () => this.deleteSelected());

    this.pathInput.addEventListener('keydown', (e: KeyboardEvent) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        this.navigate(this.pathInput.value.trim());
      }
    });

    this.tbody.addEventListener('click', (ev: MouseEvent) => {
      const entry = this.entryFromEvent(ev);
      if (entry) this.selectEntry(entry);
    });

    this.tbody.addEventListener('dblclick', (ev: MouseEvent) => {
      const entry = this.entryFromEvent(ev);
      if (!entry) return;
      if (entry.isDirectory) this.navigate(entry.fullPath);
      else this.showDetail(entry);
    });

    if (!api.isAvailable()) {
      this.setStatus('Node.js integration is unavailable. Open this page inside NW.js (node-remote enabled).');
      return;
    }
    this.navigate(this.startDir);
  }

  private on(id: string, fn: () => void): void {
    const el = document.getElementById(id);
    if (el) el.addEventListener('click', fn);
  }

  private entryFromEvent(ev: MouseEvent): EntryInfo | null {
    const target = ev.target as HTMLElement | null;
    const tr = target ? target.closest('tr') : null;
    if (!tr || !tr.dataset.index) return null;
    const idx = Number(tr.dataset.index);
    return this.displayEntries[idx] ?? null;
  }

  navigate(dir: string): void {
    if (!dir) return;
    try {
      const listing = api.listDirectory(dir);
      this.currentDir = listing.dir;
      this.parentDir = listing.parentDir;

      const display: EntryInfo[] = [];
      if (listing.parentDir) {
        display.push({
          name: '..', fullPath: listing.parentDir, isDirectory: true, isFile: false,
          isSymlink: false, size: 0, mtimeMs: 0, ctimeMs: 0, birthtimeMs: 0, ext: '',
        });
      }
      for (const entry of listing.entries) display.push(entry);

      this.displayEntries = display;
      this.selected = null;
      this.pathInput.value = listing.dir;
      this.renderRows();
      this.clearDetail();
      this.clearStatus();
      this.count.textContent = String(listing.entries.length) + ' item(s)';
    } catch (e) {
      this.setStatus('Cannot open "' + dir + '": ' + errMsg(e));
    }
  }

  private refresh(): void {
    if (this.currentDir) this.navigate(this.currentDir);
  }

  private goUp(): void {
    if (this.parentDir) this.navigate(this.parentDir);
  }

  private renderRows(): void {
    this.tbody.innerHTML = '';
    this.displayEntries.forEach((entry, index) => {
      const tr = document.createElement('tr');
      tr.dataset.index = String(index);
      if (entry.name === '..') tr.classList.add('fm-parent');

      const nameTd = document.createElement('td');
      nameTd.className = 'fm-name';
      const icon = document.createElement('span');
      icon.className = 'fm-icon';
      icon.textContent = entry.name === '..' ? '↩' : entry.isDirectory ? '📁' : '📄';
      nameTd.appendChild(icon);
      const label = document.createElement('span');
      label.className = 'fm-label';
      label.textContent = entry.name;
      nameTd.appendChild(label);
      if (entry.isSymlink) {
        const link = document.createElement('span');
        link.className = 'fm-symlink';
        link.textContent = '⤴ symlink';
        nameTd.appendChild(link);
      }
      tr.appendChild(nameTd);

      const sizeTd = document.createElement('td');
      sizeTd.className = 'fm-size';
      sizeTd.textContent = entry.isDirectory ? '—' : formatBytes(entry.size);
      tr.appendChild(sizeTd);

      const dateTd = document.createElement('td');
      dateTd.className = 'fm-date';
      dateTd.textContent = entry.mtimeMs ? formatDate(entry.mtimeMs) : '—';
      tr.appendChild(dateTd);

      this.tbody.appendChild(tr);
    });
  }

  private selectEntry(entry: EntryInfo): void {
    for (const row of Array.from(this.tbody.querySelectorAll('tr'))) {
      row.classList.remove('fm-selected');
    }
    const idx = this.displayEntries.indexOf(entry);
    const tr = idx >= 0 ? this.tbody.querySelector<HTMLElement>('tr[data-index="' + idx + '"]') : null;
    if (tr) tr.classList.add('fm-selected');
    this.selected = entry;
    this.showDetail(entry);
  }

  private showDetail(entry: EntryInfo): void {
    this.detail.innerHTML = '';
    let md: FileMetadata;
    try {
      md = api.getMetadata(entry.fullPath);
    } catch (e) {
      this.appendDetail('Error', errMsg(e));
      this.preview.textContent = '';
      return;
    }
    const rows: Array<[string, string]> = [
      ['Name', md.name],
      ['Path', md.fullPath],
      ['Type', fileKind(md) + (md.isSymlink ? ' (symlink)' : '')],
      ['Size', md.isDirectory ? '—' : formatBytes(md.size) + ' (' + md.size + ' bytes)'],
      ['Modified', formatDate(md.mtimeMs)],
      ['Created', formatDate(md.birthtimeMs)],
      ['Accessed', formatDate(md.atimeMs)],
      ['Permissions', md.permissions + '  ' + md.modeOctal],
      ['Readable', md.isReadable ? 'yes' : 'no'],
      ['Writable', md.isWritable ? 'yes' : 'no'],
    ];
    for (const [k, v] of rows) this.appendDetail(k, v);
    this.loadPreview(md);
  }

  private appendDetail(key: string, value: string): void {
    const dt = document.createElement('dt');
    dt.textContent = key;
    const dd = document.createElement('dd');
    dd.textContent = value;
    this.detail.appendChild(dt);
    this.detail.appendChild(dd);
  }

  private loadPreview(md: FileMetadata): void {
    if (md.isDirectory) {
      this.preview.textContent = '(directory — select a file to preview its text contents)';
      return;
    }
    try {
      const result = api.readTextFile(md.fullPath, PREVIEW_MAX_BYTES);
      if (result.binary) {
        this.preview.textContent = '(binary file — preview not available)';
        return;
      }
      let text = result.content.length ? result.content : '(empty file)';
      if (result.truncated) text += '\n\n… preview truncated at ' + formatBytes(PREVIEW_MAX_BYTES) + ' …';
      this.preview.textContent = text;
    } catch (e) {
      this.preview.textContent = '(cannot preview: ' + errMsg(e) + ')';
    }
  }

  private createFolder(): void {
    const name = window.prompt('Name of the new folder:');
    if (!name) return;
    try {
      api.createDirectory(this.currentDir, name);
      this.navigate(this.currentDir);
      this.setStatus('Created folder "' + name.trim() + '".');
    } catch (e) {
      window.alert('Could not create folder: ' + errMsg(e));
    }
  }

  private createFile(): void {
    const name = window.prompt('Name of the new empty file:');
    if (!name) return;
    try {
      api.createFile(this.currentDir, name);
      this.navigate(this.currentDir);
      this.setStatus('Created file "' + name.trim() + '".');
    } catch (e) {
      window.alert('Could not create file: ' + errMsg(e));
    }
  }

  private deleteSelected(): void {
    if (!this.selected || this.selected.name === '..') return;
    const entry = this.selected;
    if (!window.confirm('Delete "' + entry.name + '"?\n' + entry.fullPath)) return;
    try {
      api.deleteEntry(entry.fullPath);
      this.navigate(this.currentDir);
      this.setStatus('Deleted "' + entry.name + '".');
    } catch (e) {
      window.alert('Could not delete: ' + errMsg(e));
    }
  }

  private clearDetail(): void {
    this.detail.innerHTML = '';
    this.preview.textContent = 'Select a file to see its details and text preview.';
  }

  private setStatus(msg: string): void {
    this.status.textContent = msg;
    this.status.classList.remove('hidden');
  }

  private clearStatus(): void {
    this.status.classList.add('hidden');
  }
}
