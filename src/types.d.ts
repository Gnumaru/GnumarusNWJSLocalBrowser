// Type declarations for NW.js globals

interface NwWindow {
  get(): any;
  App?: { argv: string[] };
  require(module: string): any;
}

interface NwGlobal {
  Window: NwWindow;
  App?: { argv: string[] };
  require(module: string): any;
}

declare var nw: NwGlobal;
