<div align="center">

<img src="https://capsule-render.vercel.app/api?type=waving&color=gradient&customColorList=12,20,28&height=180&section=header&text=AcademiaML&fontSize=72&fontColor=fff&animation=twinkling&fontAlignY=32&desc=Notebook-First%20Desktop%20ML%20Workbench%20for%20Scientists&descAlignY=55&descSize=20" width="100%"/>

[![Stars](https://img.shields.io/github/stars/Xueyang-Song/academia-ml?style=for-the-badge&logo=github&color=FFD700)](https://github.com/Xueyang-Song/academia-ml/stargazers)
[![TypeScript](https://img.shields.io/badge/TypeScript-3178C6?style=for-the-badge&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Electron](https://img.shields.io/badge/Electron-47848F?style=for-the-badge&logo=electron&logoColor=white)](https://electronjs.org/)
[![Jupyter](https://img.shields.io/badge/Jupyter-F37626?style=for-the-badge&logo=jupyter&logoColor=white)](https://jupyter.org/)
[![Copilot](https://img.shields.io/badge/GitHub_Copilot_SDK-181717?style=for-the-badge&logo=github&logoColor=white)](https://github.com/features/copilot)

**JupyterLab × RStudio × AI — on your desktop. No cloud required.**

[Features](#-features) • [Quick Start](#-quick-start) • [Project Layout](#-project-layout) • [Architecture](#-architecture)

</div>

---

## What is AcademiaML?

AcademiaML is a **notebook-first desktop research workbench** designed for scientists who have tabular data and need help choosing, running, and interpreting machine learning workflows — without leaving their local environment.

Think of it as **JupyterLab + RStudio + AI advisor**, packaged as a native desktop app:

```
Your tabular data
      │
      ▼
AcademiaML opens it in a real .ipynb notebook
      │
      ├──▶  Monaco editor  (VS Code-quality editing)
      ├──▶  Local Jupyter kernel  (real Python execution)
      ├──▶  AI advisor  (OpenAI-compatible or GitHub Copilot)
      ├──▶  Agent queue  (approve before any code runs)
      └──▶  KaTeX math rendering  (publication-ready output)
```

---

## ✨ Features

<table>
<tr>
<td width="50%">

### 📓 Real Notebooks, Real Kernel
- Native `.ipynb` format — fully portable
- **Local Jupyter kernel** execution via `@jupyterlab/services`
- **Monaco Editor** (same engine as VS Code)
- Per-project Python virtual environments
- `bootstrap_runtime.py` auto-configures each project

</td>
<td width="50%">

### 🤖 AI Research Advisor
- **GitHub Copilot SDK** integration
- Local Copilot CLI agent queue
- OpenAI-compatible provider support
- Approvals gate: every AI action requires explicit sign-off
- KaTeX math rendering in AI responses

</td>
</tr>
<tr>
<td width="50%">

### 📊 Tabular Data First
- CSV parsing via **PapaParser**
- Auto-infers column types and schema
- Summary stats without exposing raw data
- `data/raw/` → `data/derived/` pipeline convention
- Sampled slice preview — no full upload

</td>
<td width="50%">

### 🔒 Local-First, Privacy-Respecting
- All computation on your machine
- Only schema + inferred types + summary stats used by AI by default
- Explicit approval required for any broader data access
- Project folders are plain directories — readable without the app

</td>
</tr>
</table>

---

## 🚀 Quick Start

```bash
# Clone and install
git clone https://github.com/Xueyang-Song/academia-ml.git
cd academia-ml
npm install

# Run in development
npm run dev

# Bootstrap a new project (Python runtime + venv)
python scripts/bootstrap_runtime.py /path/to/your/project

# Build for production
npm run build

# Package as desktop app
npm run pack
```

---

## 📁 Project Layout

AcademiaML projects are plain directories — readable, portable, version-controllable:

```
my-research-project/
├── .academiaml/
│   └── project.json        # Project config and metadata
├── notebooks/              # .ipynb files (real Jupyter format)
├── data/
│   ├── raw/                # Original data, never modified
│   └── derived/            # Processed / feature-engineered data
├── generated/              # AI-generated scripts and outputs
├── artifacts/              # Plots, model files, exports
└── logs/                   # Kernel and agent execution logs
```

---

## 🏗 Architecture

```
academia-ml/
├── electron/               # Main process
│   ├── kernel/             # Jupyter kernel management
│   ├── agent/              # Copilot SDK + agent queue
│   └── python/             # Virtualenv bootstrap, script runner
├── src/                    # Renderer process (React + Vite)
│   ├── components/
│   │   ├── notebook/       # Cell editor (Monaco), output renderer
│   │   ├── advisor/        # AI chat panel (KaTeX, markdown)
│   │   ├── data/           # Table viewer, schema inspector
│   │   └── queue/          # Agent approval drawer
│   └── lib/                # Shared utilities
├── python_templates/       # Starter ML scripts per workflow type
├── prompts/                # AI advisor prompt templates
└── scripts/
    └── bootstrap_runtime.py
```

**Tech Stack:**

![Electron](https://img.shields.io/badge/Electron-47848F?style=flat-square&logo=electron&logoColor=white)
![React](https://img.shields.io/badge/React-61DAFB?style=flat-square&logo=react&logoColor=black)
![TypeScript](https://img.shields.io/badge/TypeScript-3178C6?style=flat-square&logo=typescript&logoColor=white)
![Vite](https://img.shields.io/badge/Vite-646CFF?style=flat-square&logo=vite&logoColor=white)
![Jupyter](https://img.shields.io/badge/JupyterLab_Services-F37626?style=flat-square&logo=jupyter&logoColor=white)
![Monaco](https://img.shields.io/badge/Monaco_Editor-0078D7?style=flat-square&logo=visualstudiocode&logoColor=white)
![Copilot](https://img.shields.io/badge/GitHub_Copilot_SDK-181717?style=flat-square&logo=github&logoColor=white)
![KaTeX](https://img.shields.io/badge/KaTeX-008080?style=flat-square&logo=latex&logoColor=white)
![Tailwind](https://img.shields.io/badge/Tailwind-06B6D4?style=flat-square&logo=tailwindcss&logoColor=white)
![Python](https://img.shields.io/badge/Python_3.11+-3776AB?style=flat-square&logo=python&logoColor=white)

---

## Inspiration

Designed to feel closer to how scientists actually work:

| Tool | What AcademiaML borrows |
|------|------------------------|
| **JupyterLab** | Real `.ipynb` notebooks, kernel execution |
| **RStudio** | Project-centric workspace, data panel |
| **MATLAB** | Integrated environment, no context switching |
| **GitHub Copilot** | AI that asks before acting |

---

<div align="center">

<img src="https://capsule-render.vercel.app/api?type=waving&color=gradient&customColorList=12,20,28&height=80&section=footer" width="100%"/>

*For scientists who want to run ML, not manage infrastructure.*

[![GitHub](https://img.shields.io/badge/Xueyang--Song-181717?style=flat-square&logo=github)](https://github.com/Xueyang-Song)

</div>
