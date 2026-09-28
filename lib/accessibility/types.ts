export const ACCESSIBILITY_TOOL = "Guardian HTML accessibility 1.0.0 / parse5 8.0.1";
export const ACCESSIBILITY_RULES = {
  "document-language": {
    title: "Document language is missing",
    severity: "MEDIUM",
    fix: "Set the html lang attribute to the page's primary language.",
  },
  "document-title": {
    title: "Document title is missing",
    severity: "MEDIUM",
    fix: "Provide a concise, meaningful title for the page.",
  },
  "image-alternative": {
    title: "Images need text alternatives",
    severity: "MEDIUM",
    fix: 'Add meaningful alt text to informative images, or alt="" for genuinely decorative images.',
  },
  "form-label": {
    title: "Form controls need accessible labels",
    severity: "HIGH",
    fix: "Associate a descriptive label with each control using label/for, a wrapping label, or an appropriate ARIA name.",
  },
  "control-name": {
    title: "Interactive controls need accessible names",
    severity: "HIGH",
    fix: "Provide visible descriptive text or an appropriate accessible name for the button or link.",
  },
  "empty-heading": {
    title: "Headings need meaningful text",
    severity: "LOW",
    fix: "Give headings meaningful content or remove empty heading elements.",
  },
} as const;
export type AccessibilityRule = keyof typeof ACCESSIBILITY_RULES;
export type AccessibilityFinding = { rule: AccessibilityRule; count: number; examples: string[] };
export type AccessibilitySnapshot = {
  state: "CHECKED" | "UNKNOWN";
  checkedAt: string;
  page: string;
  tool: string;
  scope: "SERVER_HTML_SINGLE_PAGE";
  findings: AccessibilityFinding[];
  elements: number;
  reason?: string;
};
export type AccessibilityConfig = {
  accessibility?: AccessibilitySnapshot;
  accessibilityLastKnown?: AccessibilitySnapshot;
};
