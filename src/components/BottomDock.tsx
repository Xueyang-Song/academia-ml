import { useState } from "react";
import { BarChart3, Terminal } from "lucide-react";

import type { TrainingArtifactSummary } from "../../shared/types";
import type { ThemePreference } from "../lib/theme";
import BottomTerminal from "./BottomTerminal";

export default function BottomDock({
  lines,
  artifactSummary,
  themePreference,
  onThemePreferenceChange,
}: {
  lines: string[];
  artifactSummary: TrainingArtifactSummary;
  themePreference: ThemePreference;
  onThemePreferenceChange: (preference: ThemePreference) => void;
}) {
  const [tab, setTab] = useState<"log" | "results">("log");

  return (
    <section className="pane-shell" data-pane="bottom-dock">
      <div className="pane-toolbar justify-between">
        <div className="tab-strip">
          <button className={`tab-button ${tab === "log" ? "tab-button-active" : ""}`} onClick={() => setTab("log")}>
            <Terminal size={13} className="mr-1 inline" />
            Log
          </button>
          <button className={`tab-button ${tab === "results" ? "tab-button-active" : ""}`} onClick={() => setTab("results")}>
            <BarChart3 size={13} className="mr-1 inline" />
            Results
          </button>
        </div>
        <div className="flex items-center gap-2">
          <div className="theme-switch" aria-label="Theme preference">
            {(["system", "light", "dark"] as ThemePreference[]).map((preference) => (
              <button
                key={preference}
                className={`theme-switch-button ${themePreference === preference ? "theme-switch-button-active" : ""}`}
                onClick={() => onThemePreferenceChange(preference)}
              >
                {preference === "system" ? "Auto" : preference[0].toUpperCase() + preference.slice(1)}
              </button>
            ))}
          </div>
          <span className="text-[12px] text-slate">{artifactSummary.lastRunStatus}</span>
        </div>
      </div>
      <div className="min-h-0 flex-1 overflow-hidden">
        {tab === "log" ? (
          <BottomTerminal lines={lines} />
        ) : (
          <div className="grid h-full min-h-0 grid-cols-[minmax(260px,32%)_minmax(0,1fr)] overflow-hidden bg-paper">
            <div className="border-r border-line px-3 py-2">
              <p className="pane-label">Metrics</p>
              {artifactSummary.metrics.length === 0 ? (
                <p className="mt-2 text-sm text-slate">Run a workflow to populate metrics.</p>
              ) : (
                <div className="mt-2 space-y-1 text-sm text-ink">
                  {artifactSummary.metrics.map((metric) => (
                    <div key={metric.label} className="grid grid-cols-[minmax(0,1fr)_auto] gap-4 border-b border-line py-1 last:border-b-0">
                      <span className="truncate">{metric.label}</span>
                      <span className="font-mono">{metric.value}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
            <div className="min-h-0 overflow-y-auto px-3 py-2">
              <p className="pane-label">Artifacts</p>
              {artifactSummary.artifactPaths.length === 0 ? (
                <p className="mt-2 text-sm text-slate">Generated plots, metrics, and model files appear here.</p>
              ) : (
                <div className="mt-2 grid grid-cols-2 gap-2 text-[12px] text-ink">
                  {artifactSummary.artifactPaths.map((artifactPath) => (
                    <div key={artifactPath} className="border border-line bg-panel px-2 py-1.5 font-mono">
                      {artifactPath}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
