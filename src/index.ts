import type { Plugin } from "@opencode-ai/plugin";
import { extractCommandText, handleCommand, listAvailableModels } from "./commands";
import { ensureConfigExists } from "./config";

export const ModelToggle: Plugin = async ({ client }) => {
  let availableModels: string[] | undefined;

  try {
    availableModels = await listAvailableModels(client);
  } catch (error: any) {
    console.warn("Unable to fetch model list for defaults");
    if (error?.message) {
      console.warn(error.message);
    }
  }

  await ensureConfigExists(availableModels);

  return {
    "chat.message": async ({ sessionID }, { parts }) => {
      const text = extractCommandText(parts);

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
    }
  };
};

export default ModelToggle;
