import assert from "node:assert/strict";
import test from "node:test";
import {
  normalizeQuestionnaireParams,
  type ValidatableQuestionnaire,
  validateQuestionnaire,
} from "../src/core/questionnaire-validation.js";

const question = (overrides: Partial<ValidatableQuestionnaire["questions"][number]> = {}) => ({
  id: "one",
  prompt: "Choose one",
  options: [{ label: "Yes" }, { label: "No" }],
  ...overrides,
});

test("rejects empty questionnaires", () => {
  assert.equal(validateQuestionnaire({ questions: [] }).error, "no_questions");
});

test("rejects duplicate question identifiers", () => {
  const result = validateQuestionnaire({
    questions: [question(), question({ prompt: "Another" })],
  });
  assert.equal(result.error, "duplicate_question");
});

test("rejects duplicate option labels and reserved labels", () => {
  assert.equal(
    validateQuestionnaire({
      questions: [question({ options: [{ label: "Yes" }, { label: "Yes" }] })],
    }).error,
    "duplicate_option_label",
  );
  assert.equal(
    validateQuestionnaire({
      questions: [question({ options: [{ label: "Type something..." }, { label: "Other" }] })],
    }).error,
    "reserved_label",
  );
});

test("normalizes carriage returns without mutating input", () => {
  const input = {
    questions: [question({ prompt: "Line\r\nTwo", options: [{ label: "A\rB" }, { label: "C" }] })],
  };
  const normalized = normalizeQuestionnaireParams(input);
  assert.equal(normalized.questions[0].prompt, "Line\nTwo");
  assert.equal(normalized.questions[0].options[0].label, "AB");
  assert.equal(input.questions[0].prompt, "Line\r\nTwo");
});
