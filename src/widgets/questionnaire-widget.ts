export interface ProgressTheme {
  fg(name: string, value: string): string;
}

export function progressBar(
  theme: ProgressTheme,
  current: number,
  total: number,
  width: number,
): string {
  const safeTotal = Math.max(1, total);
  const barWidth = Math.min(20, Math.max(1, Math.floor(width / 4)));
  const filled = Math.round((current / safeTotal) * barWidth);
  return `${theme.fg("accent", "█".repeat(filled) + "░".repeat(barWidth - filled))} ${Math.round((current / safeTotal) * 100)}% (${current}/${total})`;
}

import {
  Editor,
  type EditorTheme,
  matchesKey,
  visibleWidth,
  wrapTextWithAnsi,
} from "@earendil-works/pi-tui";
import {
  createQuestionnaireState,
  type QuestionnaireState,
  reduceQuestionnaireState,
} from "../state/questionnaire-state.js";
import type { DisplayOption, QuestionnaireResult } from "../types.js";
import { rowIntent } from "./row-intent.js";
import { widgetRule } from "./styles.js";

export interface QuestionnaireQuestion {
  id: string;
  label: string;
  prompt: string;
  options: DisplayOption[];
  required?: boolean;
  autoAdvance?: boolean;
  type?: string;
}

export interface QuestionnaireWidgetContext {
  tui: { requestRender(): void };
  theme: ProgressTheme & { bg?(name: string, value: string): string; bold?(value: string): string };
  keys: {
    up: string;
    down: string;
    enter: string;
    escape: string;
    tab: string;
    left: string;
    right: string;
  };
  done(value: QuestionnaireResult): void;
}

export interface QuestionnaireWidgetConfig {
  questions: QuestionnaireQuestion[];
  isVisible(index: number, answers: Map<string, QuestionnaireResult["answers"][number]>): boolean;
  skipped?: string[];
}

export function createQuestionnaireWidget(
  config: QuestionnaireWidgetConfig,
  context: QuestionnaireWidgetContext,
) {
  let state: QuestionnaireState = createQuestionnaireState(config.questions.length);
  let inputId: string | null = null;
  let cached: string[] | undefined;
  const answers = () => state.answers;
  const selected = () => state.selected;
  const skipped = config.skipped ?? state.skipped;
  const machineQuestions = () =>
    config.questions.map((question, index) => ({
      id: question.id,
      visible: config.isVisible(index, answers()),
      optionCount: question.options.length,
    }));
  const editorTheme: EditorTheme = {
    borderColor: (s) => context.theme.fg("accent", s),
    selectList: {
      selectedPrefix: (s) => context.theme.fg("accent", s),
      selectedText: (s) => context.theme.fg("accent", s),
      description: (s) => context.theme.fg("muted", s),
      scrollInfo: (s) => context.theme.fg("dim", s),
      noMatch: (s) => context.theme.fg("warning", s),
    },
  };
  const editor = new Editor(context.tui as never, editorTheme);
  const multiTab = config.questions.length > 1;
  const submit = (cancelled: boolean) =>
    context.done({
      questions: config.questions.map(({ id, label, prompt }) => ({ id, label, prompt })),
      answers: [...answers().values()],
      cancelled,
    });
  const current = () => config.questions[state.tab];
  const options = () => current()?.options ?? [];
  const refresh = () => {
    cached = undefined;
    context.tui.requestRender();
  };
  const allRequiredAnswered = () =>
    config.questions.every(
      (q, i) => !q.required || answers().has(q.id) || !config.isVisible(i, answers()),
    );
  const moveVisible = (direction: 1 | -1) => {
    const transition = reduceQuestionnaireState(
      state,
      direction === 1 ? { type: "next" } : { type: "previous" },
      machineQuestions(),
    );
    state = transition.state;
    for (const id of state.skipped) if (!skipped.includes(id)) skipped.push(id);
  };
  const save = (
    q: QuestionnaireQuestion,
    value: string | string[],
    label: string | string[],
    wasCustom: boolean,
    index?: number,
  ) => {
    state = reduceQuestionnaireState(
      state,
      { type: "answer", answer: { id: q.id, value, label, wasCustom, index } },
      machineQuestions(),
    ).state;
  };
  const advance = () => {
    state = reduceQuestionnaireState(state, { type: "clear-selection" }, machineQuestions()).state;
    if (!multiTab) return submit(false);
    moveVisible(1);
    refresh();
  };
  editor.onSubmit = (value) => {
    const q = current();
    if (!q || !inputId) return;
    const answer = value.trim() || "(no response)";
    save(q, answer, answer, true);
    inputId = null;
    editor.setText("");
    advance();
  };

  const handleInput = (data: string) => {
    if (inputId) {
      if (matchesKey(data, context.keys.escape)) {
        inputId = null;
        editor.setText("");
        refresh();
      } else {
        editor.handleInput(data);
        refresh();
      }
      return;
    }
    if (state.tab === config.questions.length) {
      if (matchesKey(data, context.keys.enter) && allRequiredAnswered()) submit(false);
      else if (matchesKey(data, context.keys.escape)) submit(true);
      return;
    }
    const q = current();
    const opts = options();
    if (multiTab && (matchesKey(data, context.keys.tab) || matchesKey(data, context.keys.right))) {
      moveVisible(1);
      refresh();
      return;
    }
    if (multiTab && matchesKey(data, context.keys.left)) {
      moveVisible(-1);
      refresh();
      return;
    }
    if (matchesKey(data, context.keys.up)) {
      state = reduceQuestionnaireState(
        state,
        { type: "move-option", direction: -1 },
        machineQuestions(),
      ).state;
      refresh();
      return;
    }
    if (matchesKey(data, context.keys.down)) {
      state = reduceQuestionnaireState(
        state,
        { type: "move-option", direction: 1 },
        machineQuestions(),
      ).state;
      refresh();
      return;
    }
    if (matchesKey(data, context.keys.enter) && q && opts[state.option]) {
      const selectedOption = opts[state.option];
      if (rowIntent(selectedOption) === "other") {
        inputId = q.id;
        editor.setText("");
        refresh();
        return;
      }
      if (q.type === "multi") {
        state = reduceQuestionnaireState(
          state,
          { type: "toggle-option", index: state.option },
          machineQuestions(),
        ).state;
        if (q.autoAdvance)
          save(
            q,
            [...selected()].map((i) => opts[i].label),
            [...selected()].map((i) => opts[i].label),
            false,
          );
        refresh();
        return;
      }
      save(q, selectedOption.label, selectedOption.label, false, state.option + 1);
      if (q.autoAdvance !== false) advance();
      else refresh();
      return;
    }
    if (matchesKey(data, context.keys.escape)) submit(true);
  };
  return {
    editor,
    handleInput,
    invalidate: () => {
      cached = undefined;
    },
    render(width: number): string[] {
      if (cached) return cached;
      const w = Math.max(1, width);
      const lines = [widgetRule(context.theme, w)];
      const append = (prefix: string, text: string) => {
        const n = Math.max(1, w - visibleWidth(prefix));
        const wrapped = wrapTextWithAnsi(text, n);
        for (let i = 0; i < wrapped.length; i++)
          lines.push(`${i ? " ".repeat(visibleWidth(prefix)) : prefix}${wrapped[i]}`);
      };
      if (multiTab) {
        append(
          " ",
          `${progressBar(context.theme, answers().size + skipped.length, config.questions.length, w)}  •  ${state.tab < config.questions.length ? config.questions[state.tab].label : "Review"}`,
        );
        lines.push("");
      }
      const q = current();
      const opts = options();
      if (q) {
        append(" ", context.theme.fg("text", q.prompt));
        lines.push("");
        for (let i = 0; i < opts.length; i++) {
          const focused = i === state.option;
          const checked = q.type === "multi" && selected().has(i);
          append(
            focused ? context.theme.fg("accent", checked ? "☑ " : "> ") : checked ? "☑ " : "  ",
            context.theme.fg(focused || checked ? "accent" : "text", `${i + 1}. ${opts[i].label}`),
          );
          if (opts[i].description) append("     ", context.theme.fg("muted", opts[i].description));
        }
        if (inputId) {
          lines.push("");
          append(" ", context.theme.fg("muted", "Your answer:"));
          for (const line of editor.render(w - 2)) lines.push(` ${line}`);
        }
      } else {
        append(" ", context.theme.fg("accent", "Ready to submit"));
        lines.push("");
        for (const qn of config.questions) {
          const answer = answers().get(qn.id);
          if (answer) append(" ", `${qn.label}: ${String(answer.label)}`);
        }
      }
      lines.push("");
      append(
        " ",
        context.theme.fg(
          "dim",
          inputId
            ? "Enter to submit • Esc to cancel"
            : multiTab
              ? "Tab/←→ navigate • ↑↓ select • Enter confirm • Esc cancel"
              : "↑↓ navigate • Enter select • Esc cancel",
        ),
      );
      lines.push(widgetRule(context.theme, w));
      cached = lines;
      return lines;
    },
  };
}
