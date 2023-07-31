import { app, BrowserWindow } from 'electron';
app.whenReady().then(() => new BrowserWindow({ width: 1200, height: 800 }).loadURL('http://localhost:5173'));
