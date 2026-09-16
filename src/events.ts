import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { autoThrottleSettings, checkThrottle } from "./runtime.js";

const TOOL_NAMES = new Set([
  "question",
  "questionnaire",
  "question_input",
  "question_throttle",
  "question_branch",
]);

export function registerEvents(pi: ExtensionAPI) {
  // ─── Lifecycle Events ──────────────────────────────────────────────────

  pi.on("session_start", async (event, ctx) => {
    if (event.reason === "new" || event.reason === "resume") {
      ctx.ui.notify("Questions extension loaded", "info");
    }
  });

  pi.on("session_shutdown", async () => {
    // Cleanup any in-memory state on session shutdown
  });

  pi.on("session_info_changed", async (_event, _ctx) => {
    // Session renamed - could update widget
  });

  // ─── Tool Events ───────────────────────────────────────────────────────

  pi.on("tool_call", async (event, _ctx) => {
    // Auto-throttle: enforce cooldown between question tools
    if (autoThrottleSettings.enabled && TOOL_NAMES.has(event.toolName)) {
      const throttleCheck = checkThrottle(autoThrottleSettings.cooldown);
      if (throttleCheck.waited) {
        const remaining = Math.ceil(autoThrottleSettings.cooldown - throttleCheck.elapsed);
        // Brief wait - user won't notice the small delay
        await new Promise((r) => setTimeout(r, (remaining + 0.1) * 1000));
      }
    }
  });

  pi.on("tool_result", async (event, ctx) => {
    // Emit custom events for other extensions to subscribe to
    if (event.result?.details && "answer" in event.result.details) {
      pi.events.emit("question_answered", {
        toolName: event.toolName,
        answer: (event.result.details as any).answer,
        timestamp: Date.now(),
      });
    }

    // Auto-name session after questionnaire completion
    if (event.toolName === "questionnaire" && event.result?.details) {
      const details = event.result.details as any;
      if (details.answers && details.answers.length > 0) {
        const firstAnswer = String(details.answers[0].label ?? details.answers[0].id);
        const name = `Q&A: ${firstAnswer}`;
        ctx.sessionManager.setSessionName(name);
      }
    }
  });
}
