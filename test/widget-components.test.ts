import assert from "node:assert/strict";
import { test } from "node:test";
import { Key } from "@earendil-works/pi-tui";
import { createQuestionnaireWidget } from "../src/widgets/questionnaire-widget.js";
import { createSelectionWidget } from "../src/widgets/selection-widget.js";
import { createTextInputWidget } from "../src/widgets/text-input-widget.js";

const theme = {
  fg: (name: string, value: string) => `<${name}>${value}`,
  bg: (_name: string, value: string) => value,
  bold: (value: string) => value,
};

const keys = {
  up: Key.up,
  down: Key.down,
  enter: Key.enter,
  escape: Key.escape,
  tab: Key.tab,
  left: Key.left,
  right: Key.right,
};

test("selection widget renders focus and checkbox state and submits a multi-selection", () => {
  let result: unknown;
  const tui = { requestRender() {} };
  const component = createSelectionWidget(
    {
      question: "Pick tools",
      options: [
        { label: "Pi", description: "Agent" },
        { label: "TUI", description: "Terminal UI" },
      ],
      multi: true,
    },
    { tui, theme, keys, done: (value: unknown) => (result = value) },
  );

  component.handleInput("\r");
  assert.match(component.render(40).join("\n"), /☑ .*1\. Pi/);
  component.handleInput("\u001b[B");
  component.handleInput("\r");
  component.handleInput("\r");
  assert.deepEqual(result, { answer: ["Pi", "TUI"], wasCustom: false });
});

test("text input widget exposes validation errors and submits trimmed text", () => {
  let result: unknown;
  const tui = { requestRender() {} };
  const component = createTextInputWidget(
    { question: "Email", required: true, type: "email" },
    {
      tui,
      theme,
      keys,
      editor: {
        value: "bad",
        handleInput() {},
        getText() {
          return this.value;
        },
        setText(value: string) {
          this.value = value;
        },
        render(width: number) {
          return [this.value.slice(0, width)];
        },
        onSubmit: undefined,
      },
      done: (value: unknown) => (result = value),
    },
  );

  component.editor.onSubmit?.("bad");
  assert.match(component.render(40).join("\n"), /valid email/);
  component.editor.onSubmit?.(" good@example.com ");
  assert.deepEqual(result, { answer: "good@example.com" });
});

test("questionnaire widget shares tab, answer, and submit state", () => {
  let result: unknown;
  const component = createQuestionnaireWidget(
    {
      questions: [
        { id: "a", label: "A", prompt: "First", options: [{ label: "Yes" }] },
        { id: "b", label: "B", prompt: "Second", options: [{ label: "No" }] },
      ],
      isVisible: () => true,
    },
    { tui: { requestRender() {} }, theme, keys, done: (value: unknown) => (result = value) },
  );
  component.handleInput("\r");
  component.handleInput("\r");
  component.handleInput("\r");
  const questionnaire = result as { answers: Array<{ id: string }> };
  assert.deepEqual(
    questionnaire.answers.map((answer) => answer.id),
    ["a", "b"],
  );
});
