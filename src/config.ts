import { readFile, writeFile, mkdir } from "node:fs/promises";
import { homedir } from "node:os";
import { join } from "node:path";
import type { ModelToggleConfig } from "./types";

const CONFIG_DIR = join(homedir(), ".config", "opencode");
const CONFIG_PATH = join(CONFIG_DIR, "model-toggle.json");

const CONFIG_VERSION = "1.0.0";

function createDefaultConfig(modelCandidates?: string[]): ModelToggleConfig | null {
  if (!modelCandidates || modelCandidates.length < 3) {
    return null;
  }

  return {
    models: [modelCandidates[0], modelCandidates[1], modelCandidates[2]],
    currentIndex: 0,
    version: CONFIG_VERSION
  };
}

export async function loadConfig(): Promise<ModelToggleConfig> {
  const data = await readFile(CONFIG_PATH, "utf-8");
  const config = JSON.parse(data) as unknown;

  if (!validateConfig(config)) {
    throw new Error("Invalid config file");
  }

  return config;
}

export async function saveConfig(config: ModelToggleConfig): Promise<void> {
  await mkdir(CONFIG_DIR, { recursive: true });
  await writeFile(CONFIG_PATH, JSON.stringify(config, null, 2));
}

export async function ensureConfigExists(
  defaultModels?: string[]
): Promise<void> {
  try {
    await readFile(CONFIG_PATH);
    return;
  } catch {
    const config = createDefaultConfig(defaultModels);
    if (!config) {
      return;
    }
    await saveConfig(config);
  }
}

export function buildDefaultConfig(
  modelCandidates: string[]
): ModelToggleConfig {
  const config = createDefaultConfig(modelCandidates);
  if (!config) {
    throw new Error("Need at least three models to configure");
  }
  return config;
}

function validateConfig(config: unknown): config is ModelToggleConfig {
  if (!config || typeof config !== "object") {
    return false;
  }

  const candidate = config as ModelToggleConfig;
  return (
    Array.isArray(candidate.models) &&
    candidate.models.length === 3 &&
    typeof candidate.currentIndex === "number" &&
    candidate.currentIndex >= 0 &&
    candidate.currentIndex < 3 &&
    typeof candidate.version === "string"
  );
}
