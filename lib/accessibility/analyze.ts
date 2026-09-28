import { parse, type DefaultTreeAdapterTypes } from "parse5";
import { ACCESSIBILITY_TOOL, type AccessibilityRule, type AccessibilitySnapshot } from "./types";
type Node = DefaultTreeAdapterTypes.Node;
type Element = DefaultTreeAdapterTypes.Element;
const element = (node: Node): node is Element => "tagName" in node;
const attr = (node: Element, name: string) => node.attrs.find((a) => a.name === name)?.value;
const clean = (text: string) => text.replace(/[\s\u200b-\u200d\ufeff]+/g, " ").trim();
const excludedTags = new Set(["script", "style", "template", "noscript"]);

/** Static HTML heuristics only; no scripts, stylesheets or subresources are executed/fetched. */
export function analyzeAccessibility(
  html: string,
  page: string,
  checkedAt = new Date().toISOString(),
): AccessibilitySnapshot {
  const base: AccessibilitySnapshot = {
    state: "UNKNOWN",
    checkedAt,
    page,
    tool: ACCESSIBILITY_TOOL,
    scope: "SERVER_HTML_SINGLE_PAGE",
    findings: [],
    elements: 0,
  };
  const deadline = Date.now() + 1000;
  function budget() {
    if (Date.now() > deadline) throw Error("HTML analysis exceeded its time limit.");
  }
  try {
    if (Buffer.byteLength(html, "utf8") > 262144)
      throw Error("HTML exceeds the 256 KiB scan limit.");
    const root = parse(html, { sourceCodeLocationInfo: true });
    const nodes: Element[] = [],
      hidden = new Set<Node>(),
      ids = new Map<string, Element>(),
      parents = new Map<Node, Element>();
    const stack: { node: Node; hide: boolean; depth: number; parent?: Element }[] = [
      { node: root, hide: false, depth: 0 },
    ];
    while (stack.length) {
      budget();
      const item = stack.pop()!,
        node = item.node;
      if (item.depth > 100) throw Error("HTML exceeds the 100-level nesting limit.");
      let hide = item.hide;
      if (element(node)) {
        nodes.push(node);
        if (nodes.length > 10000) throw Error("HTML exceeds the 10,000-element scan limit.");
        const style = (attr(node, "style") ?? "").toLowerCase();
        hide =
          hide ||
          excludedTags.has(node.tagName) ||
          attr(node, "hidden") !== undefined ||
          attr(node, "inert") !== undefined ||
          (attr(node, "aria-hidden") ?? "").toLowerCase() === "true" ||
          /(?:^|;)\s*(?:display\s*:\s*none|visibility\s*:\s*(?:hidden|collapse))\s*(?:!important\s*)?(?:;|$)/.test(
            style,
          );
        const id = attr(node, "id");
        if (id && !ids.has(id)) ids.set(id, node);
      }
      if (hide) hidden.add(node);
      if (item.parent) parents.set(node, item.parent);
      if ("childNodes" in node)
        for (const child of [...node.childNodes].reverse())
          stack.push({
            node: child,
            hide,
            depth: item.depth + 1,
            parent: element(node) ? node : item.parent,
          });
    }
    base.elements = nodes.length;
    function text(node: Node, allowHidden = false, depth = 0): string {
      budget();
      if (depth > 100) return "";
      if (!allowHidden && hidden.has(node)) return "";
      if (node.nodeName === "#text") return (node as DefaultTreeAdapterTypes.TextNode).value;
      if (element(node)) {
        if (excludedTags.has(node.tagName)) return "";
        if (node.tagName === "img") return attr(node, "alt") ?? "";
        if (["input", "select", "textarea"].includes(node.tagName)) return "";
      }
      return "childNodes" in node
        ? node.childNodes.map((c) => text(c, allowHidden, depth + 1)).join(" ")
        : "";
    }
    const labels = new Map<string, Element[]>();
    for (const node of nodes) {
      budget();
      const target = attr(node, "for");
      if (node.tagName === "label" && target)
        labels.set(target, [...(labels.get(target) ?? []), node]);
    }
    function name(node: Element, content = false): string {
      const labelled = attr(node, "aria-labelledby");
      if (labelled) {
        const value = clean(
          labelled
            .split(/\s+/)
            .map((id) => ids.get(id))
            .filter((n): n is Element => !!n)
            .map((n) => text(n, true))
            .join(" "),
        );
        if (value) return value;
      }
      const aria = clean(attr(node, "aria-label") ?? "");
      if (aria) return aria;
      if (["input", "select", "textarea", "button"].includes(node.tagName)) {
        const explicit = clean(
          (labels.get(attr(node, "id") ?? "") ?? []).map((l) => text(l)).join(" "),
        );
        if (explicit) return explicit;
        let parent = parents.get(node);
        while (parent) {
          if (parent.tagName === "label") {
            const implicit = clean(text(parent));
            if (implicit) return implicit;
          }
          parent = parents.get(parent);
        }
      }
      if (
        node.tagName === "img" ||
        (node.tagName === "input" && attr(node, "type")?.toLowerCase() === "image")
      ) {
        const alt = clean(attr(node, "alt") ?? "");
        if (alt) return alt;
      }
      if (
        node.tagName === "input" &&
        ["button", "submit", "reset"].includes(attr(node, "type")?.toLowerCase() ?? "")
      ) {
        const value = attr(node, "value");
        if (value !== undefined) return clean(value);
        if (["submit", "reset"].includes(attr(node, "type")!.toLowerCase()))
          return "Browser default label";
      }
      if (content) {
        const value = clean(text(node));
        if (value) return value;
      }
      return clean(attr(node, "title") ?? "");
    }
    const findings = new Map<
      AccessibilityRule,
      { rule: AccessibilityRule; count: number; examples: string[] }
    >();
    function add(rule: AccessibilityRule, node: Element) {
      const finding = findings.get(rule) ?? { rule, count: 0, examples: [] };
      finding.count++;
      const location = node.sourceCodeLocation;
      if (finding.examples.length < 5)
        finding.examples.push(
          location
            ? `<${node.tagName}> at line ${location.startLine}, column ${location.startCol}`
            : `<${node.tagName}> (implied element)`,
        );
      findings.set(rule, finding);
    }
    const htmlNode = nodes.find((n) => n.tagName === "html")!;
    if (!clean(attr(htmlNode, "lang") ?? "")) add("document-language", htmlNode);
    const title = nodes.find((n) => n.tagName === "title" && parents.get(n)?.tagName === "head");
    if (!title || !clean(text(title, true))) add("document-title", title ?? htmlNode);
    for (const node of nodes) {
      budget();
      if (hidden.has(node)) continue;
      const tag = node.tagName,
        type = (attr(node, "type") ?? "text").toLowerCase(),
        role = (attr(node, "role") ?? "").toLowerCase();
      if (tag === "input" && type === "hidden") continue;
      if (tag === "img") {
        const decorative =
          attr(node, "alt") === "" ||
          (["none", "presentation"].includes(role) && attr(node, "tabindex") === undefined);
        if (!decorative && !name(node)) add("image-alternative", node);
      }
      const inputButton = tag === "input" && ["button", "submit", "reset", "image"].includes(type);
      if ((tag === "input" && !inputButton) || tag === "select" || tag === "textarea") {
        if (!name(node)) add("form-label", node);
      } else if (
        tag === "button" ||
        (tag === "a" && attr(node, "href") !== undefined) ||
        inputButton ||
        ["button", "link"].includes(role)
      ) {
        if (!name(node, true)) add("control-name", node);
      }
      if (/^h[1-6]$/.test(tag) && !name(node, true)) add("empty-heading", node);
    }
    return { ...base, state: "CHECKED", findings: [...findings.values()] };
  } catch (error) {
    return {
      ...base,
      reason:
        error instanceof Error && /^(HTML analysis|HTML exceeds)/.test(error.message)
          ? error.message
          : "HTML could not be analyzed completely.",
    };
  }
}
