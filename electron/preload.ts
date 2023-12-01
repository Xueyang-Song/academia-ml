import { contextBridge, ipcRenderer } from "electron";

import type {
  AgentChatMessage,
  AgentRun,
  AgentSessionSummary,
  CopilotBridgeStatus,
  CopilotModelInfo,
  DatasetPreview,
  ExampleProject,
  NotebookDocument,
  ProjectFileEntry,
  ProjectListItem,
  ProviderConfig,
  RuntimeStatus,
} from "../shared/types.js";

const api = {
  listProjects: () => ipcRenderer.invoke("project:listProjects") as Promise<ProjectListItem[]>,
  listExamples: () => ipcRenderer.invoke("project:listExamples") as Promise<ExampleProject[]>,
  openExample: (exampleId: string) => ipcRenderer.invoke("project:openExample", exampleId),
  openProjectPath: (projectPath: string) => ipcRenderer.invoke("project:openPath", projectPath),
  chooseProjectDirectory: () => ipcRenderer.invoke("project:chooseProjectDirectory"),
  createProject: (args: { title: string; description?: string; parentDirectory?: string; taskHint?: "regression" | "classification" }) =>
    ipcRenderer.invoke("project:createProject", args),
  readNotebook: (projectPath: string, relPath: string) =>
    ipcRenderer.invoke("project:readNotebook", projectPath, relPath) as Promise<NotebookDocument>,
  saveNotebook: (projectPath: string, relPath: string, notebook: NotebookDocument) =>
    ipcRenderer.invoke("project:saveNotebook", projectPath, relPath, notebook),
  createNotebook: (projectPath: string, title: string) =>
    ipcRenderer.invoke("project:createNotebook", projectPath, title) as Promise<string>,
  previewDataset: (projectPath: string, relPath: string) =>
    ipcRenderer.invoke("project:previewDataset", projectPath, relPath) as Promise<DatasetPreview>,
  listFiles: (projectPath: string, relRoot: string) =>
    ipcRenderer.invoke("project:listFiles", projectPath, relRoot) as Promise<ProjectFileEntry[]>,
  importDataset: (projectPath: string) => ipcRenderer.invoke("project:importDataset", projectPath),
  readTextFile: (projectPath: string, relPath: string) =>
    ipcRenderer.invoke("project:readTextFile", projectPath, relPath) as Promise<string>,
  runtimeStatus: (projectPath: string) =>
    ipcRenderer.invoke("runtime:getStatus", projectPath) as Promise<RuntimeStatus>,
  bootstrapRuntime: (projectPath: string) => ipcRenderer.invoke("runtime:bootstrap", projectPath),
  ensureRuntime: (projectPath: string) => ipcRenderer.invoke("runtime:ensure", projectPath) as Promise<{ status: RuntimeStatus; logs: string[] }>,
  startJupyter: (projectPath: string) =>
    ipcRenderer.invoke("runtime:startJupyter", projectPath) as Promise<RuntimeStatus>,
  stopJupyter: (projectPath: string) =>
    ipcRenderer.invoke("runtime:stopJupyter", projectPath) as Promise<RuntimeStatus>,
  runGeneratedWorkflow: (projectPath: string) =>
    ipcRenderer.invoke("runtime:runGeneratedWorkflow", projectPath) as Promise<{ ok: boolean; logs: string[] }>,
  executeNotebook: (projectPath: string, notebookPath: string) =>
    ipcRenderer.invoke("runtime:executeNotebook", projectPath, notebookPath) as Promise<{ ok: boolean; logs: string[] }>,
  testAdvisor: (config: ProviderConfig) => ipcRenderer.invoke("advisor:testConnection", config),
  sendAdvisorMessage: (config: ProviderConfig, preview: DatasetPreview | null, question: string) =>
    ipcRenderer.invoke("advisor:sendMessage", config, preview, question) as Promise<string>,
  getCopilotStatus: (cliPath?: string) =>
    ipcRenderer.invoke("agent:getCopilotStatus", cliPath) as Promise<CopilotBridgeStatus>,
  listCopilotModels: (cliPath?: string) =>
    ipcRenderer.invoke("agent:listCopilotModels", cliPath) as Promise<CopilotModelInfo[]>,
  generateWorkflow: (args: unknown) => ipcRenderer.invoke("agent:generateWorkflow", args) as Promise<AgentRun>,
  applyWorkflow: (projectPath: string, runId: string) =>
    ipcRenderer.invoke("agent:applyWorkflow", projectPath, runId) as Promise<AgentRun>,
  listSessions: () => ipcRenderer.invoke("session:list") as Promise<AgentSessionSummary[]>,
  createSession: (title?: string) => ipcRenderer.invoke("session:create", title) as Promise<AgentSessionSummary>,
  updateSession: (sessionId: string, patch: Partial<Pick<AgentSessionSummary, "title" | "projectPaths">>) =>
    ipcRenderer.invoke("session:update", sessionId, patch) as Promise<AgentSessionSummary>,
  appendSessionMessage: (sessionId: string, role: AgentChatMessage["role"], content: string) =>
    ipcRenderer.invoke("session:appendMessage", sessionId, role, content) as Promise<AgentSessionSummary>,
};

contextBridge.exposeInMainWorld("academiaML", api);
