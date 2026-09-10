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

import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
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

type DisplayOption = QOption & { isOther?: boolean };

interface QuestionResult {
  question: string;
  options: string[];
  answer: string | null;
  wasCustom: boolean;
  index?: number;
}

interface QuestionnaireResult {
  questions: Array<{ id: string; label: string; prompt: string }>;
  answers: Array<{
    id: string;
    value: string;
    label: string;
    wasCustom: boolean;
    index?: number;
  }>;
  cancelled: boolean;
}

interface QuestionInputResult {
  question: string;
  answer: string | null;
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
});

const QuestionnaireParams = Type.Object({
  questions: Type.Array(
    Type.Object({
      id: Type.String({
        description:
          'Unique identifier, e.g. "primary_user", "core_differentiator"',
      }),
      label: Type.Optional(
        Type.String({
          description:
            "Short label for tab bar, e.g. 'Scope', 'Priority' (defaults to Q1, Q2...)",
        }),
      ),
      prompt: Type.String({
        description: "The full question text to display",
      }),
      options: Type.Array(OptionSchema, {
        description: "Available options to choose from",
      }),
      allowOther: Type.Optional(
        Type.Boolean({ description: "Allow 'Type something' option (default: true)" }),
      ),
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
});

// ─── Helpers ────────────────────────────────────────────────────────────────

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

// ─── Tool 1: question (single question with options) ────────────────────────

function registerQuestionTool(pi: ExtensionAPI) {
  pi.registerTool({
    name: "question",
    label: "Question",
    description:
      "Ask the user a single question with selectable options. Includes a 'Type something...' option for custom text. Use when you need the user to make a choice or provide input to proceed.",
    parameters: QuestionParams,
    executionMode: "sequential",

    async execute(_toolCallId, params, _signal, _onUpdate, ctx) {
      if (ctx.mode !== "tui") {
        return errorResult(
          "Error: UI not available (running in non-interactive mode)",
          {
            question: params.question,
            options: params.options.map((o) => o.label),
            answer: null,
          },
        );
      }
      if (params.options.length === 0) {
        return errorResult("Error: No options provided", {
          question: params.question,
          options: [],
          answer: null,
        });
      }

      const allOptions: DisplayOption[] = [
        ...params.options,
        { label: "Type something...", isOther: true },
      ];

      const result =
        await ctx.ui.custom<{ answer: string; wasCustom: boolean; index?: number } | null>(
          (tui, theme, _kb, done) => {
            let optionIndex = 0;
            let editMode = false;
            let cachedLines: string[] | undefined;

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
                } else {
                  done({
                    answer: selected.label,
                    wasCustom: false,
                    index: optionIndex + 1,
                  });
                }
                return;
              }

              if (matchesKey(data, Key.escape)) {
                done(null);
              }
            }

            function render(width: number): string[] {
              if (cachedLines) return cachedLines;

              const lines: string[] = [];
              const renderWidth = Math.max(1, width);

              function addWrapped(text: string) {
                lines.push(...wrapTextWithAnsi(text, renderWidth));
              }

              function addWrappedWithPrefix(
                prefix: string,
                text: string,
              ) {
                const prefixWidth = visibleWidth(prefix);
                if (prefixWidth >= renderWidth) {
                  addWrapped(prefix + text);
                  return;
                }
                const wrapped = wrapTextWithAnsi(
                  text,
                  renderWidth - prefixWidth,
                );
                const continuationPrefix = " ".repeat(prefixWidth);
                for (let i = 0; i < wrapped.length; i++) {
                  lines.push(
                    `${i === 0 ? prefix : continuationPrefix}${wrapped[i]}`,
                  );
                }
              }

              lines.push(theme.fg("accent", "─".repeat(renderWidth)));
              addWrappedWithPrefix(
                " ",
                theme.fg("text", params.question),
              );
              lines.push("");

              for (let i = 0; i < allOptions.length; i++) {
                const opt = allOptions[i];
                const selected = i === optionIndex;
                const isOther = opt.isOther === true;
                const prefix = selected ? theme.fg("accent", "> ") : "  ";
                const label =
                  `${i + 1}. ${opt.label}` +
                  (isOther && editMode ? " ✎" : "");
                const color =
                  selected || (isOther && editMode) ? "accent" : "text";

                addWrappedWithPrefix(prefix, theme.fg(color, label));

                if (opt.description) {
                  addWrappedWithPrefix(
                    "     ",
                    theme.fg("muted", opt.description),
                  );
                }
              }

              if (editMode) {
                lines.push("");
                addWrappedWithPrefix(
                  " ",
                  theme.fg("muted", "Your answer:"),
                );
                for (const line of editor.render(
                  Math.max(1, renderWidth - 2),
                )) {
                  lines.push(` ${line}`);
                }
              }

              lines.push("");
              if (editMode) {
                addWrappedWithPrefix(
                  " ",
                  theme.fg(
                    "dim",
                    "Enter to submit • Esc to go back",
                  ),
                );
              } else {
                addWrappedWithPrefix(
                  " ",
                  theme.fg(
                    "dim",
                    "↑↓ navigate • Enter to select • Esc to cancel",
                  ),
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
          },
        );

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
            text: `User selected: ${result.index}. ${result.answer}`,
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
      let text =
        theme.fg("toolTitle", theme.bold("question ")) +
        theme.fg("muted", args.question);
      const opts = Array.isArray(args.options) ? args.options : [];
      if (opts.length) {
        const labels = opts.map((o: QOption) => o.label);
        const numbered = [...labels, "Type something..."].map(
          (o, i) => `${i + 1}. ${o}`,
        );
        text += `\n${theme.fg("dim", `  Options: ${numbered.join(", ")}`)}`;
      }
      return new Text(text, 0, 0);
    },

    renderResult(result, _options, theme, _context) {
      const details = result.details as QuestionResult | undefined;
      if (!details) {
        const text = result.content[0];
        return new Text(
          text?.type === "text" ? text.text : "",
          0,
          0,
        );
      }

      if (details.answer === null) {
        return new Text(theme.fg("warning", "Cancelled"), 0, 0);
      }

      if (details.wasCustom) {
        return new Text(
          theme.fg("success", "✓ ") +
            theme.fg("muted", "(wrote) ") +
            theme.fg("accent", details.answer),
          0,
          0,
        );
      }
      return new Text(
        theme.fg("success", "✓ ") + theme.fg("accent", details.answer),
        0,
        0,
      );
    },
  });
}

// ─── Tool 2: questionnaire (multi-question wizard) ──────────────────────────

function registerQuestionnaireTool(pi: ExtensionAPI) {
  pi.registerTool({
    name: "questionnaire",
    label: "Questionnaire",
    description:
      "Ask the user one or more questions in a tabbed wizard. Each question shows selectable options (plus custom text entry). Navigate between questions with Tab/arrow keys. Use for structured discovery, requirement gathering, or multi-step decision workflows.",
    parameters: QuestionnaireParams,

    async execute(_toolCallId, params, _signal, _onUpdate, ctx) {
      if (ctx.mode !== "tui") {
        return errorResult(
          "Error: UI not available (running in non-interactive mode)",
          {
            questions: params.questions.map((q) => ({
              id: q.id,
              label: q.label,
              prompt: q.prompt,
            })),
            answers: [],
            cancelled: true,
          },
        );
      }
      if (params.questions.length === 0) {
        return errorResult("Error: No questions provided", {
          questions: [],
          answers: [],
          cancelled: true,
        });
      }

      const questions = params.questions.map((q, i) => ({
        ...q,
        label: q.label || `Q${i + 1}`,
        allowOther: q.allowOther !== false,
      }));

      const isMulti = questions.length > 1;
      const totalTabs = questions.length + 1;

      const result =
        await ctx.ui.custom<QuestionnaireResult>((tui, theme, _kb, done) => {
          let currentTab = 0;
          let optionIndex = 0;
          let inputMode = false;
          let inputQuestionId: string | null = null;
          let cachedLines: string[] | undefined;
          const answers = new Map<string, QuestionnaireResult["answers"][number]>();

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
                value: "__other__",
                label: "Type something...",
                isOther: true,
              });
            }
            return opts;
          }

          function allAnswered(): boolean {
            return questions.every((q) => answers.has(q.id));
          }

          function advanceAfterAnswer() {
            if (!isMulti) {
              submit(false);
              return;
            }
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
            value: string,
            label: string,
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
              if (
                matchesKey(data, Key.tab) ||
                matchesKey(data, Key.right)
              ) {
                currentTab = (currentTab + 1) % totalTabs;
                optionIndex = 0;
                refresh();
                return;
              }
              if (
                matchesKey(data, Key.shift("tab")) ||
                matchesKey(data, Key.left)
              ) {
                currentTab =
                  (currentTab - 1 + totalTabs) % totalTabs;
                optionIndex = 0;
                refresh();
                return;
              }
            }

            if (currentTab === questions.length) {
              if (matchesKey(data, Key.enter) && allAnswered()) {
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
              optionIndex = Math.min(
                opts.length - 1,
                optionIndex + 1,
              );
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
              saveAnswer(
                q.id,
                opt.value ?? opt.label,
                opt.label,
                false,
                optionIndex + 1,
              );
              advanceAfterAnswer();
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

            function addWrappedWithPrefix(
              prefix: string,
              text: string,
            ) {
              const prefixWidth = visibleWidth(prefix);
              if (prefixWidth >= renderWidth) {
                addWrapped(prefix + text);
                return;
              }
              const wrapped = wrapTextWithAnsi(
                text,
                renderWidth - prefixWidth,
              );
              const continuationPrefix = " ".repeat(prefixWidth);
              for (let i = 0; i < wrapped.length; i++) {
                lines.push(
                  `${i === 0 ? prefix : continuationPrefix}${wrapped[i]}`,
                );
              }
            }

            lines.push(theme.fg("accent", "─".repeat(renderWidth)));

            if (isMulti) {
              const tabs: string[] = ["← "];
              for (let i = 0; i < questions.length; i++) {
                const isActive = i === currentTab;
                const isAnswered = answers.has(questions[i].id);
                const lbl = questions[i].label;
                const box = isAnswered ? "■" : "□";
                const color = isAnswered ? "success" : "muted";
                const text = ` ${box} ${lbl} `;
                const styled = isActive
                  ? theme.bg(
                      "selectedBg",
                      theme.fg("text", text),
                    )
                  : theme.fg(color, text);
                tabs.push(`${styled} `);
              }
              const canSubmit = allAnswered();
              const isSubmitTab = currentTab === questions.length;
              const submitText = " ✓ Submit ";
              const submitStyled = isSubmitTab
                ? theme.bg(
                    "selectedBg",
                    theme.fg("text", submitText),
                  )
                : theme.fg(
                    canSubmit ? "success" : "dim",
                    submitText,
                  );
              tabs.push(`${submitStyled} →`);
              addWrappedWithPrefix(" ", tabs.join(""));
              lines.push("");
            }

            function renderOptions() {
              for (let i = 0; i < opts.length; i++) {
                const opt = opts[i];
                const selected = i === optionIndex;
                const isOther = opt.isOther === true;
                const prefix =
                  selected ? theme.fg("accent", "> ") : "  ";
                const label =
                  `${i + 1}. ${opt.label}` +
                  (isOther && inputMode ? " ✎" : "");
                const color =
                  selected || (isOther && inputMode)
                    ? "accent"
                    : "text";

                addWrappedWithPrefix(
                  prefix,
                  theme.fg(color, label),
                );
                if (opt.description) {
                  addWrappedWithPrefix(
                    "     ",
                    theme.fg("muted", opt.description),
                  );
                }
              }
            }

            if (inputMode && q) {
              addWrappedWithPrefix(
                " ",
                theme.fg("text", q.prompt),
              );
              lines.push("");
              renderOptions();
              lines.push("");
              addWrappedWithPrefix(
                " ",
                theme.fg("muted", "Your answer:"),
              );
              for (const line of editor.render(
                Math.max(1, renderWidth - 2),
              )) {
                lines.push(` ${line}`);
              }
              lines.push("");
              addWrappedWithPrefix(
                " ",
                theme.fg("dim", "Enter to submit • Esc to cancel"),
              );
            } else if (currentTab === questions.length) {
              addWrappedWithPrefix(
                " ",
                theme.fg("accent", theme.bold("Ready to submit")),
              );
              lines.push("");
              for (const question of questions) {
                const answer = answers.get(question.id);
                if (answer) {
                  const prefix = answer.wasCustom ? "(wrote) " : "";
                  const summary = `${theme.fg("muted", `${question.label}: `)}${theme.fg("text", prefix + answer.label)}`;
                  addWrappedWithPrefix(" ", summary);
                }
              }
              lines.push("");
              if (allAnswered()) {
                addWrappedWithPrefix(
                  " ",
                  theme.fg("success", "Press Enter to submit"),
                );
              } else {
                const missing = questions
                  .filter((q) => !answers.has(q.id))
                  .map((q) => q.label)
                  .join(", ");
                addWrappedWithPrefix(
                  " ",
                  theme.fg(
                    "warning",
                    `Unanswered: ${missing}`,
                  ),
                );
              }
            } else if (q) {
              addWrappedWithPrefix(
                " ",
                theme.fg("text", q.prompt),
              );
              lines.push("");
              renderOptions();
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
        const qLabel =
          questions.find((q) => q.id === a.id)?.label || a.id;
        if (a.wasCustom) {
          return `${qLabel}: user wrote: ${a.label}`;
        }
        return `${qLabel}: user selected: ${a.index}. ${a.label}`;
      });

      return {
        content: [{ type: "text", text: answerLines.join("\n") }],
        details: result,
      };
    },

    renderCall(args, theme, _context) {
      const qs = (args.questions as typeof params.questions) || [];
      const count = qs.length;
      const labels = qs
        .map((q) => q.label || q.id)
        .join(", ");
      let text =
        theme.fg("toolTitle", theme.bold("questionnaire ")) +
        theme.fg(
          "muted",
          `${count} question${count !== 1 ? "s" : ""}`,
        );
      if (labels) {
        text += theme.fg("dim", ` (${labels})`);
      }
      return new Text(text, 0, 0);
    },

    renderResult(result, _options, theme, _context) {
      const details =
        result.details as QuestionnaireResult | undefined;
      if (!details) {
        const text = result.content[0];
        return new Text(
          text?.type === "text" ? text.text : "",
          0,
          0,
        );
      }
      if (details.cancelled) {
        return new Text(theme.fg("warning", "Cancelled"), 0, 0);
      }
      const lines = details.answers.map((a) => {
        if (a.wasCustom) {
          return `${theme.fg("success", "✓ ")}${theme.fg("accent", a.id)}: ${theme.fg("muted", "(wrote) ")}${a.label}`;
        }
        const display = a.index
          ? `${a.index}. ${a.label}`
          : a.label;
        return `${theme.fg("success", "✓ ")}${theme.fg("accent", a.id)}: ${display}`;
      });
      return new Text(lines.join("\n"), 0, 0);
    },
  });
}

// ─── Tool 3: question_input (open-ended text input) ─────────────────────────

function registerQuestionInputTool(pi: ExtensionAPI) {
  pi.registerTool({
    name: "question_input",
    label: "Question Input",
    description:
      "Ask the user an open-ended question with free-form text input. Use when you need a written answer, not a selection — e.g., describing a concept, writing a tagline, or explaining a constraint. The user types their answer in an inline editor.",
    parameters: QuestionInputParams,

    async execute(_toolCallId, params, _signal, _onUpdate, ctx) {
      if (ctx.mode !== "tui") {
        return errorResult(
          "Error: UI not available (running in non-interactive mode)",
          {
            question: params.question,
            answer: null,
          } as QuestionInputResult,
        );
      }

      const result =
        await ctx.ui.custom<{ answer: string } | null>((tui, theme, _kb, done) => {
          let cachedLines: string[] | undefined;
          let submitValue = "";

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
            if (trimmed || !params.required) {
              done({ answer: trimmed });
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

            function addWrappedWithPrefix(
              prefix: string,
              text: string,
            ) {
              const prefixWidth = visibleWidth(prefix);
              if (prefixWidth >= renderWidth) {
                addWrapped(prefix + text);
                return;
              }
              const wrapped = wrapTextWithAnsi(
                text,
                renderWidth - prefixWidth,
              );
              const continuationPrefix = " ".repeat(prefixWidth);
              for (let i = 0; i < wrapped.length; i++) {
                lines.push(
                  `${i === 0 ? prefix : continuationPrefix}${wrapped[i]}`,
                );
              }
            }

            lines.push(theme.fg("accent", "─".repeat(renderWidth)));
            addWrappedWithPrefix(
              " ",
              theme.fg("text", params.question),
            );
            lines.push("");

            if (params.placeholder) {
              addWrappedWithPrefix(
                " ",
                theme.fg("dim", params.placeholder),
              );
              lines.push("");
            }

            addWrappedWithPrefix(
              " ",
              theme.fg("muted", "Your answer:"),
            );
            for (const line of editor.render(
              Math.max(1, renderWidth - 2),
            )) {
              lines.push(` ${line}`);
            }

            lines.push("");
            addWrappedWithPrefix(
              " ",
              theme.fg(
                "dim",
                "Enter to submit • Esc to cancel",
              ),
            );
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
        } as QuestionInputResult,
      };
    },

    renderCall(args, theme, _context) {
      let text =
        theme.fg("toolTitle", theme.bold("question_input ")) +
        theme.fg("muted", args.question);
      if (args.placeholder) {
        text += `\n${theme.fg("dim", `  Placeholder: ${args.placeholder}`)}`;
      }
      return new Text(text, 0, 0);
    },

    renderResult(result, _options, theme, _context) {
      const details =
        result.details as QuestionInputResult | undefined;
      if (!details) {
        const text = result.content[0];
        return new Text(
          text?.type === "text" ? text.text : "",
          0,
          0,
        );
      }

      if (details.answer === null) {
        return new Text(theme.fg("warning", "Cancelled"), 0, 0);
      }

      return new Text(
        theme.fg("success", "✓ ") +
          theme.fg("accent", details.answer),
        0,
        0,
      );
    },
  });
}

// ─── Extension Entry Point ──────────────────────────────────────────────────

export default function (pi: ExtensionAPI) {
  registerQuestionTool(pi);
  registerQuestionnaireTool(pi);
  registerQuestionInputTool(pi);
}
