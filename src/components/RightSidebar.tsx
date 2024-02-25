import { useState } from "react";
import { ArrowLeft, Bot, MessageSquarePlus, SendHorizonal } from "lucide-react";
import ReactMarkdown from "react-markdown";

import type { AgentSessionSummary, CopilotBridgeStatus, CopilotModelInfo, ProjectListItem } from "../../shared/types";
import StatusBadge from "./StatusBadge";

export default function RightSidebar({
  sessions,
  activeSession,
  copilotStatus,
  projects,
  draft,
  models,
  modelLoadError,
  model,
  reasoningEffort,
  busy,
  onNewSession,
  onOpenSession,
  onBackToSessions,
  onDraftChange,
  onModelChange,
  onReasoningEffortChange,
  onSend,
  onOpenProject,
}: {
  sessions: AgentSessionSummary[];
  activeSession: AgentSessionSummary | null;
  copilotStatus: CopilotBridgeStatus | null;
  projects: ProjectListItem[];
  draft: string;
  models: CopilotModelInfo[];
  modelLoadError: string;
  model: string;
  reasoningEffort: string;
  busy: boolean;
  onNewSession: () => void;
  onOpenSession: (sessionId: string) => void;
  onBackToSessions: () => void;
  onDraftChange: (value: string) => void;
  onModelChange: (value: string) => void;
  onReasoningEffortChange: (value: string) => void;
  onSend: () => void;
  onOpenProject: (projectPath: string) => void;
}) {
  const [expandedProjects, setExpandedProjects] = useState(false);
  const sessionProjects = (activeSession?.projectPaths || [])
    .map((projectPath) => projects.find((project) => project.projectPath === projectPath))
    .filter(Boolean) as ProjectListItem[];
  const selectedModel = models.find((item) => item.id === model);
  const reasoningOptions = selectedModel?.supportedReasoningEfforts || [];
  const displayedReasoningEffort = reasoningOptions.length === 0 ? "default" : reasoningEffort;

  if (!activeSession) {
    return (
      <section className="pane-shell" data-pane="agent-sessions">
        <div className="pane-toolbar justify-between">
          <div className="flex items-center gap-2">
            <Bot size={15} className="text-teal" />
            <span className="pane-label">Agent sessions</span>
          </div>
          <button className="cell-button" onClick={onNewSession} title="New agent session">
            <MessageSquarePlus size={14} />
          </button>
        </div>
        <div className="border-b border-line bg-paper px-2.5 py-2">
          <div className="flex items-center justify-between gap-2">
            <p className="text-sm text-slate">Global project agent</p>
            <StatusBadge label={copilotStatus?.ready ? "available" : "checking"} tone={copilotStatus?.ready ? "good" : "neutral"} />
          </div>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto">
          {sessions.length === 0 ? (
            <button className="list-row" onClick={onNewSession}>
              <MessageSquarePlus size={15} className="text-teal" />
              <div>
                <p className="text-sm font-semibold text-ink">Start a session</p>
                <p className="mt-1 text-[12px] leading-5 text-slate">Ask the agent to create a project, open a project, or run a workflow.</p>
              </div>
            </button>
          ) : (
            sessions.map((session) => (
              <button key={session.id} className="list-row" onClick={() => onOpenSession(session.id)}>
                <Bot size={15} className="text-teal" />
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-ink">{session.title}</p>
                  <p className="mt-1 truncate text-[12px] text-slate">
                    {session.projectPaths.length} project{session.projectPaths.length === 1 ? "" : "s"} touched
                  </p>
                </div>
              </button>
            ))
          )}
        </div>
      </section>
    );
  }

  return (
    <section className="pane-shell" data-pane="agent-chat">
      <div className="pane-toolbar justify-between">
        <button className="menu-button inline-flex items-center gap-1" onClick={onBackToSessions}>
          <ArrowLeft size={14} /> Sessions
        </button>
        <StatusBadge label={busy ? "working" : copilotStatus?.ready ? "agent ready" : "agent"} tone={busy ? "warn" : "good"} />
      </div>
      <div className="border-b border-line bg-paper px-2.5 py-2">
        <p className="truncate text-sm font-semibold text-ink">{activeSession.title}</p>
        <div className="mt-2 grid grid-cols-2 gap-2">
          <label className="field-label">
            Model
            <select className="field-input" value={model} onChange={(event) => onModelChange(event.target.value)} disabled={models.length === 0}>
              {models.length === 0 ? (
                <option value={model}>{modelLoadError || "Loading Copilot models..."}</option>
              ) : (
                models.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.name} ({item.id})
                  </option>
                ))
              )}
            </select>
          </label>
          <label className="field-label">
            Reasoning
            <select
              className="field-input"
              value={displayedReasoningEffort}
              onChange={(event) => onReasoningEffortChange(event.target.value)}
              disabled={reasoningOptions.length === 0}
            >
              {reasoningOptions.length === 0 ? (
                <option value="default">not supported</option>
              ) : (
                reasoningOptions.map((effort) => (
                  <option key={effort} value={effort}>
                    {effort}
                    {effort === selectedModel?.defaultReasoningEffort ? " default" : ""}
                  </option>
                ))
              )}
            </select>
          </label>
        </div>
        {modelLoadError ? <p className="mt-1 text-[12px] text-rust">{modelLoadError}</p> : null}
        <div
          className="mt-2 flex min-h-[26px] flex-wrap items-center gap-1 overflow-hidden"
          onMouseEnter={() => setExpandedProjects(true)}
          onMouseLeave={() => setExpandedProjects(false)}
        >
          {sessionProjects.length === 0 ? (
            <span className="rounded-sm border border-line bg-panel px-2 py-1 text-[12px] text-slate">No project linked yet</span>
          ) : (
            sessionProjects.slice(0, expandedProjects ? sessionProjects.length : 3).map((project) => (
              <button
                key={project.projectPath}
                className="rounded-sm border border-line bg-panel px-2 py-1 text-[12px] font-medium text-ink hover:border-copper"
                onClick={() => onOpenProject(project.projectPath)}
                title={project.projectPath}
              >
                {project.title}
              </button>
            ))
          )}
          {!expandedProjects && sessionProjects.length > 3 ? (
            <span className="rounded-sm border border-line bg-panel px-2 py-1 text-[12px] text-slate">+{sessionProjects.length - 3}</span>
          ) : null}
        </div>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto bg-paper">
        {activeSession.messages.map((message) => (
          <div key={message.id} className="border-b border-line px-2.5 py-2.5 last:border-b-0">
            <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.16em] text-slate">{message.role}</p>
            <div className="agent-message">
              <ReactMarkdown>{message.content}</ReactMarkdown>
            </div>
          </div>
        ))}
      </div>
      <div className="border-t border-line bg-paper px-2 py-2">
        <textarea
          className="min-h-[112px] w-full resize-y rounded-sm border border-line bg-panel px-2.5 py-2 text-sm text-ink outline-none ring-0 placeholder:text-slate"
          placeholder='Try: "Create a project called zinc electrolyte screening" or "Open the ionic conductivity project and run a workflow."'
          value={draft}
          onChange={(event) => onDraftChange(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter" && (event.metaKey || event.ctrlKey)) {
              onSend();
            }
          }}
        />
        <div className="mt-2 flex items-center justify-between gap-2">
          <p className="text-[12px] text-slate">Ctrl+Enter sends. Project access is limited to AcademiaML project folders.</p>
          <button className="toolbar-button" onClick={onSend} disabled={!draft.trim() || busy}>
            <SendHorizonal size={16} /> Send
          </button>
        </div>
      </div>
    </section>
  );
}
