import { ipcMain } from "electron";
import fs from "node:fs/promises";
import path from "node:path";

import { sendAdvisorMessage, testAdvisorConnection } from "./advisorService.js";
import { askCopilotForPlan, getCopilotStatus, listCopilotModels } from "./copilotService.js";
import type {
  AgentRun,
  AgentStep,
  AdvisorStatus,
  CopilotBridgeStatus,
  DatasetPreview,
  NotebookDocument,
  ProjectManifest,
  ProviderConfig,
  WorkflowTaskType,
} from "../shared/types.js";

function nowIso() {
  return new Date().toISOString();
}

function runLogPath(projectPath: string, runId: string) {
  return path.join(projectPath, "logs", `agent-run-${runId}.json`);
}

async function readJson<T>(filePath: string): Promise<T> {
  return JSON.parse(await fs.readFile(filePath, "utf-8")) as T;
}

async function writeJson(filePath: string, value: unknown) {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, JSON.stringify(value, null, 2), "utf-8");
}

function manifestPath(projectPath: string) {
  return path.join(projectPath, ".academiaml", "project.json");
}

function makeStep(partial: Omit<AgentStep, "id">): AgentStep {
  return {
    id: crypto.randomUUID(),
    ...partial,
  };
}

function sampleSummary(preview: DatasetPreview) {
  return JSON.stringify(
    {
      rowCount: preview.rowCount,
      columns: preview.columns.map((column) => ({
        name: column.name,
        inferredType: column.inferredType,
        missingCount: column.missingCount,
      })),
      sampleRows: preview.sampleRows.slice(0, 5),
    },
    null,
    2,
  );
}

function inferTaskType(preview: DatasetPreview, targetColumn: string): WorkflowTaskType {
  const target = preview.columns.find((column) => column.name === targetColumn);
  if (!target) {
    return "regression";
  }
  if (target.inferredType === "boolean" || target.uniqueCount <= 6) {
    return "classification";
  }
  return "regression";
}

function cleanJsonFence(raw: string) {
  return raw.replace(/^```json\s*/i, "").replace(/^```\s*/i, "").replace(/\s*```$/i, "").trim();
}

function defaultRecommendation(taskType: WorkflowTaskType, targetColumn: string) {
  if (taskType === "classification") {
    return {
      task_type: "classification",
      target_column: targetColumn,
      preprocessing: ["median imputation for numeric columns", "most-frequent imputation for categorical columns"],
      models: ["RandomForestClassifier", "GradientBoostingClassifier", "LogisticRegression"],
      primary_metric: "F1 score",
      notes: "Start with classical baselines before more complex models.",
    };
  }
  return {
    task_type: "regression",
    target_column: targetColumn,
    preprocessing: ["median imputation for numeric columns", "most-frequent imputation for categorical columns"],
    models: ["RandomForestRegressor", "GradientBoostingRegressor", "Ridge"],
    primary_metric: "R2 and MAE",
    notes: "Start with non-linear baselines and keep the workflow reproducible in the notebook.",
  };
}

function buildPlanningPrompt(
  preview: DatasetPreview,
  taskType: WorkflowTaskType,
  targetColumn: string,
  userRequest?: string,
) {
  return [
    "You are helping a scientific researcher choose a classical machine-learning workflow for a tabular dataset.",
    "Only use schema information and the visible sample rows below. Do not ask for the full dataset.",
    "Return strict JSON with keys: task_type, target_column, preprocessing, models, primary_metric, notes.",
    "",
    userRequest ? `Researcher request: ${userRequest}` : "Researcher request: recommend a practical starting workflow.",
    `Proposed task type: ${taskType}`,
    `Target column: ${targetColumn}`,
    "Dataset summary:",
    sampleSummary(preview),
  ].join("\n");
}

function buildNotebookSuggestion(options: {
  title: string;
  datasetPath: string;
  targetColumn: string;
  taskType: WorkflowTaskType;
  recommendation: {
    preprocessing: string[];
    models: string[];
    primary_metric: string;
    notes: string;
  };
}): NotebookDocument {
  const isClassification = options.taskType === "classification";
  const primaryMetricKey = isClassification ? "f1" : "r2";
  const metricSummary = isClassification
    ? "f1_score, accuracy_score, classification_report"
    : "r2_score, mean_absolute_error";
  const estimatorDefinitions = isClassification
    ? "from sklearn.ensemble import RandomForestClassifier, GradientBoostingClassifier\nfrom sklearn.linear_model import LogisticRegression"
    : "from sklearn.ensemble import RandomForestRegressor, GradientBoostingRegressor\nfrom sklearn.linear_model import Ridge";
  const estimatorBody = isClassification
    ? `models = {
    "RandomForest": RandomForestClassifier(n_estimators=240, random_state=42),
    "GradientBoosting": GradientBoostingClassifier(random_state=42),
    "LogisticRegression": LogisticRegression(max_iter=4000),
}`
    : `models = {
    "RandomForest": RandomForestRegressor(n_estimators=240, random_state=42),
    "GradientBoosting": GradientBoostingRegressor(random_state=42),
    "Ridge": Ridge(alpha=1.0),
}`;
  const scoring = isClassification
    ? `metrics[name] = {
        "accuracy": float(accuracy_score(y_test, preds)),
        "f1": float(f1_score(y_test, preds, average="weighted")),
    }`
    : `metrics[name] = {
        "r2": float(r2_score(y_test, preds)),
        "mae": float(mean_absolute_error(y_test, preds)),
    }`;
  const yTransform = isClassification ? "y = df[target].astype(str)" : "y = pd.to_numeric(df[target], errors='coerce')";
  const splitStratify = isClassification ? "stratify=y" : "stratify=None";

  return {
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
        source: [
          `# ${options.title}\n`,
          "\n",
          `Target column: \`${options.targetColumn}\`\n`,
          "\n",
          `Recommended task framing: **${options.taskType}**\n`,
          "\n",
          `Primary metric: **${options.recommendation.primary_metric}**\n`,
          "\n",
          "This notebook was staged by the agent queue using only schema plus sampled rows.\n",
        ],
      },
      {
        cell_type: "markdown",
        id: crypto.randomUUID(),
        metadata: {},
        source: [
          "## Workflow notes\n",
          "\n",
          ...options.recommendation.preprocessing.map((line) => `- ${line}\n`),
          `- Candidate models: ${options.recommendation.models.join(", ")}\n`,
          `- Notes: ${options.recommendation.notes}\n`,
        ],
      },
      {
        cell_type: "code",
        id: crypto.randomUUID(),
        metadata: {},
        source: [
          "import json\n",
          "import joblib\n",
          "from pathlib import Path\n",
          "\n",
          "import matplotlib.pyplot as plt\n",
          "plt.switch_backend('Agg')\n",
          "import numpy as np\n",
          "import pandas as pd\n",
          `${estimatorDefinitions}\n`,
          "from sklearn.compose import ColumnTransformer\n",
          "from sklearn.impute import SimpleImputer\n",
          "from sklearn.metrics import " + metricSummary + "\n",
          "from sklearn.model_selection import train_test_split\n",
          "from sklearn.pipeline import Pipeline\n",
          "from sklearn.preprocessing import OneHotEncoder, StandardScaler\n",
        ],
        execution_count: null,
        outputs: [],
      },
      {
        cell_type: "code",
        id: crypto.randomUUID(),
        metadata: {},
        source: [
          "project_root = Path.cwd()\n",
          "if not (project_root / 'data').exists():\n",
          "    project_root = project_root.parent\n",
          `dataset_path = project_root / "${options.datasetPath.replace(/\\/g, "/")}"\n`,
          `target = "${options.targetColumn}"\n`,
          "df = pd.read_csv(dataset_path)\n",
          "df.head()\n",
        ],
        execution_count: null,
        outputs: [],
      },
      {
        cell_type: "code",
        id: crypto.randomUUID(),
        metadata: {},
        source: [
          `${yTransform}\n`,
          "X = df.drop(columns=[target])\n",
          "numeric_columns = X.select_dtypes(include=[np.number, 'float64', 'int64']).columns.tolist()\n",
          "categorical_columns = [column for column in X.columns if column not in numeric_columns]\n",
          "\n",
          "numeric_transformer = Pipeline([\n",
          "    ('imputer', SimpleImputer(strategy='median')),\n",
          "    ('scaler', StandardScaler()),\n",
          "])\n",
          "\n",
          "categorical_transformer = Pipeline([\n",
          "    ('imputer', SimpleImputer(strategy='most_frequent')),\n",
          "    ('onehot', OneHotEncoder(handle_unknown='ignore')),\n",
          "])\n",
          "\n",
          "preprocessor = ColumnTransformer([\n",
          "    ('num', numeric_transformer, numeric_columns),\n",
          "    ('cat', categorical_transformer, categorical_columns),\n",
          "])\n",
          "\n",
          `X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.25, random_state=42, ${splitStratify})\n`,
          "X_train.shape, X_test.shape\n",
        ],
        execution_count: null,
        outputs: [],
      },
      {
        cell_type: "code",
        id: crypto.randomUUID(),
        metadata: {},
        source: [
          `${estimatorBody}\n`,
          "\n",
          "metrics = {}\n",
          "fitted_models = {}\n",
          "best_name = None\n",
          "best_score = None\n",
          "\n",
          "for name, estimator in models.items():\n",
          "    pipeline = Pipeline([\n",
          "        ('preprocessor', preprocessor),\n",
          "        ('model', estimator),\n",
          "    ])\n",
          "    pipeline.fit(X_train, y_train)\n",
          "    preds = pipeline.predict(X_test)\n",
          `    ${scoring}\n`,
          "    fitted_models[name] = pipeline\n",
          `    candidate_score = metrics[name]["${primaryMetricKey}"]\n`,
          "    if best_score is None or candidate_score > best_score:\n",
          "        best_name = name\n",
          "        best_score = candidate_score\n",
          "\n",
          "metrics\n",
        ],
        execution_count: null,
        outputs: [],
      },
      {
        cell_type: "code",
        id: crypto.randomUUID(),
        metadata: {},
        source: [
          "artifacts_dir = project_root / 'artifacts'\n",
          "artifacts_dir.mkdir(parents=True, exist_ok=True)\n",
          "metrics_path = artifacts_dir / 'latest_metrics.json'\n",
          "metrics_path.write_text(json.dumps(metrics, indent=2), encoding='utf-8')\n",
          "run_summary_path = artifacts_dir / 'run_summary.json'\n",
          "run_summary_path.write_text(json.dumps({\n",
          `    'task_type': '${options.taskType}',\n`,
          "    'target_column': target,\n",
          "    'best_model': best_name,\n",
          "    'best_score': best_score,\n",
          "}, indent=2), encoding='utf-8')\n",
          "\n",
          "model_names = list(metrics.keys())\n",
          `score_values = [metrics[name]['${primaryMetricKey}'] for name in model_names]\n`,
          "plt.figure(figsize=(8, 4.4))\n",
          "plt.bar(model_names, score_values, color=['#486d6d', '#8b6f4e', '#6d7f96'])\n",
          `plt.ylabel('${isClassification ? "F1 score" : "R2 score"}')\n`,
          "plt.title('Model comparison')\n",
          "plt.tight_layout()\n",
          "plot_path = artifacts_dir / 'model_comparison.png'\n",
          "plt.savefig(plot_path, dpi=180)\n",
          "plt.close()\n",
          "model_path = artifacts_dir / 'best_model.joblib'\n",
          "if best_name is not None:\n",
          "    joblib.dump(fitted_models[best_name], model_path)\n",
          "print(json.dumps({\n",
          "    'metrics_path': str(metrics_path),\n",
          "    'plot_path': str(plot_path),\n",
          "    'model_path': str(model_path),\n",
          "    'best_model': best_name,\n",
          "    'best_score': best_score,\n",
          "}, indent=2))\n",
          "metrics_path, plot_path, model_path\n",
        ],
        execution_count: null,
        outputs: [],
      },
    ],
  };
}

function buildGeneratedScript(notebook: NotebookDocument) {
  const codeCells = notebook.cells.filter((cell) => cell.cell_type === "code");
  return codeCells.map((cell) => cell.source.join("")).join("\n\n");
}

async function generateWorkflow(args: {
  projectPath: string;
  preview: DatasetPreview;
  targetColumn: string;
  notebookPath: string;
  providerMode: "advisor" | "agent";
  userRequest?: string;
  advisorConfig?: ProviderConfig;
  copilotCliPath?: string;
  copilotModel?: string;
  reasoningEffort?: string;
}) {
  const manifest = await readJson<ProjectManifest>(manifestPath(args.projectPath));
  manifest.targetColumn = args.targetColumn;
  manifest.notebookPath = args.notebookPath;
  manifest.updatedAt = nowIso();
  await writeJson(manifestPath(args.projectPath), manifest);
  const taskType = inferTaskType(args.preview, args.targetColumn);
  const steps: AgentStep[] = [
    makeStep({
      title: "Inspect dataset",
      detail: "Profile schema, infer candidate target columns, and keep only sampled rows for remote context.",
      status: "completed",
      logs: [`Rows: ${args.preview.rowCount}`, `Columns: ${args.preview.columns.length}`],
      inputSummary: args.preview.relativePath,
      outputSummary: `${args.preview.columns.length} columns profiled`,
    }),
    makeStep({
      title: "Prepare privacy-safe payload",
      detail: "Keep the remote context limited to schema, summary stats, and the sampled rows visible in the UI.",
      status: "completed",
      logs: ["Payload capped at 5 sample rows."],
      inputSummary: "Schema + sample rows only",
      outputSummary: "Safe payload prepared",
    }),
    makeStep({
      title: "Recommend modeling approach",
      detail: "Ask Copilot or the advisor service to suggest a classical ML framing for this tabular dataset.",
      status: "running",
      logs: args.userRequest ? [`Researcher asked: ${args.userRequest}`] : [],
    }),
  ];

  let providerStatus: CopilotBridgeStatus | AdvisorStatus;
  let recommendation = defaultRecommendation(taskType, args.targetColumn);
  let recommendationSummary = recommendation.notes;
  const prompt = buildPlanningPrompt(args.preview, taskType, args.targetColumn, args.userRequest);

  if (args.providerMode === "agent") {
    providerStatus = await getCopilotStatus(args.copilotCliPath);
    if (providerStatus.ready) {
      try {
        const raw = await askCopilotForPlan({
          cliPath: args.copilotCliPath,
          prompt,
          model: args.copilotModel || manifest.copilotConfig?.model || "gpt-4.1",
          reasoningEffort: args.reasoningEffort,
        });
        recommendation = {
          ...recommendation,
          ...JSON.parse(cleanJsonFence(raw)),
        };
        recommendationSummary = recommendation.notes;
        steps[2].logs.push("Copilot SDK recommendation received.");
        steps[2].status = "completed";
        steps[2].outputSummary = recommendation.models.join(", ");
      } catch (error) {
        steps[2].logs.push(error instanceof Error ? error.message : "Copilot recommendation failed.");
        steps[2].status = "failed";
      }
    } else {
      steps[2].logs.push(providerStatus.message);
      steps[2].status = "skipped";
    }
  } else {
    providerStatus = args.advisorConfig
      ? await testAdvisorConnection(args.advisorConfig)
      : { reachable: false, message: "Advisor configuration is missing." };
    if (providerStatus.reachable && args.advisorConfig) {
      try {
        const raw = await sendAdvisorMessage(args.advisorConfig, args.preview, prompt);
        recommendationSummary = raw;
        steps[2].logs.push("Advisor recommendation received.");
        steps[2].status = "completed";
        steps[2].outputSummary = "Advisor notes captured.";
      } catch (error) {
        steps[2].logs.push(error instanceof Error ? error.message : "Advisor request failed.");
        steps[2].status = "failed";
      }
    } else {
      steps[2].logs.push(providerStatus.message);
      steps[2].status = "skipped";
    }
  }

  const notebookSuggestion = buildNotebookSuggestion({
    title: manifest.title,
    datasetPath: manifest.datasetPath,
    targetColumn: args.targetColumn,
    taskType,
    recommendation,
  });

  const generatedFiles = [
    {
      relativePath: "generated/train_workflow.py",
      content: buildGeneratedScript(notebookSuggestion),
    },
    {
      relativePath: "generated/workflow_plan.json",
      content: JSON.stringify(
        {
          taskType,
          targetColumn: args.targetColumn,
          userRequest: args.userRequest || "",
          recommendation,
          privacy: "schema + sampled rows only",
        },
        null,
        2,
      ),
    },
  ];

  steps.push(
    makeStep({
      title: "Stage notebook edits",
      detail: "Prepare notebook cells and generated scripts but wait for approval before applying them.",
      status: "awaiting_approval",
      requiresApproval: true,
      approved: false,
      logs: ["Notebook and generated scripts are ready to apply."],
      outputSummary: `${notebookSuggestion.cells.length} cells prepared`,
    }),
  );

  const run: AgentRun = {
    id: crypto.randomUUID(),
    mode: args.providerMode,
    createdAt: nowIso(),
    datasetPath: args.preview.relativePath,
    notebookPath: args.notebookPath,
    taskType,
    targetColumn: args.targetColumn,
    remotePayloadSummary: "Schema, inferred types, row count, summary stats, and 5 sampled rows.",
    recommendationSummary,
    notebookSuggestion,
    generatedFiles,
    steps,
    providerStatus,
  };

  await writeJson(runLogPath(args.projectPath, run.id), run);
  return run;
}

async function applyWorkflow(projectPath: string, runId: string) {
  const run = await readJson<AgentRun>(runLogPath(projectPath, runId));
  await fs.writeFile(path.join(projectPath, run.notebookPath), JSON.stringify(run.notebookSuggestion, null, 2), "utf-8");
  for (const file of run.generatedFiles) {
    const absolutePath = path.join(projectPath, file.relativePath);
    await fs.mkdir(path.dirname(absolutePath), { recursive: true });
    await fs.writeFile(absolutePath, file.content, "utf-8");
  }
  for (const step of run.steps) {
    if (step.requiresApproval) {
      step.approved = true;
      step.status = "completed";
      step.logs.push("Applied after user approval.");
    }
  }
  await writeJson(runLogPath(projectPath, run.id), run);
  return run;
}

export function registerAgentHandlers() {
  ipcMain.handle("agent:getCopilotStatus", async (_event, cliPath?: string) => getCopilotStatus(cliPath));
  ipcMain.handle("agent:listCopilotModels", async (_event, cliPath?: string) => listCopilotModels(cliPath));
  ipcMain.handle(
    "agent:generateWorkflow",
    async (
      _event,
      args: {
        projectPath: string;
        preview: DatasetPreview;
        targetColumn: string;
        notebookPath: string;
        providerMode: "advisor" | "agent";
        userRequest?: string;
        advisorConfig?: ProviderConfig;
        copilotCliPath?: string;
        copilotModel?: string;
        reasoningEffort?: string;
      },
    ) => generateWorkflow(args),
  );
  ipcMain.handle("agent:applyWorkflow", async (_event, projectPath: string, runId: string) => applyWorkflow(projectPath, runId));
}
