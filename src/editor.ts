import { readFile, writeFile, mkdir } from "node:fs/promises";
import { homedir } from "node:os";
import { join, dirname } from "node:path";

export async function detectEditor(): Promise<string | null> {
  const home = homedir();
  const checks = [
    { editor: "zed", path: join(home, ".config/zed/settings.json") },
    { editor: "vscode", path: join(home, ".config/Code/User/settings.json") },
    { editor: "cursor", path: join(home, ".config/Cursor/User/settings.json") }
  ];

  for (const check of checks) {
    try {
      await readFile(check.path);
      return check.editor;
    } catch {
      continue;
    }
  }

  return null;
}

export function getEditorConfigPath(editor: string): string {
  const home = homedir();
  const paths: Record<string, string> = {
    zed: join(home, ".config/zed/keymap.json"),
    vscode:
      process.platform === "darwin"
        ? join(home, "Library/Application Support/Code/User/keybindings.json")
        : join(home, ".config/Code/User/keybindings.json"),
    cursor:
      process.platform === "darwin"
        ? join(home, "Library/Application Support/Cursor/User/keybindings.json")
        : join(home, ".config/Cursor/User/keybindings.json"),
    windsurf: join(home, ".config/Windsurf/User/keybindings.json")
  };

  return paths[editor] || paths.zed;
}

export async function configureEditor(
  editor: string,
  hotkey: string
): Promise<void> {
  const configPath = getEditorConfigPath(editor);

  let existingConfig: unknown;
  try {
    const data = await readFile(configPath, "utf-8");
    existingConfig = JSON.parse(data);
  } catch {
    existingConfig = editor === "zed" ? { bindings: {} } : [];
  }

  const updatedConfig = mergeHotkey(existingConfig, editor, hotkey);

  await mkdir(dirname(configPath), { recursive: true });
  await writeFile(configPath, JSON.stringify(updatedConfig, null, 2));
}

function mergeHotkey(existing: unknown, editor: string, hotkey: string): unknown {
  if (editor === "zed") {
    const config =
      typeof existing === "object" && existing !== null
        ? (existing as { bindings?: Record<string, unknown> })
        : { bindings: {} };
    config.bindings = config.bindings || {};
    config.bindings[hotkey] = [
      "task::Spawn",
      {
        task_name: "Model Toggle",
        command: "opencode",
        args: ["run", "/m"]
      }
    ];
    return config;
  }

  const config = Array.isArray(existing) ? existing : [];
  const filtered = config.filter(
    (binding: any) =>
      !binding.args?.text?.includes("/m") &&
      !binding.args?.text?.includes("model-toggle")
  );

  filtered.push({
    key: hotkey,
    command: "workbench.action.terminal.sendSequence",
    args: { text: "opencode run '/m'\n" }
  });

  return filtered;
}
