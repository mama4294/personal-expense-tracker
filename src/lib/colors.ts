/**
 * Colours a person can be assigned. These are the same eight hues the charts
 * use as their categorical slots — already checked as a set for lightness band,
 * chroma, colourblind separation, and normal-vision separation against the
 * white card surface — so picking one can't produce an unreadable chart.
 */
export const PERSON_COLORS = [
  { value: "#2a78d6", label: "Blue" },
  { value: "#e87ba4", label: "Pink" },
  { value: "#1baf7a", label: "Teal" },
  { value: "#eb6834", label: "Orange" },
  { value: "#4a3aa7", label: "Violet" },
  { value: "#eda100", label: "Amber" },
  { value: "#008300", label: "Green" },
  { value: "#e34948", label: "Red" },
] as const;

export type PersonColor = (typeof PERSON_COLORS)[number]["value"];

export const DEFAULT_PERSON_COLOR: PersonColor = PERSON_COLORS[0].value;

export function isPersonColor(value: string): value is PersonColor {
  return PERSON_COLORS.some((colour) => colour.value === value);
}

/** Falls back to the palette head so a chart never renders with no colour. */
export function personColor(color: string | null | undefined): string {
  return color && isPersonColor(color) ? color : DEFAULT_PERSON_COLOR;
}

/** Spreads people across the palette so two people rarely start out alike. */
export function nextPersonColor(taken: (string | null)[]): PersonColor {
  const used = new Set(taken.filter(Boolean));
  return (
    PERSON_COLORS.find((colour) => !used.has(colour.value))?.value ??
    DEFAULT_PERSON_COLOR
  );
}

export function colorLabel(value: string): string {
  return PERSON_COLORS.find((colour) => colour.value === value)?.label ?? "Custom";
}
