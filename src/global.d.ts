import type {
  AgentRun,
  AgentChatMessage,
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
} from "../shared/types";

declare global {
  interface Window {
    academiaML: {
      listProjects(): Promise<ProjectListItem[]>;
      listExamples(): Promise<ExampleProject[]>;
      openExample(exampleId: string): Promise<any>;
      openProjectPath(projectPath: string): Promise<any>;
      chooseProjectDirectory(): Promise<any | null>;
      createProject(args: {
        title: string;
        description?: string;
        parentDirectory?: string;
        taskHint?: "regression" | "classification";
      }): Promise<any>;
      readNotebook(projectPath: string, relPath: string): Promise<NotebookDocument>;
      saveNotebook(projectPath: string, relPath: string, notebook: NotebookDocument): Promise<{ ok: true }>;
      createNotebook(projectPath: string, title: string): Promise<string>;
      previewDataset(projectPath: string, relPath: string): Promise<DatasetPreview>;
      listFiles(projectPath: string, relRoot: string): Promise<ProjectFileEntry[]>;
      importDataset(projectPath: string): Promise<{ relativePath: string; preview: DatasetPreview } | null>;
      readTextFile(projectPath: string, relPath: string): Promise<string>;
      runtimeStatus(projectPath: string): Promise<RuntimeStatus>;
      bootstrapRuntime(projectPath: string): Promise<{ status: RuntimeStatus; logs: string[] }>;
      ensureRuntime(projectPath: string): Promise<{ status: RuntimeStatus; logs: string[] }>;
      startJupyter(projectPath: string): Promise<RuntimeStatus>;
      stopJupyter(projectPath: string): Promise<RuntimeStatus>;
      runGeneratedWorkflow(projectPath: string): Promise<{ ok: boolean; logs: string[] }>;
      executeNotebook(projectPath: string, notebookPath: string): Promise<{ ok: boolean; logs: string[] }>;
      testAdvisor(config: ProviderConfig): Promise<{ reachable: boolean; message: string }>;
      sendAdvisorMessage(config: ProviderConfig, preview: DatasetPreview | null, question: string): Promise<string>;
      getCopilotStatus(cliPath?: string): Promise<CopilotBridgeStatus>;
      listCopilotModels(cliPath?: string): Promise<CopilotModelInfo[]>;
      generateWorkflow(args: unknown): Promise<AgentRun>;
      applyWorkflow(projectPath: string, runId: string): Promise<AgentRun>;
      listSessions(): Promise<AgentSessionSummary[]>;
      createSession(title?: string): Promise<AgentSessionSummary>;
      updateSession(sessionId: string, patch: Partial<Pick<AgentSessionSummary, "title" | "projectPaths">>): Promise<AgentSessionSummary>;
      appendSessionMessage(sessionId: string, role: AgentChatMessage["role"], content: string): Promise<AgentSessionSummary>;
    };
  }

  namespace JSX {
    interface IntrinsicElements {
      webview: any;
    }
  }
}

export {};
