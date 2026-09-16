export function formatPercentage(current: number, total: number): string {
  if (total === 0) return "0%";
  return `${Math.round((current / total) * 100)}%`;
}
