import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { keyHint } from "@earendil-works/pi-coding-agent";
import { Text } from "@earendil-works/pi-tui";
import { errorResult } from "../core/validation.js";
import { QuestionInputParams } from "../schemas.js";
import type { QuestionInputResult } from "../types.js";
import { createTextInputWidget } from "../widgets/text-input-widget.js";

export function registerQuestionInputTool(pi: ExtensionAPI): void {
  pi.registerTool({
    name: "question_input",
    label: "Question Input",
    description:
      "Ask the user an open-ended question with free-form text input. Supports validation (min/max length, regex pattern, email, number). Use when you need a written answer, not a selection.",
    promptSnippet: "Ask the user an open-ended question with free-form text",
    promptGuidelines: [
      "Use question_input when you need a written answer, not a selection.",
      "Use question_input for free-form responses instead of question with allowOther.",
    ],
    parameters: QuestionInputParams,
    executionMode: "sequential",
    prepareArguments(args) {
      return args;
    },
    async execute(_id, params, _signal, _update, ctx) {
      if (ctx.mode !== "tui")
        return errorResult("Error: UI not available (running in non-interactive mode)", {
          question: params.question,
          answer: null,
        } as QuestionInputResult);
      const result = await ctx.ui.custom<{ answer: string } | null>(
        (tui, theme, _kb, done) =>
          createTextInputWidget(params, {
            tui,
            theme,
            keys: { escape: "escape" },
            editor: (tui as any).editor,
            done,
          }),
        { overlay: true },
      );
      if (!result)
        return errorResult("User cancelled the input", {
          question: params.question,
          answer: null,
        } as QuestionInputResult);
      return {
        content: [{ type: "text", text: `User answered: ${result.answer}` }],
        details: { question: params.question, answer: result.answer } as QuestionInputResult,
      };
    },
    renderCall(args, theme) {
      let text =
        theme.fg("toolTitle", theme.bold("question_input ")) + theme.fg("muted", args.question);
      if (args.placeholder) text += `\n${theme.fg("dim", `  Placeholder: ${args.placeholder}`)}`;
      return new Text(text, 0, 0);
    },
    renderResult(result, _options, theme) {
      const details = result.details as QuestionInputResult | undefined;
      if (!details) return new Text(result.content[0]?.text ?? "", 0, 0);
      if (details.answer === null) return new Text(theme.fg("warning", "Cancelled"), 0, 0);
      return new Text(
        `${theme.fg("success", "✓ ")}${theme.fg("accent", details.answer)} (${keyHint("app.tools.expand", "to expand")})`,
        0,
        0,
      );
    },
  });
}
