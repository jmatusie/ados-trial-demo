import {
  RECORD_CONTRACT_VERSION,
  RecordContractError,
  decodeParseOutput,
  encodeParseOutput,
  expectedAbsent,
  inapplicable,
  makeRecord,
  present,
  unknown,
  unparseable,
  type ParseOutput,
} from "../../src/record/index.js";
import { Item, Section, span } from "./fixtures.js";

// REQ-053: the record is the contract between tiers, so it has one serialized form every core must produce byte for byte.

const output: ParseOutput = {
  recordSets: [
    {
      type: Section,
      records: [
        makeRecord(
          Section,
          { id: present(1), label: present("café \"q\""), enabled: expectedAbsent() },
          { spans: [span(0, 20, 1, 3)], region: "whole" },
        ),
        makeRecord(
          Section,
          { id: present(2), label: unparseable("??", [span(25, 27, 4)]), enabled: unknown() },
          { spans: [span(21, 30, 4)], region: "fragment" },
        ),
      ],
    },
    {
      type: Item,
      records: [
        makeRecord(Item, { section_id: present(1), value: present("a", [span(5, 6, 2)]) }, { spans: [span(4, 8, 2)], region: "fragment" }),
      ],
    },
  ],
};

describe("canonical encoding", () => {
  it("carries the contract version", () => {
    expect(RECORD_CONTRACT_VERSION).toBe("xv2.record/1");
    expect(JSON.parse(encodeParseOutput(output)).contract).toBe(RECORD_CONTRACT_VERSION);
  });

  it("round-trips through decode", () => {
    const text = encodeParseOutput(output);
    const back = decodeParseOutput(text);
    expect(back).toEqual(output);
    expect(encodeParseOutput(back)).toBe(text);
  });

  it("emits cells in declared column order regardless of object insertion order", () => {
    const shuffled = makeRecord(
      Section,
      { enabled: inapplicable(), label: present("x"), id: present(9) },
      { spans: [span(0, 1, 1)], region: "fragment" },
    );
    const text = encodeParseOutput({ recordSets: [{ type: Section, records: [shuffled] }] });
    const cells = JSON.parse(text).recordSets[0].records[0].cells;
    expect(cells.map((c: [string, unknown]) => c[0])).toEqual(["id", "label", "enabled"]);
  });

  it("has no insignificant whitespace and emits non-ASCII text literally", () => {
    const text = encodeParseOutput(output);
    expect(text).not.toMatch(/\n|": /);
    expect(text).toContain("café");
  });

  it("escapes only quote, backslash and control characters, with lowercase hex", () => {
    const rec = makeRecord(
      Section,
      { id: present(1), label: present("\"\\\u0001\u001f\n\t é"), enabled: unknown() },
      { spans: [span(0, 1, 1)], region: "fragment" },
    );
    const text = encodeParseOutput({ recordSets: [{ type: Section, records: [rec] }] });
    expect(text).toContain('"value":"\\"\\\\\\u0001\\u001f\\n\\t é"');
  });

  it("is pinned to an exact byte form for a small case", () => {
    const one: ParseOutput = {
      recordSets: [
        {
          type: Section,
          records: [
            makeRecord(
              Section,
              { id: present(7), label: inapplicable(), enabled: present(false) },
              { spans: [span(0, 4, 1)], region: "whole" },
            ),
          ],
        },
      ],
    };
    expect(encodeParseOutput(one)).toBe(
      '{"contract":"xv2.record/1","recordSets":[{"type":{"name":"section","columns":[["id","integer"],["label","text"],["enabled","boolean"]],"key":["id"]},' +
        '"records":[{"cells":[["id",{"kind":"present","value":7,"spans":[]}],["label",{"kind":"inapplicable"}],["enabled",{"kind":"present","value":false,"spans":[]}]],' +
        '"provenance":{"region":"whole","spans":[["input",0,4,1,1]]}}]}]}',
    );
  });

  it("refuses to decode a different contract version", () => {
    const text = encodeParseOutput(output).replace(RECORD_CONTRACT_VERSION, "xv2.record/0");
    expect(() => decodeParseOutput(text)).toThrow(RecordContractError);
  });

  it("refuses to decode output that breaks the contract", () => {
    const text = encodeParseOutput(output).replace('"value":1,', '"value":"1",');
    expect(() => decodeParseOutput(text)).toThrow(RecordContractError);
  });

  it("refuses to encode output that breaks the contract", () => {
    const bad = { recordSets: [output.recordSets[1]!] };
    expect(() => encodeParseOutput(bad)).toThrow(RecordContractError);
  });
});
