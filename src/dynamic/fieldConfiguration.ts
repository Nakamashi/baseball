import type { DynamicSettings } from "./types";
/** User reports a tall fence, but no measured height. Keep-in-play is an
 * explicit training net, not a claim about the actual ground's boundary rule. */
export const defaultField = {
  fenceHeight: 8,
  fenceMode: "keep-in-play" as const,
};
export function fieldConfiguration(settings: DynamicSettings) {
  return settings.field ?? defaultField;
}
