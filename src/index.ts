import type { Plugin } from "@opencode-ai/plugin";
import { extractCommandText, handleCommand, listAvailableModels } from "./commands";
import { ensureConfigExists } from "./config";

type PluginClient = Parameters<Plugin>[0]["client"];

type LogLevel = "info" | "warn" | "error";

async function logMessage(
  client: PluginClient,
  level: LogLevel,
  message: string,
  error?: unknown
): Promise<void> {
  const details = error instanceof Error ? error.message : error ? String(error) : "";
  const fullMessage = details ? `${message}: ${details}` : message;

  try {
    if (client.app?.log) {
      await client.app.log({
        body: {
          service: "opencode-model-toggle",
          level,
          message,
          ...(details ? { extra: { error: details } } : {})
        }
      });
      return;
    }
  } catch {
    // Fall back to console logging
  }

  if (level === "warn") {
    console.warn(fullMessage);
  } else if (level === "error") {
    console.error(fullMessage);
  } else {
    console.log(fullMessage);
  }
}

export const ModelToggle: Plugin = async ({ client }) => {
  const log = (level: LogLevel, message: string, error?: unknown) =>
    logMessage(client, level, message, error);

  try {
    let availableModels: string[] | undefined;

    try {
      availableModels = await listAvailableModels(client);
    } catch (error) {
      await log("warn", "Unable to fetch model list for defaults", error);
    }

    try {
      await ensureConfigExists(availableModels);
    } catch (error) {
      await log("warn", "Unable to ensure model toggle config", error);
    }
  } catch (error) {
    await log("error", "Model toggle failed to initialize", error);
    return {};
  }

  return {
    "chat.message": async ({ sessionID }, { parts }) => {
      try {
        const text = extractCommandText(parts ?? []);

        if (!text) {
          return;
        }

        if (
          text.startsWith("/model-toggle") ||
          text.startsWith("/m ") ||
          text === "/m"
        ) {
          await handleCommand(text, client, sessionID);
        }
      } catch (error) {
        await log("error", "Model toggle command failed", error);
      }
    }
  };
};
