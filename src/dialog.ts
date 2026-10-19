'use strict';

function execPromise(command: string): Promise<string | null> {
  return new Promise((resolve) => {
    try {
      const cp = require('child_process');
      cp.exec(command, { windowsHide: true }, (err: any, stdout: string) => {
        if (err) resolve(null);
        else resolve((stdout || '').trim() || null);
      });
    } catch (e) {
      resolve(null);
    }
  });
}

export async function chooseDirectory(): Promise<string | null> {
  const platform = process.platform;
  if (platform === 'linux') {
    let res = await execPromise('zenity --file-selection --directory --title="Choose directory to serve"');
    if (!res) res = await execPromise('kdialog --getexistingdirectory . --title "Choose directory to serve"');
    return res;
  }
  if (platform === 'darwin') {
    return execPromise("osascript -e 'POSIX path of (choose folder with prompt \"Choose directory to serve\")'");
  }
  if (platform === 'win32') {
    const cmd = 'powershell -NoProfile -Command "Add-Type -AssemblyName System.Windows.Forms; $d=New-Object System.Windows.Forms.FolderBrowserDialog; if($d.ShowDialog() -eq \'OK\') { $d.SelectedPath }"';
    return execPromise(cmd);
  }
  return null;
}

module.exports = { chooseDirectory };
