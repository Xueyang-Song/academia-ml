import { app, ipcMain } from "electron";
import fs from "node:fs/promises";
import path from "node:path";

import type { AgentChatMessage, AgentSessionSummary } from "../shared/types.js";

function nowIso() {
  return new Date().toISOString();
}

function sessionsRoot() {
  return path.join(app.getPath("userData"), "agent-sessions");
}

function sessionsFile() {
  return path.join(sessionsRoot(), "sessions.json");
}

async function readSessions(): Promise<AgentSessionSummary[]> {
  try {
    const raw = await fs.readFile(sessionsFile(), "utf-8");
    return JSON.parse(raw) as AgentSessionSummary[];
  } catch {
    return [];
  }
}

async function writeSessions(sessions: AgentSessionSummary[]) {
  await fs.mkdir(sessionsRoot(), { recursive: true });
  await fs.writeFile(sessionsFile(), JSON.stringify(sessions, null, 2), "utf-8");
}

function message(role: AgentChatMessage["role"], content: string): AgentChatMessage {
  return {
    id: crypto.randomUUID(),
    role,
    content,
    createdAt: nowIso(),
  };
}

async function listSessions() {
  const sessions = await readSessions();
  return sessions.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

async function createSession(title?: string) {
  const sessions = await readSessions();
  const createdAt = nowIso();
  const session: AgentSessionSummary = {
    id: crypto.randomUUID(),
    title: title?.trim() || "New agent session",
    createdAt,
    updatedAt: createdAt,
    projectPaths: [],
    messages: [
      message(
        "assistant",
        "Tell me what you want to do. I can create projects, open projects, inspect data, stage notebooks, and run local ML workflows inside the AcademiaML project folder.",
      ),
    ],
  };
  sessions.push(session);
  await writeSessions(sessions);
  return session;
}

async function updateSession(sessionId: string, patch: Partial<Pick<AgentSessionSummary, "title" | "projectPaths">>) {
  const sessions = await readSessions();
  const index = sessions.findIndex((session) => session.id === sessionId);
  if (index === -1) {
    throw new Error("Agent session not found.");
  }
  const current = sessions[index];
  sessions[index] = {
    ...current,
    ...patch,
    projectPaths: patch.projectPaths ? Array.from(new Set(patch.projectPaths)) : current.projectPaths,
    updatedAt: nowIso(),
  };
  await writeSessions(sessions);
  return sessions[index];
}

async function appendSessionMessage(sessionId: string, role: AgentChatMessage["role"], content: string) {
  const sessions = await readSessions();
  const index = sessions.findIndex((session) => session.id === sessionId);
  if (index === -1) {
    throw new Error("Agent session not found.");
  }
  const nextMessage = message(role, content);
  sessions[index] = {
    ...sessions[index],
    messages: [...sessions[index].messages, nextMessage],
    updatedAt: nowIso(),
  };
  if (role === "user" && sessions[index].title === "New agent session") {
    sessions[index].title = content.trim().slice(0, 54) || sessions[index].title;
  }
  await writeSessions(sessions);
  return sessions[index];
}

export function registerSessionHandlers() {
  ipcMain.handle("session:list", async () => listSessions());
  ipcMain.handle("session:create", async (_event, title?: string) => createSession(title));
  ipcMain.handle("session:update", async (_event, sessionId: string, patch: Partial<Pick<AgentSessionSummary, "title" | "projectPaths">>) =>
    updateSession(sessionId, patch),
  );
  ipcMain.handle("session:appendMessage", async (_event, sessionId: string, role: AgentChatMessage["role"], content: string) =>
    appendSessionMessage(sessionId, role, content),
  );
}
