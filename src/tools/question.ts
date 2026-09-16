import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { keyHint } from "@earendil-works/pi-coding-agent";
import { Text } from "@earendil-works/pi-tui";
import { normalizeOptions, validateOptions } from "../core/questionnaire-validation.js";
import { errorResult } from "../core/validation.js";
import { QuestionParams } from "../schemas.js";
import type { DisplayOption, QOption, QuestionResult } from "../types.js";
import { createSelectionWidget } from "../widgets/selection-widget.js";

export function registerQuestionTool(pi: ExtensionAPI): void {
  pi.registerTool({
    name: "question",
    label: "Question",
    description:
      "Ask the user a single question with selectable options. Optionally includes a 'Type something...' option for custom text. Supports single or multiple selection.",
    promptSnippet: "Ask the user a single question with selectable options",
    promptGuidelines: [
      "Use question when you need the user to choose from predefined options for a single decision.",
      "Use question_input for open-ended answers instead of forcing options.",
    ],
    parameters: QuestionParams,
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
          error: "no_ui",
        });
      if (params.options.length === 0)
        return errorResult("Error: No options provided", {
          question: params.question,
          options: [],
          answer: null,
          error: "empty_options",
        });
      const optionValidation = validateOptions(params.options);
      if (optionValidation.ok === false)
        return errorResult(optionValidation.message, {
          question: params.question,
          options: params.options.map((o) => o.label),
          answer: null,
          error: optionValidation.error,
        });
      const options: DisplayOption[] = [
        ...params.options,
        ...(params.allowOther !== false ? [{ label: "Type something...", isOther: true }] : []),
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
        } as QuestionResult);
      if (result.wasCustom)
        return {
          content: [{ type: "text", text: `User wrote: ${result.answer}` }],
          details: {
            question: params.question,
            options: labels,
            answer: result.answer,
            wasCustom: true,
          } as QuestionResult,
        };
      const answerText =
        params.type === "multi" && Array.isArray(result.answer)
          ? result.answer.join(", ")
          : `${result.index}. ${result.answer}`;
      return {
        content: [{ type: "text", text: `User selected: ${answerText}` }],
        details: {
          question: params.question,
          options: labels,
          answer: result.answer,
          wasCustom: false,
          index: result.index,
        } as QuestionResult,
      };
    },
    renderCall(args, theme) {
      const options = Array.isArray(args.options) ? args.options : [];
      const labels = options.map((o: QOption) => o.label);
      const displayed = args.allowOther === false ? labels : [...labels, "Type something..."];
      const text =
        theme.fg("toolTitle", theme.bold("question ")) +
        theme.fg("muted", args.question) +
        (displayed.length
          ? `\n${theme.fg("dim", `  Options: ${displayed.map((label, i) => `${i + 1}. ${label}`).join(", ")}`)}`
          : "");
      return new Text(text, 0, 0);
    },
    renderResult(result, _options, theme) {
      const details = result.details as QuestionResult | undefined;
      if (!details) return new Text(result.content[0]?.text ?? "", 0, 0);
      if (details.answer === null) return new Text(theme.fg("warning", "Cancelled"), 0, 0);
      const prefix = details.wasCustom ? theme.fg("muted", "(wrote) ") : "";
      return new Text(
        `${theme.fg("success", "✓ ")}${prefix}${theme.fg("accent", String(details.answer))} (${keyHint("app.tools.expand", "to expand")})`,
        0,
        0,
      );
    },
  });
}
