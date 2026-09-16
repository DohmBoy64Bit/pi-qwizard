import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { keyHint } from "@earendil-works/pi-coding-agent";
import { Text } from "@earendil-works/pi-tui";
import { normalizeOptions, validateOptions } from "../core/questionnaire-validation.js";
import { errorResult } from "../core/validation.js";
import { QuestionThrottleParams } from "../schemas.js";
import { checkThrottle, recordQuestionTime } from "../state/throttle.js";
import type { DisplayOption, QOption, QuestionThrottleResult } from "../types.js";
import { createSelectionWidget } from "../widgets/selection-widget.js";

export function registerQuestionThrottleTool(pi: ExtensionAPI): void {
  pi.registerTool({
    name: "question_throttle",
    label: "Question Throttle",
    description:
      "Ask a question with rate limiting. Ensures a minimum cooldown period between questions to prevent spam. Tracks timestamps globally across all question tools.",
    promptSnippet: "Ask a rate-limited question",
    promptGuidelines: [
      "Use question_throttle when you need to prevent rapid-fire questions.",
      "Default cooldown is 5 seconds; set higher for longer pauses.",
    ],
    parameters: QuestionThrottleParams,
    executionMode: "sequential",
    prepareArguments(args) {
      return args;
    },
    async execute(_id, rawParams, _signal, _update, ctx) {
      const params = normalizeOptions(rawParams);
      if (ctx.mode !== "tui")
        return errorResult("Error: UI not available (running in non-interactive mode)", {
          question: params.question,
          options: params.options.map((o) => o.label),
          answer: null,
          throttled: false,
          error: "no_ui",
        });
      const optionValidation = validateOptions(params.options);
      if (params.options.length === 0)
        return errorResult("Error: No options provided", {
          question: params.question,
          options: [],
          answer: null,
          throttled: false,
          error: "empty_options",
        });
      if (optionValidation.ok === false)
        return errorResult(optionValidation.message, {
          question: params.question,
          options: params.options.map((o) => o.label),
          answer: null,
          throttled: false,
          error: optionValidation.error,
        });
      const cooldown = params.cooldown ?? 5;
      const throttle = checkThrottle(cooldown);
      if (throttle.waited) {
        const remaining = Math.max(0, Math.ceil(cooldown - throttle.elapsed));
        await new Promise((resolve) => setTimeout(resolve, (remaining + 0.5) * 1000));
      }
      recordQuestionTime();
      const options: DisplayOption[] = [
        ...params.options,
        ...(params.allowOther !== false && params.options.length > 0
          ? [{ label: "Type something...", isOther: true }]
          : []),
      ];
      const result = await ctx.ui.custom<{
        answer: string | string[];
        wasCustom: boolean;
        index?: number;
      } | null>((tui, theme, _kb, done) =>
        createSelectionWidget(
          { question: params.question, options, multi: params.type === "multi" },
          { tui, theme, keys: { up: "up", down: "down", enter: "enter", escape: "escape" }, done },
        ),
      );
      const labels = params.options.map((o) => o.label);
      if (!result)
        return errorResult("User cancelled the selection", {
          question: params.question,
          options: labels,
          answer: null,
          wasCustom: false,
          throttled: throttle.waited,
        } as QuestionThrottleResult);
      const details = {
        question: params.question,
        options: labels,
        answer: result.answer,
        wasCustom: result.wasCustom,
        index: result.index,
        throttled: throttle.waited,
      } as QuestionThrottleResult;
      return {
        content: [
          {
            type: "text",
            text: result.wasCustom
              ? `User wrote: ${result.answer}`
              : `User selected: ${Array.isArray(result.answer) ? result.answer.join(", ") : result.answer}`,
          },
        ],
        details,
      };
    },
    renderCall(args, theme) {
      const options = Array.isArray(args.options) ? args.options : [];
      const labels = options.map((o: QOption) => o.label);
      const text =
        theme.fg("toolTitle", theme.bold("question_throttle ")) +
        theme.fg("muted", args.question) +
        `\n${theme.fg("dim", `  Cooldown: ${args.cooldown ?? 5}s`)}` +
        (labels.length ? `\n${theme.fg("dim", `  Options: ${labels.join(", ")}`)}` : "");
      return new Text(text, 0, 0);
    },
    renderResult(result, _options, theme) {
      const details = result.details as QuestionThrottleResult | undefined;
      if (!details) return new Text(result.content[0]?.text ?? "", 0, 0);
      if (details.answer === null) return new Text(theme.fg("warning", "Cancelled"), 0, 0);
      const throttled = details.throttled ? theme.fg("dim", " (throttled)") : "";
      return new Text(
        `${theme.fg("success", "✓ ")}${theme.fg("accent", String(details.answer))}${throttled} (${keyHint("app.tools.expand", "to expand")})`,
        0,
        0,
      );
    },
  });
}
