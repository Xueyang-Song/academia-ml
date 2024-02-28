import { useEffect, useMemo, useRef, useState } from "react";
import * as monaco from "monaco-editor";
import { ChevronDown, ChevronUp, Loader2, Play, Trash2 } from "lucide-react";
import ReactMarkdown from "react-markdown";
import rehypeHighlight from "rehype-highlight";
import rehypeKatex from "rehype-katex";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";

import type { NotebookCell } from "../../shared/types";
import type { ResolvedTheme } from "../lib/theme";
import "../lib/monacoEnvironment";

let monacoThemesDefined = false;

function defineAcademiaMonacoThemes() {
  if (monacoThemesDefined) {
    return;
  }
  monacoThemesDefined = true;
  monaco.editor.defineTheme("academia-light", {
    base: "vs",
    inherit: true,
    rules: [
      { token: "comment", foreground: "68717c", fontStyle: "italic" },
      { token: "keyword", foreground: "765122" },
      { token: "string", foreground: "2f6b5f" },
      { token: "number", foreground: "8a4b2b" },
    ],
    colors: {
      "editor.background": "#fbfaf4",
      "editor.foreground": "#21303d",
      "editor.lineHighlightBackground": "#efe7d633",
      "editorLineNumber.foreground": "#7a8490",
      "editor.selectionBackground": "#c8d7d299",
      "editorCursor.foreground": "#8a5a2b",
      "scrollbarSlider.background": "#9a927f66",
    },
  });
  monaco.editor.defineTheme("academia-dark", {
    base: "vs-dark",
    inherit: true,
    rules: [
      { token: "comment", foreground: "7e8b99", fontStyle: "italic" },
      { token: "keyword", foreground: "f0b66b" },
      { token: "string", foreground: "78d4c5" },
      { token: "number", foreground: "e6a274" },
      { token: "type", foreground: "9dd6ff" },
      { token: "function", foreground: "d9e6ff" },
    ],
    colors: {
      "editor.background": "#111821",
      "editor.foreground": "#d8e2ec",
      "editor.lineHighlightBackground": "#24324466",
      "editorLineNumber.foreground": "#6b7886",
      "editor.selectionBackground": "#2f6f7b88",
      "editorCursor.foreground": "#72e0d3",
      "scrollbarSlider.background": "#4b596966",
    },
  });
}

function editorHeight(source: string) {
  const lines = Math.max(4, source.split("\n").length);
  return Math.min(520, Math.max(132, lines * 22 + 36));
}

function outputText(output: NonNullable<NotebookCell["outputs"]>[number]) {
  if (output.output_type === "error") {
    return (output.traceback || [output.evalue || output.ename || "Execution error"]).join("\n");
  }
  return output.text?.join("") || output.data?.["text/plain"] || "";
}

function MonacoCellEditor({
  height,
  language,
  modelPath,
  source,
  theme,
  onChange,
}: {
  height: number;
  language: string;
  modelPath: string;
  source: string;
  theme: string;
  onChange: (next: string) => void;
}) {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const editorRef = useRef<monaco.editor.IStandaloneCodeEditor | null>(null);
  const modelRef = useRef<monaco.editor.ITextModel | null>(null);
  const onChangeRef = useRef(onChange);

  useEffect(() => {
    onChangeRef.current = onChange;
  }, [onChange]);

  useEffect(() => {
    defineAcademiaMonacoThemes();
    const host = hostRef.current;
    if (!host) {
      return undefined;
    }

    let disposed = false;
    const uri = monaco.Uri.parse(modelPath);
    let model = monaco.editor.getModel(uri);
    if (!model) {
      model = monaco.editor.createModel(source, language, uri);
    } else {
      monaco.editor.setModelLanguage(model, language);
      if (model.getValue() !== source) {
        model.setValue(source);
      }
    }
    modelRef.current = model;

    const editor = monaco.editor.create(host, {
      automaticLayout: false,
      cursorBlinking: "smooth",
      fontFamily: '"Cascadia Code", "JetBrains Mono", Consolas, monospace',
      fontLigatures: true,
      fontSize: 13,
      lineHeight: 22,
      lineNumbersMinChars: 3,
      minimap: { enabled: false },
      model,
      overviewRulerBorder: false,
      padding: { top: 10, bottom: 10 },
      renderLineHighlight: "all",
      scrollBeyondLastLine: false,
      scrollbar: { alwaysConsumeMouseWheel: false },
      tabSize: 4,
      theme,
      wordWrap: language === "markdown" ? "on" : "off",
    });
    editorRef.current = editor;

    const contentSubscription = editor.onDidChangeModelContent(() => {
      if (!disposed) {
        onChangeRef.current(editor.getValue());
      }
    });
    const resizeObserver = new ResizeObserver(() => {
      if (!disposed) {
        editor.layout();
      }
    });
    resizeObserver.observe(host);
    requestAnimationFrame(() => {
      if (!disposed) {
        editor.layout();
      }
    });

    return () => {
      disposed = true;
      contentSubscription.dispose();
      resizeObserver.disconnect();
      editorRef.current = null;
      modelRef.current = null;
      editor.dispose();
    };
  }, [language, modelPath]);

  useEffect(() => {
    const model = modelRef.current;
    if (model && model.getValue() !== source) {
      model.setValue(source);
    }
  }, [source]);

  useEffect(() => {
    monaco.editor.setTheme(theme);
  }, [theme]);

  useEffect(() => {
    editorRef.current?.layout();
  }, [height]);

  return <div ref={hostRef} style={{ height }} />;
}

export default function NotebookCellCard({
  cell,
  index,
  isRunning,
  notebookRunning,
  resolvedTheme,
  onChange,
  onRun,
  onMove,
  onDelete,
}: {
  cell: NotebookCell;
  index: number;
  isRunning: boolean;
  notebookRunning: boolean;
  resolvedTheme: ResolvedTheme;
  onChange: (next: string) => void;
  onRun: () => void;
  onMove: (direction: "up" | "down") => void;
  onDelete: () => void;
}) {
  const [markdownTab, setMarkdownTab] = useState<"write" | "preview">("write");
  const source = cell.source.join("");
  const language = cell.cell_type === "code" ? "python" : "markdown";
  const height = useMemo(() => editorHeight(source), [source]);

  return (
    <article className={`notebook-cell ${isRunning ? "notebook-cell-running" : ""}`}>
      <header className="flex items-center justify-between border-b border-line bg-panel px-2.5 py-1.5">
        <div className="flex min-w-0 items-center gap-3">
          <span className="rounded-sm border border-line bg-paper px-2 py-0.5 text-[11px] font-semibold uppercase tracking-[0.16em] text-slate">
            {cell.cell_type}
          </span>
          <span className="text-xs font-medium text-slate">Cell {index + 1}</span>
          {isRunning ? (
            <span className="inline-flex items-center gap-1 text-xs font-semibold text-copper">
              <Loader2 size={13} className="animate-spin" /> running
            </span>
          ) : null}
        </div>
        <div className="flex items-center gap-1">
          {cell.cell_type === "markdown" ? (
            <div className="tab-strip mr-1">
              <button
                className={`tab-button ${markdownTab === "write" ? "tab-button-active" : ""}`}
                onClick={() => setMarkdownTab("write")}
              >
                Write
              </button>
              <button
                className={`tab-button ${markdownTab === "preview" ? "tab-button-active" : ""}`}
                onClick={() => setMarkdownTab("preview")}
              >
                Preview
              </button>
            </div>
          ) : null}
          <button className="cell-button" onClick={() => onMove("up")} title="Move cell up" disabled={notebookRunning}>
            <ChevronUp size={16} />
          </button>
          <button className="cell-button" onClick={() => onMove("down")} title="Move cell down" disabled={notebookRunning}>
            <ChevronDown size={16} />
          </button>
          {cell.cell_type === "code" ? (
            <button className="cell-button" onClick={onRun} title="Run cell" disabled={notebookRunning}>
              {isRunning ? <Loader2 size={16} className="animate-spin" /> : <Play size={16} />}
            </button>
          ) : null}
          <button className="cell-button" onClick={onDelete} title="Delete cell" disabled={notebookRunning}>
            <Trash2 size={16} />
          </button>
        </div>
      </header>

      {cell.cell_type === "markdown" && markdownTab === "preview" ? (
        <div className="markdown-preview">
          <ReactMarkdown remarkPlugins={[remarkGfm, remarkMath]} rehypePlugins={[rehypeKatex, rehypeHighlight]}>
            {source || "_Empty markdown cell._"}
          </ReactMarkdown>
        </div>
      ) : (
        <div className="border-b border-line bg-code">
          <MonacoCellEditor
            height={height}
            language={language}
            modelPath={`academiaml://notebook/${cell.id}.${language}`}
            source={source}
            theme={resolvedTheme === "dark" ? "academia-dark" : "academia-light"}
            onChange={onChange}
          />
        </div>
      )}

      {cell.cell_type === "code" ? (
        <div className="space-y-2 px-3 py-2.5">
          {isRunning ? (
            <div className="inline-flex items-center gap-2 border border-copper/50 bg-copper/10 px-2.5 py-1.5 text-sm font-medium text-copper">
              <Loader2 size={14} className="animate-spin" /> Executing code in the local kernel...
            </div>
          ) : null}
          {(cell.outputs || []).length === 0 ? (
            <p className="text-sm text-slate">No output yet.</p>
          ) : (
            cell.outputs?.map((output, outputIndex) => (
              <div key={`${cell.id}-${outputIndex}`} className="border border-line bg-panel px-2.5 py-2">
                {output.output_type === "display_data" && output.data?.["image/png"] ? (
                  <img
                    alt="Cell output"
                    className="max-h-[320px] border border-line bg-elevated"
                    src={`data:image/png;base64,${output.data["image/png"]}`}
                  />
                ) : (
                  <pre className={`overflow-x-auto whitespace-pre-wrap text-sm ${output.output_type === "error" ? "text-rust" : "text-ink"}`}>
                    {outputText(output)}
                  </pre>
                )}
              </div>
            ))
          )}
        </div>
      ) : null}
    </article>
  );
}
