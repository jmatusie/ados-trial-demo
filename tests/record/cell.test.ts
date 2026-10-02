import {
  ABSENCE_STATES,
  expectedAbsent,
  inapplicable,
  isAbsent,
  present,
  simpleValue,
  unknown,
  unparseable,
} from "../../src/record/index.js";

// REQ-020: absence is a tagged four-state value, never a single null.

describe("four-state absence (REQ-020)", () => {
  it("names exactly the four states the specification defines", () => {
    expect([...ABSENCE_STATES]).toEqual([
      "inapplicable",
      "unknown",
      "expected-absent",
      "present-unparseable",
    ]);
  });

  it("keeps every absence state distinguishable from every other", () => {
    const cells = [inapplicable(), unknown(), expectedAbsent(), unparseable("x")];
    const kinds = new Set(cells.map((c) => c.kind));
    expect(kinds.size).toBe(4);
    for (const c of cells) expect(isAbsent(c)).toBe(true);
  });

  it("treats a present value as not absent, including falsy values", () => {
    for (const v of ["", 0, false]) expect(isAbsent(present(v))).toBe(false);
  });

  it("carries the raw text and its spans for a present-unparseable cell", () => {
    const span = { source: "s", start: 3, end: 7, startLine: 1, endLine: 1 };
    const cell = unparseable("abcd", [span]);
    expect(cell).toEqual({ kind: "present-unparseable", raw: "abcd", spans: [span] });
  });

  it("offers a simple presentation that is only a view, not a collapse of the model", () => {
    expect(simpleValue(present("v"))).toBe("v");
    expect(simpleValue(present(0))).toBe(0);
    for (const c of [inapplicable(), unknown(), expectedAbsent(), unparseable("x")]) {
      expect(simpleValue(c)).toBeNull();
    }
    // The full state is still on the cell after a simple read.
    const c = expectedAbsent();
    simpleValue(c);
    expect(c.kind).toBe("expected-absent");
  });

  it("returns frozen cells", () => {
    expect(Object.isFrozen(present("v"))).toBe(true);
    expect(Object.isFrozen(unknown())).toBe(true);
  });
});
