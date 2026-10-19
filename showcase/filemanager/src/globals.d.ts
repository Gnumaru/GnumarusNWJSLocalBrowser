// Minimal global declarations for the NW.js page environment.
// This app is loaded inside NW.js with `node-remote`, so Node globals exist.
declare const nw: any;
declare function require(name: string): any;
declare const process: { cwd(): string; platform: string; argv: string[] };
declare const Buffer: any;
