export interface ValidatableOption {
  label: string;
  description?: string;
}

export interface ValidatableQuestion {
  id: string;
  label?: string;
  prompt: string;
  options: ValidatableOption[];
  type?: "single" | "multi" | "yes_no" | "rating";
  when?: unknown;
  on?: boolean;
}

export interface ValidatableQuestionnaire {
  questions: ValidatableQuestion[];
}

export type QuestionnaireValidationError =
  | "no_questions"
  | "too_many_questions"
  | "duplicate_question"
  | "empty_options"
  | "reserved_label"
  | "duplicate_option_label";

export type QuestionnaireValidationResult =
  | { ok: true }
  | { ok: false; error: QuestionnaireValidationError; message: string };

export const MAX_QUESTIONS = 4;
export const MIN_OPTIONS = 2;
export const RESERVED_LABELS = ["Other", "Type something...", "Next"] as const;
const RESERVED_LABEL_SET = new Set<string>(RESERVED_LABELS);

export function validateQuestionnaire(
  params: ValidatableQuestionnaire,
): QuestionnaireValidationResult {
  if (params.questions.length === 0) {
    return { ok: false, error: "no_questions", message: "Error: No questions provided" };
  }
  if (params.questions.length > MAX_QUESTIONS) {
    return {
      ok: false,
      error: "too_many_questions",
      message: `Error: At most ${MAX_QUESTIONS} questions are allowed per questionnaire`,
    };
  }

  const questionIds = new Set<string>();
  const questionPrompts = new Set<string>();
  for (const question of params.questions) {
    if (questionIds.has(question.id) || questionPrompts.has(question.prompt)) {
      return {
        ok: false,
        error: "duplicate_question",
        message: "Error: Question IDs must be unique",
      };
    }
    questionIds.add(question.id);
    questionPrompts.add(question.prompt);

    if (
      question.type !== "yes_no" &&
      question.type !== "rating" &&
      question.options.length < MIN_OPTIONS
    ) {
      return {
        ok: false,
        error: "empty_options",
        message: `Error: Each selectable question requires at least ${MIN_OPTIONS} options`,
      };
    }

    const optionsResult = validateOptions(question.options);
    if (optionsResult.ok === false) return optionsResult;
  }

  return { ok: true };
}

export function validateOptions(options: ValidatableOption[]): QuestionnaireValidationResult {
  const labels = new Set<string>();
  for (const option of options) {
    if (RESERVED_LABEL_SET.has(option.label)) {
      return {
        ok: false,
        error: "reserved_label",
        message: `Error: Option label is reserved (${RESERVED_LABELS.join(", ")})`,
      };
    }
    if (labels.has(option.label)) {
      return {
        ok: false,
        error: "duplicate_option_label",
        message: "Error: Option labels must be unique within a question",
      };
    }
    labels.add(option.label);
  }
  return { ok: true };
}

function normalizeText(text: string): string {
  return text.replace(/\r\n/g, "\n").replace(/\r/g, "");
}

export function normalizeQuestionnaireParams<T extends ValidatableQuestionnaire>(params: T): T {
  return {
    ...params,
    questions: params.questions.map((question) => ({
      ...question,
      id: normalizeText(question.id),
      label: question.label === undefined ? undefined : normalizeText(question.label),
      prompt: normalizeText(question.prompt),
      options: question.options.map((option) => ({
        ...option,
        label: normalizeText(option.label),
        description:
          option.description === undefined ? undefined : normalizeText(option.description),
      })),
      when:
        typeof question.when === "string"
          ? normalizeText(question.when)
          : Array.isArray(question.when)
            ? question.when.map((condition) =>
                typeof condition === "string" ? normalizeText(condition) : condition,
              )
            : question.when,
    })),
  };
}

export function normalizeOptions<T extends { options: ValidatableOption[] }>(params: T): T {
  return {
    ...params,
    options: params.options.map((option) => ({
      ...option,
      label: normalizeText(option.label),
      description: option.description === undefined ? undefined : normalizeText(option.description),
    })),
  };
}
