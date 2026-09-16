import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { keyHint } from "@earendil-works/pi-coding-agent";
import { Text } from "@earendil-works/pi-tui";
import { _evaluateBranch } from "../core/branching.js";
import { generateRatingOptions, generateYesNoOptions } from "../core/question-options.js";
import {
  normalizeQuestionnaireParams,
  validateQuestionnaire,
} from "../core/questionnaire-validation.js";
import { errorResult } from "../core/validation.js";
import { QuestionBranchParams } from "../schemas.js";
import type { DisplayOption, QuestionBranchResult } from "../types.js";
import { createQuestionnaireWidget } from "../widgets/questionnaire-widget.js";

export function registerQuestionBranchTool(pi: ExtensionAPI): void {
  pi.registerTool({
    name: "question_branch",
    label: "Question Branch",
    description:
      "Multi-question wizard with advanced branching logic. Questions can be conditionally shown/hidden based on previous answers using operators like equals, contains, matches, in, is_empty, and more.",
    promptSnippet: "Ask a branching questionnaire wizard",
    promptGuidelines: [
      "Use question_branch for questionnaires with conditional logic.",
      "Use 'when' to show questions only when conditions are met.",
      "Use 'on: false' to always hide a question.",
    ],
    parameters: QuestionBranchParams,
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
          skipped: [],
          cancelled: true,
          error: validation.error,
        });
      const summary = params.questions.map((q, i) => ({
        id: q.id,
        label: q.label || `Q${i + 1}`,
        prompt: q.prompt,
      }));
      if (ctx.mode !== "tui")
        return errorResult("Error: UI not available (running in non-interactive mode)", {
          questions: summary,
          answers: [],
          skipped: [],
          cancelled: true,
        });
      if (params.questions.length === 0)
        return errorResult("Error: No questions provided", {
          questions: [],
          answers: [],
          skipped: [],
          cancelled: true,
        });
      const questions = params.questions.map((q, i) => ({
        id: q.id,
        label: q.label || `Q${i + 1}`,
        prompt: q.prompt,
        required: q.required !== false,
        autoAdvance: q.autoAdvance !== false,
        type: q.type,
        when: q.when,
        on: q.on,
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
      const skipped: string[] = [];
      const result = await ctx.ui.custom<{
        questions: QuestionBranchResult["questions"];
        answers: QuestionBranchResult["answers"];
        cancelled: boolean;
      }>((tui, theme, _kb, done) =>
        createQuestionnaireWidget(
          {
            questions,
            skipped,
            isVisible: (index, answers) => {
              const q = questions[index];
              if (q.on === false) return false;
              if (q.on === true || !q.when) return true;
              return _evaluateBranch(
                { when: q.when },
                new Map(
                  [...answers].map(([id, answer]) => [
                    id,
                    { value: answer.value, label: answer.label },
                  ]),
                ),
              );
            },
          },
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
            done: (value) => done({ ...value }),
          },
        ),
      );
      const details: QuestionBranchResult = { ...result, skipped };
      if (details.cancelled)
        return {
          content: [{ type: "text", text: "User cancelled the branching questionnaire" }],
          details,
        };
      return {
        content: [
          { type: "text", text: details.answers.map((a) => `${a.id}: ${a.label}`).join("\n") },
        ],
        details,
      };
    },
    renderCall(args, theme) {
      const questions =
        (args.questions as Array<{ id: string; label?: string; when?: unknown }>) || [];
      const branch = questions.some((q) => q.when !== undefined);
      return new Text(
        theme.fg("toolTitle", theme.bold("question_branch ")) +
          theme.fg("muted", `${questions.length} question${questions.length === 1 ? "" : "s"}`) +
          (branch ? theme.fg("dim", " (branching)") : ""),
        0,
        0,
      );
    },
    renderResult(result, _options, theme) {
      const details = result.details as QuestionBranchResult | undefined;
      if (!details) return new Text(result.content[0]?.text ?? "", 0, 0);
      if (details.cancelled) return new Text(theme.fg("warning", "Cancelled"), 0, 0);
      const skipped = details.skipped.length
        ? `\n${theme.fg("dim", `Skipped: ${details.skipped.join(", ")}`)}`
        : "";
      return new Text(
        `${details.answers.map((a) => `${theme.fg("success", "✓ ")}${theme.fg("accent", a.id)}: ${a.label}`).join("\n")}${skipped} (${keyHint("app.tools.expand", "to expand")})`,
        0,
        0,
      );
    },
  });
}
