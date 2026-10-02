import {
  RecordContractError,
  expectedAbsent,
  inapplicable,
  makeRecord,
  mergeCells,
  mergeRecords,
  present,
  unknown,
  unparseable,
  type Cell,
} from "../../src/record/index.js";
import { Entry, span } from "./fixtures.js";

// REQ-023a: tagged values for one record fold under a defined merge, with REQ-020 deciding what absence means.
// The v1 fold is shaped so the deferred knowledge-order join (REQ-023b, A.6) extends it rather than replaces it.

const all: Cell[] = [
  present("a"),
  present("b"),
  present(1),
  inapplicable(),
  unknown(),
  expectedAbsent(),
  unparseable("r"),
  unparseable("q"),
];

const cellOf = (r: ReturnType<typeof mergeCells>) => (r.ok ? r.cell : "conflict");

describe("mergeCells", () => {
  it("treats unknown as no information: it yields to anything", () => {
    for (const c of all) {
      expect(cellOf(mergeCells(unknown(), c))).toEqual(c);
      expect(cellOf(mergeCells(c, unknown()))).toEqual(c);
    }
  });

  it("is idempotent", () => {
    for (const c of all) expect(cellOf(mergeCells(c, c))).toEqual(c);
  });

  it("is commutative", () => {
    for (const a of all) for (const b of all) expect(cellOf(mergeCells(a, b))).toEqual(cellOf(mergeCells(b, a)));
  });

  it("is associative", () => {
    const m = (a: Cell | "conflict", b: Cell | "conflict") => (a === "conflict" || b === "conflict" ? "conflict" : cellOf(mergeCells(a, b)));
    for (const a of all) for (const b of all) for (const c of all) expect(m(m(a, b), c)).toEqual(m(a, m(b, c)));
  });

  it("reports a conflict rather than picking a winner", () => {
    const conflicts: [Cell, Cell][] = [
      [present("a"), present("b")],
      [present("1"), present(1)],
      [present("a"), inapplicable()],
      [present("a"), expectedAbsent()],
      [present("a"), unparseable("a")],
      [inapplicable(), expectedAbsent()],
      [unparseable("r"), unparseable("q")],
    ];
    for (const [a, b] of conflicts) expect(mergeCells(a, b).ok).toBe(false);
  });

  it("unions the spans of equal values", () => {
    const r = mergeCells(present("a", [span(0, 5, 1)]), present("a", [span(5, 9, 2)]));
    expect(r).toEqual({ ok: true, cell: present("a", [span(0, 9, 1, 2)]) });
  });
});

describe("mergeRecords", () => {
  const entry = (cells: { action: Cell }, spanStart: number, region: "whole" | "fragment" = "fragment") =>
    makeRecord(
      Entry,
      { scope: present("g"), owner: present("A"), seq: present(10), ...cells },
      { spans: [span(spanStart, spanStart + 5, spanStart + 1)], region },
    );

  it("folds two fragments of one entity into one record with both provenances", () => {
    const r = mergeRecords(Entry, entry({ action: unknown() }, 0), entry({ action: present("go") }, 20));
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.record.cells.action).toEqual(present("go"));
    expect(r.record.provenance.spans).toEqual([span(0, 5, 1), span(20, 25, 21)]);
    expect(r.record.provenance.region).toBe("fragment");
  });

  it("marks the fold whole when any part consumed a whole region", () => {
    const r = mergeRecords(Entry, entry({ action: expectedAbsent() }, 0, "whole"), entry({ action: unknown() }, 20));
    expect(r.ok && r.record.provenance.region).toBe("whole");
    expect(r.ok && r.record.cells.action).toEqual(expectedAbsent());
  });

  it("returns every conflicting column instead of a record", () => {
    const r = mergeRecords(Entry, entry({ action: present("go") }, 0), entry({ action: present("stop") }, 20));
    expect(r).toEqual({ ok: false, conflicts: [{ column: "action", a: present("go"), b: present("stop") }] });
  });

  it("refuses to fold records with different identities", () => {
    const other = makeRecord(
      Entry,
      { scope: present("g"), owner: present("A"), seq: present(20), action: unknown() },
      { spans: [span(0, 1, 1)], region: "fragment" },
    );
    expect(() => mergeRecords(Entry, entry({ action: unknown() }, 0), other)).toThrow(RecordContractError);
  });
});
