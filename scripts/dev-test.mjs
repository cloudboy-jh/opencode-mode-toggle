import { mkdtemp, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

const tempHome = await mkdtemp(join(tmpdir(), "opencode-model-toggle-"));
process.env.HOME = tempHome;

const { ModelToggle } = await import(new URL("../dist/index.js", import.meta.url));

const fakeClient = {
  config: {
    providers: async () => ({
      data: {
        providers: [
          {
            models: {
              a: { id: "model-a" },
              b: { id: "model-b" },
              c: { id: "model-c" },
              d: { id: "model-d" }
            }
          }
        ]
      }
    })
  },
  session: {
    command: async ({ body }) => {
      console.log("session.command", body);
    }
  }
};

const plugin = await ModelToggle({ client: fakeClient });
const handler = plugin["chat.message"];

if (!handler) {
  throw new Error("chat.message hook missing");
}

await handler({ sessionID: "sess-1" }, { parts: [{ type: "text", text: "/m" }] });
await handler({ sessionID: "sess-1" }, { parts: [{ type: "text", text: "/model-toggle show" }] });
await handler({ sessionID: "sess-1" }, { parts: [{ type: "text", text: "/model-toggle set 2" }] });

const configPath = join(tempHome, ".config", "opencode", "model-toggle.json");
const configContents = await readFile(configPath, "utf-8");
console.log("config", configContents.trim());
