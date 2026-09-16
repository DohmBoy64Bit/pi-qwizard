import assert from "node:assert/strict";
import { test } from "node:test";
import { registerQuestionTool } from "../src/tools/question.js";
import { registerQuestionBranchTool } from "../src/tools/question-branch.js";
import { registerQuestionInputTool } from "../src/tools/question-input.js";
import { registerQuestionThrottleTool } from "../src/tools/question-throttle.js";
import { registerQuestionnaireTool } from "../src/tools/questionnaire.js";
import { createPiHarness } from "./test-harness.js";

test("question executes the shared selection widget and preserves selection result shape", async () => {
  const h = createPiHarness();
  registerQuestionTool(h.pi);
  const promise = h.tools[0].execute(
    "id",
    { question: "Pick", options: [{ label: "One" }, { label: "Two" }] },
    null,
    null,
    h.ctx,
  );
  h.ctx.lastComponent.handleInput("\u001b[B");
  h.ctx.lastComponent.handleInput("\r");
  const result = await promise;
  assert.equal(result.details.answer, "Two");
  assert.equal(result.details.index, 2);
});

test("question_input uses overlay mode and returns a trimmed answer", async () => {
  const h = createPiHarness();
  registerQuestionInputTool(h.pi);
  const promise = h.tools[0].execute("id", { question: "Name", required: true }, null, null, h.ctx);
  h.ctx.lastComponent.editor.onSubmit?.("  Ada  ");
  const result = await promise;
  assert.equal(result.details.answer, "Ada");
});

test("question tool returns the non-TUI error contract", async () => {
  const h = createPiHarness();
  registerQuestionTool(h.pi);
  const result = await h.tools[0].execute(
    "id",
    { question: "Pick", options: [{ label: "One" }] },
    null,
    null,
    { ...h.ctx, mode: "rpc" },
  );
  assert.equal(result.details.answer, null);
  assert.match(result.content[0].text, /UI not available/);
});

test("question_throttle records and returns a throttled result without duplicating the widget", async () => {
  const h = createPiHarness();
  registerQuestionThrottleTool(h.pi);
  const promise = h.tools[0].execute(
    "id",
    { question: "Pick", options: [{ label: "One" }], cooldown: 0 },
    null,
    null,
    h.ctx,
  );
  h.ctx.lastComponent.handleInput("\r");
  const result = await promise;
  assert.equal(result.details.answer, "One");
  assert.equal(result.details.throttled, false);
});

test("questionnaire executes the shared questionnaire widget across tabs", async () => {
  const h = createPiHarness();
  registerQuestionnaireTool(h.pi);
  const promise = h.tools[0].execute(
    "id",
    {
      questions: [
        { id: "first", prompt: "First", options: [{ label: "A" }, { label: "A2" }] },
        { id: "second", prompt: "Second", options: [{ label: "B" }, { label: "B2" }] },
      ],
    },
    null,
    null,
    h.ctx,
  );
  h.ctx.lastComponent.handleInput("\r");
  h.ctx.lastComponent.handleInput("\r");
  h.ctx.lastComponent.handleInput("\r");
  const result = await promise;
  assert.deepEqual(
    result.details.answers.map((answer: any) => answer.id),
    ["first", "second"],
  );
});

test("question_branch uses the shared widget and records hidden questions as skipped", async () => {
  const h = createPiHarness();
  registerQuestionBranchTool(h.pi);
  const promise = h.tools[0].execute(
    "id",
    {
      questions: [
        { id: "kind", prompt: "Kind", options: [{ label: "A" }, { label: "A2" }] },
        {
          id: "hidden",
          prompt: "Hidden",
          options: [{ label: "B" }, { label: "B2" }],
          when: "kind equals Never",
        },
      ],
    },
    null,
    null,
    h.ctx,
  );
  h.ctx.lastComponent.handleInput("\r");
  h.ctx.lastComponent.handleInput("\r");
  const result = await promise;
  assert.deepEqual(result.details.skipped, ["hidden"]);
});

test("shared-tool renderers cover call, result, and cancellation presentations", () => {
  const h = createPiHarness();
  registerQuestionTool(h.pi);
  registerQuestionInputTool(h.pi);
  registerQuestionThrottleTool(h.pi);
  for (const tool of h.tools) {
    tool.renderCall?.({ question: "Prompt", options: [{ label: "One" }] }, h.theme, {});
    tool.renderResult?.(
      { content: [{ type: "text", text: "cancelled" }], details: { answer: null } },
      {},
      h.theme,
      {},
    );
  }
});
