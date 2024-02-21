import { useEffect, useMemo, useState } from "react";
import { Loader2, Play, PlusSquare, RefreshCw, Save, TerminalSquare } from "lucide-react";

import type { NotebookCell, NotebookDocument, ProjectFileEntry, RuntimeStatus } from "../../shared/types";
import type { ResolvedTheme } from "../lib/theme";
import NotebookCellCard from "./NotebookCellCard";
import { createCodeCell, createMarkdownCell, insertCell, moveCell, removeCell, updateCell } from "../lib/notebook";

function sourceLines(source: string) {
  return source.length ? source.split(/(?<=\n)/) : [];
}

export default function NotebookSurface({
  projectPath,
  notebookPath,
  notebooks,
  runtimeStatus,
  runtimeBusy,
  runtimeError,
  onOpenNotebook,
  onCreateNotebook,
  onRunGeneratedWorkflow,
  onRefreshView,
  labRefreshKey,
  canRunWorkflow,
  resolvedTheme,
}: {
  projectPath: string | null;
  notebookPath: string;
  notebooks: ProjectFileEntry[];
  runtimeStatus?: RuntimeStatus | null;
  runtimeBusy: boolean;
  runtimeError: string;
  onOpenNotebook: (relPath: string) => void;
  onCreateNotebook: () => void;
  onRunGeneratedWorkflow: () => void;
  onRefreshView: () => void;
  labRefreshKey: number;
  canRunWorkflow: boolean;
  resolvedTheme: ResolvedTheme;
}) {
  const [notebook, setNotebook] = useState<NotebookDocument | null>(null);
  const [loadError, setLoadError] = useState("");
  const [saveState, setSaveState] = useState("Saved");
  const [kernelState, setKernelState] = useState("No project");
  const [runningCellId, setRunningCellId] = useState<string | null>(null);
  const notebookRunning = !!runningCellId;

  const engineReady = !!runtimeStatus?.bootstrapped && !runtimeBusy && !runtimeError;

  async function loadNotebookFromDisk() {
    if (!projectPath || !notebookPath) {
      setNotebook(null);
      setLoadError("");
      return;
    }
    try {
      const loaded = await window.academiaML.readNotebook(projectPath, notebookPath);
      setNotebook(loaded);
      setLoadError("");
      setSaveState("Saved");
    } catch (error) {
      setNotebook(null);
      setLoadError(error instanceof Error ? error.message : "Could not open notebook.");
    }
  }

  useEffect(() => {
    void loadNotebookFromDisk();
  }, [projectPath, notebookPath, labRefreshKey]);

  useEffect(() => {
    if (!projectPath) {
      setKernelState("No project");
    } else if (runtimeBusy) {
      setKernelState("Starting notebook engine");
    } else if (runtimeError) {
      setKernelState("Notebook engine failed");
    } else if (engineReady) {
      setKernelState("Kernel ready");
    } else {
      setKernelState("Notebook engine idle");
    }
  }, [engineReady, projectPath, runtimeBusy, runtimeError]);

  async function commitNotebook(next: NotebookDocument) {
    if (!projectPath || !notebookPath) {
      return;
    }
    setNotebook(next);
    setSaveState("Saving");
    await window.academiaML.saveNotebook(projectPath, notebookPath, next);
    setSaveState("Saved");
  }

  async function changeCell(cell: NotebookCell, source: string) {
    if (!notebook) {
      return;
    }
    await commitNotebook(updateCell(notebook, cell.id, { source: sourceLines(source) }));
  }

  async function addCell(kind: "markdown" | "code") {
    if (!notebook) {
      return;
    }
    const next = insertCell(notebook, notebook.cells.length, kind === "markdown" ? createMarkdownCell() : createCodeCell());
    await commitNotebook(next);
  }

  async function moveNotebookCell(cell: NotebookCell, direction: "up" | "down") {
    if (!notebook) {
      return;
    }
    await commitNotebook(moveCell(notebook, cell.id, direction));
  }

  async function deleteNotebookCell(cell: NotebookCell) {
    if (!notebook) {
      return;
    }
    await commitNotebook(removeCell(notebook, cell.id));
  }

  async function executeNotebookDocument(cell?: NotebookCell) {
    if (!projectPath || !notebookPath || !notebook) {
      return;
    }
    if (!engineReady) {
      setKernelState(runtimeBusy ? "Starting notebook engine" : "Notebook engine is not ready");
      return;
    }
    setRunningCellId(cell?.id || "notebook");
    setKernelState(cell ? `Running cell ${notebook.cells.findIndex((item) => item.id === cell.id) + 1}` : "Running all cells");
    try {
      const result = await window.academiaML.executeNotebook(projectPath, notebookPath);
      setKernelState(result.ok ? "Kernel ready" : "Execution finished with errors");
      await loadNotebookFromDisk();
    } catch (error) {
      setKernelState(error instanceof Error ? `Execution failed: ${error.message}` : "Execution failed");
    } finally {
      setRunningCellId(null);
    }
  }

  const statusText = useMemo(() => {
    if (!projectPath) return "Open or create a project";
    if (runtimeError) return runtimeError;
    if (runtimeBusy) return "Notebook engine is starting";
    return kernelState;
  }, [kernelState, projectPath, runtimeBusy, runtimeError]);

  return (
    <section className="pane-shell" data-pane="notebook-workbench">
      <header className="pane-toolbar justify-between">
        <div className="flex min-w-0 items-center gap-1 overflow-x-auto">
          {notebooks.length === 0 ? (
            <span className="px-2 text-sm text-slate">No notebook open</span>
          ) : (
            notebooks.map((entry) => (
              <button
                key={entry.relativePath}
                className={`rounded-sm px-3 py-1.5 text-sm font-medium ${
                  entry.relativePath === notebookPath ? "bg-ink text-paper" : "bg-panel text-slate hover:bg-shell"
                }`}
                onClick={() => onOpenNotebook(entry.relativePath)}
              >
                {entry.name}
              </button>
            ))
          )}
        </div>
        <div className="flex min-w-0 items-center justify-end gap-1 overflow-x-auto">
          <button className="toolbar-button" onClick={onCreateNotebook} disabled={!projectPath}>
            <PlusSquare size={16} /> New
          </button>
          <button className="toolbar-button" onClick={() => void addCell("markdown")} disabled={!notebook || notebookRunning}>
            Markdown
          </button>
          <button className="toolbar-button" onClick={() => void addCell("code")} disabled={!notebook || notebookRunning}>
            Code
          </button>
          <button className="toolbar-button" onClick={() => void executeNotebookDocument()} disabled={!notebook || !engineReady || !!runningCellId}>
            {notebookRunning ? <Loader2 size={16} className="animate-spin" /> : <Play size={16} />}
            {notebookRunning ? "Running" : "Run all"}
          </button>
          <button className="toolbar-button" onClick={onRunGeneratedWorkflow} disabled={!canRunWorkflow}>
            <TerminalSquare size={16} /> Run script
          </button>
          <button
            className="toolbar-button"
            onClick={() => {
              onRefreshView();
              void loadNotebookFromDisk();
            }}
            disabled={!projectPath}
          >
            <RefreshCw size={16} /> Reload
          </button>
        </div>
      </header>
      <div className="min-h-0 flex-1 overflow-hidden bg-paper">
        <div className="flex h-full min-h-0 flex-col">
          <div className="flex items-center justify-between border-b border-line bg-panel px-2.5 py-1.5 text-xs text-slate">
            <span className="truncate">{notebookPath || "No notebook selected"}</span>
            <span className="inline-flex min-w-0 items-center gap-3">
              <span className="inline-flex max-w-[360px] items-center gap-1 truncate">
                {notebookRunning || runtimeBusy ? <Loader2 size={13} className="shrink-0 animate-spin text-copper" /> : null}
                <span className="truncate">{statusText}</span>
              </span>
              <span className="inline-flex items-center gap-1">
                <Save size={13} />
                {saveState}
              </span>
            </span>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto bg-code px-3 py-3">
            {!projectPath ? (
              <div className="mx-auto mt-20 max-w-xl border border-line bg-panel px-5 py-4 text-sm leading-6 text-ink shadow-pane">
                Start from the agent or select a project from the Explorer. The first notebook opens automatically.
              </div>
            ) : loadError ? (
              <div className="border border-rust/45 bg-rust/10 px-3 py-2 text-sm text-rust">{loadError}</div>
            ) : !notebook ? (
              <div className="px-3 py-3 text-sm text-slate">Opening notebook...</div>
            ) : (
              <div className="mx-auto max-w-[1180px] space-y-3">
                {notebook.cells.map((cell, index) => (
                  <NotebookCellCard
                    key={cell.id}
                    cell={cell}
                    index={index}
                    isRunning={runningCellId === "notebook" || runningCellId === cell.id}
                    notebookRunning={notebookRunning}
                    resolvedTheme={resolvedTheme}
                    onChange={(source) => void changeCell(cell, source)}
                    onRun={() => void executeNotebookDocument(cell)}
                    onMove={(direction) => void moveNotebookCell(cell, direction)}
                    onDelete={() => void deleteNotebookCell(cell)}
                  />
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
