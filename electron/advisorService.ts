import { ipcMain } from "electron";
import fs from "node:fs/promises";
import path from "node:path";

import type { AdvisorStatus, DatasetPreview, ProviderConfig } from "../shared/types.js";

const PROMPT_PATH = path.resolve(process.cwd(), "prompts", "advisor_system.md");

async function loadSystemPrompt() {
  return fs.readFile(PROMPT_PATH, "utf-8");
}

function toOpenAIUrl(baseUrl: string) {
  return baseUrl.replace(/\/$/, "") + "/chat/completions";
}

export async function testAdvisorConnection(config: ProviderConfig): Promise<AdvisorStatus> {
  if (!config.baseUrl || !config.apiKey || !config.model) {
    return { reachable: false, message: "Base URL, API key, and model are required." };
  }

  try {
    const response = await fetch(toOpenAIUrl(config.baseUrl), {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${config.apiKey}`,
      },
      body: JSON.stringify({
        model: config.model,
        messages: [
          { role: "system", content: "Reply with the single word connected." },
          { role: "user", content: "connected" },
        ],
        temperature: 0.1,
      }),
    });
    if (!response.ok) {
      return { reachable: false, message: `Provider returned ${response.status}.` };
    }
    return { reachable: true, message: "Advisor connection looks healthy." };
  } catch (error) {
    return { reachable: false, message: error instanceof Error ? error.message : "Unknown advisor error." };
  }
}

export async function sendAdvisorMessage(config: ProviderConfig, datasetPreview: DatasetPreview | null, question: string) {
  const system = await loadSystemPrompt();
  const context = datasetPreview
    ? {
        schema: datasetPreview.columns.map((column) => ({
          name: column.name,
          inferredType: column.inferredType,
          missingCount: column.missingCount,
          uniqueCount: column.uniqueCount,
        })),
        sampleRows: datasetPreview.sampleRows.slice(0, 5),
        rowCount: datasetPreview.rowCount,
      }
    : { note: "No dataset loaded yet." };

  const response = await fetch(toOpenAIUrl(config.baseUrl), {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${config.apiKey}`,
    },
    body: JSON.stringify({
      model: config.model,
      temperature: 0.2,
      messages: [
        { role: "system", content: system },
        {
          role: "user",
          content: JSON.stringify({
            question,
            dataset_context: context,
          }),
        },
      ],
    }),
  });
  if (!response.ok) {
    throw new Error(`Advisor request failed with status ${response.status}`);
  }
  const payload = (await response.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
  };
  return payload.choices?.[0]?.message?.content ?? "";
}

export function registerAdvisorHandlers() {
  ipcMain.handle("advisor:testConnection", async (_event, config: ProviderConfig) => testAdvisorConnection(config));
  ipcMain.handle(
    "advisor:sendMessage",
    async (_event, config: ProviderConfig, datasetPreview: DatasetPreview | null, question: string) =>
      sendAdvisorMessage(config, datasetPreview, question),
  );
}

