import { useEffect, useState } from "react";
import { ArrowLeft, Database, FileCode2, FileText, Folder, FolderOpen, Plus, UploadCloud } from "lucide-react";

import type { DatasetPreview, ProjectFileEntry, ProjectListItem, ProjectManifest } from "../../shared/types";

export default function LeftSidebar({
  projects,
  activeProjectPath,
  manifest,
  datasetPreview,
  notebooks,
  datasets,
  generated,
  artifacts,
  logs,
  activeNotebookPath,
  onSelectProject,
  onCreateProject,
  onOpenProject,
  onOpenNotebook,
  onImportDataset,
}: {
  projects: ProjectListItem[];
  activeProjectPath: string | null;
  manifest: ProjectManifest | null;
  datasetPreview: DatasetPreview | null;
  notebooks: ProjectFileEntry[];
  datasets: ProjectFileEntry[];
  generated: ProjectFileEntry[];
  artifacts: ProjectFileEntry[];
  logs: ProjectFileEntry[];
  activeNotebookPath: string;
  onSelectProject: (projectPath: string) => void;
  onCreateProject: () => void;
  onOpenProject: () => void;
  onOpenNotebook: (relPath: string) => void;
  onImportDataset: () => void;
}) {
  const [page, setPage] = useState<"projects" | "project">("projects");

  useEffect(() => {
    if (activeProjectPath) {
      setPage("project");
    }
  }, [activeProjectPath]);

  if (page === "projects" || !activeProjectPath || !manifest) {
    return (
      <section className="pane-shell" data-pane="left-sidebar">
        <div className="pane-toolbar justify-between">
          <div className="flex items-center gap-2">
            <Folder size={15} className="text-copper" />
            <span className="pane-label">Projects</span>
          </div>
          <div className="flex items-center gap-1">
            <button className="cell-button" onClick={onCreateProject} title="New project">
              <Plus size={14} />
            </button>
            <button className="cell-button" onClick={onOpenProject} title="Open project folder">
              <FolderOpen size={14} />
            </button>
          </div>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto">
          {projects.length === 0 ? (
            <button className="list-row" onClick={onCreateProject}>
              <Plus size={15} className="text-copper" />
              <div>
                <p className="text-sm font-semibold text-ink">Create a project</p>
                <p className="mt-1 text-[12px] text-slate">The first notebook opens automatically.</p>
              </div>
            </button>
          ) : (
            projects.map((project) => (
              <button
                key={project.projectPath}
                className={`list-row ${project.projectPath === activeProjectPath ? "bg-shell" : ""}`}
                onClick={() => {
                  onSelectProject(project.projectPath);
                  setPage("project");
                }}
              >
                <Folder size={15} className={project.projectPath === activeProjectPath ? "text-copper" : "text-slate"} />
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-ink">{project.title}</p>
                  <p className="mt-1 truncate text-[12px] text-slate">{project.projectPath}</p>
                </div>
              </button>
            ))
          )}
        </div>
      </section>
    );
  }

  return (
    <section className="pane-shell" data-pane="left-sidebar">
      <div className="pane-toolbar justify-between">
        <button className="menu-button inline-flex items-center gap-1" onClick={() => setPage("projects")}>
          <ArrowLeft size={14} /> Projects
        </button>
        <button className="cell-button" onClick={onOpenProject} title="Open project folder">
          <FolderOpen size={14} />
        </button>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto">
        <div className="border-b border-line bg-paper px-2.5 py-2.5">
          <p className="truncate text-sm font-semibold text-ink">{manifest.title}</p>
          <p className="mt-1 break-all text-[12px] text-slate">{activeProjectPath}</p>
        </div>

        <div className="border-b border-line px-2.5 py-2">
          <p className="pane-label">Notebooks</p>
        </div>
        {notebooks.length === 0 ? (
          <p className="px-2.5 py-3 text-sm text-slate">No notebooks yet.</p>
        ) : (
          notebooks.map((entry) => (
            <button
              key={entry.relativePath}
              className={`list-row ${entry.relativePath === activeNotebookPath ? "bg-shell" : ""}`}
              onClick={() => onOpenNotebook(entry.relativePath)}
            >
              <FileText size={15} className="text-copper" />
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-ink">{entry.name}</p>
                <p className="mt-1 truncate text-[12px] text-slate">{entry.relativePath}</p>
              </div>
            </button>
          ))
        )}

        <div className="flex items-center justify-between border-b border-line px-2.5 py-2">
          <p className="pane-label">Data</p>
          <button className="text-xs font-semibold uppercase tracking-[0.16em] text-teal" onClick={onImportDataset}>
            <UploadCloud size={14} className="mr-1 inline" />
            Import
          </button>
        </div>
        {datasets.length === 0 ? (
          <p className="px-2.5 py-3 text-sm text-slate">No datasets imported.</p>
        ) : (
          datasets.map((dataset) => (
            <div key={dataset.relativePath} className="list-row">
              <Database size={15} className="text-teal" />
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-ink">{dataset.name}</p>
                <p className="mt-1 truncate text-[12px] text-slate">{dataset.relativePath}</p>
              </div>
            </div>
          ))
        )}

        {datasetPreview ? (
          <div className="border-b border-line bg-paper px-2.5 py-2.5">
            <p className="pane-label">Data profile</p>
            <div className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1 text-sm text-ink">
              <span>Rows</span>
              <span className="font-mono">{datasetPreview.rowCount}</span>
              <span>Columns</span>
              <span className="font-mono">{datasetPreview.columns.length}</span>
              <span>Sample rows</span>
              <span className="font-mono">{datasetPreview.sampleRows.length}</span>
            </div>
          </div>
        ) : null}

        <div className="border-b border-line px-2.5 py-2">
          <p className="pane-label">Generated</p>
        </div>
        {generated.length === 0 ? <p className="px-2.5 py-3 text-sm text-slate">No generated scripts.</p> : null}
        {generated.map((entry) => (
          <div key={entry.relativePath} className="list-row">
            <FileCode2 size={15} className="text-teal" />
            <span className="truncate text-sm text-ink">{entry.relativePath}</span>
          </div>
        ))}

        <div className="border-y border-line px-2.5 py-2">
          <p className="pane-label">Artifacts and logs</p>
        </div>
        {[...artifacts, ...logs].length === 0 ? (
          <p className="px-2.5 py-3 text-sm text-slate">Run outputs appear here.</p>
        ) : (
          [...artifacts, ...logs].map((entry) => (
            <div key={entry.relativePath} className="list-row">
              <FileText size={15} className="text-slate" />
              <span className="truncate text-sm text-ink">{entry.relativePath}</span>
            </div>
          ))
        )}
      </div>
    </section>
  );
}
