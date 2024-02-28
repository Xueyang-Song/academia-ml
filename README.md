# AcademiaML

AcademiaML is a notebook-first Electron desktop tool for scientific researchers who have tabular data but need help selecting and running the right machine-learning workflow.

The revived final 2026 shape is intentionally closer to JupyterLab, MATLAB, and RStudio than to a landing-page app:

- real project folders on disk
- real `.ipynb` notebooks
- per-project Python environments
- local Jupyter kernel execution
- advisor chat for OpenAI-compatible providers
- agent queue and approvals for GitHub Copilot SDK / local Copilot CLI integration

## Commands

```bash
npm install
npm run dev
npm run build
npm run pack
python scripts/bootstrap_runtime.py <project-path>
```

## Project layout

Each project folder is kept readable:

- `.academiaml/project.json`
- `notebooks/`
- `data/raw/`
- `data/derived/`
- `generated/`
- `artifacts/`
- `logs/`

By default only schema, inferred column types, summary stats, and a small sampled slice leave the machine. Anything broader should be explicitly approved in the agent queue.
