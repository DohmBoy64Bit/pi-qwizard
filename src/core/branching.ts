export function _evaluateBranch(
  branch: {
    when:
      | string
      | { field: string; operator?: string; value?: unknown }
      | Array<string | { field: string; operator?: string; value?: unknown }>;
    on?: boolean;
  },
  answers: Map<string, { value: string | string[]; label: string | string[] }>,
): boolean {
  // If 'on' is explicitly set, use it
  if (branch.on === false) return false;
  if (branch.on === true) return true;

  const conditions = Array.isArray(branch.when) ? branch.when : [branch.when];

  return conditions.every((cond) => {
    if (typeof cond === "string") {
      // Parse simple string: "field_id equals value"
      return evaluateSimpleCondition(cond, answers);
    }
    if (typeof cond === "object") {
      return evaluateComplexCondition(cond, answers);
    }
    return false;
  });
}

export function evaluateSimpleCondition(
  expr: string,
  answers: Map<string, { value: string | string[] }>,
): boolean {
  // Parse: "field_id operator value"
  const match = expr.match(
    /^(.+?)\s+(equals|not_equals|contains|matches|in|is_empty|is_not_empty|gt|lt|gte|lte)\s+(.+)$/,
  );
  if (!match) return false;

  const [, field, operator, value] = match;
  const answer = answers.get(field);

  if (answer === undefined) return false; // Field not answered yet

  const answerStr = Array.isArray(answer.value) ? answer.value.join(", ") : String(answer.value);

  switch (operator) {
    case "equals":
      return answerStr === value;
    case "not_equals":
      return answerStr !== value;
    case "contains":
      return answerStr.toLowerCase().includes(value.toLowerCase());
    case "matches":
      try {
        return new RegExp(value, "i").test(answerStr);
      } catch {
        return false;
      }
    case "in":
      return value
        .split(", ")
        .map((v) => v.trim())
        .includes(answerStr);
    case "is_empty":
      return answerStr === "" || answerStr === "(no response)";
    case "is_not_empty":
      return answerStr !== "" && answerStr !== "(no response)";
    case "gt":
      return Number(answerStr) > Number(value);
    case "lt":
      return Number(answerStr) < Number(value);
    case "gte":
      return Number(answerStr) >= Number(value);
    case "lte":
      return Number(answerStr) <= Number(value);
    /* c8 ignore next 2 -- the expression grammar prevents unknown operators */
    default:
      return false;
  }
}

export function evaluateComplexCondition(
  cond: { field: string; operator?: string; value?: unknown },
  answers: Map<string, { value: string | string[] }>,
): boolean {
  const { field, operator = "equals", value } = cond;
  const answer = answers.get(field);

  if (answer === undefined) return false;

  const answerStr = Array.isArray(answer.value) ? answer.value.join(", ") : String(answer.value);

  switch (operator) {
    case "equals":
      return answerStr === String(value);
    case "not_equals":
      return answerStr !== String(value);
    case "contains":
      return answerStr.toLowerCase().includes(String(value).toLowerCase());
    case "matches":
      try {
        return new RegExp(String(value), "i").test(answerStr);
      } catch {
        return false;
      }
    case "in":
      if (Array.isArray(value)) {
        return value.map(String).includes(answerStr);
      }
      return false;
    case "is_empty":
      return answerStr === "" || answerStr === "(no response)";
    case "is_not_empty":
      return answerStr !== "" && answerStr !== "(no response)";
    case "gt":
      return Number(answerStr) > Number(value);
    case "lt":
      return Number(answerStr) < Number(value);
    case "gte":
      return Number(answerStr) >= Number(value);
    case "lte":
      return Number(answerStr) <= Number(value);
    default:
      return false;
  }
}
