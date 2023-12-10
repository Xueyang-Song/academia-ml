import { app, dialog, ipcMain } from "electron";
import fs from "node:fs/promises";
import path from "node:path";
import Papa from "papaparse";

import type { DatasetColumnProfile, DatasetPreview, ExampleProject, NotebookDocument, ProjectFileEntry, ProjectListItem, ProjectManifest } from "../shared/types.js";

const EXAMPLES_ROOT = path.resolve(process.cwd(), "examples");

function slugify(value: string) {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function defaultProjectsRoot() {
  return path.join(app.getPath("documents"), "AcademiaML Projects");
}

function nowIso() {
  return new Date().toISOString();
}

function metaDir(projectPath: string) {
  return path.join(projectPath, ".academiaml");
}

function manifestPath(projectPath: string) {
  return path.join(metaDir(projectPath), "project.json");
}

async function exists(target: string) {
  try {
    await fs.access(target);
    return true;
  } catch {
    return false;
  }
}

export async function ensureProjectStructure(projectPath: string, seed?: Partial<ProjectManifest>) {
  const folders = [
    ".academiaml",
    "notebooks",
    "data",
    "data/raw",
    "data/derived",
    "generated",
    "artifacts",
    "logs",
  ];
  for (const rel of folders) {
    await fs.mkdir(path.join(projectPath, rel), { recursive: true });
  }

  const manifestFile = manifestPath(projectPath);
  if (!(await exists(manifestFile))) {
    const manifest: ProjectManifest = {
      id: seed?.id ?? path.basename(projectPath).toLowerCase().replace(/[^a-z0-9]+/g, "-"),
      title: seed?.title ?? path.basename(projectPath),
      createdAt: nowIso(),
      updatedAt: nowIso(),
      description: seed?.description ?? "AcademiaML project workspace",
      datasetPath: seed?.datasetPath ?? "",
      notebookPath: seed?.notebookPath ?? "notebooks/analysis.ipynb",
      taskHint: seed?.taskHint,
      targetColumn: seed?.targetColumn,
      advisorConfig: seed?.advisorConfig,
      copilotConfig: seed?.copilotConfig ?? { model: "gpt-4.1" },
    };
    await fs.writeFile(manifestFile, JSON.stringify(manifest, null, 2), "utf-8");
  }
}

async function readJson<T>(filePath: string): Promise<T> {
  return JSON.parse(await fs.readFile(filePath, "utf-8")) as T;
}

async function writeJson(filePath: string, value: unknown) {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, JSON.stringify(value, null, 2), "utf-8");
}

async function listFiles(root: string, relRoot = ""): Promise<ProjectFileEntry[]> {
  const target = path.join(root, relRoot);
  const entries = await fs.readdir(target, { withFileTypes: true });
  const output: ProjectFileEntry[] = [];
  for (const entry of entries) {
    const rel = path.join(relRoot, entry.name);
    output.push({
      name: entry.name,
      relativePath: rel.replace(/\\/g, "/"),
      kind: entry.isDirectory() ? "directory" : "file",
    });
  }
  return output.sort((a, b) => a.relativePath.localeCompare(b.relativePath));
}

async function buildDatasetPreview(projectPath: string, relPath: string): Promise<DatasetPreview> {
  const absolutePath = path.join(projectPath, relPath);
  const raw = await fs.readFile(absolutePath, "utf-8");
  const parsed = Papa.parse<Record<string, string>>(raw, {
    header: true,
    dynamicTyping: true,
    skipEmptyLines: true,
  });

  const rows = parsed.data.slice(0, 5);
  const allRows = parsed.data;
  const columns: DatasetColumnProfile[] = [];
  const fields = parsed.meta.fields ?? [];

  for (const field of fields) {
    const values = allRows.map((row) => row[field]).filter((value) => value !== undefined && value !== null && value !== "");
    const missingCount = allRows.length - values.length;
    const numericValues = values.filter((value) => typeof value === "number") as number[];
    const booleanValues = values.filter((value) => typeof value === "boolean");
    const inferredType = numericValues.length === values.length ? "number" : booleanValues.length === values.length ? "boolean" : "string";
    const column: DatasetColumnProfile = {
      name: field,
      inferredType,
      missingCount,
      uniqueCount: new Set(values.map((value) => String(value))).size,
    };
    if (inferredType === "number" && numericValues.length > 0) {
      column.mean = numericValues.reduce((sum, value) => sum + value, 0) / numericValues.length;
      column.min = Math.min(...numericValues);
      column.max = Math.max(...numericValues);
    }
    columns.push(column);
  }

  const targetSuggestions = columns
    .filter((column) => column.inferredType === "number" || column.inferredType === "boolean")
    .sort((a, b) => {
      const rank = (name: string) => {
        const lower = name.toLowerCase();
        if (lower.includes("target") || lower.includes("label")) return 0;
        if (lower.includes("yield") || lower.includes("life") || lower.includes("efficiency")) return 1;
        return 2;
      };
      return rank(a.name) - rank(b.name);
    })
    .map((column) => column.name)
    .slice(0, 5);

  return {
    relativePath: relPath.replace(/\\/g, "/"),
    rowCount: allRows.length,
    sampleRows: rows,
    columns,
    targetSuggestions,
  };
}

async function loadProject(projectPath: string) {
  await ensureProjectStructure(projectPath);
  const manifest = await readJson<ProjectManifest>(manifestPath(projectPath));
  const notebooks = (await listFiles(projectPath, "notebooks")).filter(
    (entry) => entry.kind === "file" && entry.relativePath.endsWith(".ipynb"),
  );
  const datasets = (await listFiles(projectPath, "data/raw")).filter((entry) => entry.kind === "file");
  const generated = (await listFiles(projectPath, "generated")).filter((entry) => entry.kind === "file");
  const artifacts = (await listFiles(projectPath, "artifacts")).filter((entry) => entry.kind === "file");
  const logs = (await listFiles(projectPath, "logs")).filter((entry) => entry.kind === "file");
  const preview = manifest.datasetPath ? await buildDatasetPreview(projectPath, manifest.datasetPath) : null;
  return {
    projectPath,
    manifest,
    notebooks,
    datasets,
    generated,
    artifacts,
    logs,
    datasetPreview: preview,
  };
}

async function listProjectDirectories(root: string) {
  if (!(await exists(root))) {
    return [];
  }
  const entries = await fs.readdir(root, { withFileTypes: true });
  return entries.filter((entry) => entry.isDirectory()).map((entry) => path.join(root, entry.name));
}

async function listProjects(): Promise<ProjectListItem[]> {
  const roots = [defaultProjectsRoot(), path.join(app.getPath("userData"), "workspaces")];
  const seen = new Set<string>();
  const projects: ProjectListItem[] = [];

  for (const root of roots) {
    const directories = await listProjectDirectories(root);
    for (const directory of directories) {
      const resolved = path.resolve(directory);
      const manifestFile = manifestPath(resolved);
      if (seen.has(resolved.toLowerCase()) || !(await exists(manifestFile))) {
        continue;
      }
      try {
        const manifest = await readJson<ProjectManifest>(manifestFile);
        seen.add(resolved.toLowerCase());
        projects.push({
          id: manifest.id,
          title: manifest.title,
          description: manifest.description,
          projectPath: resolved,
          updatedAt: manifest.updatedAt,
          datasetPath: manifest.datasetPath,
          notebookPath: manifest.notebookPath,
        });
      } catch {
        // Ignore folders that look like projects but have broken metadata.
      }
    }
  }

  return projects.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)).slice(0, 16);
}

async function chooseProjectDirectory() {
  const result = await dialog.showOpenDialog({
    properties: ["openDirectory"],
    title: "Open AcademiaML project folder",
  });
  if (result.canceled || result.filePaths.length === 0) {
    return null;
  }
  return loadProject(result.filePaths[0]);
}

async function createProject(args: {
  title: string;
  description?: string;
  parentDirectory?: string;
  taskHint?: ProjectManifest["taskHint"];
}) {
  const title = args.title.trim();
  if (!title) {
    throw new Error("Project title is required.");
  }
  const parentDirectory = args.parentDirectory?.trim() || defaultProjectsRoot();
  const slug = slugify(title) || "academiaml-project";
  await fs.mkdir(parentDirectory, { recursive: true });

  let projectPath = path.join(parentDirectory, slug);
  if (await exists(projectPath)) {
    projectPath = path.join(parentDirectory, `${slug}-${Date.now()}`);
  }

  await ensureProjectStructure(projectPath, {
    title,
    description: args.description?.trim() || "AcademiaML project workspace",
    notebookPath: "notebooks/analysis.ipynb",
    taskHint: args.taskHint,
    copilotConfig: { model: "gpt-4.1" },
  });

  await createNotebook(projectPath, "Analysis");
  return loadProject(projectPath);
}

async function copyDirectory(src: string, dest: string) {
  await fs.mkdir(dest, { recursive: true });
  const entries = await fs.readdir(src, { withFileTypes: true });
  for (const entry of entries) {
    const sourcePath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);
    const normalizedSource = sourcePath.replace(/\\/g, "/");
    if (normalizedSource.includes("/.academiaml/runtime")) {
      continue;
    }
    if (entry.isDirectory()) {
      await copyDirectory(sourcePath, destPath);
    } else {
      await fs.mkdir(path.dirname(destPath), { recursive: true });
      await fs.copyFile(sourcePath, destPath);
    }
  }
}

async function listExamples(): Promise<ExampleProject[]> {
  const catalogPath = path.join(EXAMPLES_ROOT, "catalog.json");
  return readJson<ExampleProject[]>(catalogPath);
}

async function openExample(exampleId: string) {
  const catalog = await listExamples();
  const example = catalog.find((item) => item.id === exampleId);
  if (!example) {
    throw new Error(`Example ${exampleId} not found`);
  }
  const source = path.join(EXAMPLES_ROOT, example.id);
  const workspaceRoot = path.join(app.getPath("userData"), "workspaces");
  await fs.mkdir(workspaceRoot, { recursive: true });
  const destination = path.join(workspaceRoot, `${example.id}-${Date.now()}`);
  await copyDirectory(source, destination);
  await ensureProjectStructure(destination, {
    title: example.title,
    description: example.description,
    datasetPath: example.datasetPath,
    notebookPath: example.notebookPath,
    targetColumn: example.targetColumn,
    taskHint: example.taskHint,
  });
  return loadProject(destination);
}

async function readNotebook(projectPath: string, relPath: string): Promise<NotebookDocument> {
  const absolutePath = path.join(projectPath, relPath);
  return readJson<NotebookDocument>(absolutePath);
}

async function saveNotebook(projectPath: string, relPath: string, notebook: NotebookDocument) {
  const absolutePath = path.join(projectPath, relPath);
  await writeJson(absolutePath, notebook);
  const manifest = await readJson<ProjectManifest>(manifestPath(projectPath));
  manifest.updatedAt = nowIso();
  manifest.notebookPath = relPath.replace(/\\/g, "/");
  await writeJson(manifestPath(projectPath), manifest);
  return { ok: true };
}

async function createNotebook(projectPath: string, title: string) {
  const safeName = title.toLowerCase().replace(/[^a-z0-9]+/g, "-");
  const relPath = `notebooks/${safeName || "analysis"}.ipynb`;
  const starter: NotebookDocument = {
    nbformat: 4,
    nbformat_minor: 5,
    metadata: {
      kernelspec: {
        display_name: "Python (AcademiaML)",
        language: "python",
        name: "academiaml",
      },
      language_info: {
        name: "python",
      },
    },
    cells: [
      {
        cell_type: "markdown",
        id: crypto.randomUUID(),
        metadata: {},
        source: [`# ${title}\n`, "\n", "Use the advisor or agent to shape the next steps.\n"],
      },
    ],
  };
  await saveNotebook(projectPath, relPath, starter);
  return relPath;
}

async function importDataset(projectPath: string) {
  const result = await dialog.showOpenDialog({
    properties: ["openFile"],
    filters: [{ name: "Tabular data", extensions: ["csv", "tsv"] }],
  });
  if (result.canceled || result.filePaths.length === 0) {
    return null;
  }
  const source = result.filePaths[0];
  const destRel = `data/raw/${path.basename(source)}`;
  const dest = path.join(projectPath, destRel);
  await fs.copyFile(source, dest);
  const manifest = await readJson<ProjectManifest>(manifestPath(projectPath));
  manifest.datasetPath = destRel.replace(/\\/g, "/");
  manifest.updatedAt = nowIso();
  await writeJson(manifestPath(projectPath), manifest);
  return {
    relativePath: destRel.replace(/\\/g, "/"),
    preview: await buildDatasetPreview(projectPath, destRel),
  };
}

export function registerProjectHandlers() {
  ipcMain.handle("project:listProjects", async () => listProjects());
  ipcMain.handle("project:listExamples", async () => listExamples());
  ipcMain.handle("project:openExample", async (_event, exampleId: string) => openExample(exampleId));
  ipcMain.handle("project:openPath", async (_event, projectPath: string) => loadProject(projectPath));
  ipcMain.handle("project:chooseProjectDirectory", async () => chooseProjectDirectory());
  ipcMain.handle(
    "project:createProject",
    async (_event, args: { title: string; description?: string; parentDirectory?: string; taskHint?: ProjectManifest["taskHint"] }) =>
      createProject(args),
  );
  ipcMain.handle("project:readNotebook", async (_event, projectPath: string, relPath: string) => readNotebook(projectPath, relPath));
  ipcMain.handle("project:saveNotebook", async (_event, projectPath: string, relPath: string, notebook: NotebookDocument) => saveNotebook(projectPath, relPath, notebook));
  ipcMain.handle("project:createNotebook", async (_event, projectPath: string, title: string) => createNotebook(projectPath, title));
  ipcMain.handle("project:previewDataset", async (_event, projectPath: string, relPath: string) => buildDatasetPreview(projectPath, relPath));
  ipcMain.handle("project:listFiles", async (_event, projectPath: string, relRoot: string) => listFiles(projectPath, relRoot));
  ipcMain.handle("project:importDataset", async (_event, projectPath: string) => importDataset(projectPath));
  ipcMain.handle("project:readTextFile", async (_event, projectPath: string, relPath: string) => fs.readFile(path.join(projectPath, relPath), "utf-8"));
}
