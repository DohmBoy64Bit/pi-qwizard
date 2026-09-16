/**
 * Questions Extension - A suite of tools for interactive user Q&A
 *
 * Provides three tools:
 *  - question       : Single question with selectable options (+ custom text)
 *  - questionnaire  : Multi-question wizard with tab navigation
 *  - question_input : Open-ended text input for free-form answers
 *
 * Usage: Call any tool from the LLM when user input is needed to proceed.
 *        The tools render full custom TUI interfaces.
 */

// ─── Shared Types ───────────────────────────────────────────────────────────

export interface QOption {
  label: string;
  description?: string;
}

export type QuestionOption = QOption;

export type DisplayOption = QOption & {
  isOther?: boolean;
  value?: string;
  count?: number; // For multi-select
};

export interface QuestionResult {
  question: string;
  options: string[];
  answer: string | string[] | null;
  wasCustom: boolean;
  index?: number;
  [key: string]: unknown;
}

export interface QuestionnaireResult {
  questions: Array<{ id: string; label: string; prompt: string }>;
  answers: Array<{
    id: string;
    value: string | string[];
    label: string | string[];
    wasCustom: boolean;
    index?: number;
  }>;
  cancelled: boolean;
}

export interface QuestionInputResult {
  question: string;
  answer: string | null;
  validationErrors?: string[];
  [key: string]: unknown;
}

export interface QuestionThrottleResult {
  question: string;
  options: string[];
  answer: string | string[] | null;
  wasCustom: boolean;
  index?: number;
  throttled: boolean;
  [key: string]: unknown;
}

export interface QuestionBranchResult {
  questions: Array<{ id: string; label: string; prompt: string }>;
  answers: Array<{
    id: string;
    value: string | string[];
    label: string | string[];
    wasCustom: boolean;
    index?: number;
  }>;
  skipped: string[];
  cancelled: boolean;
}
