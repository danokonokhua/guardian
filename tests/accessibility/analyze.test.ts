import { describe, expect, it } from "vitest";
import { analyzeAccessibility } from "@/lib/accessibility/analyze";
import { parseMonitorConfig } from "@/lib/monitor-config";
const page = "https://example.com/";
const document = (body: string) =>
  `<!doctype html><html lang="en"><head><title>Useful page</title></head><body>${body}</body></html>`;
const rules = (html: string) => analyzeAccessibility(html, page).findings.map((f) => f.rule);
describe("bounded static accessibility checks", () => {
  it("does not mistake an SVG icon title for the document title", () => {
    expect(
      rules('<html lang="en"><body><svg><title>Menu icon</title></svg></body></html>'),
    ).toEqual(["document-title"]);
  });
  it("reports six supported rules and retains only bounded non-content evidence", () => {
    const result = analyzeAccessibility(
      '<html><body><img src="SECRET"><input value="PRIVATE"><button></button><h2></h2></body></html>',
      page,
    );
    expect(result.state).toBe("CHECKED");
    expect(result.findings.map((f) => f.rule).sort()).toEqual([
      "control-name",
      "document-language",
      "document-title",
      "empty-heading",
      "form-label",
      "image-alternative",
    ]);
    expect(JSON.stringify(result)).not.toMatch(/SECRET|PRIVATE/);
  });
  it("respects decorative images and controls hidden by their ancestors", () => {
    expect(
      rules(
        document(
          '<img alt=""><img role="presentation"><img role="none"><div hidden><input><button></button><img></div><div aria-hidden="true"><input><img></div><div inert><button></button></div><div style="display: none !important"><input></div><div style="visibility:hidden"><img></div><input type="hidden"><template><img><input></template><script>"<input>"</script>',
        ),
      ),
    ).toEqual([]);
  });
  it("does not treat a decorative image as a functional link name", () => {
    expect(rules(document('<a href="/"><img alt=""></a>'))).toEqual(["control-name"]);
  });
  it("accepts native explicit, implicit and ARIA labels including hidden references", () => {
    expect(
      rules(
        document(
          '<label for="a">Email</label><input id="a"><label>Name<input></label><span id="n" hidden>Search</span><input aria-labelledby="n"><input aria-label="Message"><textarea title="Comments"></textarea><label for="s">Country</label><select id="s"></select>',
        ),
      ),
    ).toEqual([]);
  });
  it("does not accept placeholder or ordinary input value as its label", () => {
    const findings = analyzeAccessibility(
      document(
        '<input placeholder="Name"><input value="Name"><label for="empty"></label><input id="empty">',
      ),
      page,
    ).findings;
    expect(findings).toMatchObject([{ rule: "form-label", count: 3 }]);
  });
  it("accepts icon alternatives, SVG titles, submit defaults and named custom buttons", () => {
    expect(
      rules(
        document(
          '<button><img alt="Search"></button><button><svg><title>Menu</title></svg></button><input type="submit"><input type="reset"><input type="image" alt="Send"><div role="button" aria-label="Close"></div><a href="/" title="Home"></a>',
        ),
      ),
    ).toEqual([]);
  });
  it("flags empty image inputs, empty button values and custom controls", () => {
    expect(
      analyzeAccessibility(
        document(
          '<input type="image"><input type="button" value=" "><div role="button"></div><input type="submit" value="">',
        ),
        page,
      ).findings,
    ).toMatchObject([{ rule: "control-name", count: 4 }]);
  });
  it("counts findings while retaining only five example locations per rule", () => {
    const result = analyzeAccessibility(document("<img>".repeat(100)), page);
    expect(result.findings[0]).toMatchObject({ rule: "image-alternative", count: 100 });
    expect(result.findings[0]?.examples).toHaveLength(5);
  });
  it("rejects excessive HTML bytes and nesting without reporting a clean result", () => {
    expect(analyzeAccessibility("a".repeat(262145), page).state).toBe("UNKNOWN");
    expect(analyzeAccessibility(document("<div>".repeat(110)), page).state).toBe("UNKNOWN");
  });
  it("handles malformed HTML and encoded label text through an HTML parser", () => {
    expect(
      rules(
        document("<label for=x>&#78;ame</label><input id=x><button><span>Save &amp; close</span>"),
      ),
    ).toEqual([]);
  });
  it("never executes scripts", () => {
    expect(
      rules(document('<script>throw new Error("executed")</script><button>Save</button>')),
    ).toEqual([]);
  });
  it("requires read-only configuration and at least hourly scans", () => {
    const input = { websiteId: "38ed7924-5682-41a9-9b33-b251c08892da", type: "ACCESSIBILITY" };
    expect(parseMonitorConfig(input).frequencyMinutes).toBe(1440);
    expect(() => parseMonitorConfig({ ...input, frequencyMinutes: 5 })).toThrow();
    expect(() =>
      parseMonitorConfig({ ...input, config: { accessibility: { state: "CHECKED" } } }),
    ).toThrow();
  });
});
