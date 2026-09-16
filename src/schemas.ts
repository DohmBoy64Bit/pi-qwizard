import { StringEnum } from "@earendil-works/pi-ai";
import { Type } from "typebox";

// ─── Schema Definitions ─────────────────────────────────────────────────────

export const OptionSchema = Type.Object({
  label: Type.String({ description: "Display label for the option" }),
  description: Type.Optional(
    Type.String({ description: "Optional description shown below label" }),
  ),
});

export const QuestionParams = Type.Object({
  question: Type.String({ description: "The question to ask the user" }),
  options: Type.Array(OptionSchema, {
    description: "Options for the user to choose from",
  }),
  allowOther: Type.Optional(
    Type.Boolean({ description: "Include 'Type something...' option (default: true)" }),
  ),
  type: Type.Optional(StringEnum(["single", "multi"] as const), {
    description: "Selection type: single or multiple (default: single)",
  }),
});

export const QuestionnaireParams = Type.Object({
  questions: Type.Array(
    Type.Object({
      id: Type.String({
        description: 'Unique identifier, e.g. "primary_user", "core_differentiator"',
      }),
      label: Type.Optional(
        Type.String({
          description: "Short label for tab bar, e.g. 'Scope', 'Priority' (defaults to Q1, Q2...)",
        }),
      ),
      prompt: Type.String({
        description: "The full question text to display",
      }),
      options: Type.Array(OptionSchema, {
        description: "Available options to choose from",
      }),
      allowOther: Type.Optional(
        Type.Boolean({ description: "Allow 'Type something...' option (default: true)" }),
      ),
      required: Type.Optional(
        Type.Boolean({ description: "Whether this question must be answered (default: true)" }),
      ),
      autoAdvance: Type.Optional(
        Type.Boolean({
          description: "Auto-advance to next question after selection (default: true)",
        }),
      ),
      when: Type.Optional(
        Type.String({
          description: "Conditional visibility: expression like 'field_id equals value'",
        }),
      ),
      type: Type.Optional(StringEnum(["single", "multi", "yes_no", "rating"] as const), {
        description: "Question type: single, multi, yes_no, or rating (default: single)",
      }),
    }),
    { description: "Questions to ask the user in sequence" },
  ),
});

export const QuestionInputParams = Type.Object({
  question: Type.String({
    description: "The question or prompt for the user to answer",
  }),
  placeholder: Type.Optional(
    Type.String({
      description: "Placeholder text shown in the input field",
    }),
  ),
  required: Type.Optional(
    Type.Boolean({ description: "Whether the answer must be non-empty (default: true)" }),
  ),
  minLength: Type.Optional(Type.Number({ description: "Minimum character count for the answer" })),
  maxLength: Type.Optional(Type.Number({ description: "Maximum character count for the answer" })),
  pattern: Type.Optional(Type.String({ description: "Regex pattern the answer must match" })),
  type: Type.Optional(StringEnum(["text", "number", "email", "date"] as const), {
    description: "Input type for validation (default: text)",
  }),
});

// ─── Throttle Schema ─────────────────────────────────────────────────────────

export const QuestionThrottleParams = Type.Object({
  question: Type.String({ description: "The question to ask the user" }),
  options: Type.Array(OptionSchema, {
    description: "Options for the user to choose from",
  }),
  cooldown: Type.Optional(
    Type.Number({ description: "Minimum seconds between questions (default: 5)" }),
  ),
  allowOther: Type.Optional(
    Type.Boolean({ description: "Include 'Type something...' option (default: true)" }),
  ),
  type: Type.Optional(StringEnum(["single", "multi"] as const), {
    description: "Selection type: single or multiple (default: single)",
  }),
});

// ─── Branch Schema ───────────────────────────────────────────────────────────

const _BranchConditionSchema = Type.String({
  description:
    "Condition expression like 'field_id equals value'. Also supports object { field, operator, value }",
});

export const QuestionBranchParams = Type.Object({
  questions: Type.Array(
    Type.Object({
      id: Type.String({
        description: 'Unique identifier, e.g. "primary_user", "core_differentiator"',
      }),
      label: Type.Optional(
        Type.String({
          description: "Short label for tab bar, e.g. 'Scope', 'Priority' (defaults to Q1, Q2...)",
        }),
      ),
      prompt: Type.String({
        description: "The full question text to display",
      }),
      options: Type.Array(OptionSchema, {
        description: "Available options to choose from",
      }),
      allowOther: Type.Optional(
        Type.Boolean({ description: "Allow 'Type something...' option (default: true)" }),
      ),
      required: Type.Optional(
        Type.Boolean({ description: "Whether this question must be answered (default: true)" }),
      ),
      autoAdvance: Type.Optional(
        Type.Boolean({
          description: "Auto-advance to next question after selection (default: true)",
        }),
      ),
      when: Type.Optional(
        (Type as any).Union([
          Type.String({
            description:
              "Condition expression: 'field_id equals value'. Also supports object {field, operator, value} or array.",
          }),
          Type.Object({
            field: Type.String({ description: "Answer field to check" }),
            operator: Type.Optional(
              Type.String({ description: "Comparison operator (default: equals)" }),
            ),
            value: (Type as any).Unknown({ description: "Value to compare against" }),
          }),
          Type.Array(
            (Type as any).Union([
              Type.String(),
              Type.Object({
                field: Type.String(),
                operator: Type.Optional(Type.String()),
                value: (Type as any).Unknown(),
              }),
            ]),
          ),
        ]),
        {
          description:
            "Conditional visibility: show/hide based on previous answers. Supports 'when' condition and 'on' override.",
        },
      ),
      on: Type.Optional(
        Type.Boolean({
          description: "If true, always show; if false, always hide (overrides when)",
        }),
      ),
      type: Type.Optional(StringEnum(["single", "multi", "yes_no", "rating"] as const), {
        description: "Question type: single, multi, yes_no, or rating (default: single)",
      }),
    }),
    { description: "Questions to ask the user in sequence" },
  ),
});
