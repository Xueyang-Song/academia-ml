# AcademiaML desktop architecture

The revived final product is intentionally notebook-first.

- Electron main process owns files, dialogs, subprocesses, runtime bootstrap, and Jupyter server lifecycle.
- The renderer uses a docked IDE layout:
  - left sidebar for project, datasets, files, and runtime status
  - center notebook workbench with real `.ipynb` documents
  - right sidebar for advisor/agent orchestration
  - bottom panel for terminal and execution logs
- `@jupyterlab/services` drives the real local kernel/session control.
- The Copilot bridge uses the local CLI + `@github/copilot-sdk` path when available.
- The OpenAI-compatible advisor remains available as a degraded fallback.
