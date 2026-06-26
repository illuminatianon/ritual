import { app, BrowserWindow } from 'electron';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { openDatabase } from './db/database';
import { registerIpcHandlers } from './ipc/register';

const currentDir = dirname(fileURLToPath(import.meta.url));

app.disableHardwareAcceleration();
app.commandLine.appendSwitch('disable-gpu');
app.commandLine.appendSwitch('disable-gpu-compositing');
app.commandLine.appendSwitch('disable-software-rasterizer');

process.env.DIST_ELECTRON = join(currentDir, '..');
process.env.DIST = join(process.env.DIST_ELECTRON, 'dist');
process.env.PUBLIC = process.env.VITE_DEV_SERVER_URL ? join(process.env.DIST_ELECTRON, '../public') : process.env.DIST;

let mainWindow: BrowserWindow | null = null;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 1040,
    minHeight: 680,
    title: 'Ritual',
    backgroundColor: '#111214',
    webPreferences: {
      preload: join(currentDir, 'preload.mjs'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  if (process.env.VITE_DEV_SERVER_URL) {
    void mainWindow.loadURL(process.env.VITE_DEV_SERVER_URL);
  } else if (process.env.DIST) {
    void mainWindow.loadFile(join(process.env.DIST, 'index.html'));
  }
}

app.whenReady().then(() => {
  const db = openDatabase(join(app.getPath('userData'), 'ritual.sqlite'));
  registerIpcHandlers(db);
  createWindow();
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});
