import { contextBridge } from 'electron';
contextBridge.exposeInMainWorld('academiaML', {});
