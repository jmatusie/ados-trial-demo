import { checkSpan, compareCodePoints, normalizeSpans, spansAreNormal } from "../../src/record/index.js";

const s = (source: string, start: number, end: number, startLine: number, endLine: number) => ({
  source,
  start,
  end,
  startLine,
  endLine,
});

// REQ-021: provenance names input lines and byte ranges. The source name keeps a record mergeable across parses later (Section 4.2).

describe("span", () => {
  it("accepts a well-formed span", () => {
    expect(checkSpan(s("in", 0, 10, 1, 2))).toEqual([]);
  });

  it("accepts a zero-width span", () => {
    expect(checkSpan(s("in", 4, 4, 1, 1))).toEqual([]);
  });

  it.each([
    ["empty source", s("", 0, 1, 1, 1)],
    ["negative start", s("in", -1, 1, 1, 1)],
    ["end before start", s("in", 5, 4, 1, 1)],
    ["fractional offset", s("in", 0.5, 1, 1, 1)],
    ["zero line", s("in", 0, 1, 0, 1)],
    ["end line before start line", s("in", 0, 1, 3, 2)],
  ])("rejects %s", (_name, span) => {
    expect(checkSpan(span).length).toBeGreaterThan(0);
  });
});

describe("normalizeSpans", () => {
  it("sorts by source, then start, then end", () => {
    const out = normalizeSpans([s("b", 0, 1, 1, 1), s("a", 20, 25, 3, 3), s("a", 0, 5, 1, 1)]);
    expect(out).toEqual([s("a", 0, 5, 1, 1), s("a", 20, 25, 3, 3), s("b", 0, 1, 1, 1)]);
  });

  it("coalesces overlapping and adjacent spans within one source", () => {
    const out = normalizeSpans([s("a", 5, 12, 2, 2), s("a", 0, 5, 1, 1), s("a", 10, 20, 2, 3)]);
    expect(out).toEqual([s("a", 0, 20, 1, 3)]);
  });

  it("never coalesces across sources", () => {
    const out = normalizeSpans([s("a", 0, 5, 1, 1), s("b", 5, 10, 1, 1)]);
    expect(out).toHaveLength(2);
  });

  it("is idempotent and order-independent", () => {
    const input = [s("a", 30, 40, 4, 4), s("a", 0, 10, 1, 1), s("a", 10, 15, 2, 2)];
    const once = normalizeSpans(input);
    expect(normalizeSpans(once)).toEqual(once);
    expect(normalizeSpans([...input].reverse())).toEqual(once);
    expect(spansAreNormal(once)).toBe(true);
    expect(spansAreNormal(input)).toBe(false);
  });
});

describe("compareCodePoints (REQ-061: ordering is specified, not inherited from the host)", () => {
  it("orders by Unicode code point rather than UTF-16 code unit", () => {
    // U+FF61 is one code unit; U+1F600 is a surrogate pair starting 0xD83D. Code-unit order would put the emoji first.
    expect(compareCodePoints("｡", "\u{1F600}")).toBeLessThan(0);
    expect(compareCodePoints("a", "b")).toBeLessThan(0);
    expect(compareCodePoints("ab", "a")).toBeGreaterThan(0);
    expect(compareCodePoints("x", "x")).toBe(0);
  });
});
