import {
  Editor,
  type EditorTheme,
  matchesKey,
  visibleWidth,
  wrapTextWithAnsi,
} from "@earendil-works/pi-tui";
import { validateAnswer } from "../core/validation.js";
import { widgetRule } from "./styles.js";

export interface RenderableEditor {
  render(width: number): string[];
}

export function renderEditorLines(editor: RenderableEditor, width: number): string[] {
  return editor.render(Math.max(1, width));
}

export interface TextInputTheme {
  fg(name: string, value: string): string;
}

export interface TextInputContext {
  tui: { requestRender(): void };
  theme: TextInputTheme;
  keys: { escape: string };
  editor?: Editor;
  done(value: unknown): void;
}

export interface TextInputOptions {
  question: string;
  placeholder?: string;
  required?: boolean;
  minLength?: number;
  maxLength?: number;
  pattern?: string;
  type?: string;
}

export function createTextInputWidget(options: TextInputOptions, context: TextInputContext) {
  const editorTheme: EditorTheme = {
    borderColor: (s) => context.theme.fg("accent", s),
    selectList: {
      selectedPrefix: (t) => context.theme.fg("accent", t),
      selectedText: (t) => context.theme.fg("accent", t),
      description: (t) => context.theme.fg("muted", t),
      scrollInfo: (t) => context.theme.fg("dim", t),
      noMatch: (t) => context.theme.fg("warning", t),
    },
  };
  const editor = context.editor ?? new Editor(context.tui as never, editorTheme);
  let errors: string[] = [];
  let cachedLines: string[] | undefined;
  const refresh = () => {
    cachedLines = undefined;
    context.tui.requestRender();
  };

  editor.onSubmit = (value) => {
    const answer = value.trim();
    errors = validateAnswer(
      answer,
      options.minLength,
      options.maxLength,
      options.pattern,
      options.type,
    );
    if (errors.length > 0 || (options.required !== false && !answer)) {
      if (!answer && options.required !== false) errors = ["Answer is required", ...errors];
      refresh();
      return;
    }
    context.done({ answer });
  };

  return {
    editor,
    invalidate: () => {
      cachedLines = undefined;
    },
    handleInput(data: string) {
      if (matchesKey(data, context.keys.escape)) {
        context.done(null);
        return;
      }
      editor.handleInput(data);
      refresh();
    },
    render(width: number): string[] {
      if (cachedLines) return cachedLines;
      const renderWidth = Math.max(1, width);
      const lines = [widgetRule(context.theme, renderWidth)];
      const append = (prefix: string, text: string) => {
        const prefixWidth = visibleWidth(prefix);
        const wrapped = wrapTextWithAnsi(text, Math.max(1, renderWidth - prefixWidth));
        const continuation = " ".repeat(prefixWidth);
        for (let i = 0; i < wrapped.length; i++)
          lines.push(`${i === 0 ? prefix : continuation}${wrapped[i]}`);
      };
      append(" ", context.theme.fg("text", options.question));
      lines.push("");
      const value = editor.getText().trim();
      const count = `${value.length}/${options.maxLength ?? "∞"}`;
      append(
        " ",
        context.theme.fg(
          "dim",
          options.minLength !== undefined || options.maxLength !== undefined
            ? count
            : `type: ${options.type ?? "text"}`,
        ),
      );
      if (options.placeholder) {
        lines.push("");
        append(" ", context.theme.fg("dim", options.placeholder));
      }
      lines.push("");
      append(" ", context.theme.fg("muted", "Your answer:"));
      for (const line of renderEditorLines(editor, renderWidth - 2)) lines.push(` ${line}`);
      for (const error of errors) {
        lines.push("");
        append(" ", context.theme.fg("warning", `⚠ ${error}`));
      }
      lines.push("");
      append(" ", context.theme.fg("dim", "Enter to submit • Esc to cancel"));
      lines.push(widgetRule(context.theme, renderWidth));
      cachedLines = lines;
      return lines;
    },
  };
}
