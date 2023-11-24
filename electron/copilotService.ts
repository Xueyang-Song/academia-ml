import { spawn } from "node:child_process";
import path from "node:path";

import type { CopilotBridgeStatus, CopilotModelInfo } from "../shared/types.js";

function probeCli(cliPath: string) {
  return new Promise<boolean>((resolve) => {
    const child = spawn(cliPath, ["--version"], {
      stdio: "ignore",
      shell: cliPath === "copilot" && process.platform === "win32",
    });
    child.on("close", (code) => resolve(code === 0));
    child.on("error", () => resolve(false));
  });
}

async function resolveCliPath(cliPath?: string) {
  const candidates = [
    cliPath,
    process.env.COPILOT_CLI_PATH,
    process.platform === "win32"
      ? path.join(process.env.LOCALAPPDATA || "", "Microsoft", "WinGet", "Links", "copilot.exe")
      : undefined,
    "copilot",
  ].filter(Boolean) as string[];

  for (const candidate of candidates) {
    // eslint-disable-next-line no-await-in-loop
    if (await probeCli(candidate)) {
      return candidate;
    }
  }
  return cliPath || candidates[candidates.length - 1] || "copilot";
}

export async function getCopilotStatus(cliPath?: string): Promise<CopilotBridgeStatus> {
  const resolved = await resolveCliPath(cliPath);
  const installed = await probeCli(resolved);
  let sdkAvailable = false;
  try {
    await import("@github/copilot-sdk");
    sdkAvailable = true;
  } catch {
    sdkAvailable = false;
  }
  if (!installed) {
    return {
      installed: false,
      sdkAvailable,
      authenticated: false,
      ready: false,
      cliPath: resolved,
      message: "GitHub Copilot CLI was not found on this machine.",
    };
  }

  try {
    const { CopilotClient, approveAll } = await import("@github/copilot-sdk");
    const client = new CopilotClient({
      cliPath: resolved,
      logLevel: "error",
    });
    const session = await client.createSession({ model: "gpt-4.1", onPermissionRequest: approveAll });
    await session.sendAndWait({ prompt: "Reply with the single word ready." });
    await session.disconnect();
    await client.stop();
    return {
      installed: true,
      sdkAvailable: true,
      authenticated: true,
      ready: true,
      cliPath: resolved,
      message: "Copilot SDK bridge is ready.",
    };
  } catch (error) {
    return {
      installed: true,
      sdkAvailable,
      authenticated: false,
      ready: false,
      cliPath: resolved,
      message: error instanceof Error ? error.message : "Copilot bridge is installed but not ready.",
    };
  }
}

export async function listCopilotModels(cliPath?: string): Promise<CopilotModelInfo[]> {
  const resolved = await resolveCliPath(cliPath);
  const installed = await probeCli(resolved);
  if (!installed) {
    throw new Error("GitHub Copilot CLI was not found on this machine.");
  }

  const { CopilotClient } = await import("@github/copilot-sdk");
  const client = new CopilotClient({
    cliPath: resolved,
    logLevel: "error",
  });
  try {
    await client.start();
    const models = await client.listModels();
    return models.map((model) => ({
      id: model.id,
      name: model.name || model.id,
      supportedReasoningEfforts: model.supportedReasoningEfforts || [],
      defaultReasoningEffort: model.defaultReasoningEffort,
    }));
  } finally {
    await client.stop();
  }
}

export async function askCopilotForPlan(options: {
  cliPath?: string;
  prompt: string;
  model: string;
  reasoningEffort?: string;
}) {
  const resolved = await resolveCliPath(options.cliPath);
  const { CopilotClient, approveAll } = await import("@github/copilot-sdk");
  const client = new CopilotClient({
    cliPath: resolved,
    logLevel: "error",
  });
  try {
    const sessionOptions: {
      model: string;
      reasoningEffort?: "low" | "medium" | "high" | "xhigh";
      onPermissionRequest: typeof approveAll;
    } = {
      model: options.model,
      onPermissionRequest: approveAll,
    };
    if (
      options.reasoningEffort === "low" ||
      options.reasoningEffort === "medium" ||
      options.reasoningEffort === "high" ||
      options.reasoningEffort === "xhigh"
    ) {
      sessionOptions.reasoningEffort = options.reasoningEffort;
    }

    const session = await client.createSession(sessionOptions);
    const response = await session.sendAndWait({ prompt: options.prompt });
    await session.disconnect();
    return response?.data?.content ?? "";
  } finally {
    await client.stop();
  }
}
