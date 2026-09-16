import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { keyHint } from "@earendil-works/pi-coding-agent";
import { Text } from "@earendil-works/pi-tui";
import { generateRatingOptions, generateYesNoOptions } from "../core/question-options.js";
import {
  normalizeQuestionnaireParams,
  validateQuestionnaire,
} from "../core/questionnaire-validation.js";
import { errorResult } from "../core/validation.js";
import { QuestionnaireParams } from "../schemas.js";
import type { DisplayOption, QuestionnaireResult } from "../types.js";
import { createQuestionnaireWidget } from "../widgets/questionnaire-widget.js";

export function registerQuestionnaireTool(pi: ExtensionAPI): void {
  pi.registerTool({
    name: "questionnaire",
    label: "Questionnaire",
    description:
      "Ask the user one or more questions in a tabbed wizard. Each question shows selectable options (plus custom text entry). Navigate between questions with Tab/arrow keys. Supports conditional branching, required/optional questions, and multiple selection types.",
    promptSnippet: "Ask the user a multi-step questionnaire wizard",
    promptGuidelines: [
      "Use questionnaire when you need structured information across multiple topics.",
      "Use individual question tools for simple single-decision scenarios.",
    ],
    parameters: QuestionnaireParams,
    executionMode: "sequential",
    prepareArguments(args) {
      return args;
    },
    async execute(_id, rawParams, _signal, _update, ctx) {
      const params = normalizeQuestionnaireParams(rawParams);
      const validation = validateQuestionnaire(params);
      if (validation.ok === false)
        return errorResult(validation.message, {
          questions: params.questions.map((q, i) => ({
            id: q.id,
            label: q.label || `Q${i + 1}`,
            prompt: q.prompt,
          })),
          answers: [],
          cancelled: true,
          error: validation.error,
        });
      const questionSummary = params.questions.map((q, i) => ({
        id: q.id,
        label: q.label || `Q${i + 1}`,
        prompt: q.prompt,
      }));
      if (ctx.mode !== "tui")
        return errorResult("Error: UI not available (running in non-interactive mode)", {
          questions: questionSummary,
          answers: [],
          cancelled: true,
        });
      if (params.questions.length === 0)
        return errorResult("Error: No questions provided", {
          questions: [],
          answers: [],
          cancelled: true,
        });
      const questions = params.questions.map((q, i) => ({
        id: q.id,
        label: q.label || `Q${i + 1}`,
        prompt: q.prompt,
        required: q.required !== false,
        autoAdvance: q.autoAdvance !== false,
        type: q.type,
        options: (q.type === "yes_no"
          ? generateYesNoOptions()
          : q.type === "rating"
            ? generateRatingOptions()
            : q.options
        )
          .map(
            (option): DisplayOption => ({ label: option.label, description: option.description }),
          )
          .concat(q.allowOther !== false ? [{ label: "Type something...", isOther: true }] : []),
      }));
      const result = await ctx.ui.custom<QuestionnaireResult>((tui, theme, _kb, done) =>
        createQuestionnaireWidget(
          { questions, isVisible: () => true },
          {
            tui,
            theme,
            keys: {
              up: "up",
              down: "down",
              enter: "enter",
              escape: "escape",
              tab: "tab",
              left: "left",
              right: "right",
            },
            done,
          },
        ),
      );
      if (result.cancelled)
        return {
          content: [{ type: "text", text: "User cancelled the questionnaire" }],
          details: result,
        };
      const lines = result.answers.map(
        (answer) =>
          `${answer.id}: ${answer.wasCustom ? `user wrote: ${answer.label}` : `user selected: ${answer.label}`}`,
      );
      return { content: [{ type: "text", text: lines.join("\n") }], details: result };
    },
    renderCall(args, theme) {
      const questions = (args.questions as Array<{ id: string; label?: string }>) || [];
      return new Text(
        theme.fg("toolTitle", theme.bold("questionnaire ")) +
          theme.fg("muted", `${questions.length} question${questions.length === 1 ? "" : "s"}`),
        0,
        0,
      );
    },
    renderResult(result, _options, theme) {
      const details = result.details as QuestionnaireResult | undefined;
      if (!details) return new Text(result.content[0]?.text ?? "", 0, 0);
      if (details.cancelled) return new Text(theme.fg("warning", "Cancelled"), 0, 0);
      return new Text(
        `${details.answers.map((a) => `${theme.fg("success", "✓ ")}${theme.fg("accent", a.id)}: ${a.label}`).join("\n")} (${keyHint("app.tools.expand", "to expand")})`,
        0,
        0,
      );
    },
  });
}
