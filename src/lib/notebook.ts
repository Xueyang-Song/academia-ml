import type { NotebookCell, NotebookDocument, NotebookOutput } from "../../shared/types";

export function createMarkdownCell(source = "## Notes\n\nDescribe the reasoning for this step.\n"): NotebookCell {
  return {
    cell_type: "markdown",
    id: crypto.randomUUID(),
    metadata: {},
    source: source.split(/(?<=\n)/),
  };
}

export function createCodeCell(source = "# write code here\n"): NotebookCell {
  return {
    cell_type: "code",
    id: crypto.randomUUID(),
    metadata: {},
    source: source.split(/(?<=\n)/),
    execution_count: null,
    outputs: [],
  };
}

export function cloneNotebook(notebook: NotebookDocument): NotebookDocument {
  return JSON.parse(JSON.stringify(notebook)) as NotebookDocument;
}

export function updateCell(notebook: NotebookDocument, cellId: string, patch: Partial<NotebookCell>) {
  const next = cloneNotebook(notebook);
  next.cells = next.cells.map((cell) => (cell.id === cellId ? { ...cell, ...patch } : cell));
  return next;
}

export function insertCell(notebook: NotebookDocument, index: number, cell: NotebookCell) {
  const next = cloneNotebook(notebook);
  next.cells.splice(index, 0, cell);
  return next;
}

export function removeCell(notebook: NotebookDocument, cellId: string) {
  const next = cloneNotebook(notebook);
  next.cells = next.cells.filter((cell) => cell.id !== cellId);
  return next;
}

export function moveCell(notebook: NotebookDocument, cellId: string, direction: "up" | "down") {
  const next = cloneNotebook(notebook);
  const index = next.cells.findIndex((cell) => cell.id === cellId);
  if (index === -1) {
    return next;
  }
  const target = direction === "up" ? index - 1 : index + 1;
  if (target < 0 || target >= next.cells.length) {
    return next;
  }
  const [cell] = next.cells.splice(index, 1);
  next.cells.splice(target, 0, cell);
  return next;
}

export function outputToPlainText(output: NotebookOutput) {
  if (output.output_type === "stream") {
    return output.text?.join("") || "";
  }
  if (output.output_type === "error") {
    return (output.traceback || [output.evalue || output.ename || "Execution error"]).join("\n");
  }
  const data = output.data || {};
  return data["text/plain"] || "";
}
