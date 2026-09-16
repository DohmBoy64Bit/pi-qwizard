import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { registerQuestionTool } from "./question.js";
import { registerQuestionBranchTool } from "./question-branch.js";
import { registerQuestionInputTool } from "./question-input.js";
import { registerQuestionThrottleTool } from "./question-throttle.js";
import { registerQuestionnaireTool } from "./questionnaire.js";

export function registerTools(pi: ExtensionAPI): void {
  registerQuestionTool(pi);
  registerQuestionnaireTool(pi);
  registerQuestionInputTool(pi);
  registerQuestionThrottleTool(pi);
  registerQuestionBranchTool(pi);
}
