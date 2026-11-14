/**
 * Design tokens — gouache/paper palette matched to the garden art.
 * Import these instead of per-file colour constants.
 */
export const C = {
  paper: "#F5F0E6", // screen background — warm paper
  card: "#FFFDF8", // cards, sheets
  ink: "#22302A",
  sub: "#5E6B60",
  faint: "#8C9387",
  line: "#E4DCCB",
  spruce: "#2F4A3A", // headers, active tab, selected state
  sage: "#8FA58A",
  sageSoft: "#E3E8DA", // chips, user bubbles
  wood: "#8A6A4A",
  lake: "#6F95A8",
  sun: "#E9C46A",
  green: "#007841", // S-Pankki green — primary CTA only
  terra: "#B5654A", // attention — never bright red
  white: "#FFFFFF",
} as const;

export const R = {
  card: 18,
  sheet: 18,
  chip: 999,
} as const;

/** Soft warm shadow — replaces hairline borders on cards/sheets. */
export const SHADOW = {
  shadowColor: "#5A4A30",
  shadowOpacity: 0.08,
  shadowRadius: 12,
  shadowOffset: { width: 0, height: 4 },
  elevation: 2,
} as const;

export const FONT = {
  display: "Fraunces_600SemiBold",
  body: "Figtree_500Medium",
  semi: "Figtree_600SemiBold",
  bold: "Figtree_700Bold",
} as const;
