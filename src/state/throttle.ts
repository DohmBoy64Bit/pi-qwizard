const lastQuestionTime = new Map<string, number>();

export function checkThrottle(cooldown: number): { waited: boolean; elapsed: number } {
  const now = Date.now();
  const last = lastQuestionTime.get("__global__") ?? 0;
  const elapsed = (now - last) / 1000;
  if (elapsed < cooldown) return { waited: true, elapsed };
  lastQuestionTime.set("__global__", now);
  return { waited: false, elapsed };
}

export function recordQuestionTime(): void {
  lastQuestionTime.set("__global__", Date.now());
}

export function clearQuestionTime(): void {
  lastQuestionTime.delete("__global__");
}
