import type { OpencodeClient, Part, TextPart } from "@opencode-ai/sdk";
import { buildDefaultConfig, loadConfig, saveConfig } from "./config";

export async function handleCommand(
  command: string,
  client: OpencodeClient,
  sessionID: string
): Promise<void> {
  const parts = command.trim().split(/\s+/);
  const baseCommand = parts[0];
  const subcommand = parts[1] || "toggle";
  const args = parts.slice(2);

  if (baseCommand === "/m" && !parts[1]) {
    await handleToggle(client, sessionID);
    return;
  }

  switch (subcommand) {
    case "setup":
      await handleSetup(client);
      break;
    case "show":
      await handleShow();
      break;
    case "set":
      await handleSet(args[0], client, sessionID);
      break;
    case "reset":
      await handleReset(client);
      break;
    case "toggle":
    default:
      await handleToggle(client, sessionID);
  }
}

export function extractCommandText(parts: Part[]): string {
  return parts
    .filter((part): part is TextPart => part.type === "text")
    .map((part) => part.text)
    .join("")
    .trim();
}

export async function listAvailableModels(
  client: OpencodeClient
): Promise<string[]> {
  const response = await client.config.providers();
  const payload = "data" in response ? response.data : response;
  const providers = payload?.providers ?? [];
  const models = providers.flatMap((provider) =>
    Object.values(provider.models ?? {}).map((model) => model.id)
  );
  return Array.from(new Set(models));
}

async function handleToggle(
  client: OpencodeClient,
  sessionID: string
): Promise<void> {
  const config = await loadConfigOrWarn();
  if (!config) {
    return;
  }

  config.currentIndex = ((config.currentIndex + 1) % 3) as 0 | 1 | 2;
  const newModel = config.models[config.currentIndex];

  try {
    await setSessionModel(client, sessionID, newModel);
    await saveConfig(config);

    const position = config.currentIndex + 1;
    console.log(`→ ${newModel} [${position}/3]`);
  } catch (error: any) {
    console.error(`Failed to switch to ${newModel}: ${error.message}`);
    console.log("Run /model-toggle setup to reconfigure");
  }
}

async function handleShow(): Promise<void> {
  const config = await loadConfigOrWarn();
  if (!config) {
    return;
  }

  console.log("\nModel Rotation:");
  config.models.forEach((model, idx) => {
    const prefix = idx === config.currentIndex ? "→" : " ";
    const suffix = idx === config.currentIndex ? " (active)" : "";
    console.log(`${prefix} ${idx + 1}. ${model}${suffix}`);
  });
  console.log("\nUse /m to cycle through models");
}

async function handleSet(
  index: string | undefined,
  client: OpencodeClient,
  sessionID: string
): Promise<void> {
  const idx = Number.parseInt(index ?? "", 10) - 1;

  if (Number.isNaN(idx) || idx < 0 || idx > 2) {
    console.log("Error: Index must be 1, 2, or 3");
    console.log("Usage: /model-toggle set <1|2|3>");
    return;
  }

  const config = await loadConfigOrWarn();
  if (!config) {
    return;
  }

  config.currentIndex = idx as 0 | 1 | 2;
  const newModel = config.models[config.currentIndex];

  try {
    await setSessionModel(client, sessionID, newModel);
    await saveConfig(config);

    const position = config.currentIndex + 1;
    console.log(`→ ${newModel} [${position}/3]`);
  } catch (error: any) {
    console.error(`Failed to switch to ${newModel}: ${error.message}`);
  }
}

async function handleSetup(client: OpencodeClient): Promise<void> {
  console.log("\n🎯 Model Toggle Setup\n");

  let availableModels: string[] = [];
  try {
    availableModels = await listAvailableModels(client);
  } catch (error: any) {
    console.error("Failed to fetch available models");
    console.error(error?.message ?? "Unknown error");
    return;
  }

  if (availableModels.length === 0) {
    console.log("No models returned from OpenCode");
    return;
  }

  console.log("Available models:");
  availableModels.forEach((model, idx) => {
    console.log(`  ${idx + 1}. ${model}`);
  });

  console.log("\nInteractive model selection coming in v1.1");
  console.log("For now, manually edit: ~/.config/opencode/model-toggle.json");
  console.log('Set the "models" array to your 3 preferred models\n');

  await setupEditorHotkey(client);
}

async function handleReset(client: OpencodeClient): Promise<void> {
  let availableModels: string[] = [];
  try {
    availableModels = await listAvailableModels(client);
  } catch (error: any) {
    console.error("Failed to fetch available models");
    console.error(error?.message ?? "Unknown error");
    return;
  }

  try {
    const defaultConfig = buildDefaultConfig(availableModels);
    await saveConfig(defaultConfig);
    console.log("✓ Configuration reset to defaults");
  } catch (error: any) {
    console.error("Need at least three models to reset config");
    if (error?.message) {
      console.error(error.message);
    }
  }
}

async function loadConfigOrWarn() {
  try {
    return await loadConfig();
  } catch (error: any) {
    console.error("Config missing or invalid");
    if (error?.message) {
      console.error(error.message);
    }
    console.log("Run /model-toggle setup to configure");
    return null;
  }
}

async function setSessionModel(
  client: OpencodeClient,
  sessionID: string,
  model: string
): Promise<void> {
  await client.session.command({
    path: { id: sessionID },
    body: {
      command: "model",
      arguments: model
    }
  });
}

async function setupEditorHotkey(client: OpencodeClient): Promise<void> {
  const { detectEditor, getEditorConfigPath } = await import("./editor");

  console.log("🎹 Editor Hotkey Setup\n");

  const detectedEditor = await detectEditor();

  if (detectedEditor) {
    console.log(`Detected: ${detectedEditor}`);
  }

  console.log("\nManual editor setup:");
  console.log("Add this hotkey to your editor config:\n");

  const exampleHotkey = "cmd+shift+m";
  const editor = detectedEditor || "zed";
  const configPath = getEditorConfigPath(editor);

  console.log(`Editor: ${editor}`);
  console.log(`Config: ${configPath}`);
  console.log(`Hotkey: ${exampleHotkey}\n`);

  console.log("See examples/ folder in plugin repo for config snippets");
  console.log("Automated setup coming in v1.1!");
}
