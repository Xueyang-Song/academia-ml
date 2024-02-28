import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { join } from "node:path";
import readline from "node:readline";

const cwd = process.cwd();
const electronMain = join(cwd, "dist-electron", "electron", "main.js");
const electronExecutable =
  process.platform === "win32"
    ? join(cwd, "node_modules", "electron", "dist", "electron.exe")
    : join(cwd, "node_modules", "electron", "dist", "electron");
const processes = [];

function stripAnsi(value) {
  return value.replace(
    // eslint-disable-next-line no-control-regex
    /[\u001B\u009B][[\]()#;?]*(?:(?:[0-9]{1,4}(?:;[0-9]{0,4})*)?[0-9A-ORZcf-nqry=><~])/g,
    "",
  );
}

function start(name, command, args, extraEnv = {}) {
  const child = spawn(command, args, {
    cwd,
    env: { ...process.env, ...extraEnv },
    shell: process.platform === "win32",
    stdio: ["inherit", "pipe", "pipe"],
  });
  processes.push(child);
  const prefix = `[${name}]`;
  const pipe = (stream, method = "log") => {
    const rl = readline.createInterface({ input: stream });
    rl.on("line", (line) => {
      console[method](`${prefix} ${line}`);
      const cleanLine = stripAnsi(line);
      if (name === "RENDERER") {
        const match = cleanLine.match(/Local:\s+(http:\/\/[^\s]+)/i);
        if (match) {
          rendererUrl = match[1];
        }
      }
    });
  };
  pipe(child.stdout);
  pipe(child.stderr, "error");
  child.on("exit", (code) => {
    if (!shuttingDown && code && code !== 0) {
      console.error(`${prefix} exited with code ${code}`);
      shutdown(code);
    }
  });
  return child;
}

let rendererUrl = "";
let shuttingDown = false;

function shutdown(code = 0) {
  if (shuttingDown) {
    return;
  }
  shuttingDown = true;
  for (const child of processes) {
    if (!child.killed) {
      child.kill();
    }
  }
  setTimeout(() => process.exit(code), 350);
}

process.on("SIGINT", () => shutdown(0));
process.on("SIGTERM", () => shutdown(0));

start("RENDERER", "npm", ["run", "dev:renderer"]);
start("MAIN", "npm", ["run", "dev:main"]);

const startedAt = Date.now();
const interval = setInterval(() => {
  if (rendererUrl && existsSync(electronMain)) {
    clearInterval(interval);
    start("ELECTRON", electronExecutable, ["."], { VITE_DEV_SERVER_URL: rendererUrl });
    return;
  }
  if (Date.now() - startedAt > 120000) {
    clearInterval(interval);
    console.error("Timed out waiting for renderer URL or Electron build output.");
    shutdown(1);
  }
}, 300);
