/**
 * Questions Extension - A suite of tools for interactive user Q&A
 *
 * Provides three tools:
 *  - question       : Single question with selectable options (+ custom text)
 *  - questionnaire  : Multi-question wizard with tab navigation
 *  - question_input : Open-ended text input for free-form answers
 *
 * Usage: Call any tool from the LLM when user input is needed to proceed.
 *        The tools render full custom TUI interfaces.
 */

import { StringEnum } from "@earendil-works/pi-ai";
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { keyHint } from "@earendil-works/pi-coding-agent";
import {
  Editor,
  type EditorTheme,
  Key,
  matchesKey,
  Text,
  visibleWidth,
  wrapTextWithAnsi,
} from "@earendil-works/pi-tui";
import { Type } from "typebox";

// ─── Shared Types ───────────────────────────────────────────────────────────

interface QOption {
  label: string;
  description?: string;
}

type DisplayOption = QOption & {
  isOther?: boolean;
  value?: string;
  count?: number; // For multi-select
};

interface QuestionResult {
  question: string;
  options: string[];
  answer: string | string[] | null;
  wasCustom: boolean;
  index?: number;
  [key: string]: unknown;
}

interface QuestionnaireResult {
  questions: Array<{ id: string; label: string; prompt: string }>;
  answers: Array<{
    id: string;
    value: string | string[];
    label: string | string[];
    wasCustom: boolean;
    index?: number;
  }>;
  cancelled: boolean;
}

interface QuestionInputResult {
  question: string;
  answer: string | null;
  validationErrors?: string[];
  [key: string]: unknown;
}

interface QuestionThrottleResult {
  question: string;
  options: string[];
  answer: string | string[] | null;
  wasCustom: boolean;
  index?: number;
  throttled: boolean;
  [key: string]: unknown;
}

interface QuestionBranchResult {
  questions: Array<{ id: string; label: string; prompt: string }>;
  answers: Array<{
    id: string;
    value: string | string[];
    label: string | string[];
    wasCustom: boolean;
    index?: number;
  }>;
  skipped: string[];
  cancelled: boolean;
}

// ─── Schema Definitions ─────────────────────────────────────────────────────

const OptionSchema = Type.Object({
  label: Type.String({ description: "Display label for the option" }),
  description: Type.Optional(
    Type.String({ description: "Optional description shown below label" }),
  ),
});

const QuestionParams = Type.Object({
  question: Type.String({ description: "The question to ask the user" }),
  options: Type.Array(OptionSchema, {
    description: "Options for the user to choose from",
  }),
  allowOther: Type.Optional(
    Type.Boolean({ description: "Include 'Type something...' option (default: true)" }),
  ),
  type: Type.Optional(StringEnum(["single", "multi"] as const), {
    description: "Selection type: single or multiple (default: single)",
  }),
});

const QuestionnaireParams = Type.Object({
  questions: Type.Array(
    Type.Object({
      id: Type.String({
        description: 'Unique identifier, e.g. "primary_user", "core_differentiator"',
      }),
      label: Type.Optional(
        Type.String({
          description: "Short label for tab bar, e.g. 'Scope', 'Priority' (defaults to Q1, Q2...)",
        }),
      ),
      prompt: Type.String({
        description: "The full question text to display",
      }),
      options: Type.Array(OptionSchema, {
        description: "Available options to choose from",
      }),
      allowOther: Type.Optional(
        Type.Boolean({ description: "Allow 'Type something...' option (default: true)" }),
      ),
      required: Type.Optional(
        Type.Boolean({ description: "Whether this question must be answered (default: true)" }),
      ),
      autoAdvance: Type.Optional(
        Type.Boolean({
          description: "Auto-advance to next question after selection (default: true)",
        }),
      ),
      when: Type.Optional(
        Type.String({
          description: "Conditional visibility: expression like 'field_id equals value'",
        }),
      ),
      type: Type.Optional(StringEnum(["single", "multi", "yes_no", "rating"] as const), {
        description: "Question type: single, multi, yes_no, or rating (default: single)",
      }),
    }),
    { description: "Questions to ask the user in sequence" },
  ),
});

const QuestionInputParams = Type.Object({
  question: Type.String({
    description: "The question or prompt for the user to answer",
  }),
  placeholder: Type.Optional(
    Type.String({
      description: "Placeholder text shown in the input field",
    }),
  ),
  required: Type.Optional(
    Type.Boolean({ description: "Whether the answer must be non-empty (default: true)" }),
  ),
  minLength: Type.Optional(Type.Number({ description: "Minimum character count for the answer" })),
  maxLength: Type.Optional(Type.Number({ description: "Maximum character count for the answer" })),
  pattern: Type.Optional(Type.String({ description: "Regex pattern the answer must match" })),
  type: Type.Optional(StringEnum(["text", "number", "email", "date"] as const), {
    description: "Input type for validation (default: text)",
  }),
});

// ─── Throttle Schema ─────────────────────────────────────────────────────────

const QuestionThrottleParams = Type.Object({
  question: Type.String({ description: "The question to ask the user" }),
  options: Type.Array(OptionSchema, {
    description: "Options for the user to choose from",
  }),
  cooldown: Type.Optional(
    Type.Number({ description: "Minimum seconds between questions (default: 5)" }),
  ),
  allowOther: Type.Optional(
    Type.Boolean({ description: "Include 'Type something...' option (default: true)" }),
  ),
  type: Type.Optional(StringEnum(["single", "multi"] as const), {
    description: "Selection type: single or multiple (default: single)",
  }),
});

// ─── Branch Schema ───────────────────────────────────────────────────────────

const BranchConditionSchema = Type.String({
  description:
    "Condition expression like 'field_id equals value'. Also supports object { field, operator, value }",
});

const BranchSchema = Type.Object({
  when: Type.Optional(
    Type.String({
      description:
        "Condition(s): string 'field_id equals value'. Also supports object {field, operator, value} or array.",
    }),
  ),
  on: Type.Optional(
    Type.Boolean({ description: "If true, always show; if false, always hide (overrides when)" }),
  ),
});

const QuestionBranchParams = Type.Object({
  questions: Type.Array(
    Type.Object({
      id: Type.String({
        description: 'Unique identifier, e.g. "primary_user", "core_differentiator"',
      }),
      label: Type.Optional(
        Type.String({
          description: "Short label for tab bar, e.g. 'Scope', 'Priority' (defaults to Q1, Q2...)",
        }),
      ),
      prompt: Type.String({
        description: "The full question text to display",
      }),
      options: Type.Array(OptionSchema, {
        description: "Available options to choose from",
      }),
      allowOther: Type.Optional(
        Type.Boolean({ description: "Allow 'Type something...' option (default: true)" }),
      ),
      required: Type.Optional(
        Type.Boolean({ description: "Whether this question must be answered (default: true)" }),
      ),
      autoAdvance: Type.Optional(
        Type.Boolean({
          description: "Auto-advance to next question after selection (default: true)",
        }),
      ),
      branch: Type.Optional(BranchSchema, {
        description:
          "Conditional visibility: show/hide based on previous answers. Supports 'when' condition and 'on' override.",
      }),
      type: Type.Optional(StringEnum(["single", "multi", "yes_no", "rating"] as const), {
        description: "Question type: single, multi, yes_no, or rating (default: single)",
      }),
    }),
    { description: "Questions to ask the user in sequence" },
  ),
});

// ─── Helpers ────────────────────────────────────────────────────────────────

// Throttle: track last question timestamp globally
const lastQuestionTime = new Map<string, number>();

function checkThrottle(cooldown: number): { waited: boolean; elapsed: number } {
  const now = Date.now();
  const last = lastQuestionTime.get("__global__") ?? 0;
  const elapsed = (now - last) / 1000;
  if (elapsed < cooldown) {
    return { waited: true, elapsed };
  }
  lastQuestionTime.set("__global__", now);
  return { waited: false, elapsed };
}

function recordQuestionTime(): void {
  lastQuestionTime.set("__global__", Date.now());
}

// Branch evaluation
function evaluateBranch(
  branch: { when: string | { field: string; operator?: string; value?: unknown } | Array<string | { field: string; operator?: string; value?: unknown }>; on?: boolean },
  answers: Map<string, { value: string | string[]; label: string | string[] }>,
): boolean {
  // If 'on' is explicitly set, use it
  if (branch.on === false) return false;
  if (branch.on === true) return true;

  const conditions = Array.isArray(branch.when) ? branch.when : [branch.when];

  return conditions.every((cond) => {
    if (typeof cond === "string") {
      // Parse simple string: "field_id equals value"
      return evaluateSimpleCondition(cond, answers);
    }
    if (typeof cond === "object") {
      return evaluateComplexCondition(cond, answers);
    }
    return true;
  });
}

function evaluateSimpleCondition(expr: string, answers: Map<string, { value: string | string[] }>): boolean {
  // Parse: "field_id operator value"
  const match = expr.match(/^(.+?)\s+(equals|not_equals|contains|matches|in|is_empty|is_not_empty|gt|lt|gte|lte)\s+(.+)$/);
  if (!match) return true; // Invalid format, pass through

  const [, field, operator, value] = match;
  const answer = answers.get(field);

  if (answer === undefined) return false; // Field not answered yet

  const answerStr = Array.isArray(answer.value) ? answer.value.join(", ") : String(answer.value);

  switch (operator) {
    case "equals":
      return answerStr === value;
    case "not_equals":
      return answerStr !== value;
    case "contains":
      return answerStr.toLowerCase().includes(value.toLowerCase());
    case "matches":
      try {
        return new RegExp(value, "i").test(answerStr);
      } catch {
        return false;
      }
    case "in":
      return value.split(", ").map((v) => v.trim()).includes(answerStr);
    case "is_empty":
      return answerStr === "" || answerStr === "(no response)";
    case "is_not_empty":
      return answerStr !== "" && answerStr !== "(no response)";
    case "gt":
      return Number(answerStr) > Number(value);
    case "lt":
      return Number(answerStr) < Number(value);
    case "gte":
      return Number(answerStr) >= Number(value);
    case "lte":
      return Number(answerStr) <= Number(value);
    default:
      return true;
  }
}

function evaluateComplexCondition(
  cond: { field: string; operator?: string; value?: unknown },
  answers: Map<string, { value: string | string[] }>,
): boolean {
  const { field, operator = "equals", value } = cond;
  const answer = answers.get(field);

  if (answer === undefined) return false;

  const answerStr = Array.isArray(answer.value) ? answer.value.join(", ") : String(answer.value);

  switch (operator) {
    case "equals":
      return answerStr === String(value);
    case "not_equals":
      return answerStr !== String(value);
    case "contains":
      return answerStr.toLowerCase().includes(String(value).toLowerCase());
    case "matches":
      try {
        return new RegExp(String(value), "i").test(answerStr);
      } catch {
        return false;
      }
    case "in":
      if (Array.isArray(value)) {
        return value.map(String).includes(answerStr);
      }
      return false;
    case "is_empty":
      return answerStr === "" || answerStr === "(no response)";
    case "is_not_empty":
      return answerStr !== "" && answerStr !== "(no response)";
    case "gt":
      return Number(answerStr) > Number(value);
    case "lt":
      return Number(answerStr) < Number(value);
    case "gte":
      return Number(answerStr) >= Number(value);
    case "lte":
      return Number(answerStr) <= Number(value);
    default:
      return true;
  }
}

function errorResult(
  message: string,
  details?: Record<string, unknown>,
): {
  content: { type: "text"; text: string }[];
  details: Record<string, unknown>;
} {
  return {
    content: [{ type: "text", text: message }],
    details: details ?? {},
  };
}

function validateAnswer(
  value: string,
  minLength?: number,
  maxLength?: number,
  pattern?: string,
  inputType?: string,
): string[] {
  const errors: string[] = [];
  const trimmed = value.trim();

  if (minLength !== undefined && trimmed.length < minLength) {
    errors.push(`Answer must be at least ${minLength} characters (currently ${trimmed.length})`);
  }
  if (maxLength !== undefined && trimmed.length > maxLength) {
    errors.push(`Answer must be at most ${maxLength} characters (currently ${trimmed.length})`);
  }
  if (pattern) {
    const regex = new RegExp(pattern);
    if (!regex.test(trimmed)) {
      errors.push(`Answer doesn't match required pattern: ${pattern}`);
    }
  }
  if (inputType === "email" && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) {
    errors.push("Please enter a valid email address");
  }
  if (inputType === "number" && Number.isNaN(Number(trimmed))) {
    errors.push("Please enter a valid number");
  }

  return errors;
}

function formatPercentage(current: number, total: number): string {
  if (total === 0) return "0%";
  return `${Math.round((current / total) * 100)}%`;
}

function generateYesNoOptions(): Array<{ label: string; description?: string }> {
  return [
    { label: "Yes", description: "Confirm" },
    { label: "No", description: "Decline" },
  ];
}

function generateRatingOptions(): Array<{ label: string; description?: string }> {
  return [
    { label: "1", description: "Poor" },
    { label: "2", description: "Fair" },
    { label: "3", description: "Good" },
    { label: "4", description: "Very Good" },
    { label: "5", description: "Excellent" },
  ];
}

// ─── Tool 1: question (single question with options) ────────────────────────

function registerQuestionTool(pi: ExtensionAPI) {
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
      // Compatibility shim: fold legacy 'type' as string into current schema
      if (!args || typeof args !== "object") return args;
      const input = args as Record<string, unknown>;
      if (input.type !== undefined && typeof input.type !== "string") {
        return args;
      }
      return input;
    },

    async execute(_toolCallId, params, _signal, _onUpdate, ctx) {
      if (ctx.mode !== "tui") {
        return errorResult("Error: UI not available (running in non-interactive mode)", {
          question: params.question,
          options: params.options.map((o) => o.label),
          answer: null,
        });
      }
      if (params.options.length === 0) {
        return errorResult("Error: No options provided", {
          question: params.question,
          options: [],
          answer: null,
        });
      }

      const allowOther = params.allowOther !== false;
      const isMulti = params.type === "multi";
      const allOptions: DisplayOption[] = [
        ...params.options,
        ...(allowOther ? [{ label: "Type something...", isOther: true }] : []),
      ];

      const result = await ctx.ui.custom<{
        answer: string | string[];
        wasCustom: boolean;
        index?: number;
      } | null>((tui, theme, _kb, done) => {
        let optionIndex = 0;
        let editMode = false;
        let cachedLines: string[] | undefined;
        const selectedIndices = new Set<number>();
        let justToggled = false;
        let toggleTimeout: ReturnType<typeof setTimeout> | null = null;

        const editorTheme: EditorTheme = {
          borderColor: (s) => theme.fg("accent", s),
          selectList: {
            selectedPrefix: (t) => theme.fg("accent", t),
            selectedText: (t) => theme.fg("accent", t),
            description: (t) => theme.fg("muted", t),
            scrollInfo: (t) => theme.fg("dim", t),
            noMatch: (t) => theme.fg("warning", t),
          },
        };
        const editor = new Editor(tui, editorTheme);

        editor.onSubmit = (value) => {
          const trimmed = value.trim();
          if (trimmed) {
            done({ answer: trimmed, wasCustom: true });
          } else {
            editMode = false;
            editor.setText("");
            refresh();
          }
        };

        function refresh() {
          cachedLines = undefined;
          tui.requestRender();
        }

        function handleInput(data: string) {
          if (editMode) {
            if (matchesKey(data, Key.escape)) {
              editMode = false;
              editor.setText("");
              refresh();
              return;
            }
            editor.handleInput(data);
            refresh();
            return;
          }

          if (matchesKey(data, Key.up)) {
            optionIndex = Math.max(0, optionIndex - 1);
            refresh();
            return;
          }
          if (matchesKey(data, Key.down)) {
            optionIndex = Math.min(allOptions.length - 1, optionIndex + 1);
            refresh();
            return;
          }

          if (matchesKey(data, Key.enter)) {
            const selected = allOptions[optionIndex];
            if (selected.isOther) {
              editMode = true;
              refresh();
              return;
            }

            if (isMulti) {
              if (justToggled) {
                // Second Enter = submit
                if (selectedIndices.size > 0) {
                  done({
                    answer: Array.from(selectedIndices).map((i) => allOptions[i].label),
                    wasCustom: false,
                  });
                } else {
                  // Nothing selected, just move on
                  done(null);
                }
                return;
              }
              // First Enter = toggle
              if (selectedIndices.has(optionIndex)) {
                selectedIndices.delete(optionIndex);
              } else {
                selectedIndices.add(optionIndex);
              }
              justToggled = true;
              refresh();
              if (toggleTimeout) clearTimeout(toggleTimeout);
              toggleTimeout = setTimeout(() => {
                justToggled = false;
                toggleTimeout = null;
              }, 800);
              return;
            }

            done({
              answer: selected.label,
              wasCustom: false,
              index: optionIndex + 1,
            });
            return;
          }

          if (matchesKey(data, Key.escape)) {
            if (toggleTimeout) {
              clearTimeout(toggleTimeout);
              toggleTimeout = null;
            }
            if (isMulti && selectedIndices.size > 0) {
              done({
                answer: Array.from(selectedIndices).map((i) => allOptions[i].label),
                wasCustom: false,
              });
            } else {
              done(null);
            }
          }
        }

        function render(width: number): string[] {
          if (cachedLines) return cachedLines;

          const lines: string[] = [];
          const renderWidth = Math.max(1, width);

          function addWrapped(text: string) {
            lines.push(...wrapTextWithAnsi(text, renderWidth));
          }

          function addWrappedWithPrefix(prefix: string, text: string) {
            const prefixWidth = visibleWidth(prefix);
            if (prefixWidth >= renderWidth) {
              addWrapped(prefix + text);
              return;
            }
            const wrapped = wrapTextWithAnsi(text, renderWidth - prefixWidth);
            const continuationPrefix = " ".repeat(prefixWidth);
            for (let i = 0; i < wrapped.length; i++) {
              lines.push(`${i === 0 ? prefix : continuationPrefix}${wrapped[i]}`);
            }
          }

          lines.push(theme.fg("accent", "─".repeat(renderWidth)));
          addWrappedWithPrefix(" ", theme.fg("text", params.question));
          lines.push("");

          const _prefix = isMulti ? "[ ]" : "> ";
          const selectedPrefix = isMulti ? "[x]" : "> ";

          for (let i = 0; i < allOptions.length; i++) {
            const opt = allOptions[i];
            const selected = i === optionIndex;
            const isOther = opt.isOther === true;
            const label = `${i + 1}. ${opt.label}` + (isOther && editMode ? " ✎" : "");
            const color = selected || (isOther && editMode) ? "accent" : "text";

            addWrappedWithPrefix(
              selected ? theme.fg("accent", selectedPrefix) : "  ",
              theme.fg(color, label),
            );

            if (opt.description) {
              addWrappedWithPrefix("     ", theme.fg("muted", opt.description));
            }
          }

          if (isMulti && selectedIndices.size > 0) {
            lines.push("");
            addWrappedWithPrefix(
              " ",
              theme.fg(
                "muted",
                `Selected: ${Array.from(selectedIndices)
                  .map((i) => allOptions[i].label)
                  .join(", ")}`,
              ),
            );
          }

          if (editMode) {
            lines.push("");
            addWrappedWithPrefix(" ", theme.fg("muted", "Your answer:"));
            for (const line of editor.render(Math.max(1, renderWidth - 2))) {
              lines.push(` ${line}`);
            }
          }

          lines.push("");
          if (editMode) {
            addWrappedWithPrefix(" ", theme.fg("dim", "Enter to submit • Esc to go back"));
          } else if (isMulti) {
            if (justToggled) {
              addWrappedWithPrefix(
                " ",
                theme.fg("accent", "↑↓ navigate • Enter to submit • Esc to submit selected"),
              );
            } else if (selectedIndices.size > 0) {
              addWrappedWithPrefix(
                " ",
                theme.fg("dim", "↑↓ navigate • Enter toggle • Enter submit • Esc submit selected"),
              );
            } else {
              addWrappedWithPrefix(
                " ",
                theme.fg("dim", "↑↓ navigate • Enter toggle • Esc cancel"),
              );
            }
          } else {
            addWrappedWithPrefix(
              " ",
              theme.fg("dim", "↑↓ navigate • Enter to select • Esc to cancel"),
            );
          }
          lines.push(theme.fg("accent", "─".repeat(renderWidth)));

          cachedLines = lines;
          return lines;
        }

        return {
          render,
          invalidate: () => {
            cachedLines = undefined;
          },
          handleInput,
        };
      });

      const simpleOptions = params.options.map((o) => o.label);

      if (!result) {
        return errorResult("User cancelled the selection", {
          question: params.question,
          options: simpleOptions,
          answer: null,
          wasCustom: false,
        } as QuestionResult);
      }

      if (result.wasCustom) {
        return {
          content: [
            {
              type: "text",
              text: `User wrote: ${result.answer}`,
            },
          ],
          details: {
            question: params.question,
            options: simpleOptions,
            answer: result.answer,
            wasCustom: true,
          } as QuestionResult,
        };
      }

      return {
        content: [
          {
            type: "text",
            text:
              isMulti && Array.isArray(result.answer)
                ? `User selected: ${result.answer.join(", ")}`
                : `User selected: ${result.index}. ${result.answer}`,
          },
        ],
        details: {
          question: params.question,
          options: simpleOptions,
          answer: result.answer,
          wasCustom: false,
          index: result.index,
        } as QuestionResult,
      };
    },

    renderCall(args, theme, _context) {
      let text = theme.fg("toolTitle", theme.bold("question ")) + theme.fg("muted", args.question);
      const opts = Array.isArray(args.options) ? args.options : [];
      if (opts.length) {
        const labels = opts.map((o: QOption) => o.label);
        const showOther = args.allowOther !== false;
        const numbered = showOther
          ? [...labels, "Type something..."].map((o, i) => `${i + 1}. ${o}`)
          : labels.map((o, i) => `${i + 1}. ${o}`);
        text += `\n${theme.fg("dim", `  Options: ${numbered.join(", ")}`)}`;
      }
      return new Text(text, 0, 0);
    },

    renderResult(result, _options, theme, _context) {
      const details = result.details as QuestionResult | undefined;
      if (!details) {
        const text = result.content[0];
        return new Text(text?.type === "text" ? text.text : "", 0, 0);
      }

      if (details.answer === null) {
        return new Text(theme.fg("warning", "Cancelled"), 0, 0);
      }

      if (details.wasCustom) {
        let text =
          theme.fg("success", "✓ ") +
          theme.fg("muted", "(wrote) ") +
          theme.fg("accent", String(details.answer));
        text += ` (${keyHint("app.tools.expand", "to expand")})`;
        return new Text(text, 0, 0);
      }
      let text = theme.fg("success", "✓ ") + theme.fg("accent", String(details.answer));
      text += ` (${keyHint("app.tools.expand", "to expand")})`;
      return new Text(text, 0, 0);
    },
  });
}

// ─── Tool 2: questionnaire (multi-question wizard) ──────────────────────────

function registerQuestionnaireTool(pi: ExtensionAPI) {
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
      // Compatibility shim: handle older questionnaire schemas
      if (!args || typeof args !== "object") return args;
      const input = args as Record<string, unknown>;
      if (Array.isArray(input.questions)) {
        return input;
      }
      return args;
    },

    async execute(_toolCallId, params, _signal, _onUpdate, ctx) {
      if (ctx.mode !== "tui") {
        return errorResult("Error: UI not available (running in non-interactive mode)", {
          questions: params.questions.map((q) => ({
            id: q.id,
            label: q.label,
            prompt: q.prompt,
          })),
          answers: [],
          cancelled: true,
        });
      }
      if (params.questions.length === 0) {
        return errorResult("Error: No questions provided", {
          questions: [],
          answers: [],
          cancelled: true,
        });
      }

      // Process questions: apply defaults, generate options for special types
      const questions = params.questions.map((q, i) => {
        const base = {
          ...q,
          label: q.label || `Q${i + 1}`,
          allowOther: q.allowOther !== false,
          required: q.required !== false,
          autoAdvance: q.autoAdvance !== false,
        };

        // Generate options for special question types
        if (base.type === "yes_no") {
          return { ...base, options: generateYesNoOptions() };
        }
        if (base.type === "rating") {
          return { ...base, options: generateRatingOptions() };
        }

        return base;
      });

      const isMulti = questions.length > 1;
      const totalTabs = questions.length + 1;

      const result = await ctx.ui.custom<QuestionnaireResult>((tui, theme, _kb, done) => {
        let currentTab = 0;
        let optionIndex = 0;
        let inputMode = false;
        let inputQuestionId: string | null = null;
        let cachedLines: string[] | undefined;
        const answers = new Map<string, QuestionnaireResult["answers"][number]>();
        const selectedIndices = new Set<number>();

        const editorTheme: EditorTheme = {
          borderColor: (s) => theme.fg("accent", s),
          selectList: {
            selectedPrefix: (t) => theme.fg("accent", t),
            selectedText: (t) => theme.fg("accent", t),
            description: (t) => theme.fg("muted", t),
            scrollInfo: (t) => theme.fg("dim", t),
            noMatch: (t) => theme.fg("warning", t),
          },
        };
        const editor = new Editor(tui, editorTheme);

        function refresh() {
          cachedLines = undefined;
          tui.requestRender();
        }

        function submit(cancelled: boolean) {
          done({
            questions: questions.map((q) => ({
              id: q.id,
              label: q.label,
              prompt: q.prompt,
            })),
            answers: Array.from(answers.values()),
            cancelled,
          });
        }

        function currentQuestion() {
          return questions[currentTab];
        }

        function currentOptions(): DisplayOption[] {
          const q = currentQuestion();
          if (!q) return [];
          const opts: DisplayOption[] = q.options.map((o) => ({
            label: o.label,
            description: o.description,
          }));
          if (q.allowOther) {
            opts.push({
              label: "Type something...",
              isOther: true,
            });
          }
          return opts;
        }

        function allRequiredAnswered(): boolean {
          return questions.every((q) => !q.required || answers.has(q.id));
        }

        function advanceAfterAnswer() {
          selectedIndices.clear();
          if (!isMulti) {
            submit(false);
            return;
          }
          // Find next unanswered question
          if (currentTab < questions.length - 1) {
            currentTab++;
          } else {
            currentTab = questions.length;
          }
          optionIndex = 0;
          refresh();
        }

        function saveAnswer(
          questionId: string,
          value: string | string[],
          label: string | string[],
          wasCustom: boolean,
          index?: number,
        ) {
          answers.set(questionId, {
            id: questionId,
            value,
            label,
            wasCustom,
            index,
          });
        }

        editor.onSubmit = (value) => {
          if (!inputQuestionId) return;
          const trimmed = value.trim() || "(no response)";
          saveAnswer(inputQuestionId, trimmed, trimmed, true);
          inputMode = false;
          inputQuestionId = null;
          editor.setText("");
          advanceAfterAnswer();
        };

        function handleInput(data: string) {
          if (inputMode) {
            if (matchesKey(data, Key.escape)) {
              inputMode = false;
              inputQuestionId = null;
              editor.setText("");
              refresh();
              return;
            }
            editor.handleInput(data);
            refresh();
            return;
          }

          const q = currentQuestion();
          const opts = currentOptions();

          if (isMulti) {
            if (matchesKey(data, Key.tab) || matchesKey(data, Key.right)) {
              currentTab = (currentTab + 1) % totalTabs;
              optionIndex = 0;
              refresh();
              return;
            }
            if (matchesKey(data, Key.shift("tab")) || matchesKey(data, Key.left)) {
              currentTab = (currentTab - 1 + totalTabs) % totalTabs;
              optionIndex = 0;
              refresh();
              return;
            }
          }

          if (currentTab === questions.length) {
            if (matchesKey(data, Key.enter) && allRequiredAnswered()) {
              submit(false);
            } else if (matchesKey(data, Key.escape)) {
              submit(true);
            }
            return;
          }

          if (matchesKey(data, Key.up)) {
            optionIndex = Math.max(0, optionIndex - 1);
            refresh();
            return;
          }
          if (matchesKey(data, Key.down)) {
            optionIndex = Math.min(opts.length - 1, optionIndex + 1);
            refresh();
            return;
          }

          if (matchesKey(data, Key.enter) && q) {
            const opt = opts[optionIndex];
            if (opt.isOther) {
              inputMode = true;
              inputQuestionId = q.id;
              editor.setText("");
              refresh();
              return;
            }

            const isMultiSelect = q.type === "multi";

            if (isMultiSelect) {
              if (selectedIndices.has(optionIndex)) {
                selectedIndices.delete(optionIndex);
              } else {
                selectedIndices.add(optionIndex);
              }
              refresh();
              return;
            }

            // Single select
            saveAnswer(q.id, opt.label, opt.label, false, optionIndex + 1);

            if (q.autoAdvance !== false) {
              advanceAfterAnswer();
            } else {
              optionIndex = 0;
              refresh();
            }
            return;
          }

          if (matchesKey(data, Key.escape)) {
            submit(true);
          }
        }

        function render(width: number): string[] {
          if (cachedLines) return cachedLines;

          const lines: string[] = [];
          const renderWidth = Math.max(1, width);
          const q = currentQuestion();
          const opts = currentOptions();

          function addWrapped(text: string) {
            lines.push(...wrapTextWithAnsi(text, renderWidth));
          }

          function addWrappedWithPrefix(prefix: string, text: string) {
            const prefixWidth = visibleWidth(prefix);
            if (prefixWidth >= renderWidth) {
              addWrapped(prefix + text);
              return;
            }
            const wrapped = wrapTextWithAnsi(text, renderWidth - prefixWidth);
            const continuationPrefix = " ".repeat(prefixWidth);
            for (let i = 0; i < wrapped.length; i++) {
              lines.push(`${i === 0 ? prefix : continuationPrefix}${wrapped[i]}`);
            }
          }

          lines.push(theme.fg("accent", "─".repeat(renderWidth)));

          if (isMulti) {
            const answeredCount = questions.filter((q) => answers.has(q.id)).length;
            const percentage = formatPercentage(answeredCount, questions.length);

            // Progress bar
            const barWidth = Math.min(20, Math.floor(renderWidth / 4));
            const filled = Math.round((answeredCount / questions.length) * barWidth);
            const bar = "█".repeat(filled) + "░".repeat(barWidth - filled);
            const progressText = ` ${theme.fg("accent", bar)} ${percentage} (${answeredCount}/${questions.length})`;
            addWrappedWithPrefix(" ", progressText);
            lines.push("");

            const tabs: string[] = ["← "];
            for (let i = 0; i < questions.length; i++) {
              const isActive = i === currentTab;
              const isAnswered = answers.has(questions[i].id);
              const lbl = questions[i].label;
              const box = isAnswered ? "■" : "□";
              const color = isAnswered ? "success" : "muted";
              const text = ` ${box} ${lbl} `;
              const styled = isActive
                ? theme.bg("selectedBg", theme.fg("text", text))
                : theme.fg(color, text);
              tabs.push(`${styled} `);
            }
            const canSubmit = allRequiredAnswered();
            const isSubmitTab = currentTab === questions.length;
            const submitText = " ✓ Submit ";
            const submitStyled = isSubmitTab
              ? theme.bg("selectedBg", theme.fg("text", submitText))
              : theme.fg(canSubmit ? "success" : "dim", submitText);
            tabs.push(`${submitStyled} →`);
            addWrappedWithPrefix(" ", tabs.join(""));
            lines.push("");
          }

          function renderOptions() {
            for (let i = 0; i < opts.length; i++) {
              const opt = opts[i];
              const selected = i === optionIndex;
              const isOther = opt.isOther === true;
              const prefix = selected ? theme.fg("accent", "> ") : "  ";
              const label = `${i + 1}. ${opt.label}` + (isOther && inputMode ? " ✎" : "");
              const color = selected || (isOther && inputMode) ? "accent" : "text";

              addWrappedWithPrefix(prefix, theme.fg(color, label));
              if (opt.description) {
                addWrappedWithPrefix("     ", theme.fg("muted", opt.description));
              }
            }
          }

          if (inputMode && q) {
            addWrappedWithPrefix(" ", theme.fg("text", q.prompt));
            lines.push("");
            renderOptions();
            lines.push("");
            addWrappedWithPrefix(" ", theme.fg("muted", "Your answer:"));
            for (const line of editor.render(Math.max(1, renderWidth - 2))) {
              lines.push(` ${line}`);
            }
            lines.push("");
            addWrappedWithPrefix(" ", theme.fg("dim", "Enter to submit • Esc to cancel"));
          } else if (currentTab === questions.length) {
            addWrappedWithPrefix(" ", theme.fg("accent", theme.bold("Ready to submit")));
            lines.push("");
            for (const question of questions) {
              const answer = answers.get(question.id);
              if (answer) {
                const prefix = answer.wasCustom ? "(wrote) " : "";
                const summary = `${theme.fg("muted", `${question.label}: `)}${theme.fg("text", prefix + String(answer.label))}`;
                addWrappedWithPrefix(" ", summary);
              }
            }
            lines.push("");
            if (allRequiredAnswered()) {
              addWrappedWithPrefix(" ", theme.fg("success", "Press Enter to submit"));
            } else {
              const missing = questions
                .filter((q) => q.required && !answers.has(q.id))
                .map((q) => q.label)
                .join(", ");
              if (missing) {
                addWrappedWithPrefix(" ", theme.fg("warning", `Unanswered: ${missing}`));
              }
            }
          } else if (q) {
            addWrappedWithPrefix(" ", theme.fg("text", q.prompt));
            lines.push("");
            renderOptions();

            // Show selected items for multi-select
            if (q.type === "multi" && selectedIndices.size > 0) {
              lines.push("");
              addWrappedWithPrefix(
                " ",
                theme.fg(
                  "muted",
                  `Selected: ${Array.from(selectedIndices)
                    .map((i) => opts[i].label)
                    .join(", ")}`,
                ),
              );
            }
          }

          lines.push("");
          if (!inputMode) {
            const help = isMulti
              ? "Tab/←→ navigate • ↑↓ select • Enter confirm • Esc cancel"
              : "↑↓ navigate • Enter select • Esc cancel";
            addWrappedWithPrefix(" ", theme.fg("dim", help));
          }
          lines.push(theme.fg("accent", "─".repeat(renderWidth)));

          cachedLines = lines;
          return lines;
        }

        return {
          render,
          invalidate: () => {
            cachedLines = undefined;
          },
          handleInput,
        };
      });

      if (result.cancelled) {
        return {
          content: [
            {
              type: "text",
              text: "User cancelled the questionnaire",
            },
          ],
          details: result,
        };
      }

      const answerLines = result.answers.map((a) => {
        const qLabel = questions.find((q) => q.id === a.id)?.label || a.id;
        if (a.wasCustom) {
          return `${qLabel}: user wrote: ${a.label}`;
        }
        const display = a.index ? `${a.index}. ${a.label}` : a.label;
        return `${qLabel}: user selected: ${display}`;
      });

      return {
        content: [{ type: "text", text: answerLines.join("\n") }],
        details: result,
      };
    },

    renderCall(args, theme, _context) {
      const qs = (args.questions as Array<{ id: string; label?: string; prompt: string }>) || [];
      const count = qs.length;
      const labels = qs.map((q) => q.label || q.id).join(", ");
      let text =
        theme.fg("toolTitle", theme.bold("questionnaire ")) +
        theme.fg("muted", `${count} question${count !== 1 ? "s" : ""}`);
      if (labels) {
        text += theme.fg("dim", ` (${labels})`);
      }
      return new Text(text, 0, 0);
    },

    renderResult(result, _options, theme, _context) {
      const details = result.details as QuestionnaireResult | undefined;
      if (!details) {
        const text = result.content[0];
        return new Text(text?.type === "text" ? text.text : "", 0, 0);
      }
      if (details.cancelled) {
        return new Text(theme.fg("warning", "Cancelled"), 0, 0);
      }
      const lines = details.answers.map((a) => {
        if (a.wasCustom) {
          return `${theme.fg("success", "✓ ")}${theme.fg("accent", a.id)}: ${theme.fg("muted", "(wrote) ")}${a.label}`;
        }
        const display = a.index ? `${a.index}. ${a.label}` : a.label;
        return `${theme.fg("success", "✓ ")}${theme.fg("accent", a.id)}: ${display}`;
      });
      let text = lines.join("\n");
      text += ` (${keyHint("app.tools.expand", "to expand")})`;
      return new Text(text, 0, 0);
    },
  });
}

// ─── Tool 3: question_input (open-ended text input) ─────────────────────────

function registerQuestionInputTool(pi: ExtensionAPI) {
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
      // Compatibility shim: handle older input schemas
      if (!args || typeof args !== "object") return args;
      const input = args as Record<string, unknown>;
      if (typeof input.question === "string") {
        return input;
      }
      return args;
    },

    async execute(_toolCallId, params, _signal, _onUpdate, ctx) {
      if (ctx.mode !== "tui") {
        return errorResult("Error: UI not available (running in non-interactive mode)", {
          question: params.question,
          answer: null,
        } as QuestionInputResult);
      }

      const result = await ctx.ui.custom<{ answer: string; validationErrors?: string[] } | null>(
        (tui, theme, _kb, done) => {
          let cachedLines: string[] | undefined;
          let validationErrors: string[] = [];

          const editorTheme: EditorTheme = {
            borderColor: (s) => theme.fg("accent", s),
            selectList: {
              selectedPrefix: (t) => theme.fg("accent", t),
              selectedText: (t) => theme.fg("accent", t),
              description: (t) => theme.fg("muted", t),
              scrollInfo: (t) => theme.fg("dim", t),
              noMatch: (t) => theme.fg("warning", t),
            },
          };
          const editor = new Editor(tui, editorTheme);

          editor.onSubmit = (value) => {
            const trimmed = value.trim();
            const errors = validateAnswer(
              trimmed,
              params.minLength,
              params.maxLength,
              params.pattern,
              params.type,
            );

            if (errors.length > 0) {
              validationErrors = errors;
              refresh();
              return;
            }

            if (trimmed || !params.required) {
              done({ answer: trimmed, validationErrors: errors.length > 0 ? errors : undefined });
            }
          };

          function refresh() {
            cachedLines = undefined;
            tui.requestRender();
          }

          function handleInput(data: string) {
            if (matchesKey(data, Key.escape)) {
              done(null);
              return;
            }
            editor.handleInput(data);
            refresh();
          }

          function render(width: number): string[] {
            if (cachedLines) return cachedLines;

            const lines: string[] = [];
            const renderWidth = Math.max(1, width);

            function addWrapped(text: string) {
              lines.push(...wrapTextWithAnsi(text, renderWidth));
            }

            function addWrappedWithPrefix(prefix: string, text: string) {
              const prefixWidth = visibleWidth(prefix);
              if (prefixWidth >= renderWidth) {
                addWrapped(prefix + text);
                return;
              }
              const wrapped = wrapTextWithAnsi(text, renderWidth - prefixWidth);
              const continuationPrefix = " ".repeat(prefixWidth);
              for (let i = 0; i < wrapped.length; i++) {
                lines.push(`${i === 0 ? prefix : continuationPrefix}${wrapped[i]}`);
              }
            }

            lines.push(theme.fg("accent", "─".repeat(renderWidth)));
            addWrappedWithPrefix(" ", theme.fg("text", params.question));
            lines.push("");

            // Show validation info
            const currentText = editor.getText().trim();
            const charCount = currentText.length;
            const infoParts: string[] = [];
            if (params.minLength !== undefined || params.maxLength !== undefined) {
              infoParts.push(`${charCount}/${params.maxLength ?? "∞"}`);
            }
            if (params.type) {
              infoParts.push(`type: ${params.type}`);
            }
            if (infoParts.length > 0) {
              addWrappedWithPrefix(" ", theme.fg("dim", infoParts.join(" • ")));
              lines.push("");
            }

            if (params.placeholder) {
              addWrappedWithPrefix(" ", theme.fg("dim", params.placeholder));
              lines.push("");
            }

            addWrappedWithPrefix(" ", theme.fg("muted", "Your answer:"));
            for (const line of editor.render(Math.max(1, renderWidth - 2))) {
              lines.push(` ${line}`);
            }

            // Show validation errors
            if (validationErrors.length > 0) {
              lines.push("");
              for (const err of validationErrors) {
                addWrappedWithPrefix(" ", theme.fg("warning", `⚠ ${err}`));
              }
            }

            lines.push("");
            addWrappedWithPrefix(" ", theme.fg("dim", "Enter to submit • Esc to cancel"));
            lines.push(theme.fg("accent", "─".repeat(renderWidth)));

            cachedLines = lines;
            return lines;
          }

          return {
            render,
            invalidate: () => {
              cachedLines = undefined;
            },
            handleInput,
          };
        },
        {
          overlay: true, // Render as floating modal overlay
        },
      );

      if (!result) {
        return errorResult("User cancelled the input", {
          question: params.question,
          answer: null,
        } as QuestionInputResult);
      }

      return {
        content: [
          {
            type: "text",
            text: `User answered: ${result.answer}`,
          },
        ],
        details: {
          question: params.question,
          answer: result.answer,
          validationErrors:
            result.validationErrors && result.validationErrors.length > 0
              ? result.validationErrors
              : undefined,
        } as QuestionInputResult,
      };
    },

    renderCall(args, theme, _context) {
      let text =
        theme.fg("toolTitle", theme.bold("question_input ")) + theme.fg("muted", args.question);
      if (args.placeholder) {
        text += `\n${theme.fg("dim", `  Placeholder: ${args.placeholder}`)}`;
      }
      const validations = [];
      if (args.minLength !== undefined) validations.push(`min: ${args.minLength}`);
      if (args.maxLength !== undefined) validations.push(`max: ${args.maxLength}`);
      if (args.pattern) validations.push(`pattern: ${args.pattern}`);
      if (args.type) validations.push(`type: ${args.type}`);
      if (validations.length > 0) {
        text += `\n${theme.fg("dim", `  Validation: ${validations.join(", ")}`)}`;
      }
      return new Text(text, 0, 0);
    },

    renderResult(result, _options, theme, _context) {
      const details = result.details as QuestionInputResult | undefined;
      if (!details) {
        const text = result.content[0];
        return new Text(text?.type === "text" ? text.text : "", 0, 0);
      }

      if (details.answer === null) {
        return new Text(theme.fg("warning", "Cancelled"), 0, 0);
      }

      let text = theme.fg("success", "✓ ") + theme.fg("accent", details.answer);
      text += ` (${keyHint("app.tools.expand", "to expand")})`;
      return new Text(text, 0, 0);
    },
  });
}

// ─── Tool 4: question_throttle (rate-limited questions) ─────────────────────

function registerQuestionThrottleTool(pi: ExtensionAPI) {
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

    async execute(_toolCallId, params, _signal, _onUpdate, ctx) {
      if (ctx.mode !== "tui") {
        return errorResult("Error: UI not available (running in non-interactive mode)", {
          question: params.question,
          options: params.options.map((o) => o.label),
          answer: null,
          throttled: false,
        });
      }

      const cooldown = params.cooldown ?? 5;
      const throttleCheck = checkThrottle(cooldown);

      // Brief wait message if throttled
      if (throttleCheck.waited) {
        const remaining = Math.ceil(cooldown - throttleCheck.elapsed);
        // Wait silently - the cooldown ensures spacing
        await new Promise((r) => setTimeout(r, (remaining + 0.5) * 1000));
      }

      recordQuestionTime();

      // Reuse the question tool's UI by calling it directly
      const questionResult = await ctx.ui.custom<{
        answer: string | string[];
        wasCustom: boolean;
        index?: number;
      } | null>((tui, theme, _kb, done) => {
        let optionIndex = 0;
        let editMode = false;
        let cachedLines: string[] | undefined;
        const selectedIndices = new Set<number>();
        let justToggled = false;
        let toggleTimeout: ReturnType<typeof setTimeout> | null = null;
        const isMulti = params.type === "multi";
        const allOptions = [...params.options, ...(params.allowOther !== false ? [{ label: "Type something...", isOther: true }] : [])];

        const editorTheme: EditorTheme = {
          borderColor: (s) => theme.fg("accent", s),
          selectList: {
            selectedPrefix: (t) => theme.fg("accent", t),
            selectedText: (t) => theme.fg("accent", t),
            description: (t) => theme.fg("muted", t),
            scrollInfo: (t) => theme.fg("dim", t),
            noMatch: (t) => theme.fg("warning", t),
          },
        };
        const editor = new Editor(tui, editorTheme);

        editor.onSubmit = (value) => {
          const trimmed = value.trim();
          if (trimmed) {
            done({ answer: trimmed, wasCustom: true });
          } else {
            editMode = false;
            editor.setText("");
            refresh();
          }
        };

        function refresh() {
          cachedLines = undefined;
          tui.requestRender();
        }

        function handleInput(data: string) {
          if (editMode) {
            if (matchesKey(data, Key.escape)) {
              editMode = false;
              editor.setText("");
              refresh();
              return;
            }
            editor.handleInput(data);
            refresh();
            return;
          }

          if (matchesKey(data, Key.up)) {
            optionIndex = Math.max(0, optionIndex - 1);
            refresh();
            return;
          }
          if (matchesKey(data, Key.down)) {
            optionIndex = Math.min(params.options.length - 1, optionIndex + 1);
            refresh();
            return;
          }

          if (matchesKey(data, Key.enter)) {
            const selected = allOptions[optionIndex];
            if (selected.isOther) {
              editMode = true;
              refresh();
              return;
            }

            if (isMulti) {
              if (justToggled) {
                if (selectedIndices.size > 0) {
                  done({
                    answer: Array.from(selectedIndices).map((i) => allOptions[i].label),
                    wasCustom: false,
                  });
                } else {
                  done(null);
                }
                return;
              }
              if (selectedIndices.has(optionIndex)) {
                selectedIndices.delete(optionIndex);
              } else {
                selectedIndices.add(optionIndex);
              }
              justToggled = true;
              refresh();
              if (toggleTimeout) clearTimeout(toggleTimeout);
              toggleTimeout = setTimeout(() => {
                justToggled = false;
                toggleTimeout = null;
              }, 800);
              return;
            }

            done({
              answer: selected.label,
              wasCustom: false,
              index: optionIndex + 1,
            });
            return;
          }

          if (matchesKey(data, Key.escape)) {
            if (toggleTimeout) {
              clearTimeout(toggleTimeout);
              toggleTimeout = null;
            }
            if (isMulti && selectedIndices.size > 0) {
              done({
                answer: Array.from(selectedIndices).map((i) => allOptions[i].label),
                wasCustom: false,
              });
            } else {
              done(null);
            }
          }
        }

        function render(width: number): string[] {
          if (cachedLines) return cachedLines;

          const lines: string[] = [];
          const renderWidth = Math.max(1, width);

          function addWrapped(text: string) {
            lines.push(...wrapTextWithAnsi(text, renderWidth));
          }

          function addWrappedWithPrefix(prefix: string, text: string) {
            const prefixWidth = visibleWidth(prefix);
            if (prefixWidth >= renderWidth) {
              addWrapped(prefix + text);
              return;
            }
            const wrapped = wrapTextWithAnsi(text, renderWidth - prefixWidth);
            const continuationPrefix = " ".repeat(prefixWidth);
            for (let i = 0; i < wrapped.length; i++) {
              lines.push(`${i === 0 ? prefix : continuationPrefix}${wrapped[i]}`);
            }
          }

          lines.push(theme.fg("accent", "─".repeat(renderWidth)));
          addWrappedWithPrefix(" ", theme.fg("text", params.question));
          lines.push("");

          const _prefix = isMulti ? "[ ]" : "> ";
          const selectedPrefix = isMulti ? "[x]" : "> ";

          for (let i = 0; i < allOptions.length; i++) {
            const opt = allOptions[i];
            const selected = i === optionIndex;
            const isOther = opt.isOther === true;
            const label = `${i + 1}. ${opt.label}` + (isOther && editMode ? " ✎" : "");
            const color = selected || (isOther && editMode) ? "accent" : "text";

            addWrappedWithPrefix(
              selected ? theme.fg("accent", selectedPrefix) : "  ",
              theme.fg(color, label),
            );

            if (opt.description) {
              addWrappedWithPrefix("     ", theme.fg("muted", opt.description));
            }
          }

          if (isMulti && selectedIndices.size > 0) {
            lines.push("");
            addWrappedWithPrefix(
              " ",
              theme.fg(
                "muted",
                `Selected: ${Array.from(selectedIndices)
                  .map((i) => allOptions[i].label)
                  .join(", ")}`,
              ),
            );
          }

          if (editMode) {
            lines.push("");
            addWrappedWithPrefix(" ", theme.fg("muted", "Your answer:"));
            for (const line of editor.render(Math.max(1, renderWidth - 2))) {
              lines.push(` ${line}`);
            }
          }

          lines.push("");
          if (editMode) {
            addWrappedWithPrefix(" ", theme.fg("dim", "Enter to submit • Esc to go back"));
          } else if (isMulti) {
            if (justToggled) {
              addWrappedWithPrefix(
                " ",
                theme.fg("accent", "↑↓ navigate • Enter to submit • Esc to submit selected"),
              );
            } else if (selectedIndices.size > 0) {
              addWrappedWithPrefix(
                " ",
                theme.fg("dim", "↑↓ navigate • Enter toggle • Enter submit • Esc submit selected"),
              );
            } else {
              addWrappedWithPrefix(
                " ",
                theme.fg("dim", "↑↓ navigate • Enter toggle • Esc cancel"),
              );
            }
          } else {
            addWrappedWithPrefix(
              " ",
              theme.fg("dim", "↑↓ navigate • Enter to select • Esc to cancel"),
            );
          }
          lines.push(theme.fg("accent", "─".repeat(renderWidth)));

          cachedLines = lines;
          return lines;
        }

        return {
          render,
          invalidate: () => {
            cachedLines = undefined;
          },
          handleInput,
        };
      });

      const simpleOptions = params.options.map((o) => o.label);

      if (!questionResult) {
        return errorResult("User cancelled the selection", {
          question: params.question,
          options: simpleOptions,
          answer: null,
          wasCustom: false,
          throttled: throttleCheck.waited,
        });
      }

      if (questionResult.wasCustom) {
        return {
          content: [
            {
              type: "text",
              text: `User wrote: ${questionResult.answer}`,
            },
          ],
          details: {
            question: params.question,
            options: simpleOptions,
            answer: questionResult.answer,
            wasCustom: true,
            throttled: throttleCheck.waited,
          },
        };
      }

      return {
        content: [
          {
            type: "text",
            text: `User selected: ${questionResult.index}. ${questionResult.answer}`,
          },
        ],
        details: {
          question: params.question,
          options: simpleOptions,
          answer: questionResult.answer,
          wasCustom: false,
          index: questionResult.index,
          throttled: throttleCheck.waited,
        },
      };
    },

    renderCall(args, theme, _context) {
      let text = theme.fg("toolTitle", theme.bold("question_throttle ")) + theme.fg("muted", args.question);
      const cooldown = args.cooldown ?? 5;
      text += `\n${theme.fg("dim", `  Cooldown: ${cooldown}s`)}`;
      const opts = Array.isArray(args.options) ? args.options : [];
      if (opts.length) {
        const labels = opts.map((o: QOption) => o.label);
        const showOther = args.allowOther !== false;
        const numbered = showOther
          ? [...labels, "Type something..."].map((o, i) => `${i + 1}. ${o}`)
          : labels.map((o, i) => `${i + 1}. ${o}`);
        text += `\n${theme.fg("dim", `  Options: ${numbered.join(", ")}`)}`;
      }
      return new Text(text, 0, 0);
    },

    renderResult(result, _options, theme, _context) {
      const details = result.details as QuestionThrottleResult | undefined;
      if (!details) {
        const text = result.content[0];
        return new Text(text?.type === "text" ? text.text : "", 0, 0);
      }

      if (details.answer === null) {
        return new Text(theme.fg("warning", "Cancelled"), 0, 0);
      }

      let text = theme.fg("success", "✓ ") + theme.fg("accent", String(details.answer));
      if (details.throttled) {
        text += theme.fg("dim", " (throttled)");
      }
      text += ` (${keyHint("app.tools.expand", "to expand")})`;
      return new Text(text, 0, 0);
    },
  });
}

// ─── Tool 5: question_branch (branching questionnaire) ───────────────────────

function registerQuestionBranchTool(pi: ExtensionAPI) {
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

    async execute(_toolCallId, params, _signal, _onUpdate, ctx) {
      if (ctx.mode !== "tui") {
        return errorResult("Error: UI not available (running in non-interactive mode)", {
          questions: params.questions.map((q) => ({
            id: q.id,
            label: q.label,
            prompt: q.prompt,
          })),
          answers: [],
          skipped: [],
          cancelled: true,
        });
      }
      if (params.questions.length === 0) {
        return errorResult("Error: No questions provided", {
          questions: [],
          answers: [],
          skipped: [],
          cancelled: true,
        });
      }

      // Process questions: apply defaults, generate options for special types, filter by branch
      const processedQuestions = params.questions.map((q, i) => {
        const base = {
          ...q,
          label: q.label || `Q${i + 1}`,
          allowOther: q.allowOther !== false,
          required: q.required !== false,
          autoAdvance: q.autoAdvance !== false,
        };

        if (base.type === "yes_no") {
          return { ...base, options: generateYesNoOptions() };
        }
        if (base.type === "rating") {
          return { ...base, options: generateRatingOptions() };
        }

        return base;
      });

      const isMulti = processedQuestions.length > 1;
      const totalTabs = processedQuestions.length + 1;

      const result = await ctx.ui.custom<QuestionBranchResult>((tui, theme, _kb, done) => {
        let currentTab = 0;
        let optionIndex = 0;
        let inputMode = false;
        let inputQuestionId: string | null = null;
        let cachedLines: string[] | undefined;
        const answers = new Map<string, QuestionBranchResult["answers"][number]>();
        const selectedIndices = new Set<number>();
        const skipped: string[] = [];

        const editorTheme: EditorTheme = {
          borderColor: (s) => theme.fg("accent", s),
          selectList: {
            selectedPrefix: (t) => theme.fg("accent", t),
            selectedText: (t) => theme.fg("accent", t),
            description: (t) => theme.fg("muted", t),
            scrollInfo: (t) => theme.fg("dim", t),
            noMatch: (t) => theme.fg("warning", t),
          },
        };
        const editor = new Editor(tui, editorTheme);

        function refresh() {
          cachedLines = undefined;
          tui.requestRender();
        }

        function submit(cancelled: boolean) {
          done({
            questions: processedQuestions.map((q) => ({
              id: q.id,
              label: q.label,
              prompt: q.prompt,
            })),
            answers: Array.from(answers.values()),
            skipped,
            cancelled,
          });
        }

        function currentQuestion() {
          return processedQuestions[currentTab];
        }

        function currentOptions(): DisplayOption[] {
          const q = currentQuestion();
          if (!q) return [];
          const opts: DisplayOption[] = q.options.map((o) => ({
            label: o.label,
            description: o.description,
          }));
          if (q.allowOther) {
            opts.push({
              label: "Type something...",
              isOther: true,
            });
          }
          return opts;
        }

        function allRequiredAnswered(): boolean {
          return processedQuestions.every((q) => !q.required || answers.has(q.id));
        }

        function advanceAfterAnswer() {
          selectedIndices.clear();
          if (!isMulti) {
            submit(false);
            return;
          }
          // Find next visible question
          if (currentTab < processedQuestions.length - 1) {
            currentTab++;
          } else {
            currentTab = processedQuestions.length;
          }
          optionIndex = 0;
          refresh();
        }

        function saveAnswer(
          questionId: string,
          value: string | string[],
          label: string | string[],
          wasCustom: boolean,
          index?: number,
        ) {
          answers.set(questionId, {
            id: questionId,
            value,
            label,
            wasCustom,
            index,
          });
        }

        editor.onSubmit = (value) => {
          if (!inputQuestionId) return;
          const trimmed = value.trim() || "(no response)";
          saveAnswer(inputQuestionId, trimmed, trimmed, true);
          inputMode = false;
          inputQuestionId = null;
          editor.setText("");
          advanceAfterAnswer();
        };

        function handleInput(data: string) {
          if (inputMode) {
            if (matchesKey(data, Key.escape)) {
              inputMode = false;
              inputQuestionId = null;
              editor.setText("");
              refresh();
              return;
            }
            editor.handleInput(data);
            refresh();
            return;
          }

          const q = currentQuestion();
          const opts = currentOptions();

          if (isMulti) {
            if (matchesKey(data, Key.tab) || matchesKey(data, Key.right)) {
              currentTab = (currentTab + 1) % totalTabs;
              optionIndex = 0;
              refresh();
              return;
            }
            if (matchesKey(data, Key.shift("tab")) || matchesKey(data, Key.left)) {
              currentTab = (currentTab - 1 + totalTabs) % totalTabs;
              optionIndex = 0;
              refresh();
              return;
            }
          }

          if (currentTab === processedQuestions.length) {
            if (matchesKey(data, Key.enter) && allRequiredAnswered()) {
              submit(false);
            } else if (matchesKey(data, Key.escape)) {
              submit(true);
            }
            return;
          }

          if (matchesKey(data, Key.up)) {
            optionIndex = Math.max(0, optionIndex - 1);
            refresh();
            return;
          }
          if (matchesKey(data, Key.down)) {
            optionIndex = Math.min(opts.length - 1, optionIndex + 1);
            refresh();
            return;
          }

          if (matchesKey(data, Key.enter) && q) {
            const opt = opts[optionIndex];
            if (opt.isOther) {
              inputMode = true;
              inputQuestionId = q.id;
              editor.setText("");
              refresh();
              return;
            }

            const isMultiSelect = q.type === "multi";

            if (isMultiSelect) {
              if (selectedIndices.has(optionIndex)) {
                selectedIndices.delete(optionIndex);
              } else {
                selectedIndices.add(optionIndex);
              }
              refresh();
              return;
            }

            // Single select
            saveAnswer(q.id, opt.label, opt.label, false, optionIndex + 1);

            if (q.autoAdvance !== false) {
              advanceAfterAnswer();
            } else {
              optionIndex = 0;
              refresh();
            }
            return;
          }

          if (matchesKey(data, Key.escape)) {
            submit(true);
          }
        }

        function render(width: number): string[] {
          if (cachedLines) return cachedLines;

          const lines: string[] = [];
          const renderWidth = Math.max(1, width);
          const q = currentQuestion();
          const opts = currentOptions();

          function addWrapped(text: string) {
            lines.push(...wrapTextWithAnsi(text, renderWidth));
          }

          function addWrappedWithPrefix(prefix: string, text: string) {
            const prefixWidth = visibleWidth(prefix);
            if (prefixWidth >= renderWidth) {
              addWrapped(prefix + text);
              return;
            }
            const wrapped = wrapTextWithAnsi(text, renderWidth - prefixWidth);
            const continuationPrefix = " ".repeat(prefixWidth);
            for (let i = 0; i < wrapped.length; i++) {
              lines.push(`${i === 0 ? prefix : continuationPrefix}${wrapped[i]}`);
            }
          }

          lines.push(theme.fg("accent", "─".repeat(renderWidth)));

          if (isMulti) {
            const answeredCount = processedQuestions.filter((q) => answers.has(q.id) || skipped.includes(q.id)).length;
            const percentage = formatPercentage(answeredCount, processedQuestions.length);

            // Progress bar
            const barWidth = Math.min(20, Math.floor(renderWidth / 4));
            const filled = Math.round((answeredCount / processedQuestions.length) * barWidth);
            const bar = "█".repeat(filled) + "░".repeat(barWidth - filled);
            const progressText = ` ${theme.fg("accent", bar)} ${percentage} (${answeredCount}/${processedQuestions.length})`;
            addWrappedWithPrefix(" ", progressText);
            lines.push("");

            const tabs: string[] = ["← "];
            for (let i = 0; i < processedQuestions.length; i++) {
              const isActive = i === currentTab;
              const isAnswered = answers.has(processedQuestions[i].id);
              const isSkipped = skipped.includes(processedQuestions[i].id);
              const lbl = processedQuestions[i].label;
              const box = isAnswered ? "■" : isSkipped ? "◇" : "□";
              const color = isAnswered ? "success" : isSkipped ? "dim" : "muted";
              const text = ` ${box} ${lbl} `;
              const styled = isActive
                ? theme.bg("selectedBg", theme.fg("text", text))
                : theme.fg(color, text);
              tabs.push(`${styled} `);
            }
            const canSubmit = allRequiredAnswered();
            const submitText = " ✓ Submit ";
            const submitStyled = currentTab === processedQuestions.length
              ? theme.bg("selectedBg", theme.fg("text", submitText))
              : theme.fg(canSubmit ? "success" : "dim", submitText);
            tabs.push(`${submitStyled} →`);
            addWrappedWithPrefix(" ", tabs.join(""));
            lines.push("");
          }

          function renderOptions() {
            for (let i = 0; i < opts.length; i++) {
              const opt = opts[i];
              const selected = i === optionIndex;
              const isOther = opt.isOther === true;
              const prefix = selected ? theme.fg("accent", "> ") : "  ";
              const label = `${i + 1}. ${opt.label}` + (isOther && inputMode ? " ✎" : "");
              const color = selected || (isOther && inputMode) ? "accent" : "text";

              addWrappedWithPrefix(prefix, theme.fg(color, label));
              if (opt.description) {
                addWrappedWithPrefix("     ", theme.fg("muted", opt.description));
              }
            }
          }

          if (inputMode && q) {
            addWrappedWithPrefix(" ", theme.fg("text", q.prompt));
            lines.push("");
            renderOptions();
            lines.push("");
            addWrappedWithPrefix(" ", theme.fg("muted", "Your answer:"));
            for (const line of editor.render(Math.max(1, renderWidth - 2))) {
              lines.push(` ${line}`);
            }
            lines.push("");
            addWrappedWithPrefix(" ", theme.fg("dim", "Enter to submit • Esc to cancel"));
          } else if (currentTab === processedQuestions.length) {
            addWrappedWithPrefix(" ", theme.fg("accent", theme.bold("Ready to submit")));
            lines.push("");
            for (const question of processedQuestions) {
              const answer = answers.get(question.id);
              const isSkipped = skipped.includes(question.id);
              if (answer) {
                const prefix = answer.wasCustom ? "(wrote) " : "";
                const summary = `${theme.fg("muted", `${question.label}: `)}${theme.fg("text", prefix + String(answer.label))}`;
                addWrappedWithPrefix(" ", summary);
              } else if (isSkipped) {
                addWrappedWithPrefix(" ", theme.fg("dim", `${question.label}: skipped`));
              }
            }
            lines.push("");
            if (allRequiredAnswered()) {
              addWrappedWithPrefix(" ", theme.fg("success", "Press Enter to submit"));
            } else {
              const missing = processedQuestions
                .filter((q) => q.required && !answers.has(q.id) && !skipped.includes(q.id))
                .map((q) => q.label)
                .join(", ");
              if (missing) {
                addWrappedWithPrefix(" ", theme.fg("warning", `Unanswered: ${missing}`));
              }
            }
          } else if (q) {
            addWrappedWithPrefix(" ", theme.fg("text", q.prompt));
            lines.push("");
            renderOptions();

            // Show selected items for multi-select
            if (q.type === "multi" && selectedIndices.size > 0) {
              lines.push("");
              addWrappedWithPrefix(
                " ",
                theme.fg(
                  "muted",
                  `Selected: ${Array.from(selectedIndices)
                    .map((i) => opts[i].label)
                    .join(", ")}`,
                ),
              );
            }
          }

          lines.push("");
          if (!inputMode) {
            const help = isMulti
              ? "Tab/←→ navigate • ↑↓ select • Enter confirm • Esc cancel"
              : "↑↓ navigate • Enter select • Esc cancel";
            addWrappedWithPrefix(" ", theme.fg("dim", help));
          }
          lines.push(theme.fg("accent", "─".repeat(renderWidth)));

          cachedLines = lines;
          return lines;
        }

        return {
          render,
          invalidate: () => {
            cachedLines = undefined;
          },
          handleInput,
        };
      });

      if (result.cancelled) {
        return {
          content: [
            {
              type: "text",
              text: "User cancelled the questionnaire",
            },
          ],
          details: result,
        };
      }

      const answerLines = result.answers.map((a) => {
        const qLabel = processedQuestions.find((q) => q.id === a.id)?.label || a.id;
        if (a.wasCustom) {
          return `${qLabel}: user wrote: ${a.label}`;
        }
        const display = a.index ? `${a.index}. ${a.label}` : a.label;
        return `${qLabel}: user selected: ${display}`;
      });

      return {
        content: [{ type: "text", text: answerLines.join("\n") }],
        details: result,
      };
    },

    renderCall(args, theme, _context) {
      const qs = (args.questions as Array<{ id: string; label?: string; prompt: string; branch?: unknown }>) || [];
      const count = qs.length;
      const labels = qs.map((q) => q.label || q.id).join(", ");
      const hasBranch = qs.some((q) => q.branch !== undefined);
      let text =
        theme.fg("toolTitle", theme.bold("question_branch ")) +
        theme.fg("muted", `${count} question${count !== 1 ? "s" : ""}`);
      if (hasBranch) {
        text += theme.fg("dim", " (branching)");
      }
      if (labels) {
        text += theme.fg("dim", ` (${labels})`);
      }
      return new Text(text, 0, 0);
    },

    renderResult(result, _options, theme, _context) {
      const details = result.details as QuestionBranchResult | undefined;
      if (!details) {
        const text = result.content[0];
        return new Text(text?.type === "text" ? text.text : "", 0, 0);
      }
      if (details.cancelled) {
        return new Text(theme.fg("warning", "Cancelled"), 0, 0);
      }
      const lines = details.answers.map((a) => {
        if (a.wasCustom) {
          return `${theme.fg("success", "✓ ")}${theme.fg("accent", a.id)}: ${theme.fg("muted", "(wrote) ")}${a.label}`;
        }
        const display = a.index ? `${a.index}. ${a.label}` : a.label;
        return `${theme.fg("success", "✓ ")}${theme.fg("accent", a.id)}: ${display}`;
      });
      let text = lines.join("\n");
      if (details.skipped.length > 0) {
        text += `\n${theme.fg("dim", `Skipped: ${details.skipped.join(", ")}`)}`;
      }
      text += ` (${keyHint("app.tools.expand", "to expand")})`;
      return new Text(text, 0, 0);
    },
  });
}

// ─── Extension Entry Point ──────────────────────────────────────────────────

const TOOL_NAMES = new Set(["question", "questionnaire", "question_input", "question_throttle", "question_branch"]);

export default function (pi: ExtensionAPI) {
  registerQuestionTool(pi);
  registerQuestionnaireTool(pi);
  registerQuestionInputTool(pi);
  registerQuestionThrottleTool(pi);
  registerQuestionBranchTool(pi);

  // ─── Custom Message Renderer ───────────────────────────────────────

  // Register custom renderer for question results in chat transcript
  pi.registerMessageRenderer("question_result", (message, options, theme) => {
    const { expanded, outputPad } = options;
    let text = theme.fg("accent", "[Question] ") + message.content;
    if (expanded && message.details) {
      text += "\n" + theme.fg("dim", JSON.stringify(message.details, null, 2));
    }
    return new Text(text, outputPad, 0);
  });

  pi.registerMessageRenderer("questionnaire_result", (message, options, theme) => {
    const { expanded, outputPad } = options;
    let text = theme.fg("accent", "[Questionnaire] ") + message.content;
    if (expanded && message.details) {
      text += "\n" + theme.fg("dim", JSON.stringify(message.details, null, 2));
    }
    return new Text(text, outputPad, 0);
  });

  pi.registerMessageRenderer("question_input_result", (message, options, theme) => {
    const { expanded, outputPad } = options;
    let text = theme.fg("accent", "[Question Input] ") + message.content;
    if (expanded && message.details) {
      text += "\n" + theme.fg("dim", JSON.stringify(message.details, null, 2));
    }
    return new Text(text, outputPad, 0);
  });

  pi.registerMessageRenderer("question_throttle_result", (message, options, theme) => {
    const { expanded, outputPad } = options;
    let text = theme.fg("accent", "[Question Throttle] ") + message.content;
    if (expanded && message.details) {
      text += "\n" + theme.fg("dim", JSON.stringify(message.details, null, 2));
    }
    return new Text(text, outputPad, 0);
  });

  pi.registerMessageRenderer("question_branch_result", (message, options, theme) => {
    const { expanded, outputPad } = options;
    let text = theme.fg("accent", "[Question Branch] ") + message.content;
    if (expanded && message.details) {
      text += "\n" + theme.fg("dim", JSON.stringify(message.details, null, 2));
    }
    return new Text(text, outputPad, 0);
  });

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
    // Log tool calls for debugging
    if (TOOL_NAMES.has(event.toolName)) {
      // Could track usage statistics or inject context
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

  // ─── Slash Commands ──────────────────────────────────────────────────

  pi.registerCommand("q-status", {
    description: "Show questions extension usage statistics",
    handler: async (_args, ctx) => {
      ctx.ui.notify(
        "Questions extension: 5 tools registered (question, questionnaire, question_input, question_throttle, question_branch)",
        "info",
      );
      return {
        content: [
          {
            type: "text",
            text: "Questions extension loaded with 5 tools: question, questionnaire, question_input, question_throttle, question_branch",
          },
        ],
      };
    },
  });

  pi.registerCommand("q-clear", {
    description: "Clear any cached question state (if applicable)",
    handler: async (_args, ctx) => {
      ctx.ui.notify("Question state cleared", "info");
      return {
        content: [{ type: "text", text: "Question state cleared successfully" }],
      };
    },
  });
}
