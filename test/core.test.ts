import assert from "node:assert/strict";
import { test } from "node:test";
import {
  _evaluateBranch,
  evaluateComplexCondition,
  evaluateSimpleCondition,
} from "../src/core/branching.js";
import { formatPercentage } from "../src/core/formatting.js";
import { generateRatingOptions, generateYesNoOptions } from "../src/core/question-options.js";
import { errorResult, validateAnswer } from "../src/core/validation.js";
import { selectionLabel, selectionPrefix } from "../src/widgets/question-widget.js";
import { progressBar } from "../src/widgets/questionnaire-widget.js";
import { widgetHint, widgetRule } from "../src/widgets/styles.js";
import { renderEditorLines } from "../src/widgets/text-input-widget.js";

test("formatting handles normal and empty totals", () => {
  assert.equal(formatPercentage(1, 4), "25%");
  assert.equal(formatPercentage(3, 0), "0%");
});

test("special question options match the original feature contract", () => {
  assert.deepEqual(generateYesNoOptions(), [
    { label: "Yes", description: "Confirm" },
    { label: "No", description: "Decline" },
  ]);
  assert.deepEqual(generateRatingOptions(), [
    { label: "1", description: "Poor" },
    { label: "2", description: "Fair" },
    { label: "3", description: "Good" },
    { label: "4", description: "Very Good" },
    { label: "5", description: "Excellent" },
  ]);
});

test("answer validation covers length, pattern, email, and number", () => {
  assert.deepEqual(validateAnswer("a", 2), ["Answer must be at least 2 characters (currently 1)"]);
  assert.deepEqual(validateAnswer("abcd", undefined, 3), [
    "Answer must be at most 3 characters (currently 4)",
  ]);
  assert.deepEqual(validateAnswer("abc", undefined, undefined, "^\\d+$"), [
    "Answer doesn't match required pattern: ^\\d+$",
  ]);
  assert.deepEqual(validateAnswer("x", undefined, undefined, undefined, "email"), [
    "Please enter a valid email address",
  ]);
  assert.deepEqual(validateAnswer("x", undefined, undefined, undefined, "number"), [
    "Please enter a valid number",
  ]);
  assert.deepEqual(validateAnswer("ok@example.com", undefined, undefined, undefined, "email"), []);
  assert.deepEqual(validateAnswer("42", undefined, undefined, undefined, "number"), []);
  assert.deepEqual(validateAnswer("value", undefined, undefined, "["), [
    "Answer pattern is invalid",
  ]);
});

test("error results preserve message and optional details", () => {
  assert.deepEqual(errorResult("failed"), {
    content: [{ type: "text", text: "failed" }],
    details: {},
  });
  assert.deepEqual(errorResult("failed", { cancelled: true }), {
    content: [{ type: "text", text: "failed" }],
    details: { cancelled: true },
  });
});

test("branching evaluates every supported operator", () => {
  const answers = new Map([
    ["name", { value: "Alice" }],
    ["empty", { value: "" }],
    ["score", { value: "5" }],
    ["tags", { value: ["red", "blue"] }],
    ["noResponse", { value: "(no response)" }],
  ]);
  assert.equal(evaluateSimpleCondition("name equals Alice", answers), true);
  assert.equal(evaluateSimpleCondition("name not_equals Bob", answers), true);
  assert.equal(evaluateSimpleCondition("name contains lic", answers), true);
  assert.equal(evaluateSimpleCondition("name matches ^ali", answers), true);
  assert.equal(evaluateSimpleCondition("name matches [", answers), false);
  assert.equal(evaluateSimpleCondition("name in Bob, Alice", answers), true);
  assert.equal(evaluateSimpleCondition("empty is_empty x", answers), true);
  assert.equal(evaluateSimpleCondition("noResponse is_empty x", answers), true);
  assert.equal(evaluateSimpleCondition("name is_not_empty x", answers), true);
  assert.equal(evaluateSimpleCondition("noResponse is_not_empty x", answers), false);
  assert.equal(evaluateSimpleCondition("score gt 4", answers), true);
  assert.equal(evaluateSimpleCondition("score lt 6", answers), true);
  assert.equal(evaluateSimpleCondition("score gte 5", answers), true);
  assert.equal(evaluateSimpleCondition("score lte 5", answers), true);
  assert.equal(evaluateSimpleCondition("malformed", answers), false);
  assert.equal(evaluateSimpleCondition("missing equals x", answers), false);
  assert.equal(evaluateSimpleCondition("tags contains blue", answers), true);
  assert.equal(evaluateComplexCondition({ field: "name", value: "Alice" }, answers), true);
  assert.equal(
    evaluateComplexCondition({ field: "name", operator: "not_equals", value: "Bob" }, answers),
    true,
  );
  assert.equal(
    evaluateComplexCondition({ field: "name", operator: "contains", value: "LIC" }, answers),
    true,
  );
  assert.equal(
    evaluateComplexCondition({ field: "name", operator: "matches", value: "^ali" }, answers),
    true,
  );
  assert.equal(
    evaluateComplexCondition({ field: "name", operator: "matches", value: "[" }, answers),
    false,
  );
  assert.equal(
    evaluateComplexCondition({ field: "name", operator: "in", value: ["Alice"] }, answers),
    true,
  );
  assert.equal(
    evaluateComplexCondition({ field: "name", operator: "in", value: "Alice" }, answers),
    false,
  );
  assert.equal(
    evaluateComplexCondition({ field: "empty", operator: "is_empty", value: "x" }, answers),
    true,
  );
  assert.equal(
    evaluateComplexCondition({ field: "noResponse", operator: "is_empty", value: "x" }, answers),
    true,
  );
  assert.equal(
    evaluateComplexCondition({ field: "name", operator: "is_not_empty", value: "x" }, answers),
    true,
  );
  assert.equal(
    evaluateComplexCondition(
      { field: "noResponse", operator: "is_not_empty", value: "x" },
      answers,
    ),
    false,
  );
  assert.equal(
    evaluateComplexCondition({ field: "tags", operator: "contains", value: "blue" }, answers),
    true,
  );
  assert.equal(
    evaluateComplexCondition({ field: "score", operator: "gt", value: 4 }, answers),
    true,
  );
  assert.equal(
    evaluateComplexCondition({ field: "score", operator: "lt", value: 6 }, answers),
    true,
  );
  assert.equal(
    evaluateComplexCondition({ field: "score", operator: "gte", value: 5 }, answers),
    true,
  );
  assert.equal(
    evaluateComplexCondition({ field: "score", operator: "lte", value: 5 }, answers),
    true,
  );
  assert.equal(evaluateComplexCondition({ field: "missing", value: "x" }, answers), false);
  assert.equal(
    evaluateComplexCondition({ field: "name", operator: "unknown", value: "x" }, answers),
    false,
  );
  assert.equal(_evaluateBranch({ on: false, when: "name equals Alice" }, answers), false);
  assert.equal(_evaluateBranch({ on: true, when: "name equals Bob" }, answers), true);
  assert.equal(
    _evaluateBranch(
      { when: ["name equals Alice", { field: "score", operator: "gte", value: 5 }] },
      answers,
    ),
    true,
  );
  assert.equal(_evaluateBranch({ when: { field: "name", value: "Alice" } }, answers), true);
  assert.equal(_evaluateBranch({ when: [42] } as any, answers), false);
});

test("shared widgets provide consistent layout primitives", () => {
  const theme = { fg: (name: string, value: string) => `<${name}>${value}` };
  assert.equal(widgetRule(theme, 3), "<accent>───");
  assert.equal(widgetHint(theme, "help"), "<dim>help");
  assert.equal(selectionPrefix(theme, true), "<accent>> ");
  assert.equal(selectionPrefix(theme, false), "  ");
  assert.equal(selectionLabel(1, "Choice", true), "2. Choice ✎");
  assert.equal(selectionLabel(1, "Choice", false), "2. Choice");
  assert.equal(progressBar(theme, 1, 2, 8), "<accent>█░ 50% (1/2)");
  assert.deepEqual(renderEditorLines({ render: (width) => [`${width}`] }, 0), ["1"]);
});
