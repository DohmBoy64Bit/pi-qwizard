export interface SelectionTheme {
  fg(name: string, value: string): string;
}

export function selectionPrefix(theme: SelectionTheme, selected: boolean): string {
  return selected ? theme.fg("accent", "> ") : "  ";
}

export function selectionLabel(index: number, label: string, editing = false): string {
  return `${index + 1}. ${label}${editing ? " ✎" : ""}`;
}
