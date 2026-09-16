import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { autoThrottleSettings, clearQuestionTime } from "./runtime.js";

export function registerCommands(pi: ExtensionAPI) {
  // ─── Slash Commands ──────────────────────────────────────────────────

  // Main /qwizard command
  pi.registerCommand("qwizard", {
    description: "Manage questions extension: status, auto-throttle, clear",
    handler: async (args: string, ctx) => {
      const parts = (args || "").trim().split(/\s+/);
      const subcommand = parts[0]?.toLowerCase();
      const arg1 = parts[1];

      if (!subcommand || subcommand === "help" || subcommand === "") {
        ctx.ui.notify(
          `qwizard - Questions extension management\n\nUsage: /qwizard [subcommand] [args]\n\nSubcommands:\n  help                    Show this help message\n  status                  Show extension status and settings\n  auto-throttle           Manage auto-throttle\n    on                    Enable auto-throttle\n    off                   Disable auto-throttle\n    <seconds>             Set cooldown (e.g., /qwizard auto-throttle 5)\n  clear                   Clear throttle state\n\nSettings:\n  Auto-throttle: ${autoThrottleSettings.enabled ? "enabled" : "disabled"}\n  Cooldown: ${autoThrottleSettings.cooldown}s\n  Tools: question, questionnaire, question_input, question_throttle, question_branch`,
          "info",
        );
        return;
      }

      switch (subcommand) {
        case "status": {
          ctx.ui.notify(
            `qwizard - Extension Status\n\nTools: question, questionnaire, question_input, question_throttle, question_branch\nAuto-throttle: ${autoThrottleSettings.enabled ? "enabled" : "disabled"}\nCooldown: ${autoThrottleSettings.cooldown}s`,
            "info",
          );
          return;
        }

        case "auto-throttle": {
          if (!arg1) {
            ctx.ui.notify(
              `Auto-throttle - Current settings\n\nStatus: ${autoThrottleSettings.enabled ? "enabled" : "disabled"}\nCooldown: ${autoThrottleSettings.cooldown}s\n\nUsage:\n  /qwizard auto-throttle on    Enable auto-throttle\n  /qwizard auto-throttle off   Disable auto-throttle\n  /qwizard auto-throttle <N>   Set cooldown to N seconds`,
              "info",
            );
            return;
          }

          if (arg1 === "on") {
            autoThrottleSettings.enabled = true;
            ctx.ui.notify(
              `Auto-throttle enabled (${autoThrottleSettings.cooldown}s cooldown)`,
              "info",
            );
            return;
          }

          if (arg1 === "off") {
            autoThrottleSettings.enabled = false;
            ctx.ui.notify("Auto-throttle disabled", "info");
            return;
          }

          // Try to parse as number
          const cooldown = parseInt(arg1, 10);
          if (!Number.isNaN(cooldown) && cooldown > 0 && cooldown <= 60) {
            autoThrottleSettings.cooldown = cooldown;
            ctx.ui.notify(`Cooldown set to ${cooldown}s`, "info");
            return;
          }

          ctx.ui.notify("Invalid argument. Use: on, off, or a number (1-60)", "warning");
          return;
        }

        case "clear": {
          clearQuestionTime();
          ctx.ui.notify("Throttle state cleared", "info");
          return;
        }

        default: {
          ctx.ui.notify(
            `Unknown subcommand: ${subcommand}. Use /qwizard help for usage.`,
            "warning",
          );
          return;
        }
      }
    },
  });
}
