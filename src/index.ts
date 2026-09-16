import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { registerCommands } from "./commands.js";
import { registerEvents } from "./events.js";
import { registerRenderers } from "./renderers.js";
import { registerTools } from "./tools/registry.js";

export default function registerQWizard(pi: ExtensionAPI): void {
  registerTools(pi);
  registerRenderers(pi);
  registerEvents(pi);
  registerCommands(pi);
}
