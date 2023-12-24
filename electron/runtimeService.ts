import { app, ipcMain } from "electron";
import { spawn } from "node:child_process";
import fs from "node:fs/promises";
import net from "node:net";
import path from "node:path";

import type { RuntimeStatus } from "../shared/types.js";

interface ServerHandle {
  process: ReturnType<typeof spawn>;
  status: RuntimeStatus;
}

interface WorkflowRunResult {
  ok: boolean;
  logs: string[];
}

const jupyterServers = new Map<string, ServerHandle>();
const jupyterStarts = new Map<string, Promise<RuntimeStatus>>();
const runtimeBootstraps = new Map<string, Promise<{ status: RuntimeStatus; logs: string[] }>>();

function runtimeRoot(projectPath: string) {
  return path.join(projectPath, ".academiaml", "runtime");
}

function pythonPathFor(projectPath: string) {
  const root = runtimeRoot(projectPath);
  return process.platform === "win32"
    ? path.join(root, "venv", "Scripts", "python.exe")
    : path.join(root, "venv", "bin", "python");
}

function statusFile(projectPath: string) {
  return path.join(runtimeRoot(projectPath), "status.json");
}

function logFile(projectPath: string) {
  return path.join(projectPath, "logs", "runtime.log");
}

function resourcePath(...segments: string[]) {
  if (app.isPackaged) {
    return path.join(process.resourcesPath, "app.asar.unpacked", ...segments);
  }
  return path.join(process.cwd(), ...segments);
}

async function exists(target: string) {
  try {
    await fs.access(target);
    return true;
  } catch {
    return false;
  }
}

async function appendLog(projectPath: string, line: string) {
  const file = logFile(projectPath);
  await fs.mkdir(path.dirname(file), { recursive: true });
  await fs.appendFile(file, `${line}\n`, "utf-8");
}

async function getRuntimeStatus(projectPath: string): Promise<RuntimeStatus> {
  const py = pythonPathFor(projectPath);
  const bootstrapped = await exists(py);
  const running = jupyterServers.get(projectPath)?.status ?? null;
  if (running) {
    return running;
  }
  return {
    bootstrapped,
    jupyterRunning: false,
    pythonPath: py,
    logPath: logFile(projectPath),
    message: bootstrapped ? "Runtime ready. Jupyter server is not running." : "Runtime not bootstrapped yet.",
  };
}

function waitFor(command: string, args: string[], projectPath: string) {
  return new Promise<{ ok: boolean; logs: string[] }>((resolve, reject) => {
    const logs: string[] = [];
    const child = spawn(command, args, {
      cwd: process.cwd(),
      stdio: ["ignore", "pipe", "pipe"],
    });
    child.stdout.on("data", async (chunk) => {
      const text = chunk.toString();
      logs.push(text);
      await appendLog(projectPath, text.trimEnd());
    });
    child.stderr.on("data", async (chunk) => {
      const text = chunk.toString();
      logs.push(text);
      await appendLog(projectPath, text.trimEnd());
    });
    child.on("error", reject);
    child.on("close", (code) => {
      if (code === 0) {
        resolve({ ok: true, logs });
      } else {
        resolve({ ok: false, logs });
      }
    });
  });
}

function waitForProjectCommand(command: string, args: string[], projectPath: string): Promise<WorkflowRunResult> {
  return new Promise((resolve, reject) => {
    const logs: string[] = [];
    const runtimeDir = runtimeRoot(projectPath);
    const kernelsPrefix = path.join(runtimeDir, "jupyter");
    const child = spawn(command, args, {
      cwd: projectPath,
      env: {
        ...process.env,
        PYTHONUNBUFFERED: "1",
        PYTHONIOENCODING: "utf-8",
        MPLBACKEND: "Agg",
        JUPYTER_CONFIG_DIR: path.join(runtimeDir, "jupyter_config"),
        JUPYTER_DATA_DIR: path.join(runtimeDir, "jupyter_data"),
        JUPYTER_RUNTIME_DIR: path.join(runtimeDir, "jupyter_runtime"),
        JUPYTER_PATH: path.join(kernelsPrefix, "share", "jupyter"),
      },
      stdio: ["ignore", "pipe", "pipe"],
    });
    child.stdout.on("data", async (chunk) => {
      const text = chunk.toString();
      logs.push(text);
      await appendLog(projectPath, text.trimEnd());
    });
    child.stderr.on("data", async (chunk) => {
      const text = chunk.toString();
      logs.push(text);
      await appendLog(projectPath, text.trimEnd());
    });
    child.on("error", reject);
    child.on("close", (code) => {
      resolve({
        ok: code === 0,
        logs,
      });
    });
  });
}

async function bootstrapRuntime(projectPath: string) {
  const existing = runtimeBootstraps.get(projectPath);
  if (existing) {
    return existing;
  }

  const bootstrap = (async () => {
  await appendLog(projectPath, `== bootstrap ${new Date().toISOString()} ==`);
  const result = await waitFor("python", [resourcePath("scripts", "bootstrap_runtime.py"), projectPath], projectPath);
  const py = pythonPathFor(projectPath);
  const status: RuntimeStatus = {
    bootstrapped: result.ok && (await exists(py)),
    jupyterRunning: false,
    pythonPath: py,
    logPath: logFile(projectPath),
    message: result.ok ? "Runtime bootstrapped successfully." : "Runtime bootstrap failed.",
  };
  await fs.mkdir(path.dirname(statusFile(projectPath)), { recursive: true });
  await fs.writeFile(statusFile(projectPath), JSON.stringify(status, null, 2), "utf-8");
  return { status, logs: result.logs };
  })();

  runtimeBootstraps.set(projectPath, bootstrap);
  try {
    return await bootstrap;
  } finally {
    runtimeBootstraps.delete(projectPath);
  }
}

async function allocatePort() {
  return new Promise<number>((resolve, reject) => {
    const server = net.createServer();
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      if (address && typeof address === "object") {
        const port = address.port;
        server.close(() => resolve(port));
      } else {
        reject(new Error("Unable to allocate port"));
      }
    });
    server.on("error", reject);
  });
}

async function waitForServer(baseUrl: string, token: string) {
  const deadline = Date.now() + 120000;
  const probes = [
    () => `${baseUrl}api/status?token=${encodeURIComponent(token)}`,
    () => `${baseUrl}api?token=${encodeURIComponent(token)}`,
    () => `${baseUrl}lab?token=${encodeURIComponent(token)}`,
  ];
  while (Date.now() < deadline) {
    for (const probe of probes) {
      try {
        const response = await fetch(probe(), {
          headers: {
            Authorization: `token ${token}`,
          },
          redirect: "manual",
        });
        if (response.status >= 200 && response.status < 500) {
          return true;
        }
      } catch {
        // keep polling
      }
    }
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  return false;
}

async function startJupyter(projectPath: string) {
  const current = jupyterServers.get(projectPath);
  if (current) {
    return current.status;
  }
  const pending = jupyterStarts.get(projectPath);
  if (pending) {
    return pending;
  }

  const start = startJupyterInternal(projectPath);
  jupyterStarts.set(projectPath, start);
  try {
    return await start;
  } finally {
    jupyterStarts.delete(projectPath);
  }
}

async function startJupyterInternal(projectPath: string) {
  const py = pythonPathFor(projectPath);
  if (!(await exists(py))) {
    throw new Error("Runtime is not bootstrapped yet.");
  }

  const port = await allocatePort();
  const token = `academiaml-${Math.random().toString(36).slice(2, 10)}`;
  const baseUrl = `http://127.0.0.1:${port}/`;
  const wsUrl = `ws://127.0.0.1:${port}/`;
  const runtimeDir = runtimeRoot(projectPath);
  const kernelsPrefix = path.join(runtimeDir, "jupyter");
  const jupyterConfigDir = path.join(runtimeDir, "jupyter_config");
  const jupyterDataDir = path.join(runtimeDir, "jupyter_data");
  const jupyterRuntimeDir = path.join(runtimeDir, "jupyter_runtime");
  const recentLogs: string[] = [];

  await appendLog(projectPath, `== jupyter ${new Date().toISOString()} ==`);
  await fs.mkdir(jupyterConfigDir, { recursive: true });
  await fs.mkdir(jupyterDataDir, { recursive: true });
  await fs.mkdir(jupyterRuntimeDir, { recursive: true });

  const rememberLog = (chunk: unknown) => {
    const text = String(chunk).trimEnd();
    if (text) {
      recentLogs.push(text);
      while (recentLogs.length > 12) {
        recentLogs.shift();
      }
      void appendLog(projectPath, text);
    }
  };

  const child = spawn(
    py,
    [
      "-m",
      "jupyter_server",
      "--no-browser",
      "--ServerApp.ip=127.0.0.1",
      `--ServerApp.port=${port}`,
      "--ServerApp.port_retries=0",
      `--ServerApp.token=${token}`,
      "--ServerApp.password=",
      "--ServerApp.disable_check_xsrf=True",
      "--ServerApp.allow_origin=*",
      `--ServerApp.root_dir=${projectPath}`,
    ],
    {
      cwd: projectPath,
      env: {
        ...process.env,
        PYTHONUNBUFFERED: "1",
        JUPYTER_CONFIG_DIR: jupyterConfigDir,
        JUPYTER_DATA_DIR: jupyterDataDir,
        JUPYTER_RUNTIME_DIR: jupyterRuntimeDir,
        JUPYTER_PATH: path.join(kernelsPrefix, "share", "jupyter"),
      },
      stdio: ["ignore", "pipe", "pipe"],
    },
  );

  child.stdout.on("data", (chunk) => {
    rememberLog(chunk.toString());
  });
  child.stderr.on("data", (chunk) => {
    rememberLog(chunk.toString());
  });
  child.on("close", () => {
    jupyterServers.delete(projectPath);
  });

  const ready = await waitForServer(baseUrl, token);
  if (!ready) {
    child.kill();
    const tail = recentLogs.length ? ` Last Jupyter log: ${recentLogs.join("\n")}` : "";
    throw new Error(`Jupyter server failed to start.${tail}`);
  }

  const status: RuntimeStatus = {
    bootstrapped: true,
    jupyterRunning: true,
    pythonPath: py,
    baseUrl,
    wsUrl,
    token,
    logPath: logFile(projectPath),
    message: "Jupyter server is running.",
  };
  jupyterServers.set(projectPath, { process: child, status });
  return status;
}

async function ensureRuntime(projectPath: string) {
  const logs: string[] = [];
  let status = await getRuntimeStatus(projectPath);
  if (!status.jupyterRunning) {
    const bootstrapped = await bootstrapRuntime(projectPath);
    logs.push(...bootstrapped.logs);
    status = bootstrapped.status;
    if (!status.bootstrapped) {
      throw new Error("Notebook engine setup failed. See runtime.log for details.");
    }
  }
  const running = await startJupyter(projectPath);
  return { status: running, logs };
}

async function executeNotebook(projectPath: string, notebookPath: string) {
  const py = pythonPathFor(projectPath);
  if (!(await exists(py))) {
    throw new Error("Notebook engine is not ready yet.");
  }
  const normalizedNotebook = notebookPath.replace(/\\/g, "/");
  await appendLog(projectPath, `== execute notebook ${normalizedNotebook} ${new Date().toISOString()} ==`);
  return waitForProjectCommand(
    py,
    [
      "-m",
      "jupyter",
      "nbconvert",
      "--to",
      "notebook",
      "--execute",
      "--inplace",
      "--allow-errors",
      normalizedNotebook,
      "--ExecutePreprocessor.kernel_name=academiaml",
      "--ExecutePreprocessor.timeout=600",
    ],
    projectPath,
  );
}

async function stopJupyter(projectPath: string) {
  const existing = jupyterServers.get(projectPath);
  if (existing) {
    existing.process.kill();
    jupyterServers.delete(projectPath);
  }
  return getRuntimeStatus(projectPath);
}

async function runGeneratedWorkflow(projectPath: string) {
  const py = pythonPathFor(projectPath);
  if (!(await exists(py))) {
    throw new Error("Runtime is not bootstrapped yet.");
  }
  const scriptPath = path.join(projectPath, "generated", "train_workflow.py");
  if (!(await exists(scriptPath))) {
    throw new Error("No generated workflow script was found. Generate and apply a workflow first.");
  }

  await appendLog(projectPath, `== workflow ${new Date().toISOString()} ==`);
  const result = await waitForProjectCommand(py, [scriptPath], projectPath);
  return result;
}

export function registerRuntimeHandlers() {
  ipcMain.handle("runtime:getStatus", async (_event, projectPath: string) => getRuntimeStatus(projectPath));
  ipcMain.handle("runtime:bootstrap", async (_event, projectPath: string) => bootstrapRuntime(projectPath));
  ipcMain.handle("runtime:ensure", async (_event, projectPath: string) => ensureRuntime(projectPath));
  ipcMain.handle("runtime:startJupyter", async (_event, projectPath: string) => startJupyter(projectPath));
  ipcMain.handle("runtime:stopJupyter", async (_event, projectPath: string) => stopJupyter(projectPath));
  ipcMain.handle("runtime:runGeneratedWorkflow", async (_event, projectPath: string) => runGeneratedWorkflow(projectPath));
  ipcMain.handle("runtime:executeNotebook", async (_event, projectPath: string, notebookPath: string) => executeNotebook(projectPath, notebookPath));
}
