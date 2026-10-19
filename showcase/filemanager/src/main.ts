import { FileManagerApp } from './app.js';
import * as api from './fsapi.js';

function resolveStartDir(): string {
  const params = new URLSearchParams(window.location.search);
  const fromQuery = params.get('dir');
  if (fromQuery) return fromQuery;

  const served = (window as unknown as { __SERVED_DIR__?: unknown }).__SERVED_DIR__;
  if (typeof served === 'string' && served) return served;

  return api.homeDir();
}

const app = new FileManagerApp(resolveStartDir());
app.start();
