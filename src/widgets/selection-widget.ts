import { Editor, type EditorTheme, matchesKey } from "@earendil-works/pi-tui";
import type { DisplayOption } from "../types.js";
import { appendWrappedWithPrefix, beginWidget, endWidget } from "./layout.js";
import { rowIntent } from "./row-intent.js";
import { renderEditorLines } from "./text-input-widget.js";

export interface SelectionWidgetTheme {
  fg(name: string, value: string): string;
}

export interface SelectionWidgetKeys {
  up: string;
  down: string;
  enter: string;
  escape: string;
}

export interface SelectionWidgetOptions {
  question: string;
  options: DisplayOption[];
  multi?: boolean;
  allowOther?: boolean;
}

export interface SelectionWidgetContext {
  tui: { requestRender(): void };
  theme: SelectionWidgetTheme;
  keys: SelectionWidgetKeys;
  done(value: unknown): void;
}

export interface SelectionWidget {
  render(width: number): string[];
  invalidate(): void;
  handleInput(data: string): void;
}

function editorTheme(theme: SelectionWidgetTheme): EditorTheme {
  return {
    borderColor: (s) => theme.fg("accent", s),
    selectList: {
      selectedPrefix: (t) => theme.fg("accent", t),
      selectedText: (t) => theme.fg("accent", t),
      description: (t) => theme.fg("muted", t),
      scrollInfo: (t) => theme.fg("dim", t),
      noMatch: (t) => theme.fg("warning", t),
    },
  };
}

export function createSelectionWidget(
  options: SelectionWidgetOptions,
  context: SelectionWidgetContext,
): SelectionWidget & { editor: Editor } {
  const multi = options.multi === true;
  const allOptions = options.options;
  let optionIndex = 0;
  let editMode = false;
  let justToggled = false;
  let lastToggledIndex: number | undefined;
  let cachedLines: string[] | undefined;
  let toggleTimeout: ReturnType<typeof setTimeout> | undefined;
  const selectedIndices = new Set<number>();
  const editor = new Editor(context.tui as never, editorTheme(context.theme));

  const refresh = () => {
    cachedLines = undefined;
    context.tui.requestRender();
  };

  editor.onSubmit = (value) => {
    const answer = value.trim();
    if (answer) {
      context.done({ answer, wasCustom: true });
      return;
    }
    editMode = false;
    editor.setText("");
    refresh();
  };

  function submitSelected(): void {
    context.done({
      answer: Array.from(selectedIndices).map((index) => allOptions[index].label),
      wasCustom: false,
    });
  }

  function handleInput(data: string): void {
    if (editMode) {
      if (matchesKey(data, context.keys.escape)) {
        editMode = false;
        editor.setText("");
        refresh();
        return;
      }
      editor.handleInput(data);
      refresh();
      return;
    }
    if (matchesKey(data, context.keys.up)) {
      optionIndex = Math.max(0, optionIndex - 1);
      refresh();
      return;
    }
    if (matchesKey(data, context.keys.down)) {
      optionIndex = Math.min(allOptions.length - 1, optionIndex + 1);
      refresh();
      return;
    }
    if (matchesKey(data, context.keys.enter)) {
      const selected = allOptions[optionIndex];
      if (rowIntent(selected) === "other") {
        editMode = true;
        refresh();
        return;
      }
      if (multi) {
        if (justToggled && lastToggledIndex === optionIndex && selectedIndices.size > 0) {
          submitSelected();
          return;
        }
        if (selectedIndices.has(optionIndex)) selectedIndices.delete(optionIndex);
        else selectedIndices.add(optionIndex);
        justToggled = true;
        lastToggledIndex = optionIndex;
        if (toggleTimeout) clearTimeout(toggleTimeout);
        toggleTimeout = setTimeout(() => {
          justToggled = false;
        }, 800);
        refresh();
        return;
      }
      context.done({ answer: selected.label, wasCustom: false, index: optionIndex + 1 });
      return;
    }
    if (matchesKey(data, context.keys.escape)) {
      if (toggleTimeout) clearTimeout(toggleTimeout);
      if (multi && selectedIndices.size > 0) submitSelected();
      else context.done(null);
    }
  }

  return {
    editor,
    handleInput,
    invalidate: () => {
      cachedLines = undefined;
    },
    render(width) {
      if (cachedLines) return cachedLines;
      const renderWidth = Math.max(1, width);
      const lines = beginWidget(context.theme, renderWidth);
      appendWrappedWithPrefix(lines, " ", context.theme.fg("text", options.question), renderWidth);
      lines.push("");
      for (let i = 0; i < allOptions.length; i++) {
        const option = allOptions[i];
        const focused = i === optionIndex;
        const checked = multi && selectedIndices.has(i);
        const marker = multi ? (checked ? "☑ " : "☐ ") : focused ? "> " : "  ";
        const isOther = rowIntent(option) === "other";
        const label = `${i + 1}. ${option.label}${isOther && editMode ? " ✎" : ""}`;
        const color = focused || checked || (isOther && editMode) ? "accent" : "text";
        appendWrappedWithPrefix(
          lines,
          focused ? context.theme.fg("accent", marker) : marker,
          context.theme.fg(color, label),
          renderWidth,
        );
        if (option.description)
          appendWrappedWithPrefix(
            lines,
            "     ",
            context.theme.fg("muted", option.description),
            renderWidth,
          );
      }
      if (multi && selectedIndices.size > 0) {
        lines.push("");
        appendWrappedWithPrefix(
          lines,
          " ",
          context.theme.fg(
            "muted",
            `Selected: ${Array.from(selectedIndices)
              .map((i) => allOptions[i].label)
              .join(", ")}`,
          ),
          renderWidth,
        );
      }
      if (editMode) {
        lines.push("");
        appendWrappedWithPrefix(lines, " ", context.theme.fg("muted", "Your answer:"), renderWidth);
        for (const line of renderEditorLines(editor, renderWidth - 2)) lines.push(` ${line}`);
      }
      lines.push("");
      appendWrappedWithPrefix(
        lines,
        " ",
        context.theme.fg(
          "dim",
          editMode
            ? "Enter to submit • Esc to go back"
            : multi
              ? "↑↓ navigate • Enter toggle • Enter submit • Esc submit selected"
              : "↑↓ navigate • Enter select • Esc cancel",
        ),
        renderWidth,
      );
      cachedLines = endWidget(context.theme, renderWidth, lines);
      return cachedLines;
    },
  };
}
