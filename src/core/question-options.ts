import type { QuestionOption } from "../types.js";

export function generateYesNoOptions(): QuestionOption[] {
  return [
    { label: "Yes", description: "Confirm" },
    { label: "No", description: "Decline" },
  ];
}

export function generateRatingOptions(): QuestionOption[] {
  return [
    { label: "1", description: "Poor" },
    { label: "2", description: "Fair" },
    { label: "3", description: "Good" },
    { label: "4", description: "Very Good" },
    { label: "5", description: "Excellent" },
  ];
}
