import {
  RecordContractError,
  checkParseOutput,
  checkRecord,
  checkRecordSet,
  expectedAbsent,
  inapplicable,
  keyOf,
  makeRecord,
  present,
  unknown,
  unparseable,
  type Cell,
  type ParsedRecord,
} from "../../src/record/index.js";
import { Entry, Item, Section, span } from "./fixtures.js";

const section = (id: number, cells: Partial<Record<"label" | "enabled", Cell>> = {}, region: "whole" | "fragment" = "whole") =>
  makeRecord(
    Section,
    { id: present(id), label: cells.label ?? present("x"), enabled: cells.enabled ?? present(true) },
    { spans: [span(id * 10, id * 10 + 9, id)], region },
  );

describe("makeRecord", () => {
  it("builds a record carrying span provenance and region-completeness (REQ-021)", () => {
    const r = section(1);
    expect(r.type).toBe("section");
    expect(r.provenance).toEqual({ spans: [span(10, 19, 1)], region: "whole" });
  });

  it("normalizes provenance spans", () => {
    const r = makeRecord(
      Section,
      { id: present(1), label: present("x"), enabled: present(true) },
      { spans: [span(5, 9, 2), span(0, 5, 1)], region: "whole" },
    );
    expect(r.provenance.spans).toEqual([span(0, 9, 1, 2)]);
  });

  it("returns a deeply frozen record", () => {
    const r = section(1);
    expect(Object.isFrozen(r)).toBe(true);
    expect(Object.isFrozen(r.cells)).toBe(true);
    expect(Object.isFrozen(r.provenance)).toBe(true);
    expect(Object.isFrozen(r.provenance.spans)).toBe(true);
  });

  it("throws with every issue listed when the record breaks the contract", () => {
    try {
      makeRecord(Section, { id: present("one") }, { spans: [], region: "whole" });
      expect.unreachable();
    } catch (e) {
      expect(e).toBeInstanceOf(RecordContractError);
      const codes = (e as RecordContractError).issues.map((i) => i.code).sort();
      expect(codes).toEqual(["missing-cell", "missing-cell", "no-provenance", "value-type"]);
    }
  });
});

describe("checkRecord", () => {
  const good = section(1);
  const withCells = (cells: Record<string, unknown>): ParsedRecord =>
    ({ ...good, cells: { ...good.cells, ...cells } }) as ParsedRecord;

  it("accepts a valid record", () => {
    expect(checkRecord(Section, good)).toEqual([]);
  });

  it("requires every declared column to carry a cell, so absence is always explicit (REQ-020)", () => {
    const { label: _drop, ...rest } = good.cells;
    expect(checkRecord(Section, { ...good, cells: rest }).map((i) => i.code)).toEqual(["missing-cell"]);
  });

  it("rejects a cell for an undeclared column (REQ-003a)", () => {
    expect(checkRecord(Section, withCells({ extra: present("x") })).map((i) => i.code)).toEqual(["undeclared-column"]);
  });

  it("rejects a record naming a different type", () => {
    expect(checkRecord(Section, { ...good, type: "entry" }).map((i) => i.code)).toEqual(["type-mismatch"]);
  });

  it.each([
    ["text column given a number", { label: present(1) }],
    ["integer column given a string", { id: present("1") }],
    ["integer column given a fraction", { id: present(1.5) }],
    ["integer column given an unsafe integer", { id: present(2 ** 53) }],
    ["boolean column given a string", { enabled: present("true") }],
  ])("rejects a %s", (_n, cells) => {
    expect(checkRecord(Section, withCells(cells)).map((i) => i.code)).toContain("value-type");
  });

  it("rejects a null standing in for absence", () => {
    expect(checkRecord(Section, withCells({ label: null })).map((i) => i.code)).toEqual(["bad-cell"]);
  });

  it("rejects an unknown cell kind", () => {
    expect(checkRecord(Section, withCells({ label: { kind: "missing" } })).map((i) => i.code)).toEqual(["bad-cell"]);
  });

  it("accepts every absence state in a non-key column of a whole-region record", () => {
    for (const c of [inapplicable(), unknown(), expectedAbsent(), unparseable("zz", [span(12, 14, 1)])]) {
      expect(checkRecord(Section, withCells({ label: c }))).toEqual([]);
    }
  });

  it("refuses expected-absent in a fragment record, since absence there is not negative information (A.5)", () => {
    const frag = { ...section(1, {}, "fragment"), cells: { ...good.cells, label: expectedAbsent() } };
    expect(checkRecord(Section, frag).map((i) => i.code)).toEqual(["closed-world-in-fragment"]);
  });

  it("allows unknown in a fragment record", () => {
    expect(checkRecord(Section, section(1, { label: unknown() }, "fragment"))).toEqual([]);
  });

  it("requires a key column to be present or inapplicable (REQ-052)", () => {
    for (const c of [unknown(), expectedAbsent(), unparseable("?")]) {
      expect(checkRecord(Section, withCells({ id: c })).map((i) => i.code)).toEqual(["indeterminate-key"]);
    }
    expect(checkRecord(Section, withCells({ id: inapplicable() }))).toEqual([]);
  });

  it("requires provenance spans, well-formed and normalized", () => {
    const codes = (spans: unknown) =>
      checkRecord(Section, { ...good, provenance: { spans, region: "whole" } } as ParsedRecord).map((i) => i.code);
    expect(codes([])).toEqual(["no-provenance"]);
    expect(codes([span(5, 4, 1)])).toEqual(["bad-span"]);
    expect(codes([span(5, 9, 2), span(0, 5, 1)])).toEqual(["spans-not-normal"]);
  });

  it("rejects an unknown region value", () => {
    const r = { ...good, provenance: { ...good.provenance, region: "partial" } } as unknown as ParsedRecord;
    expect(checkRecord(Section, r).map((i) => i.code)).toEqual(["bad-region"]);
  });
});

describe("keyOf", () => {
  it("is the tuple of key cells in declared key order", () => {
    const e = makeRecord(
      Entry,
      { scope: present("g"), owner: present("A"), seq: present(10), action: present("go") },
      { spans: [span(0, 1, 1)], region: "fragment" },
    );
    expect(keyOf(Entry, e)).toBe(JSON.stringify([{ v: "g" }, { v: "A" }, { v: 10 }]));
  });

  it("distinguishes an integer from its text, and inapplicable from any value", () => {
    const mk = (scope: Cell) =>
      makeRecord(
        Entry,
        { scope, owner: present("A"), seq: present(1), action: present("go") },
        { spans: [span(0, 1, 1)], region: "fragment" },
      );
    const keys = new Set([keyOf(Entry, mk(present("1"))), keyOf(Entry, mk(present("null"))), keyOf(Entry, mk(inapplicable()))]);
    expect(keys.size).toBe(3);
  });
});

describe("checkRecordSet", () => {
  it("accepts an ordered set with distinct keys", () => {
    expect(checkRecordSet({ type: Section, records: [section(2), section(1)] })).toEqual([]);
  });

  it("rejects two records with one identity, which is an unfolded grain", () => {
    const issues = checkRecordSet({ type: Section, records: [section(1), section(1)] });
    expect(issues.map((i) => i.code)).toEqual(["duplicate-key"]);
    expect(issues[0]?.path).toBe("records[1]");
  });

  it("reports record issues with their position", () => {
    const bad = { ...section(1), type: "entry" };
    expect(checkRecordSet({ type: Section, records: [section(2), bad] })[0]?.path).toBe("records[1]");
  });
});

describe("checkParseOutput", () => {
  const item = (sectionId: number, value: string) =>
    makeRecord(
      Item,
      { section_id: present(sectionId), value: present(value) },
      { spans: [span(sectionId * 10 + 2, sectionId * 10 + 4, sectionId)], region: "fragment" },
    );
  const sections = { type: Section, records: [section(1), section(2)] };

  it("accepts child records whose foreign key names an enclosing record (REQ-050)", () => {
    expect(checkParseOutput({ recordSets: [sections, { type: Item, records: [item(1, "a"), item(2, "a")] }] })).toEqual([]);
  });

  it("rejects a child record whose foreign key names no parent record", () => {
    const issues = checkParseOutput({ recordSets: [sections, { type: Item, records: [item(3, "a")] }] });
    expect(issues.map((i) => i.code)).toEqual(["orphan-child"]);
  });

  it("rejects a child set whose parent set is missing", () => {
    expect(checkParseOutput({ recordSets: [{ type: Item, records: [] }] }).map((i) => i.code)).toEqual(["missing-parent-set"]);
  });

  it("rejects a foreign key whose arity or types differ from the parent key", () => {
    const WrongType = { ...Item, columns: [{ name: "section_id", type: "text" }, { name: "value", type: "text" }] } as typeof Item;
    const issues = checkParseOutput({ recordSets: [sections, { type: WrongType, records: [] }] });
    expect(issues.map((i) => i.code)).toEqual(["foreign-key-shape"]);
  });

  it("rejects two record sets of the same type", () => {
    expect(checkParseOutput({ recordSets: [sections, sections] }).map((i) => i.code)).toEqual(["duplicate-record-set"]);
  });
});
