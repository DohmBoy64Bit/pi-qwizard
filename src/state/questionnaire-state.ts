import type { QuestionnaireResult } from "../types.js";

export interface QuestionnaireStateQuestion {
  id: string;
  visible: boolean;
  optionCount: number;
}

export interface QuestionnaireState {
  tab: number;
  option: number;
  answers: Map<string, QuestionnaireResult["answers"][number]>;
  selected: Set<number>;
  skipped: string[];
}

export type QuestionnaireStateAction =
  | { type: "next" }
  | { type: "previous" }
  | { type: "move-option"; direction: 1 | -1 }
  | { type: "toggle-option"; index: number }
  | { type: "answer"; answer: QuestionnaireResult["answers"][number] }
  | { type: "clear-selection" };

export interface QuestionnaireStateTransition {
  state: QuestionnaireState;
  completed: boolean;
}

export function createQuestionnaireState(_questionCount: number): QuestionnaireState {
  return {
    tab: 0,
    option: 0,
    answers: new Map(),
    selected: new Set(),
    skipped: [],
  };
}

function move(
  state: QuestionnaireState,
  direction: 1 | -1,
  questions: QuestionnaireStateQuestion[],
): QuestionnaireStateTransition {
  let tab = state.tab + direction;
  const skipped = [...state.skipped];
  while (tab >= 0 && tab < questions.length && !questions[tab].visible) {
    if (!skipped.includes(questions[tab].id)) skipped.push(questions[tab].id);
    tab += direction;
  }
  return {
    state: {
      ...state,
      tab: Math.max(0, Math.min(questions.length, tab)),
      option: 0,
      skipped,
      selected: new Set(),
    },
    completed: tab >= questions.length,
  };
}

export function reduceQuestionnaireState(
  state: QuestionnaireState,
  action: QuestionnaireStateAction,
  questions: QuestionnaireStateQuestion[],
): QuestionnaireStateTransition {
  if (action.type === "next") return move(state, 1, questions);
  if (action.type === "previous") return move(state, -1, questions);
  if (action.type === "move-option") {
    const count = questions[state.tab]?.optionCount ?? 0;
    return {
      state: {
        ...state,
        option: Math.max(0, Math.min(Math.max(0, count - 1), state.option + action.direction)),
      },
      completed: false,
    };
  }
  if (action.type === "toggle-option") {
    const selected = new Set(state.selected);
    if (selected.has(action.index)) selected.delete(action.index);
    else selected.add(action.index);
    return { state: { ...state, selected }, completed: false };
  }
  if (action.type === "answer") {
    const answers = new Map(state.answers);
    answers.set(action.answer.id, action.answer);
    return { state: { ...state, answers }, completed: false };
  }
  return { state: { ...state, selected: new Set() }, completed: false };
}
