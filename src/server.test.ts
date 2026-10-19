'use strict';

import * as assert from 'assert';
import * as http from 'http';
import * as fs from 'fs';
import * as path from 'path';
import { startServer, PORT } from './server.js';

const tmpRoot: string = path.join(process.cwd(), 'tmp', 'srvtest');
fs.rmSync(tmpRoot, { recursive: true, force: true });
fs.mkdirSync(tmpRoot, { recursive: true });
fs.writeFileSync(path.join(tmpRoot, 'index.html'), '<h1>hi</h1>');
fs.mkdirSync(path.join(tmpRoot, 'sub'));
fs.writeFileSync(path.join(tmpRoot, 'sub', 'a.html'), '<p>a</p>');

const server = startServer(tmpRoot, (url: string) => {
  console.log('listening', url);

  http.get(url, (res) => {
    let d: string = '';
    res.on('data', (c: Buffer) => { d += c.toString(); });
    res.on('end', () => {
      assert.strictEqual(res.statusCode, 200);
      assert.match(d, /hi/);
      console.log('index OK');

      fs.rmSync(path.join(tmpRoot, 'index.html'));
      http.get(url + 'sub/', (res2) => {
        let d2: string = '';
        res2.on('data', (c: Buffer) => { d2 += c.toString(); });
        res2.on('end', () => {
          assert.strictEqual(res2.statusCode, 200);
          assert.match(d2, /a.html/);
          console.log('listing OK');

          http.get(url + '../etc/passwd', (res3) => {
            assert.ok(res3.statusCode === 403 || res3.statusCode === 404, 'traversal should be blocked');
            console.log('traversal status', res3.statusCode);

            const req = http.request({ hostname: '127.0.0.1', port: PORT, path: '/', headers: { Host: 'evil.com' } }, (res4) => {
              assert.strictEqual(res4.statusCode, 403);
              console.log('host block OK');
              server.close();
              process.exit(0);
            });
            req.end();
          });
        });
      });
    });
  });
}, (err: Error) => { console.error(err); process.exit(1); });
