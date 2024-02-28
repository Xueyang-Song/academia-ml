import { useEffect, useMemo, useRef, useState } from "react";
import { Panel, PanelGroup, PanelResizeHandle } from "react-resizable-panels";

import type {
  AgentRun,
  AgentSessionSummary,
  CopilotModelInfo,
  DatasetPreview,
  ProjectFileEntry,
  ProjectListItem,
  ProjectManifest,
  RuntimeStatus,
  TrainingArtifactSummary,
  WorkflowTaskType,
} from "../shared/types";
import LeftSidebar from "./components/LeftSidebar";
import NotebookSurface from "./components/NotebookSurface";
import RightSidebar from "./components/RightSidebar";
import BottomDock from "./components/BottomDock";
import ModalDialog from "./components/ModalDialog";
import {
  applyResolvedTheme,
  readThemePreference,
  resolveThemePreference,
  type ResolvedTheme,
  type ThemePreference,
  writeThemePreference,
} from "./lib/theme";

interface LoadedProject {
  projectPath: string;
  manifest: ProjectManifest;
  notebooks: ProjectFileEntry[];
  datasets: ProjectFileEntry[];
  generated: ProjectFileEntry[];
  artifacts: ProjectFileEntry[];
  logs: ProjectFileEntry[];
  datasetPreview: DatasetPreview | null;
}

function cleanProjectName(raw: string) {
  return raw.replace(/^["'`]|["'`]$/g, "").replace(/[.!?]$/g, "").trim();
}

function App() {
  const [projectList, setProjectList] = useState<ProjectListItem[]>([]);
  const [project, setProject] = useState<LoadedProject | null>(null);
  const [activeNotebookPath, setActiveNotebookPath] = useState("");
  const [runtimeStatus, setRuntimeStatus] = useState<RuntimeStatus | null>(null);
  const [runtimeBusy, setRuntimeBusy] = useState(false);
  const [runtimeError, setRuntimeError] = useState("");
  const runtimeStarts = useRef(new Map<string, Promise<void>>());
  const activeProjectPathRef = useRef<string | null>(null);

  const [datasetPreview, setDatasetPreview] = useState<DatasetPreview | null>(null);
  const [copilotStatus, setCopilotStatus] = useState<any>(null);
  const [copilotModels, setCopilotModels] = useState<CopilotModelInfo[]>([]);
  const [copilotModelError, setCopilotModelError] = useState("");
  const [agentRun, setAgentRun] = useState<AgentRun | null>(null);
  const [agentModel, setAgentModel] = useState("gpt-5.2-codex");
  const [agentReasoningEffort, setAgentReasoningEffort] = useState("default");
  const [sessions, setSessions] = useState<AgentSessionSummary[]>([]);
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [sessionDraft, setSessionDraft] = useState("");
  const [sessionBusy, setSessionBusy] = useState(false);
  const [terminalLines, setTerminalLines] = useState<string[]>([
    "AcademiaML ready.",
    "Use the agent or select a project. The notebook engine starts automatically.",
  ]);
  const [artifactSummary, setArtifactSummary] = useState<TrainingArtifactSummary>({
    metrics: [],
    artifactPaths: [],
    lastRunStatus: "idle",
  });
  const [activeTargetColumn, setActiveTargetColumn] = useState("");
  const [labRefreshKey, setLabRefreshKey] = useState(0);

  const [projectDialogOpen, setProjectDialogOpen] = useState(false);
  const [notebookDialogOpen, setNotebookDialogOpen] = useState(false);
  const [projectActionBusy, setProjectActionBusy] = useState(false);
  const [projectDialogError, setProjectDialogError] = useState("");
  const [newProjectTitle, setNewProjectTitle] = useState("");
  const [newProjectDescription, setNewProjectDescription] = useState("");
  const [newProjectTaskHint, setNewProjectTaskHint] = useState<WorkflowTaskType>("regression");
  const [newNotebookTitle, setNewNotebookTitle] = useState("Analysis");
  const [themePreference, setThemePreference] = useState<ThemePreference>(() => readThemePreference());
  const [resolvedTheme, setResolvedTheme] = useState<ResolvedTheme>(() => resolveThemePreference(readThemePreference()));

  const activeSession = useMemo(
    () => sessions.find((session) => session.id === activeSessionId) || null,
    [activeSessionId, sessions],
  );

  function reasoningForModel(models: CopilotModelInfo[], modelId: string, current: string) {
    const modelInfo = models.find((item) => item.id === modelId);
    if (!modelInfo || modelInfo.supportedReasoningEfforts.length === 0) {
      return "default";
    }
    if (modelInfo.supportedReasoningEfforts.includes(current)) {
      return current;
    }
    return modelInfo.defaultReasoningEffort || modelInfo.supportedReasoningEfforts[0];
  }

  async function refreshCopilotModels(cliPath?: string) {
    try {
      const models = await window.academiaML.listCopilotModels(cliPath);
      setCopilotModels(models);
      setCopilotModelError("");
      setAgentModel((currentModel) => {
        const nextModel =
          models.find((item) => item.id === currentModel)?.id ||
          models.find((item) => item.id === "gpt-5.2-codex")?.id ||
          models[0]?.id ||
          currentModel;
        setAgentReasoningEffort((currentEffort) => reasoningForModel(models, nextModel, currentEffort));
        return nextModel;
      });
      return models;
    } catch (error) {
      const message = error instanceof Error ? error.message : "Could not load Copilot model catalog.";
      setCopilotModels([]);
      setCopilotModelError(message);
      appendLogs(`Copilot model catalog error: ${message}`);
      return [];
    }
  }

  function changeAgentModel(modelId: string) {
    setAgentModel(modelId);
    setAgentReasoningEffort((current) => reasoningForModel(copilotModels, modelId, current));
  }

  function changeThemePreference(preference: ThemePreference) {
    writeThemePreference(preference);
    setThemePreference(preference);
  }

  const appendLogs = (...lines: string[]) => {
    const cleaned = lines.flatMap((line) => line.toString().split(/\r?\n/)).filter(Boolean);
    if (cleaned.length) {
      setTerminalLines((current) => [...current, ...cleaned].slice(-800));
    }
  };

  async function refreshProjectList() {
    const list = await window.academiaML.listProjects();
    setProjectList(list);
    return list;
  }

  async function refreshSessions(nextActiveSessionId = activeSessionId) {
    const list = await window.academiaML.listSessions();
    setSessions(list);
    if (nextActiveSessionId && list.some((session) => session.id === nextActiveSessionId)) {
      setActiveSessionId(nextActiveSessionId);
    }
    return list;
  }

  async function refreshRuntime(projectPath: string) {
    const status = await window.academiaML.runtimeStatus(projectPath);
    if (activeProjectPathRef.current === projectPath) {
      setRuntimeStatus(status);
    }
    return status;
  }

  async function ensureNotebookEngine(projectPath: string) {
    const existing = runtimeStarts.current.get(projectPath);
    if (existing) {
      return existing;
    }

    const run = (async () => {
      if (activeProjectPathRef.current === projectPath) {
        setRuntimeBusy(true);
        setRuntimeError("");
      }
      appendLogs("Starting notebook engine...");
      try {
        const result = await window.academiaML.ensureRuntime(projectPath);
        if (result.logs.length) {
          appendLogs(...result.logs);
        }
        if (activeProjectPathRef.current === projectPath) {
          setRuntimeStatus(result.status);
          setRuntimeError("");
          setLabRefreshKey((current) => current + 1);
        }
        appendLogs("Notebook engine ready.");
      } catch (error) {
        const message = error instanceof Error ? error.message : "Notebook engine failed to start.";
        if (activeProjectPathRef.current === projectPath) {
          setRuntimeError(message);
        }
        appendLogs(message);
      } finally {
        if (activeProjectPathRef.current === projectPath) {
          setRuntimeBusy(false);
        }
        runtimeStarts.current.delete(projectPath);
      }
    })();

    runtimeStarts.current.set(projectPath, run);
    return run;
  }

  async function refreshArtifacts(targetProject = project) {
    if (!targetProject) {
      return;
    }
    const artifacts = await window.academiaML.listFiles(targetProject.projectPath, "artifacts");
    let metrics: Array<{ label: string; value: string }> = [];
    const metricsFile = artifacts.find((entry) => entry.relativePath.endsWith("latest_metrics.json"));
    if (metricsFile) {
      try {
        const raw = await window.academiaML.readTextFile(targetProject.projectPath, metricsFile.relativePath);
        const parsed = JSON.parse(raw) as Record<string, Record<string, number>>;
        metrics = Object.entries(parsed).flatMap(([name, values]) =>
          Object.entries(values).map(([metricName, metricValue]) => ({
            label: `${name} ${metricName}`,
            value: Number(metricValue).toFixed(4),
          })),
        );
      } catch {
        metrics = [];
      }
    }
    setArtifactSummary((current) => ({
      ...current,
      metrics,
      artifactPaths: artifacts.map((entry) => entry.relativePath),
    }));
    setProject((current) => (current ? { ...current, artifacts } : current));
  }

  async function syncProjectState(nextProject: LoadedProject, options?: { logLine?: string; openNotebookPath?: string }) {
    activeProjectPathRef.current = nextProject.projectPath;
    setRuntimeError("");
    setProject(nextProject);
    setDatasetPreview(nextProject.datasetPreview);
    setActiveTargetColumn(nextProject.manifest.targetColumn || nextProject.datasetPreview?.targetSuggestions?.[0] || "");
    setActiveNotebookPath(options?.openNotebookPath || nextProject.manifest.notebookPath || nextProject.notebooks[0]?.relativePath || "");
    await refreshRuntime(nextProject.projectPath);
    await refreshArtifacts(nextProject);
    await refreshProjectList();
    const copilot = await window.academiaML.getCopilotStatus(nextProject.manifest.copilotConfig?.cliPath);
    setCopilotStatus(copilot);
    if (copilot.ready) {
      void refreshCopilotModels(copilot.cliPath);
    }
    if (options?.logLine) {
      appendLogs(options.logLine);
    }
    void ensureNotebookEngine(nextProject.projectPath);
  }

  async function openProjectByPath(projectPath: string) {
    const loaded = (await window.academiaML.openProjectPath(projectPath)) as LoadedProject;
    await syncProjectState(loaded, { logLine: `Opened project: ${loaded.manifest.title}` });
    return loaded;
  }

  async function reloadProject(options?: { openNotebookPath?: string }) {
    if (!project) {
      return;
    }
    const refreshed = (await window.academiaML.openProjectPath(project.projectPath)) as LoadedProject;
    await syncProjectState(refreshed, {
      openNotebookPath: options?.openNotebookPath || activeNotebookPath || refreshed.manifest.notebookPath,
    });
  }

  async function linkSessionProject(sessionId: string | null, projectPath: string) {
    if (!sessionId) {
      return;
    }
    const session = sessions.find((item) => item.id === sessionId);
    const currentPaths = session?.projectPaths || [];
    if (currentPaths.includes(projectPath)) {
      return;
    }
    const updated = await window.academiaML.updateSession(sessionId, {
      projectPaths: [...currentPaths, projectPath],
    });
    setSessions((current) => current.map((item) => (item.id === updated.id ? updated : item)));
  }

  useEffect(() => {
    void (async () => {
      const [projects, loadedSessions] = await Promise.all([refreshProjectList(), refreshSessions(null)]);
      if (loadedSessions.length > 0) {
        setActiveSessionId(null);
      }
      if (projects.length > 0) {
        await openProjectByPath(projects[0].projectPath);
      }
      const copilot = await window.academiaML.getCopilotStatus();
      setCopilotStatus(copilot);
      if (copilot.ready) {
        void refreshCopilotModels(copilot.cliPath);
      }
    })();
  }, []);

  useEffect(() => {
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const syncTheme = () => {
      const next = resolveThemePreference(themePreference);
      setResolvedTheme(next);
      applyResolvedTheme(next);
    };

    syncTheme();
    if (themePreference === "system") {
      media.addEventListener("change", syncTheme);
      return () => media.removeEventListener("change", syncTheme);
    }
    return undefined;
  }, [themePreference]);

  async function openExistingProject() {
    const loaded = (await window.academiaML.chooseProjectDirectory()) as LoadedProject | null;
    if (!loaded) {
      return;
    }
    await syncProjectState(loaded, { logLine: `Opened project: ${loaded.manifest.title}` });
    await linkSessionProject(activeSessionId, loaded.projectPath);
    setProjectDialogOpen(false);
  }

  async function createProject(title: string, description = "", taskHint: WorkflowTaskType = "regression") {
    const loaded = (await window.academiaML.createProject({
      title,
      description,
      taskHint,
    })) as LoadedProject;
    await syncProjectState(loaded, { logLine: `Created project: ${loaded.manifest.title}` });
    await refreshProjectList();
    return loaded;
  }

  async function createProjectFromDialog() {
    const title = newProjectTitle.trim();
    if (!title) {
      setProjectDialogError("Type a project name first.");
      return;
    }
    setProjectActionBusy(true);
    setProjectDialogError("");
    try {
      const loaded = await createProject(title, newProjectDescription, newProjectTaskHint);
      await linkSessionProject(activeSessionId, loaded.projectPath);
      setNewProjectTitle("");
      setNewProjectDescription("");
      setProjectDialogOpen(false);
    } catch (error) {
      setProjectDialogError(error instanceof Error ? error.message : "Project creation failed.");
    } finally {
      setProjectActionBusy(false);
    }
  }

  async function createNotebookFromDialog() {
    if (!project) {
      return;
    }
    const title = newNotebookTitle.trim() || "Analysis";
    const relPath = await window.academiaML.createNotebook(project.projectPath, title);
    await reloadProject({ openNotebookPath: relPath });
    setNotebookDialogOpen(false);
    setNewNotebookTitle("Analysis");
    appendLogs(`Created notebook ${relPath}`);
  }

  async function openNotebook(relPath: string) {
    setActiveNotebookPath(relPath);
    setLabRefreshKey((current) => current + 1);
    appendLogs(`Opened notebook ${relPath}`);
  }

  async function runGeneratedWorkflow() {
    if (!project) {
      return;
    }
    await ensureNotebookEngine(project.projectPath);
    setArtifactSummary((current) => ({ ...current, lastRunStatus: "running" }));
    appendLogs("Running generated workflow script...");
    try {
      const result = await window.academiaML.runGeneratedWorkflow(project.projectPath);
      appendLogs(...result.logs);
      await refreshArtifacts(project);
      setArtifactSummary((current) => ({ ...current, lastRunStatus: result.ok ? "completed" : "failed" }));
      setLabRefreshKey((current) => current + 1);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Workflow execution failed.";
      appendLogs(message);
      setArtifactSummary((current) => ({ ...current, lastRunStatus: "failed" }));
    }
  }

  async function stageWorkflow(userRequest?: string) {
    if (!project || !datasetPreview || !activeTargetColumn) {
      throw new Error("Open a project with an imported dataset and prediction column first.");
    }

    appendLogs("Agent is staging a workflow...");
    const run = await window.academiaML.generateWorkflow({
      projectPath: project.projectPath,
      preview: datasetPreview,
      targetColumn: activeTargetColumn,
      notebookPath: activeNotebookPath || project.manifest.notebookPath,
      providerMode: "agent",
      userRequest: userRequest || "Inspect this dataset and stage a practical classical ML workflow.",
      copilotCliPath: project.manifest.copilotConfig?.cliPath,
      copilotModel: agentModel,
      reasoningEffort: agentReasoningEffort,
    });
    setAgentRun(run);
    return run;
  }

  async function applyCurrentWorkflow(run = agentRun) {
    if (!project || !run) {
      throw new Error("No staged workflow is ready to apply.");
    }
    const next = await window.academiaML.applyWorkflow(project.projectPath, run.id);
    setAgentRun(next);
    await reloadProject({ openNotebookPath: next.notebookPath });
    appendLogs("Notebook edits applied after approval.");
    return next;
  }

  async function importDataset() {
    if (!project) {
      return;
    }
    const result = await window.academiaML.importDataset(project.projectPath);
    if (!result) {
      return;
    }
    await reloadProject();
    setDatasetPreview(result.preview);
    setActiveTargetColumn(result.preview.targetSuggestions[0] || "");
    appendLogs(`Imported dataset ${result.relativePath}`);
  }

  async function createAgentSession() {
    const session = await window.academiaML.createSession();
    setSessions((current) => [session, ...current]);
    setActiveSessionId(session.id);
  }

  async function appendSessionMessage(role: "user" | "assistant" | "tool", content: string, sessionId = activeSessionId) {
    if (!sessionId) {
      return null;
    }
    const updated = await window.academiaML.appendSessionMessage(sessionId, role, content);
    setSessions((current) => current.map((session) => (session.id === updated.id ? updated : session)));
    return updated;
  }

  async function sendAgentSessionMessage() {
    let session = activeSession;
    if (!session) {
      session = await window.academiaML.createSession();
      setSessions((current) => [session!, ...current]);
      setActiveSessionId(session.id);
    }
    const sessionId = session.id;
    const request = sessionDraft.trim();
    if (!request) {
      return;
    }
    setSessionDraft("");
    setSessionBusy(true);
    await appendSessionMessage("user", request, sessionId);

    try {
      const lower = request.toLowerCase();
      const createMatch =
        request.match(/(?:create|start|make|new)\s+(?:a\s+)?project(?:\s+(?:called|named|for))?\s+(.+)/i) ||
        request.match(/project\s+(?:called|named)\s+(.+)/i);
      if (createMatch) {
        const title = cleanProjectName(createMatch[1]);
        const loaded = await createProject(title || "Untitled research project", "Created from the global agent session.");
        await linkSessionProject(sessionId, loaded.projectPath);
        await appendSessionMessage("tool", `Created and opened project **${loaded.manifest.title}**.`, sessionId);
        await appendSessionMessage("assistant", `I created **${loaded.manifest.title}** and opened its starter notebook.`, sessionId);
        return;
      }

      const openMatch = request.match(/open\s+(?:the\s+)?(?:project\s+)?(.+)/i);
      if (openMatch) {
        const query = cleanProjectName(openMatch[1]).toLowerCase();
        const match = projectList.find(
          (item) => item.title.toLowerCase().includes(query) || item.projectPath.toLowerCase().includes(query),
        );
        if (!match) {
          await appendSessionMessage("assistant", `I could not find a project matching "${query}" in the AcademiaML project folders.`, sessionId);
          return;
        }
        const loaded = await openProjectByPath(match.projectPath);
        await linkSessionProject(sessionId, loaded.projectPath);
        await appendSessionMessage("tool", `Opened project **${loaded.manifest.title}**.`, sessionId);
        await appendSessionMessage("assistant", `I opened **${loaded.manifest.title}**.`, sessionId);
        return;
      }

      if (lower.includes("workflow") || lower.includes("train") || lower.includes("model")) {
        const run = await stageWorkflow(request);
        await linkSessionProject(sessionId, project!.projectPath);
        await appendSessionMessage("tool", `Staged workflow for **${project!.manifest.title}** with ${run.steps.length} agent steps.`, sessionId);
        if (lower.includes("run")) {
          await applyCurrentWorkflow(run);
          await runGeneratedWorkflow();
          await appendSessionMessage("assistant", "I staged the notebook, applied the generated files, ran the local workflow, and refreshed the results tab.", sessionId);
        } else {
          await appendSessionMessage("assistant", "I staged a workflow. Say `run it` if you want me to apply the notebook edits and execute the local training script.", sessionId);
        }
        return;
      }

      if (lower.includes("run it") || lower === "run") {
        await applyCurrentWorkflow();
        await runGeneratedWorkflow();
        if (project) {
          await linkSessionProject(sessionId, project.projectPath);
        }
        await appendSessionMessage("assistant", "I applied the staged workflow and ran it locally. Check the Results tab at the bottom.", sessionId);
        return;
      }

      await appendSessionMessage(
        "assistant",
        "I can help from here. Try asking me to create a project, open a project, import data, stage a workflow, or run the current workflow.",
        sessionId,
      );
    } catch (error) {
      await appendSessionMessage("assistant", error instanceof Error ? error.message : "The agent action failed.", sessionId);
    } finally {
      setSessionBusy(false);
      await refreshSessions(sessionId);
    }
  }

  const targetOptions = useMemo(() => {
    if (!datasetPreview) {
      return [];
    }
    const candidates = datasetPreview.columns
      .filter((column) => column.inferredType === "number" || column.inferredType === "boolean")
      .map((column) => column.name);
    return Array.from(new Set([project?.manifest.targetColumn, ...datasetPreview.targetSuggestions, ...candidates].filter(Boolean) as string[]));
  }, [datasetPreview, project?.manifest.targetColumn]);

  const hasGeneratedWorkflow = useMemo(() => {
    if (!project) {
      return false;
    }
    return project.generated.some((entry) => entry.relativePath.endsWith("train_workflow.py"));
  }, [project]);

  return (
    <main className="app-shell relative h-full min-h-0 w-full min-w-0 overflow-hidden bg-shell text-ink">
      <PanelGroup direction="horizontal" className="h-full min-h-0 min-w-0">
        <Panel defaultSize={19} minSize={14}>
          <LeftSidebar
            projects={projectList}
            activeProjectPath={project?.projectPath || null}
            manifest={project?.manifest || null}
            datasetPreview={datasetPreview}
            notebooks={project?.notebooks || []}
            datasets={project?.datasets || []}
            generated={project?.generated || []}
            artifacts={project?.artifacts || []}
            logs={project?.logs || []}
            activeNotebookPath={activeNotebookPath}
            onSelectProject={(projectPath) => void openProjectByPath(projectPath)}
            onCreateProject={() => setProjectDialogOpen(true)}
            onOpenProject={() => void openExistingProject()}
            onOpenNotebook={(relPath) => void openNotebook(relPath)}
            onImportDataset={() => void importDataset()}
          />
        </Panel>
        <PanelResizeHandle className="resize-handle" />
        <Panel defaultSize={58} minSize={42}>
          <PanelGroup direction="vertical" className="min-h-0 min-w-0">
            <Panel defaultSize={78} minSize={48}>
              <NotebookSurface
                projectPath={project?.projectPath || null}
                notebookPath={activeNotebookPath}
                notebooks={project?.notebooks || []}
                runtimeStatus={runtimeStatus}
                runtimeBusy={runtimeBusy}
                runtimeError={runtimeError}
                onOpenNotebook={(relPath) => void openNotebook(relPath)}
                onCreateNotebook={() => setNotebookDialogOpen(true)}
                onRunGeneratedWorkflow={() => void runGeneratedWorkflow()}
                onRefreshView={() => setLabRefreshKey((current) => current + 1)}
                labRefreshKey={labRefreshKey}
                canRunWorkflow={hasGeneratedWorkflow}
                resolvedTheme={resolvedTheme}
              />
            </Panel>
            <PanelResizeHandle className="resize-handle" />
            <Panel defaultSize={22} minSize={13}>
              <BottomDock
                lines={terminalLines}
                artifactSummary={artifactSummary}
                themePreference={themePreference}
                onThemePreferenceChange={changeThemePreference}
              />
            </Panel>
          </PanelGroup>
        </Panel>
        <PanelResizeHandle className="resize-handle" />
        <Panel defaultSize={23} minSize={17}>
          <RightSidebar
            sessions={sessions}
            activeSession={activeSession}
            copilotStatus={copilotStatus}
            projects={projectList}
            draft={sessionDraft}
            models={copilotModels}
            modelLoadError={copilotModelError}
            model={agentModel}
            reasoningEffort={agentReasoningEffort}
            busy={sessionBusy}
            onNewSession={() => void createAgentSession()}
            onOpenSession={setActiveSessionId}
            onBackToSessions={() => setActiveSessionId(null)}
            onDraftChange={setSessionDraft}
            onModelChange={changeAgentModel}
            onReasoningEffortChange={setAgentReasoningEffort}
            onSend={() => void sendAgentSessionMessage()}
            onOpenProject={(projectPath) => void openProjectByPath(projectPath)}
          />
        </Panel>
      </PanelGroup>

      {projectDialogOpen ? (
        <ModalDialog
          title="New Project"
          onClose={() => setProjectDialogOpen(false)}
          footer={
            <div className="flex items-center justify-between gap-3">
              <p className="text-sm text-slate">A starter notebook opens immediately after creation.</p>
              <div className="flex items-center gap-2">
                <button className="toolbar-button" onClick={() => void openExistingProject()} disabled={projectActionBusy}>
                  Open folder
                </button>
                <button className="toolbar-button" onClick={() => void createProjectFromDialog()} disabled={projectActionBusy}>
                  Create
                </button>
              </div>
            </div>
          }
        >
          <div className="space-y-3">
            <label className="field-label">
              Project name
              <input
                className="field-input"
                placeholder="e.g. zinc electrolyte screening"
                value={newProjectTitle}
                onChange={(event) => setNewProjectTitle(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    void createProjectFromDialog();
                  }
                }}
                autoFocus
              />
            </label>
            <label className="field-label">
              Notes
              <textarea
                className="min-h-[92px] rounded-sm border border-line bg-panel px-2.5 py-2 text-sm text-ink outline-none ring-0"
                value={newProjectDescription}
                onChange={(event) => setNewProjectDescription(event.target.value)}
              />
            </label>
            <label className="field-label">
              First workflow type
              <select className="field-input" value={newProjectTaskHint} onChange={(event) => setNewProjectTaskHint(event.target.value as WorkflowTaskType)}>
                <option value="regression">Regression</option>
                <option value="classification">Classification</option>
              </select>
            </label>
            {projectDialogError ? <p className="text-sm text-rust">{projectDialogError}</p> : null}
          </div>
        </ModalDialog>
      ) : null}

      {notebookDialogOpen ? (
        <ModalDialog
          title="New Notebook"
          onClose={() => setNotebookDialogOpen(false)}
          footer={
            <div className="flex items-center justify-between gap-3">
              <p className="text-sm text-slate">Creates a real `.ipynb` file in the selected project.</p>
              <button className="toolbar-button" onClick={() => void createNotebookFromDialog()} disabled={!project}>
                Create notebook
              </button>
            </div>
          }
        >
          <label className="field-label">
            Notebook title
            <input className="field-input" value={newNotebookTitle} onChange={(event) => setNewNotebookTitle(event.target.value)} autoFocus />
          </label>
        </ModalDialog>
      ) : null}

      {datasetPreview && targetOptions.length > 0 ? (
        <div className="pointer-events-none absolute bottom-1 right-[calc(23%+10px)] z-10 flex items-center gap-2 text-[12px] text-slate">
          <span>Prediction column</span>
          <select
            className="pointer-events-auto rounded-sm border border-line bg-paper px-2 py-1 text-ink"
            value={activeTargetColumn}
            onChange={(event) => setActiveTargetColumn(event.target.value)}
          >
            {targetOptions.map((column) => (
              <option key={column} value={column}>
                {column}
              </option>
            ))}
          </select>
        </div>
      ) : null}
    </main>
  );
}

export default App;
