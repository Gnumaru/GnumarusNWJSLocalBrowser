export interface EntryInfo {
  name: string;
  fullPath: string;
  isDirectory: boolean;
  isFile: boolean;
  isSymlink: boolean;
  size: number;
  mtimeMs: number;
  ctimeMs: number;
  birthtimeMs: number;
  ext: string;
}

export interface Listing {
  dir: string;
  parentDir: string | null;
  entries: EntryInfo[];
}

export interface FileMetadata extends EntryInfo {
  atimeMs: number;
  permissions: string;
  modeOctal: string;
  isReadable: boolean;
  isWritable: boolean;
}

export interface TextResult {
  content: string;
  size: number;
  truncated: boolean;
  binary: boolean;
}
