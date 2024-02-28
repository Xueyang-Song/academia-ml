export type ProviderMode = "advisor" | "agent";
export type NotebookCellKind = "markdown" | "code";
export type WorkflowTaskType = "regression" | "classification";

export interface ProviderConfig {
  baseUrl: string;
  apiKey: string;
  model: string;
}

export interface CopilotConfig {
  cliPath?: string;
  model: string;
}

export interface CopilotModelInfo {
  id: string;
  name: string;
  supportedReasoningEfforts: string[];
  defaultReasoningEffort?: string;
}

export interface ProjectManifest {
  id: string;
  title: string;
  createdAt: string;
  updatedAt: string;
  description: string;
  datasetPath: string;
  notebookPath: string;
  taskHint?: WorkflowTaskType;
  targetColumn?: string;
  advisorConfig?: ProviderConfig;
  copilotConfig?: CopilotConfig;
}

export interface ExampleProject {
  id: string;
  title: string;
  description: string;
  notebookPath: string;
  datasetPath: string;
  targetColumn?: string;
  taskHint?: WorkflowTaskType;
}

export interface ProjectListItem {
  id: string;
  title: string;
  description: string;
  projectPath: string;
  updatedAt: string;
  datasetPath: string;
  notebookPath: string;
}

export interface AgentChatMessage {
  id: string;
  role: "user" | "assistant" | "tool";
  content: string;
  createdAt: string;
}

export interface AgentSessionSummary {
  id: string;
  title: string;
  createdAt: string;
  updatedAt: string;
  projectPaths: string[];
  messages: AgentChatMessage[];
}

export interface ProjectFileEntry {
  name: string;
  relativePath: string;
  kind: "directory" | "file";
}

export interface DatasetColumnProfile {
  name: string;
  inferredType: "number" | "boolean" | "string";
  missingCount: number;
  uniqueCount: number;
  mean?: number;
  min?: number;
  max?: number;
}

export interface DatasetPreview {
  relativePath: string;
  rowCount: number;
  sampleRows: Record<string, string | number | boolean | null>[];
  columns: DatasetColumnProfile[];
  targetSuggestions: string[];
}

export interface NotebookOutput {
  output_type: "stream" | "display_data" | "execute_result" | "error";
  name?: string;
  text?: string[];
  data?: Record<string, string>;
  ename?: string;
  evalue?: string;
  traceback?: string[];
}

export interface NotebookCell {
  cell_type: NotebookCellKind;
  id: string;
  metadata: Record<string, unknown>;
  source: string[];
  execution_count?: number | null;
  outputs?: NotebookOutput[];
}

export interface NotebookDocument {
  nbformat: number;
  nbformat_minor: number;
  metadata: Record<string, unknown>;
  cells: NotebookCell[];
}

export type AgentStepStatus =
  | "pending"
  | "running"
  | "awaiting_approval"
  | "completed"
  | "failed"
  | "skipped";

export interface AgentStep {
  id: string;
  title: string;
  detail: string;
  status: AgentStepStatus;
  requiresApproval?: boolean;
  approved?: boolean;
  inputSummary?: string;
  outputSummary?: string;
  logs: string[];
}

export interface AgentRun {
  id: string;
  mode: ProviderMode;
  createdAt: string;
  datasetPath: string;
  notebookPath: string;
  taskType: WorkflowTaskType;
  targetColumn: string;
  remotePayloadSummary: string;
  recommendationSummary: string;
  notebookSuggestion: NotebookDocument;
  generatedFiles: Array<{
    relativePath: string;
    content: string;
  }>;
  steps: AgentStep[];
  providerStatus: CopilotBridgeStatus | AdvisorStatus;
}

export interface CopilotBridgeStatus {
  installed: boolean;
  sdkAvailable: boolean;
  authenticated: boolean;
  ready: boolean;
  cliPath?: string;
  message: string;
}

export interface AdvisorStatus {
  reachable: boolean;
  message: string;
}

export interface RuntimeStatus {
  bootstrapped: boolean;
  jupyterRunning: boolean;
  pythonPath: string;
  baseUrl?: string;
  wsUrl?: string;
  token?: string;
  logPath: string;
  message: string;
}

export interface TrainingArtifactSummary {
  metrics: Array<{ label: string; value: string }>;
  artifactPaths: string[];
  lastRunStatus: "idle" | "running" | "completed" | "failed";
}
