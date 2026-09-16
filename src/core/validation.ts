export function errorResult(
  message: string,
  details?: Record<string, unknown>,
): {
  content: { type: "text"; text: string }[];
  details: Record<string, unknown>;
} {
  return {
    content: [{ type: "text", text: message }],
    details: details ?? {},
  };
}

export function validateAnswer(
  value: string,
  minLength?: number,
  maxLength?: number,
  pattern?: string,
  inputType?: string,
): string[] {
  const errors: string[] = [];
  const trimmed = value.trim();

  if (minLength !== undefined && trimmed.length < minLength) {
    errors.push(`Answer must be at least ${minLength} characters (currently ${trimmed.length})`);
  }
  if (maxLength !== undefined && trimmed.length > maxLength) {
    errors.push(`Answer must be at most ${maxLength} characters (currently ${trimmed.length})`);
  }
  if (pattern) {
    try {
      const regex = new RegExp(pattern);
      if (!regex.test(trimmed)) errors.push(`Answer doesn't match required pattern: ${pattern}`);
    } catch {
      errors.push("Answer pattern is invalid");
    }
  }
  if (inputType === "email" && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) {
    errors.push("Please enter a valid email address");
  }
  if (inputType === "number" && Number.isNaN(Number(trimmed))) {
    errors.push("Please enter a valid number");
  }

  return errors;
}
