import assert from "node:assert/strict";
import test from "node:test";
import {
  createQuestionnaireState,
  type QuestionnaireStateQuestion,
  reduceQuestionnaireState,
} from "../src/state/questionnaire-state.js";

const questions: QuestionnaireStateQuestion[] = [
  { id: "first", visible: true, optionCount: 2 },
  { id: "hidden", visible: false, optionCount: 1 },
  { id: "last", visible: true, optionCount: 3 },
];

test("questionnaire state advances over hidden questions and records them", () => {
  const initial = createQuestionnaireState(questions.length);
  const result = reduceQuestionnaireState(initial, { type: "next" }, questions);

  assert.equal(result.state.tab, 2);
  assert.deepEqual(result.state.skipped, ["hidden"]);
});

test("questionnaire state clamps option movement to available options", () => {
  const initial = { ...createQuestionnaireState(questions.length), tab: 2, option: 1 };
  const result = reduceQuestionnaireState(
    initial,
    { type: "move-option", direction: 1 },
    questions,
  );

  assert.equal(result.state.option, 2);
});

test("questionnaire state saves an answer and clears multi-selection on advance", () => {
  const initial = {
    ...createQuestionnaireState(questions.length),
    tab: 0,
    selected: new Set([0, 1]),
  };
  const result = reduceQuestionnaireState(
    initial,
    { type: "answer", answer: { id: "first", value: "yes", label: "Yes", wasCustom: false } },
    questions,
  );

  assert.equal(result.state.answers.get("first")?.label, "Yes");
  assert.equal(result.state.selected.size, 2);
  assert.equal(result.state.tab, 0);
});
