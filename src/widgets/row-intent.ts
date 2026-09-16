import type { DisplayOption } from "../types.js";

export type RowIntent = "option" | "other";

export function rowIntent(option: DisplayOption | undefined): RowIntent {
  return option?.isOther === true ? "other" : "option";
}
