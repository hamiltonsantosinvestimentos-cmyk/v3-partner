import type { IntakeSection, SectionCondition } from "./schema-registry";

export type FormState = Record<string, string | number | boolean | undefined>;

/** Returns true if the section should be visible given the current form state and active tags. */
export function isSectionVisible(
  section: IntakeSection,
  state: FormState,
  activeTags: string[]
): boolean {
  const cond: SectionCondition | undefined = section.condition;
  if (!cond) return true;

  if (cond.tag) {
    return activeTags.includes(cond.tag);
  }

  if (cond.field_equals) {
    const { key, value } = cond.field_equals;
    return String(state[key] ?? "") === value;
  }

  return true;
}

/** Derive active tags from form state (sector + sub_sector passed as extra state fields). */
export function deriveActiveTags(
  schemaTags: string[],
  state: FormState
): string[] {
  const tags = new Set<string>(schemaTags);

  // If the form has an explicit "is_startup" toggle
  if (state["is_startup"] === true || state["is_startup"] === "true") {
    tags.add("startup");
  }

  // If empresa has MRR filled → likely a startup
  const mrr = Number(state["mrr_atual_brl"] ?? 0);
  if (mrr > 0) tags.add("startup");

  return Array.from(tags);
}

/** Return only the sections that are visible under the current state. */
export function getVisibleSections(
  sections: IntakeSection[],
  state: FormState,
  activeTags: string[]
): IntakeSection[] {
  return sections.filter((s) => isSectionVisible(s, state, activeTags));
}
